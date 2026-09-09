# Twilio toll-free verification — answers for the form

Fill the Twilio **Toll-Free Verification** request with the text below. The number is
+1 855 243 5973; `TWILIO_FROM_NUMBER` and `SMS_CONTACT_EMAIL` are set in Vercel, so the
public pages render the real number and contact.

> **Resubmission note.** The first submission was rejected with error **30498** ("opt-in
> workflow must match submission details"). Cause: it declared a keyword opt-in (text
> REMIND) alongside the web form, but the backend never implemented REMIND as a consent
> path — a cold REMIND was answered with "sign in and add this number". The keyword has
> been removed from the app, this page's collateral and the webhook, so the web form is
> now the single opt-in. **Declare one opt-in type: Web form.**
>
> **Second rejection: 30513**, "Opt-in — consent for messaging is a requirement for
> service" (request SID HH733be67f207a6157c5c493c0fb315602). The submission never said
> the app is usable without texts. The description described enrolling but not declining;
> the consent box said only "Consent is not a condition of purchase", which answers a
> question nobody asked here since nothing is sold; and the one use of the word
> "optional" was buried in the program page's intro. Reviewers read that as consent being
> bundled into the service. Fixed by stating optionality where the decision is made: the
> consent box, a callout above "How to opt in", a paragraph opening the Terms, and the
> description below. **The reviewer must be able to see that a user can decline texts and
> still use Brill HQ in full.** Keep that claim true and prominent in any future edit.

Public pages (host these URLs; they are served by the deployed app, no login):

| Page | URL |
|---|---|
| Program description + opt-in collateral (screenshot this) | https://brill-hq-to-do.vercel.app/sms-opt-in.html |
| SMS Terms & Conditions | https://brill-hq-to-do.vercel.app/sms-terms.html |
| Privacy Policy | https://brill-hq-to-do.vercel.app/sms-privacy.html |

Take a screenshot of `sms-opt-in.html` (it shows the exact consent form, the
the confirmation/welcome/HELP/STOP messages, frequency and
disclaimers) and upload it to Google Drive / OneDrive with "anyone with the link
can view", then paste that link into **Opt-In Image URLs**. You can also paste the
page URL itself.

---

## Business / use case fields

**Business name:** Brill Media
**Website:** https://brill-hq-to-do.vercel.app (app) — company site brillmedia.co

**Use case category:** `Account_notifications` — select this one only. Do not also tick
Delivery_notifications or Events; one opt-in cannot cover multiple use cases (error 30504).

**Use case description:** (the field caps at 500 characters; this is 496)
Brill HQ is Brill Media's private task and notes app. Text reminders are optional: the
app works fully without them and delivers reminders by browser notification instead. A
user who wants texts enters their number and ticks a consent box that is unchecked by
default, then must reply YES to a confirmation text. Each text contains only a reminder
they scheduled ("call Jason at 9:30am"). Reply STOP to cancel, HELP for help. No
marketing. Numbers are never shared. Under 1000 messages per month.

**Estimated monthly volume:** under 1000 messages (single account holder; one text per
reminder scheduled).

> The 500-character cap forces this to be terse, so keep every element a reviewer scores
> separately: the business named, the transactional use case, consent originating on the
> web form, the unchecked box, the YES double opt-in, STOP/HELP, no marketing, no
> sharing, and a volume figure. Drop framing before dropping any of those.

**Opt-in type:** Web form. (Not "via text" — there is no keyword opt-in. Declaring one
is what caused the 30498 rejection.) Double opt-in: every enrollment must be confirmed by
replying YES to the confirmation text.

---

## Opt-In Policy Proof (paste this)

Brill HQ Reminders has a single opt-in path — a web form inside the app — and every
enrollment must be confirmed by replying YES before any reminder texts are sent.

Via web form (inside the app). A signed-in user opens Reminders → "Get reminders by
text", enters their mobile number, ticks a consent checkbox and taps "Send confirmation
text". The consent language shown next to the checkbox is:
"By checking this box and tapping Send, I agree to receive recurring automated reminder
text messages from Brill HQ Reminders at the number provided. Consent is not a condition
of purchase. Message frequency varies (one text per reminder I schedule). Msg & data rates
may apply. Reply HELP for help or STOP to cancel at any time. See the SMS Terms
(https://brill-hq-to-do.vercel.app/sms-terms.html) and Privacy Policy
(https://brill-hq-to-do.vercel.app/sms-privacy.html)."

Confirmation request (sent immediately after either opt-in; the user must reply YES):
"Brill HQ Reminders: Reply YES to confirm you want your scheduled reminders texted to this
number. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to
cancel. Terms: https://brill-hq-to-do.vercel.app/sms-terms.html"

Welcome / confirmation message (sent after the user replies YES):
"Brill HQ Reminders: You're confirmed. We'll text you each reminder you schedule in Brill
HQ. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.
Terms: https://brill-hq-to-do.vercel.app/sms-terms.html"

Message frequency: varies — one text per reminder the user schedules (one per occurrence
for repeating reminders); typically a few per week.

Standard disclaimers (shown at opt-in, in the confirmation text and on the program page):
Msg & data rates may apply. Message frequency varies. Consent is not a condition of
purchase. Carriers are not liable for delayed or undelivered messages. Mobile information
is never shared with third parties or affiliates for marketing or promotional purposes.

HELP: reply HELP or INFO to any message. The response is Twilio's standard help reply for
this toll-free number, identifying the program and the support contact
(SMS_CONTACT_EMAIL). Replying HELP does not change the subscription.

STOP: reply STOP, CANCEL, END, QUIT, UNSUBSCRIBE or STOPALL to any message. The number is
unsubscribed at the carrier level immediately and the carrier's standard confirmation is
returned; no further texts can be delivered. Reply START or UNSTOP to re-subscribe. Texts
can also be turned off inside the app under Reminders.

> Do not paste custom HELP/STOP wording into the verification form. This number uses
> Twilio's default opt-out handling, so Twilio populates those fields itself. A US
> toll-free number always unsubscribes on STOP and returns the carrier's own confirmation
> — a custom message cannot replace it — and after an opt-out the number is on Twilio's
> block list, so any reply we sent would fail with error 21610. Quoting wording the number
> does not actually send is the same description-vs-behaviour gap that caused the 30498
> rejection. Custom HELP text would require a Messaging Service with Advanced Opt-Out
> enabled, which only Twilio support can later disable.

Terms: https://brill-hq-to-do.vercel.app/sms-terms.html
Privacy: https://brill-hq-to-do.vercel.app/sms-privacy.html
Program page (collateral): https://brill-hq-to-do.vercel.app/sms-opt-in.html
Opt-in screenshot: [Google Drive / OneDrive link to a screenshot of sms-opt-in.html]

---

## Message samples (paste these)

Sample 1 (reminder):
"Brill HQ Reminders: Send the BSH invoice
Bruno promised Friday
https://brill-hq-to-do.vercel.app/?view=reminders
Reply STOP to cancel."

Sample 2 (reminder, repeating):
"Brill HQ Reminders: Weekly pipeline review
https://brill-hq-to-do.vercel.app/?view=reminders
Reply STOP to cancel."

Sample 3 (confirmation request):
"Brill HQ Reminders: Reply YES to confirm you want your scheduled reminders texted to this
number. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to
cancel. Terms: https://brill-hq-to-do.vercel.app/sms-terms.html"

---

## After the number is approved

1. Twilio Console → Phone Numbers → your number → **Messaging** → "A message comes in":
   Webhook, `HTTP POST`, `https://brill-hq-to-do.vercel.app/api/sms-inbound`. Save.
   (This is what receives YES / STOP / HELP replies.)
2. Vercel env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
   (E.164, e.g. `+18335550123`), `SMS_CONTACT_EMAIL` (support email shown in HELP and on
   the public pages).
3. In the app: Reminders → Get reminders by text → enter your number, tick the box,
   Send → reply YES to the text. The card flips to "Text-message reminders are on".
