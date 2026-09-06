# Twilio toll-free verification — answers for the form

Fill the Twilio **Toll-Free Verification** request with the text below. Replace
`[TOLL-FREE NUMBER]` with your Twilio number (e.g. +1 833 555 0123) and make sure
`TWILIO_FROM_NUMBER` and `SMS_CONTACT_EMAIL` are set in Vercel first, so the public
pages show the real number and contact.

Public pages (host these URLs; they are served by the deployed app, no login):

| Page | URL |
|---|---|
| Program description + opt-in collateral (screenshot this) | https://brill-hq-to-do.vercel.app/sms-opt-in.html |
| SMS Terms & Conditions | https://brill-hq-to-do.vercel.app/sms-terms.html |
| Privacy Policy | https://brill-hq-to-do.vercel.app/sms-privacy.html |

Take a screenshot of `sms-opt-in.html` (it shows the exact consent form, the
keyword instructions, the confirmation/welcome/HELP/STOP messages, frequency and
disclaimers) and upload it to Google Drive / OneDrive with "anyone with the link
can view", then paste that link into **Opt-In Image URLs**. You can also paste the
page URL itself.

---

## Business / use case fields

**Business name:** Brill Media
**Website:** https://brill-hq-to-do.vercel.app (app) — company site brillmedia.co

**Use case category:** Account notifications / reminders (transactional; not marketing)

**Use case description:**
Brill HQ is Brill Media's internal task, project and notes application, used by the
account holder. "Brill HQ Reminders" sends the account holder a text message for each
reminder they themselves schedule in the app (for example "remind me Friday at 9am to
send the invoice"). Messages go only to the mobile number the account holder enrolled
and confirmed by replying YES. No marketing or promotional content is ever sent, and
the recipient is the person who created the reminder.

**Estimated monthly volume:** under 100 messages (single account holder; one text per
reminder scheduled).

**Opt-in type:** Web form (in-app) and Keyword (text REMIND). Double opt-in: every
enrollment must be confirmed by replying YES.

---

## Opt-In Policy Proof (paste this)

Users opt in to Brill HQ Reminders in one of two ways, and in both cases must confirm
by replying YES before any reminder texts are sent.

1) Via web form (inside the app). A signed-in user opens Reminders → "Get reminders by
text", enters their mobile number, ticks a consent checkbox and taps "Send confirmation
text". The consent language shown next to the checkbox is:
"By checking this box and tapping Send, I agree to receive recurring automated reminder
text messages from Brill HQ Reminders at the number provided. Consent is not a condition
of purchase. Message frequency varies (one text per reminder I schedule). Msg & data rates
may apply. Reply HELP for help or STOP to cancel at any time. See the SMS Terms
(https://brill-hq-to-do.vercel.app/sms-terms.html) and Privacy Policy
(https://brill-hq-to-do.vercel.app/sms-privacy.html)."

2) Via text (keyword campaign). From the phone they added in the app, the user texts the
keyword REMIND to [TOLL-FREE NUMBER]. The keyword and number are shown on the enrollment
card in the app and on the public program page
https://brill-hq-to-do.vercel.app/sms-opt-in.html.

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

HELP: reply HELP to any message. Response: "Brill HQ Reminders: We text you the reminders
you schedule in your Brill HQ account. Support: [SMS_CONTACT_EMAIL]. Msg frequency varies.
Msg & data rates may apply. Reply HELP for help, STOP to cancel."

STOP: reply STOP to any message. Response: "Brill HQ Reminders: You've been unsubscribed
and will receive no further texts. Reply START to re-subscribe." Texts can also be turned
off inside the app under Reminders.

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
   (This is what receives YES / REMIND / STOP replies.)
2. Vercel env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
   (E.164, e.g. `+18335550123`), `SMS_CONTACT_EMAIL` (support email shown in HELP and on
   the public pages).
3. In the app: Reminders → Get reminders by text → enter your number, tick the box,
   Send → reply YES to the text. The card flips to "Text-message reminders are on".
