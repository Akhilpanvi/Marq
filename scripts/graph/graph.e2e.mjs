// End-to-end test of the self-contained architecture map (graphify-out/graph.html).
//   node scripts/graph/graph.e2e.mjs [path-to-graph.html]
// Env: GRAPH_SHOTS=<dir>  saves screenshots (default, hover, pinned, light theme) there.
//      CHROME=<path>      overrides the headless chromium executable.
// Needs only playwright-core and the headless chromium already in ~/Library/Caches/ms-playwright.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'

const file = resolve(process.argv[2] ?? 'graphify-out/graph.html')
assert(existsSync(file), `graph file not found: ${file}`)
const URL_ = pathToFileURL(file).href
const SHOTS = process.env.GRAPH_SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME
  const cache = join(homedir(), 'Library/Caches/ms-playwright')
  const shell = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell')).sort().pop()
  assert(shell, `no chromium_headless_shell folder in ${cache}`)
  const chrome = readdirSync(join(cache, shell)).find((d) => d.startsWith('chrome-'))
  assert(chrome, `no chrome-* folder in ${join(cache, shell)}`)
  return join(cache, shell, chrome, 'chrome-headless-shell')
}

const errors = []
const requests = []
let passed = 0
async function step(name, fn) {
  process.stdout.write(`• ${name} … `)
  try {
    await fn()
    assert.deepEqual(errors, [], `console/page errors: ${errors.join(' | ')}`)
    assert.deepEqual(requests, [], `network requests made: ${requests.join(', ')}`)
  } catch (e) {
    console.log('FAILED')
    console.error(`  step: ${name}\n  ${e && e.message ? e.message : e}`)
    await browser?.close().catch(() => {})
    process.exit(1)
  }
  passed++
  console.log('ok')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TID = (id) => `[data-testid="${id}"]`
const CARD = TID('node-card')

// WCAG relative luminance / contrast
function parseRgb(s) {
  const m = s.match(/rgba?\(([^)]+)\)/)
  assert(m, `cannot parse colour "${s}"`)
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
}
function lum({ r, g, b }) {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const browser = await chromium.launch({ executablePath: findChrome() })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })
page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:') && !r.url().startsWith('about:')) requests.push(r.url()) })

async function load() {
  await page.goto(URL_)
  await page.waitForFunction(() => window.__graphReady === true, null, { timeout: 10000 }).catch(() => {
    throw new Error('window.__graphReady did not become true within 10s')
  })
}
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) }) }
const selected = () => page.evaluate(() => window.__graph.selected())
const visibleCount = () => page.evaluate(() => window.__graph.visibleCount())
const getGraph = () => page.evaluate(() => (typeof GRAPH !== 'undefined' ? GRAPH : null))
const cardRects = () => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => {
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
  const vis = r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01
  return { id: el.dataset.id, x: r.left, y: r.top, w: r.width, h: r.height, vis, fs: parseFloat(cs.fontSize) }
}), CARD)
// centre of a card that is actually hit-testable at its centre point
const hittableCard = () => page.evaluate((sel) => {
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2, y = r.top + r.height / 2
    if (r.width < 1 || x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
    const hit = document.elementFromPoint(x, y)
    if (hit && (el === hit || el.contains(hit))) return { id: el.dataset.id, x, y }
  }
  return null
}, CARD)
const panelText = () => page.locator(TID('details-panel')).innerText()

let G = null
let total = 0

await step('loads with no console/page errors, no network, __graphReady < 10s', async () => {
  await load()
  assert(await page.locator(TID('graph-root')).count() === 1, 'missing [data-testid=graph-root]')
  await sleep(300)
})

await step('cards: count, labels, unique ids, stats line', async () => {
  G = await getGraph()
  const cards = page.locator(CARD)
  total = await cards.count()
  assert(total > 50, `expected > 50 cards, got ${total}`)
  const info = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => ({ id: e.dataset.id, t: (e.innerText || e.textContent || '').trim() })), CARD)
  const empty = info.filter((c) => !c.t).map((c) => c.id)
  assert.equal(empty.length, 0, `cards with empty label: ${empty.slice(0, 5).join(', ')}`)
  const ids = info.map((c) => c.id)
  assert(ids.every(Boolean), 'some cards lack data-id')
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
  assert.equal(dup.length, 0, `duplicate data-id values: ${dup.slice(0, 5).join(', ')}`)
  const stats = await page.locator(TID('stats')).innerText()
  const m = stats.match(/(\d[\d,]*)\s*files?\D+(\d[\d,]*)\s*links?\D+(\d[\d,]*)\s*features?/i)
  assert(m, `stats text not like "N files · M links · F features": "${stats}"`)
  assert.equal(Number(m[1].replace(/,/g, '')), total, `stats says ${m[1]} files but ${total} cards rendered`)
  if (G) assert.equal(G.nodes.length, total, `GRAPH has ${G.nodes.length} nodes but ${total} cards`)
  await shot('default')
})

await step('layout: no overlaps, min size, font size >= 11px', async () => {
  const rs = (await cardRects()).filter((r) => r.vis)
  assert(rs.length > 50, `only ${rs.length} visible cards`)
  const small = rs.filter((r) => r.w < 60 || r.h < 16)
  assert.equal(small.length, 0, `cards too small (<60x16): ${small.slice(0, 5).map((r) => `${r.id} ${r.w.toFixed(0)}x${r.h.toFixed(0)}`).join('; ')}`)
  const tiny = rs.filter((r) => r.fs < 11)
  assert.equal(tiny.length, 0, `font-size < 11px on: ${tiny.slice(0, 5).map((r) => `${r.id} ${r.fs}px`).join('; ')}`)
  const T = 1
  const bad = []
  for (let i = 0; i < rs.length && bad.length < 5; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j]
    if (a.x + a.w - T > b.x && b.x + b.w - T > a.x && a.y + a.h - T > b.y && b.y + b.h - T > a.y) { bad.push(`${a.id} x ${b.id}`); if (bad.length >= 5) break }
  }
  assert.equal(bad.length, 0, `overlapping cards: ${bad.join('; ')}`)
})

await step('hover draws edges; click pins selection; Esc clears', async () => {
  await page.mouse.move(2, 2)
  await sleep(300)
  const before = await page.screenshot()
  const c = await hittableCard()
  assert(c, 'no hit-testable card found in the viewport')
  await page.mouse.move(c.x, c.y)
  await sleep(400)
  const after = await page.screenshot()
  assert(!before.equals(after), `hovering ${c.id} changed nothing on screen (edges not drawn?)`)
  await shot('hover')
  await page.mouse.click(c.x, c.y)
  await sleep(300)
  assert.equal(await selected(), c.id, `selected() should be ${c.id} after click`)
  assert((await panelText()).includes(c.id), `details panel does not contain path "${c.id}"`)
  await shot('pinned')
  await page.mouse.move(2, 2)
  await sleep(200)
  assert.equal(await selected(), c.id, 'selection must stay pinned after the mouse leaves')
  await page.keyboard.press('Escape')
  await sleep(200)
  assert.equal(await selected(), null, 'Esc should clear selection')
})

await step('details panel: Depends on / Used by counts match GRAPH edges', async () => {
  if (!G) { console.log('(GRAPH not readable, skipped) '); return }
  const out = new Map(), inn = new Map()
  const seen = new Set()
  for (const e of G.edges) {
    if (e.source === e.target || seen.has(e.source + '\0' + e.target)) continue
    seen.add(e.source + '\0' + e.target)
    out.set(e.source, (out.get(e.source) ?? 0) + 1)
    inn.set(e.target, (inn.get(e.target) ?? 0) + 1)
  }
  const both = G.nodes.filter((n) => out.get(n.id) && inn.get(n.id)).sort((a, b) => (out.get(b.id) + inn.get(b.id)) - (out.get(a.id) + inn.get(a.id)))
  assert(both.length, 'no node has both incoming and outgoing edges')
  for (const n of [both[0], both[Math.floor(both.length / 2)]]) {
    await page.evaluate((id) => window.__graph.select(id), n.id)
    await sleep(300)
    assert.equal(await selected(), n.id, `select(${n.id}) did not select`)
    const t = await panelText()
    const dep = t.match(/Depends on\s*\((\d+)\)/i), used = t.match(/Used by\s*\((\d+)\)/i)
    assert(dep, `panel lacks "Depends on (N)" for ${n.id}: ${t.slice(0, 200)}`)
    assert(used, `panel lacks "Used by (N)" for ${n.id}`)
    assert.equal(Number(dep[1]), out.get(n.id), `${n.id}: Depends on (${dep[1]}) != ${out.get(n.id)} outgoing edges (source=dependent assumed)`)
    assert.equal(Number(used[1]), inn.get(n.id), `${n.id}: Used by (${used[1]}) != ${inn.get(n.id)} incoming edges`)
  }
  await page.keyboard.press('Escape')
})

await step('search: filters/highlights, restores on clear, Enter selects first match', async () => {
  const sig = () => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => `${e.className}|${getComputedStyle(e).opacity}|${getComputedStyle(e).display}`).join('\n'), CARD)
  const v0 = await visibleCount(), s0 = await sig()
  const input = page.locator(TID('search-input'))
  await page.mouse.click(700, 5).catch(() => {})
  await page.keyboard.press('Escape')
  await page.keyboard.press('/')
  assert(await input.evaluate((e) => e === document.activeElement), '"/" did not focus the search input')
  await input.fill('')
  await input.pressSequentially('scoring', { delay: 30 })
  await sleep(500)
  if (G) {
    const n = G.nodes.filter((x) => `${x.id} ${x.label}`.toLowerCase().includes('scoring')).length
    assert(n >= 1, 'GRAPH has no node matching "scoring"')
  }
  const v1 = await visibleCount(), s1 = await sig()
  assert(v1 >= 1, `visibleCount() is ${v1} for "scoring"`)
  assert(v1 !== v0 || s1 !== s0, 'typing "scoring" neither changed visibleCount nor card highlighting')
  await input.press('Enter')
  await sleep(300)
  const sel = await selected()
  assert(sel, 'Enter did not select a match')
  assert(sel.toLowerCase().includes('scoring') || (G?.nodes.find((n) => n.id === sel)?.label ?? '').toLowerCase().includes('scoring'), `Enter selected "${sel}", not a "scoring" match`)
  await page.keyboard.press('Escape')
  await input.fill('')
  await sleep(400)
  await page.keyboard.press('Escape')
  await sleep(200)
  assert.equal(await visibleCount(), v0, 'visibleCount not restored after clearing search')
  assert.equal(await sig(), s0, 'card states not restored after clearing search')
  assert.equal(await selected(), null, 'selection should be cleared')
})

await step('feature chips: toggle hides, toggle restores, double-click solos', async () => {
  const chips = page.locator(TID('feature-chip'))
  const n = await chips.count()
  assert(n >= 2, `expected >= 2 feature chips, got ${n}`)
  const all = await visibleCount()
  const counts = G ? Object.fromEntries(G.features.map((f) => [f.id, G.nodes.filter((x) => x.feature === f.id).length])) : null
  let idx = 0, fid = null
  for (let i = 0; i < n; i++) {
    const f = await chips.nth(i).getAttribute('data-feature')
    if (!counts || (counts[f] > 0 && counts[f] < all)) { idx = i; fid = f; break }
  }
  const chip = chips.nth(idx)
  fid = fid ?? await chip.getAttribute('data-feature')
  await chip.click()
  await sleep(400)
  const hidden = await visibleCount()
  assert(hidden < all, `clicking chip "${fid}" did not reduce visibleCount (${all} -> ${hidden})`)
  if (counts) assert.equal(hidden, all - counts[fid], `after hiding "${fid}" expected ${all - counts[fid]} visible, got ${hidden}`)
  await chip.click()
  await sleep(400)
  assert.equal(await visibleCount(), all, `second click on "${fid}" did not restore visibleCount`)
  await chip.dblclick()
  await sleep(500)
  const solo = await visibleCount()
  assert(solo >= 1 && solo < all, `double-click solo gave visibleCount ${solo} (all=${all})`)
  if (counts) assert.equal(solo, counts[fid], `solo "${fid}" expected ${counts[fid]} visible, got ${solo}`)
  // restore (reload clears any chip state; if state persists, fall back to clicking chips)
  await load()
  if ((await visibleCount()) !== all) {
    for (let i = 0; i < n; i++) { if ((await visibleCount()) === all) break; await chips.nth(i).click(); await sleep(200) }
  }
  assert.equal(await visibleCount(), all, 'could not restore all features after solo')
})

await step('theme: toggles background, persists across reload, contrast >= 4.5', async () => {
  const state = () => page.evaluate((sel) => {
    const card = document.querySelector(sel)
    const label = getComputedStyle(card.querySelector('*') || card).color
    let el = card, bg = null
    while (el) { const c = getComputedStyle(el).backgroundColor; const m = c.match(/[\d.]+/g); if (m && !(m.length > 3 && Number(m[3]) < 0.5) && c !== 'transparent') { bg = c; break } el = el.parentElement }
    return { body: getComputedStyle(document.body).backgroundColor, color: label, cardBg: bg ?? getComputedStyle(document.body).backgroundColor }
  }, CARD)
  const check = (s, which) => {
    const c = contrast(parseRgb(s.color), parseRgb(s.cardBg))
    assert(c >= 4.5, `${which} theme: card label contrast ${c.toFixed(2)} < 4.5 (${s.color} on ${s.cardBg})`)
  }
  const a = await state()
  check(a, 'initial')
  await page.locator(TID('theme-toggle')).click()
  await sleep(500)
  const b = await state()
  assert.notEqual(b.body, a.body, `body background unchanged after theme toggle (${a.body})`)
  check(b, 'toggled')
  await shot('light')
  await load()
  const c = await state()
  assert.equal(c.body, b.body, `theme did not persist across reload (${b.body} -> ${c.body})`)
  await page.locator(TID('theme-toggle')).click()
  await sleep(500)
  assert.equal((await state()).body, a.body, 'toggling back did not restore the original background')
  await load() // persist original theme again
})

await step('zoom: wheel changes scale, zoom-fit returns every card to the viewport', async () => {
  const probe = () => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 100) / 100).join(',') }, CARD)
  const p0 = await probe()
  await page.mouse.move(720, 450)
  await page.mouse.wheel(0, -600)
  await sleep(500)
  let p1 = await probe()
  if (p1 === p0) { await page.keyboard.down('Control'); await page.mouse.wheel(0, -600); await page.keyboard.up('Control'); await sleep(500); p1 = await probe() }
  assert.notEqual(p1, p0, 'wheel zoom did not change card geometry')
  await page.locator(TID('zoom-fit')).click()
  await sleep(1200)
  const vp = page.viewportSize()
  const out = (await cardRects()).filter((r) => r.vis && (r.x < -1 || r.y < -1 || r.x + r.w > vp.width + 1 || r.y + r.h > vp.height + 1))
  assert.equal(out.length, 0, `after zoom-fit ${out.length} cards outside ${vp.width}x${vp.height}: ${out.slice(0, 4).map((r) => `${r.id}@${r.x.toFixed(0)},${r.y.toFixed(0)}`).join('; ')}`)
})

await step('responsive: 1024x700 and 1440x900 have no h-scroll, panel + controls visible', async () => {
  for (const [w, h] of [[1024, 700], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h })
    await sleep(600)
    const sw = await page.evaluate(() => ({ sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), iw: innerWidth }))
    assert(sw.sw <= sw.iw + 1, `${w}x${h}: horizontal scroll (scrollWidth ${sw.sw} > ${sw.iw})`)
    for (const id of ['details-panel', 'search-input', 'theme-toggle', 'zoom-fit', 'stats']) {
      const box = await page.locator(TID(id)).boundingBox()
      assert(box && box.width > 0 && box.height > 0, `${w}x${h}: ${id} not visible`)
      assert(box.x + box.width > 0 && box.y + box.height > 0 && box.x < w && box.y < h, `${w}x${h}: ${id} is outside the viewport`)
    }
  }
})

await step('screenshots', async () => {
  if (!SHOTS) { process.stdout.write('(GRAPH_SHOTS unset) '); return }
  for (const n of ['default', 'hover', 'pinned', 'light']) assert(existsSync(join(SHOTS, `${n}.png`)), `missing screenshot ${n}.png`)
})

await browser.close()
console.log(`\n${passed} graph checks passed.`)
