// Single source of truth for all to-do items.
// Compiled from: action-items.md, reminders.md, all-reminders.md,
// todo.md, robert-todo-checklist.md, pipeline.md, memory notes.
// Edit this file to add, remove, or reorganize tasks.
// The todo-app.html reads from this file automatically.

const TODO_DATA = [
  {
    id: "immediate",
    title: "Immediate — Do Today/Tomorrow",
    color: "#ff3b30",
    items: [
      "Assemble Zoplex strategy deliverable before April 2 meeting (Mark/Thomas/Keith 4:30 PM CST)",
      "Respond to Jenn on Chetan compensation timing/meeting decision — THIRD ASK, 3-year anniversary April 10, last raise June 2024",
      "Reply to BambooHR owner-transfer request (Nicole account ownership transfer)",
      "Sync with Rishabh — make Improvado go/no-go decision (DocuSign awaiting signature, 5 days past deadline)",
      "Listen to Tom Guzzardo call with Nicole for outcome language and problem language",
      "Create a project-tracking template for Tom Guzzardo",
      "Get Tom's call notes to the team for access",
      "Track BSH landscape decision on SEO proposal options before April 8 maintenance deadline",
      "Track BSH Invoice #3762 payment (Bruno promised Friday or Monday)"
    ]
  },
  {
    id: "claude-rollout",
    title: "Claude Team Rollout — Secure Setup & Training",
    color: "#ff3b30",
    items: [
      "Design and build secure Claude shared repository on Dropbox (company/client data, automations, permissions)",
      "Configure security controls and test with small group before broader Claude rollout",
      "Prepare and deliver follow-up Claude training session for marketing team",
      "Document handoff plan — Robert is single point of failure for all AI tooling"
    ]
  },
  {
    id: "calls-contacts",
    title: "Calls to Return & People to Contact",
    color: "#ff9500",
    items: [
      "Return missed call — Phoenix AZ (602) 492-1142",
      "Return missed call — Reeder Francis (715) 617-0821",
      "Schedule intro call with Jake Lundstrom (Amazon Ads) — lundjake@amazon.com / 303-862-2638",
      "Get back to Brad Weber",
      "Contact Lacey (referral from Rachel Beder) — pitch LaunchPad at $3,500",
      "Contact Liddell Moore / cbarrett@techdream.com",
      "Contact RPA regarding Honda (pending 30+ days)",
      "Reschedule Chris King meeting (Fri Apr 3 / Mon Apr 6 / Tue Apr 7) — chris@chrismking.com",
      "Discovery call with Matheus Maroki (matheusmaroki@gmail.com) — access to 3K+ agency owner community for white-label/resell"
    ]
  },
  {
    id: "tom",
    title: "Tom Guzzardo / Growth Engine",
    color: "#f5c542",
    items: [
      "Send comprehensive strategy document",
      "Finalize email subject lines + content bullets",
      "Send contract/ACH details for coaching engagement",
      "Deliver SEO website audit to Tom (pending credentials access)",
      "Finalize Spirit Led CEO Assessment lead magnet + build Tom's value ladder (3–5 tiers)",
      "Maintain coaching-session cadence and decision-framework workstream",
      "Improve status communication protocol across team"
    ]
  },
  {
    id: "pipeline",
    title: "Pipeline / Sales / Delivery",
    color: "#f5c542",
    items: [
      "Follow up: Kith Kitchens (Roger/Chris) — advance strategy-first scope",
      "Follow up: Scott Rundle — confirm $497 diagnostic + next step",
      "Send Scott Rundle email with accounting confirming 10% rev share on clients he brings",
      "Follow up: Stuart McFaul with team CC and maintain cadence",
      "Lock Solmaz strategy/diagnostic follow-up and revenue-mix priorities — schedule diagnostic hour",
      "Deliver Curiosity / Turkish Airlines revised 3-option media plan (label guaranteed vs non-guaranteed, include Canada CTV + bilingual creative)",
      "Evaluate City of Arroyo Grande Tourism RFP decision — proposals due April 17",
      "Follow up: Anne Bushroe partnership",
      "Follow up: Raphael/SplitBase — resume V1 LinkedIn baseline, evaluate V2 after $5K threshold",
      "Soulmaz superconsumer for family-based and employment",
      "Finalize GBP content-type framework (FAQs, process walkthroughs, wins, testimonials, offers/events)",
      "Kyle Smith / Forge Marketing — prepare WL pricing and case studies",
      "Clean Mindful Cosmetics — confirm Balbir/Sonia slot + run $497 diagnostic",
      "Nella Beauty — execute $497 diagnostic and strategy session",
      "Sonia L.A Beauty — execute $497 diagnostic and strategy session",
      "Lap Laser (via Heinzeroth) — deliver white-labeled deck",
      "ShoSum — customer interviews, Nielsen audience audit, retargeting infrastructure build",
      "Complete final content pricing/packaging structure",
      "Communicate updated offer format on next sales calls",
      "Build/refine referral workflow criteria + handoff process"
    ]
  },
  {
    id: "hubspot-marketing",
    title: "HubSpot / Attribution / Email",
    color: "#f5c542",
    items: [
      "Implement HubSpot attribution hygiene (UTMs + conversion audit + LinkedIn pixel validation)",
      "Fix HubSpot tracking integration and implement manual UTM parameters",
      "Audit all creatives for proper UTM codes",
      "Audit conversion definitions — remove 'service page view' trigger",
      "Create/verify HubSpot 'Hot Leads' scoring view (email engagement, site visits, ad engagement, lead score threshold)",
      "Set daily Tier A/B/C lead-intent ranking workflow in HubSpot",
      "Create booked-call confirmation/prep email template in HubSpot",
      "Create new-lead response email template for leads with no call booked",
      "Create no-show follow-up email template in HubSpot",
      "Create post-call recap email template in HubSpot",
      "Build robust nurture sequence (25–45 emails / ~100 days + 2-year nurture flow)"
    ]
  },
  {
    id: "linkedin",
    title: "LinkedIn Campaigns",
    color: "#f5c542",
    items: [
      "Make LinkedIn campaign structure decisions (V1 baseline, V2 test threshold, funnel separation)",
      "Switch LinkedIn campaigns from Primer-based targeting to native LinkedIn audience data",
      "Establish LinkedIn retargeting campaign targeting game publishers and gaming agencies",
      "Separate prospecting and bottom-funnel campaign structures",
      "Remove external-link usage in LinkedIn post flow — prioritize native uploads + comment/DM conversion path",
      "Document March LinkedIn Challenge playbook from February tests",
      "Pause V2 narrow audience campaign and maintain V1 broader audience (pending evaluation)"
    ]
  },
  {
    id: "alm",
    title: "ALM Partnership",
    color: "#f5c542",
    items: [
      "Follow up for ALM pricing rate card and account transition spreadsheet",
      "Follow up for Lynda to send ALM detailed SOW breakdown from Sanjay",
      "Provide ALM internal hourly rates and total cost per client",
      "Have ALM review deliverables and confirm replication feasibility",
      "Create rebranded ALM presentation for Robert to use with clients",
      "Obtain geographic information for ALM regional approach",
      "Determine which SEO clients qualify for initial pilot transition with ALM",
      "Clarify standalone AI Search component work in ALM partnership",
      "Decide whether to include standalone AI Search line item",
      "Schedule follow-up conversation on ALM AI Search differentials"
    ]
  },
  {
    id: "content",
    title: "Content / Media / SEO",
    color: "#f5c542",
    items: [
      "Build YouTube long-form content library and implement syndication routing",
      "Convert one long-form episode into short clips, prompts, SOP snippets, and one lead magnet draft",
      "Implement CDN and connect syndication partners",
      "Implement Beehive newsletter platform integration for Mike Signorelli",
      "Get projects set up for personal content postings",
      "Research semantic links strategy and provide counter-argument documentation",
      "Run C. Boyle Threads to 100 followers",
      "Update Lovable capabilities page (reviews, press, case studies, coverage, dashboards, automation, creative, email, landing pages, SEO)",
      "Create social content for Valley Link Marketing — warm, less negative, a little funny"
    ]
  },
  {
    id: "media-buying",
    title: "Media Buying / Partnerships",
    color: "#f5c542",
    items: [
      "Process media/partnership backlog (Gaming/Sports inventory, FIFA World Cup RFPs, PQG geofencing dependencies)",
      "Prepare/send FIFA World Cup RFP and baseline package options — establish split scenarios for budget tiers",
      "Ensure Meta media spend is on Ink Business Preferred credit card (up to $150k) for 4% return",
      "Do dashboard money analysis — Datorama cost + Rishabh's cost, identify redeployment savings",
      "Develop tiered New Game Club subscription model",
      "Build platform/inventory comparison grid (guaranteed vs non-guaranteed)",
      "Advance white-label infrastructure packaging for partners",
      "Formalize referral economics and partner onboarding assets"
    ]
  },
  {
    id: "ops-internal",
    title: "Operations / Internal",
    color: "#34c759",
    items: [
      "Create an updated org chart",
      "Formalize a better process to compile client information and define step-by-step workflow",
      "Connect assist@brillmedia.co to enable outbound email sending",
      "Talk to Bob about a rev share agreement",
      "Update the growth engine agreement, send to Bob, put in folder",
      "Respond to creative team about Canva access",
      "Check why Rohan is using Otter and confirm context",
      "Re-check Otter (assist@brillmedia.co joining calls, Rochira visibility, Brill Media sharing)",
      "Get call tracking back on track",
      "Get meeting notes back into assistant workflow",
      "Buffer social posting failures — may need re-authorization across all connected accounts",
      "Ensure AD1 global unsubscribe file is applied before new traffic",
      "Migrate Google Cloud image/video endpoints before 2026-06-30",
      "Build and maintain system for saving marketing effort data (Miro boards, Google Docs)",
      "Productize value ladder execution — document V1 process into repeatable SOP",
      "Standardize diagnostic → launchpad → growth-engine handoff",
      "Deliver SEO audit + implementation prerequisites where pending",
      "Build/check client retention 'check-engine-light' scorecard process"
    ]
  },
  {
    id: "ai-workflows",
    title: "AI Workflows & Tools",
    color: "#34c759",
    items: [
      "Focus on queued AI workflows: creating images for social, adapting existing images for social, writing SEO articles",
      "Decide Google AI Pro vs Ultra for Gemini 3.1 image/video",
      "Do more with Google AI image workflow + have Claude build landing pages",
      "Use separate Chrome profile for Claude autonomy"
    ]
  },
  {
    id: "gbp",
    title: "Google Business Profile Strategy",
    color: "#34c759",
    items: [
      "Ahamed A to add GBP content strategy to marketing review meeting agenda — coordinate with Sanjay + Adrian",
      "Research competitor marketing firm GBP activity (what are other agencies posting?)",
      "Ahamed/Design to create Canva design template for GBP posts (4:3 ratio, 1200x900px)",
      "Finalize GBP content types framework (FAQs, process walkthroughs, customer wins, testimonials, offers/events)"
    ]
  },
  {
    id: "personal-finance",
    title: "Personal — Finance & Cards",
    color: "#007aff",
    items: [
      "Call Chase to request expedited delivery of Disney credit card",
      "Check credit cards for current 0% balance transfer offers and expiration windows",
      "Take advantage of JetBlue cash back offer (promo terms + authorized-user bonus window)",
      "Activate T-Mobile MLB.TV for free",
      "Set up FHA healthcare account",
      "Check streaming credit triggered + anniversary progress"
    ]
  },
  {
    id: "personal-life",
    title: "Personal — Life & Projects",
    color: "#007aff",
    items: [
      "Plan neighborhood Dodgers game get-together (Bill and Anthony)",
      "Get scratched lens replaced",
      "Route mail somewhere other than home address",
      "Move camera recording position out a bit",
      "Get photography site live"
    ]
  },
  {
    id: "personal-coaching",
    title: "Personal Coaching",
    color: "#5e5ce6",
    items: [
      "Add notes for personal coaching"
    ]
  }
];
