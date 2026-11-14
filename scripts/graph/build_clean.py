#!/usr/bin/env python3
"""Collapse graphify-out/graph.json (symbol level) into a file-level dataset."""
import json, os, re, datetime, collections

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
g = json.load(open(os.path.join(ROOT, "graphify-out/graph.json")))
PDF = "docs/MARQ-How-It-Works.pdf"
CONFIG = {"next.config.ts", "vercel.json", "package.json", "tsconfig.json", "proxy.ts"}

LAYERS = [("pages", "Pages"), ("components", "Components"), ("actions", "Actions & API"),
          ("lib", "Libraries"), ("data", "Data & Models"), ("tooling", "Scripts, Config & Docs")]
LORDER = {l[0]: i for i, l in enumerate(LAYERS)}
FEATURES = [
 ("students", "Students", "#4E9AF1"), ("attendance", "Attendance & Register", "#F5A623"),
 ("assessments", "Assessments", "#B07CF0"), ("scoring-performance", "Scoring & Performance", "#E5547E"),
 ("coding", "Coding & Leaderboard", "#2EC4B6"), ("placement", "Placement & Jobs", "#8BC34A"),
 ("auth-accounts", "Auth & Accounts", "#D9534F"), ("reports-exports", "Reports & Exports", "#C9A227"),
 ("admin-settings", "Admin & Settings", "#8D99AE"), ("training-mentors", "Training & Mentors", "#F28E5B"),
 ("platform", "Platform", "#5B7DB1"), ("tests-tooling", "Tests & Tooling", "#A0522D"),
 ("shared", "Shared UI & Utils", "#9AA5B1"),
]

def keep(f):
    if f == PDF: return True
    if f in CONFIG: return True
    return f.split("/")[0] in ("app", "components", "lib", "models", "scripts")

def layer(p):
    b = os.path.basename(p)
    if p == PDF: return "tooling"
    if p == "proxy.ts" or p.startswith("app/actions/") or p.startswith("app/api/"): return "actions"
    if p.startswith("app/"):
        return "pages" if b in ("page.tsx", "layout.tsx", "loading.tsx", "not-found.tsx") else "components"
    if p.startswith("components/"): return "components"
    if p.startswith("lib/"): return "lib"
    if p.startswith("models/"): return "data"
    return "tooling"

FRULES = [
 ("tests-tooling", r"^scripts/|e2e|\.check\.|seed|import-roster|^docs/|package\.json|tsconfig|postcss|next\.config|vercel\.json"),
 ("reports-exports", r"report|csv|sheet|download|print|export|template"),
 ("attendance", r"attendance|register|periods"),
 ("auth-accounts", r"login|activate|account|session|rbac|users|roles|onboarding|signup|password|forgot|change-password|auth|tokens|denied|proxy|scope"),
 ("assessments", r"assessment|evaluation|rating"),
 ("scoring-performance", r"scor|intel|journey|performance|formula|metrics|charts|overview"),
 ("coding", r"coding|leaderboard|contest"),
 ("placement", r"compan|jobs?\b|job-|application|placement|drive"),
 ("training-mentors", r"training|mentor|session-fields"),
 ("admin-settings", r"settings|announcement|audit|feedback|admin|inbox|notif"),
 ("students", r"student|avatar|/me/page|/me/profile|actions/me"),
 ("platform", r"layout|theme|/db|logo|ui\.tsx|form|toast|mail|nav|sidebar|loading|not-found|models/|options|format|client-bits|auth-shell|^app/page|notify"),
]
def feature(p):
    for f, rx in FRULES:
        if re.search(rx, p): return f
    return "shared"

# ---- nodes -> files
nfile, sym = {}, collections.Counter()
for n in g["nodes"]:
    f = n.get("source_file", "")
    if n.get("file_type") != "code" or n["id"].startswith("ref_") or not f or not keep(f): continue
    if f in ("package.json", "tsconfig.json") and False: pass
    nfile[n["id"]] = f
    sym[f] += 1
# package.json/tsconfig entries are dependency/option nodes: drop those files entirely
for f in ("package.json", "tsconfig.json"):
    for k in [k for k, v in nfile.items() if v == f]: del nfile[k]
    sym.pop(f, None)
files = set(sym) | {PDF}

# ---- edges
pair = {}  # sorted key -> [dir counts]
for l in g["links"]:
    a, b = nfile.get(l["source"]), nfile.get(l["target"])
    if not a or not b or a == b: continue
    k = tuple(sorted((a, b)))
    e = pair.setdefault(k, {"fw": 0, "bw": 0})
    e["fw" if a == k[0] else "bw"] += 1
edges = []
for k, e in pair.items():
    s, t = (k[0], k[1]) if e["fw"] >= e["bw"] else (k[1], k[0])
    edges.append({"source": s, "target": t, "weight": e["fw"] + e["bw"]})

# ---- hubs: distinct dependents (incoming, by chosen direction)
dep = collections.defaultdict(set)
for e in edges: dep[e["target"]].add(e["source"])
real = [f for f in files if f != PDF]
ranked = sorted(dep.items(), key=lambda kv: (-len(kv[1]), kv[0]))
hubs = [(f, len(d)) for f, d in ranked if len(d) > 0.18 * len(real)][:8]
hubset = {h for h, _ in hubs}

# true degree before hub removal
nb = collections.defaultdict(set)
for e in edges: nb[e["source"]].add(e["target"]); nb[e["target"]].add(e["source"])
# which shared helpers each file uses (their edges are hidden from the drawing, but listed in the details panel)
uses_hubs = collections.defaultdict(set)
for e in edges:
    if e["target"] in hubset: uses_hubs[e["source"]].add(e["target"])
    if e["source"] in hubset: uses_hubs[e["target"]].add(e["source"]) if False else None
edges = [e for e in edges if e["source"] not in hubset and e["target"] not in hubset]
edges.sort(key=lambda e: (e["source"], e["target"]))
connected = {e["source"] for e in edges} | {e["target"] for e in edges}

# ---- summaries
HAND = {
 "lib/form.ts": "Form helpers: Invalid error and attempt wrapper for server actions",
 "lib/auth.ts": "Auth helpers: current user, login checks and access guards",
 "components/ui.tsx": "Shared UI building blocks used across pages",
 "models/index.ts": "All Mongoose models and schemas for the database",
 "components/form.tsx": "Shared form components and submit buttons",
 "lib/scoring.ts": "Scoring engine for student performance scores",
 "lib/rbac.ts": "Role-based access control: roles and permissions",
 "lib/session.ts": "Session cookie creation, reading and clearing",
 "lib/register.ts": "Daily register logic: post, lock and request changes",
 "lib/coding.ts": "Coding profile sync and stats from external platforms",
 "lib/reports.ts": "Report builders for the reports pages and exports",
 "lib/db.ts": "MongoDB connection helper",
 "lib/mail.ts": "Outgoing email sending",
 "lib/notify.ts": "Creates in-app notifications",
 "lib/placement.ts": "Placement drive and application rules",
 "lib/periods.ts": "Class periods and timings for attendance",
 "lib/csv.ts": "CSV parsing and writing helpers",
 "lib/sheet.ts": "Excel sheet reading and writing helpers",
 "lib/scope.ts": "Limits data to the user's allowed scope",
 "lib/tokens.ts": "Signed tokens for activation and password reset",
 "lib/password.ts": "Password hashing and checking",
 "lib/settings.ts": "App-wide settings read and write",
 "lib/intel.ts": "Student intelligence and risk insights",
 "lib/journey.ts": "Student journey timeline",
 "proxy.ts": "Request proxy: route protection and redirects",
 "app/actions/auth.ts": "Server actions for login, logout and password change",
 "app/actions/students.ts": "Server actions to add, edit, import and drop students",
 "app/actions/register.ts": "Server actions for the attendance register",
 "app/actions/placement.ts": "Server actions for companies, jobs and applications",
 "app/actions/assessments.ts": "Server actions for assessments and results",
 "app/actions/signup.ts": "Server actions for student sign-up and activation",
 "components/nav.tsx": "Top navigation bar",
 "components/sidebar.tsx": "Sidebar navigation menu",
 "components/charts.tsx": "Chart components for dashboards",
 "components/students-client.tsx": "Students list with filters and actions",
 "components/register-editor.tsx": "Editor for the daily attendance register",
 "app/layout.tsx": "Root layout for the whole app",
 "app/(app)/layout.tsx": "Layout for signed-in pages with sidebar and nav",
 "app/page.tsx": "Landing page",
 "docs/MARQ-How-It-Works.pdf": "Workflow document explaining how MARQ works",
}
def words(s):
    s = re.sub(r"[-_\[\]()]", " ", s)
    return s.strip()
def summary(p, syms):
    if p in HAND: return HAND[p]
    parts = [x for x in p.split("/") if x not in ("app", "(app)", "components", "lib")]
    b = os.path.splitext(parts[-1])[0] if parts else p
    route = "/".join(x for x in parts[:-1] if not x.startswith("["))
    L = layer(p)
    if L == "pages":
        if b == "page": s = (words(route).replace('me ', 'my ', 1) if route.startswith('me/') else words(route) or 'Home') + " page"; s = s[0].upper() + s[1:]
        else: s = f"{words(route + ' ' + b)} for this section".capitalize()
    elif L == "actions":
        if p.startswith("app/api/"): s = f"API route: {words(route.replace('api/', ''))}".strip()
        else: s = f"Server actions for {words(b)}"
    elif L == "components": s = f"{words(b).capitalize()} UI component"
    elif L == "lib": s = f"{words(b).capitalize()} helpers"
    elif L == "data": s = f"{words(b).capitalize()} data models"
    else:
        s = f"Script: {words(b)}" if p.startswith("scripts/") else f"Config: {os.path.basename(p)}"
    ex = [x for x in syms.get(p, []) if len(x) > 3 and "." not in x and x.lower() != b.lower()][:3]
    if ex and L in ("lib", "components", "actions") and len(s) < 55:
        s += " (" + ", ".join(ex) + ")"
    return s[:90]
syms_by = collections.defaultdict(list)
for n in g["nodes"]:
    f = nfile.get(n["id"])
    if f: syms_by[f].append(re.sub(r"\(\)$", "", n["label"]))

nodes = []
for p in files:
    L = layer(p)
    if L == "tooling" and p != PDF and p not in connected and p not in nb and not p.startswith("scripts/"):
        continue  # tooling noise
    label = p.replace("app/", "", 1).replace("(app)/", "") if p.startswith("app/") else p
    label = re.sub(r"^(components|lib|models)/", lambda m: m.group(0) if m.group(1) == "lib" else "", label) if False else label
    if p.startswith("app/") and re.search(r"/(page|layout|loading|not-found)\.tsx$", p):
        # pages are labelled by their route, e.g. /students/[id], /me/jobs — not by "page.tsx"
        route = re.sub(r"\((\w+)\)/?", "", p[len("app/"):])
        route = re.sub(r"/?(page|layout|loading|not-found)\.tsx$", "", route)
        kind = re.search(r"/(layout|loading|not-found)\.tsx$", p)
        short = "/" + route.strip("/") if route.strip("/") else "/"
        if kind: short += f" ({kind.group(1)})"
    elif p.startswith("app/"):
        short = "/".join(p.replace("app/", "", 1).replace("(app)/", "").split("/")[-2:])
    else:
        short = p
    nodes.append({"id": p, "label": short, "path": p, "layer": L,
                  "feature": "tests-tooling" if p == PDF else feature(p),
                  "symbols": sym.get(p, 1 if p == PDF else 0), "degree": len(nb.get(p, ())),
                  "summary": summary(p, syms_by), "hubs": sorted(uses_hubs.get(p, ()))})
from collections import Counter
_dup = {k for k, v in Counter(n["label"] for n in nodes).items() if v > 1}
for n in nodes:  # identical short labels: fall back to the path so every card is unambiguous
    if n["label"] in _dup:
        n["label"] = n["path"].replace("app/", "", 1) if n["path"].startswith("app/") else n["path"]
nodes.sort(key=lambda n: (LORDER[n["layer"]], n["path"]))
ids = {n["id"] for n in nodes}
edges = [e for e in edges if e["source"] in ids and e["target"] in ids]
hubs_out = [{"id": h, "label": next(n["label"] for n in nodes if n["id"] == h), "uses": u} for h, u in hubs]
used = {n["feature"] for n in nodes}
out = {
 "meta": {"nodes": len(nodes), "edges": len(edges), "source": "graphify-out/graph.json",
          "generated": datetime.date.today().isoformat()},
 "layers": [{"id": i, "label": l, "order": k} for k, (i, l) in enumerate(LAYERS)],
 "features": [{"id": i, "label": l, "color": c} for i, l, c in FEATURES],
 "nodes": nodes, "edges": edges, "hubs": hubs_out,
}
with open(os.path.join(ROOT, "graphify-out/clean-graph.json"), "w") as fh:
    json.dump(out, fh, indent=1, ensure_ascii=False)
    fh.write("\n")

c = collections.Counter
print("nodes", len(nodes), "edges", len(edges))
print("layers", dict(c(n["layer"] for n in nodes)))
print("features", dict(c(n["feature"] for n in nodes)))
print("hubs", [(h["id"], h["uses"]) for h in hubs_out])
