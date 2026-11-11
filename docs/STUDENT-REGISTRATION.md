# Student registration — how it works

*For the Marquee programme office, and as the script for a walkthrough video.*
Live at **https://marq.klef.me/register**. Screenshots are in [`docs/registration/`](registration/).

## In one line

A Top Notch student enters their university email → MARQ confirms they are on the list and shows their details → they click **Register** → an email arrives → they set a password → they add their coding profiles → they complete their profile → their MARQ dashboard opens.

## Before students can register (programme office)

1. **The student must be on the Top Notch list.** Admins add students under **Students → Bulk import** (or **Add student**). Only emails in that list are accepted — any other email is refused.
2. **Email must be working.** The domain `marq.klef.me` has to be verified in Resend (SPF/DKIM records in Cloudflare). If email can’t be sent, registration stops with a clear message; the link is never shown on screen, so nobody can register someone else’s account.
3. Alternatively, admins can invite students themselves: **Students → select → Create accounts & invite**. Those students skip step 1–4 below and start at step 5.

## The student’s steps

| # | Screen | What the student does | What MARQ checks |
|---|---|---|---|
| 1 | Sign-in page → **Register with your university email** ([01](registration/01-login.png)) | Opens registration | — |
| 2 | **Student registration** ([02](registration/02-register-email.png)) | Types their university email, clicks **Continue** | Email is on the Top Notch list and active ([03](registration/03-not-on-list.png) shows a refusal) |
| 3 | **Is this you?** ([04](registration/04-confirm-details.png)) | Checks name, student ID, branch and the masked email; clicks **Register** (or **Not me**) | Not already registered; not deactivated |
| 4 | **Check your email** ([05](registration/05-email-sent.png)) | Opens the email from *MARQ · KL University* and clicks **Activate account** | One-time link, valid 7 days; only a hash is stored |
| 5 | **Set your password** ([06](registration/06-set-password.png)) | Chooses a password (10+ characters) | Link unused and unexpired; signs them in |
| 6 | **Coding profiles** — step 2 of 3 ([07](registration/07-coding-profiles.png)) | Enters LeetCode, CodeChef and GitHub usernames (Codeforces optional), clicks **Verify & continue** | Each account must exist — checked live; wrong usernames are named in the error |
| 7 | **Your profile** — step 3 of 3 ([08](registration/08-profile.png)) | Mobile, personal email, headline, LinkedIn, resume link, at least 3 skills (GitHub link, portfolio optional); clicks **Finish & open MARQ** | All required fields valid |
| 8 | **My Dashboard** ([09](registration/09-dashboard.png)) | Lands on their dashboard | Onboarding complete — the portal is unlocked |
| 9 | **Job Opportunities** ([10](registration/10-drive-status.png)) | Answers *“Status of the candidate for this drive”* on each company drive | Saved to their application timeline |

Until steps 6 and 7 are done, every page sends the student back to onboarding — they cannot skip them.

## Messages students may see

| Message | Meaning | What to do |
|---|---|---|
| *This email is not on the Top Notch Marquee list…* | Email not in MARQ’s student list | Use the university email; otherwise ask the office to add/correct it |
| *You have already registered. Sign in…* | Account already active | Sign in, or use **Forgot your password?** / **Change password** |
| *Your account is deactivated…* | Disabled by an admin | Contact the programme office |
| *A registration email was sent a moment ago…* | Asked twice within 5 minutes | Check inbox and spam; retry after 5 minutes |
| *We couldn’t send the email right now…* | Email service unavailable | Try later, or the office invites them from Students |
| *This link is invalid, already used, or expired* | Old or reused link | Register again (sends a new link) |
| *These accounts don’t exist: codechef (“…”)* | Username typo | Fix the username exactly as on the platform |
| *List at least 3 skills…* / *Add your LinkedIn…* | Profile incomplete | Fill the required fields |

## After registration

- **Change password:** on the sign-in page (**Change password**) or inside MARQ (**Change Password** in the menu).
- **Forgot password:** **Forgot your password?** on the sign-in page emails a reset link (30 minutes).
- **Coding profiles** refresh every night; students can press **Sync now** on *Coding Profiles* (once per 10 minutes).
- **Feedback:** **Feedback** in the menu, or on the sign-in page.

## Security notes (for the office)

- Only emails already on the list can register; the details shown are limited to name, student ID, branch and a masked email.
- Registration attempts are rate-limited per network and per student.
- The activation link goes only to the student’s inbox — proving they own that mailbox.
- Every registration, activation and onboarding completion is written to **Audit Logs**.

## Video script (≈3 minutes)

| Time | Scene | Narration |
|---|---|---|
| 0:00 | Sign-in page (01) | “Welcome to MARQ, KL University’s Marquee programme platform. If you’re a Top Notch student, start with *Register with your university email*.” |
| 0:15 | Email step (02) | “Type the university email the programme office has on record and press Continue.” |
| 0:25 | Refusal (03) | “Only Top Notch students can register — any other email is politely refused.” |
| 0:35 | Is this you? (04) | “MARQ shows your name, student ID and branch. If it’s you, press Register.” |
| 0:50 | Email sent (05) | “Check your inbox — and spam — for an email from MARQ · KL University. Click *Activate account*.” |
| 1:05 | Set password (06) | “Choose a password of at least ten characters. You’re signed in straight away.” |
| 1:20 | Coding profiles (07) | “Add your LeetCode, CodeChef and GitHub usernames — Codeforces is optional. MARQ checks each one exists.” |
| 1:45 | Profile (08) | “Complete your profile: mobile, personal email, a one-line headline, LinkedIn, a resume link and at least three skills.” |
| 2:10 | Dashboard (09) | “That’s it — your dashboard shows your training, scores and coding rank.” |
| 2:25 | Drive status (10) | “For every company drive, keep *Status of the candidate* up to date — it powers the programme’s placement analysis.” |
| 2:45 | Sign-in page | “Need help? Use Change password, Forgot password, or Feedback on the sign-in page.” |

*Regenerate the screenshots after UI changes:* start the app against a test database with `REGISTRATION_SHOW_LINK=true`, add a demo student, and walk the flow (see the commit that added this file for the capture script outline).
