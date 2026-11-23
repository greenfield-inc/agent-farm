# Data sources

How each source behind the evidence was reached, and the traps each one set. Use it whenever you pull data or judge whether a number can be trusted. Read credentials from the environment or a secret manager at the moment of use; never paste, print or commit them, and never put a property id or key in a page or record.

Product A is an open-source developer tool for running coding agents in parallel. Product B is a B2B healthcare SaaS with a free plan.

## Check freshness before every read

Data jobs fail silently. On Product A, four failed in one season and each was found late: analytics recorded nothing from 2026-09-09 to 10-05 after an 800,000 to 900,000 events-a-day burst (likely a quota cutoff); the install-matching job failed all 7 runs on an empty secret; IndexNow submission was refused 10-27 to 10-29 over a failed payment; and site changes merged on 07-17 reached production only on 08-05 after a silent deploy-hook failure ("Growth, phase by phase", v2, 2026-11-04).

Before you read any number:

1. Pull a daily total for every source across your whole window and look for days at or near zero. A gap that removes every event type at once is an outage; exclude that window from every comparison and say so.
2. Check the date of the last data point. Search Console's last final day runs about 3 days behind today.
3. For a site that deploys by hand, confirm the change you are reading actually deployed (see [Repository history](#repository-history)).
4. Check each scheduled job's last successful run and that its secrets are set.
5. Record what you found in the output's source list, including "no gap found".

A gap found a month late cannot be filled. A missing window stays missing; never interpolate it.

## Search Console analytics

Reached through the connected Search Console tool, read-only.

- **Pull shape.** Query search analytics with dimensions `date`, `page,date` and `query,date`, search type web, data state final. Page through results 25,000 rows at a time until a page comes back short. Large outputs come back as a file path instead of inline rows: read the file, and keep it as the raw pull.
- **Three totals that never match.** Property totals come from the date-only pull. Page-level sums run higher, because one search can show several of the site's pages (Product A lifetime: 10,298 clicks by property, 10,513 by page; impressions 334,447 against 393,526). Query-level sums run lower, because Google withholds rare queries (Product B's query report held about 55% of its clicks over 90 days). Say which total each number is.
- **Fold URLs before you sum.** Fold `www`, trailing slashes and `/index.html` into one page. Drop `#fragment` URLs: since October Search Console reports section anchors as their own URLs (Product A: 12,158 impressions and zero clicks on fragments to 2026-11-01), and they come from the same result as their page.
- **Positions.** Average position is per query, not per page, and an AI Overview source card is counted at the Overview's position. A steady position does not mean steady clicks (corrections, entry 9).
- **Brand split.** Keep one versioned brand pattern (the brand and its common misspellings) and split every report into brand and non-brand, and homepage against every other page.
- **Windows.** Search Console dates are Pacific time. Compare matched windows of the same length and scope, and say the window with every number.
- **Questions it cannot answer.** It sees no sign-up, and analytics sees no query. The join between them is the landing page only.

## URL Inspection

Reached through the same connected tool. Inspect the exact canonical form of each URL (with `www` if the site uses it).

- Inspect every new URL, never a sample, at day 7 after it goes live. The October checks on Product A inspected all 41 pages; Product B inspected every page of its templated batch.
- "Discovered, currently not indexed" and "URL is unknown to Google" both mean Googlebot never fetched the page. Google has not judged its content, so do not rewrite the content in response; look at who links to the page.
- A 404 with an old "last crawled" date names its referring page: that is how Product B traced several missing pages to a link shipped days before them.
- Before you diagnose code from an indexing report, check the submitted sitemap's exact URL and protocol and the age of any redirect. Product A's early "0 of 31 indexed" came from a sitemap submitted with an `http://` address, and its `www` split was index lag after a redirect ("SEO: GSC Findings and Diagnosis", data pulled 2026-05-07).
- A page that returns 200 with a canonical and valid JSON is not proven indexed or rich-result eligible. Only the inspection says so.

## AI-feature impressions

Search Console's Generative AI features report (Performance, Generative AI features) is available only in the Search Console screen. The API returns `400 INVALID_ARGUMENT` for the search types `aiOverview`, `aiMode` and `generativeAi`, and a `searchAppearance` query returns no AI rows ("Product B growth deep dive", 2026-11-03; "Conductor query clicks: evidence tables", 2026-11-03).

To use it:

1. Open the report for the window you need and read its tables from the screen (or have the person export them).
2. Transcribe impressions by month and by page into the run's data folder.
3. Label every number "transcribed from the Search Console UI on <date>".
4. Keep it as impressions only. The report has no clicks or queries, so never invent a click or query split.
5. Report AI-feature impressions as a share of web impressions only with the caveat that whether Google counts them inside web impressions is unverified. Page sums can exceed property totals because slash variants count separately.
6. A zero in a UI export may mean unavailable rather than none.

What it showed on Product B: AI-feature impressions rose from 14% of web impressions to 34% about three months later, concentrated on definition and compliance pages.

## Analytics

Product A and Product B used PostHog with HogQL; the same traps apply to GA4 and other tools.

- **Query month by month, with an explicit limit.** Synchronous queries time out on long windows, and the default limit of 100 rows silently truncates results. Set `LIMIT` on every query and pull one month at a time.
- **Count sessions, not pageviews, for channel shares.** A single-page app that captures pageviews on navigation keeps the external referrer for the whole session, so pageview counts weight deep sessions. Product A's AI-visit pageviews and AI-visit sessions told different-sized stories.
- **Classify AI visits by referrer or `utm_source`.** From October 2026 ChatGPT sent most visits with no referrer and `utm_source=chatgpt.com`. A referrer-only classifier loses them; the tag keeps them. Classify ChatGPT, Claude, Perplexity, Gemini and Copilot by either field, and take the landing page as the first pageview of each session.
- **Test the Direct bucket before blaming referrer loss.** On Product A, direct and untagged landings on compare pages stayed flat while AI landings there fell, so the lost AI clicks did not hide in Direct.
- **Event definitions change.** Read each event's definition and the date it started or changed. Product B's "signup completed" event fired per user and overcounted organizations about 4x; net-new sign-ups are organizations. Product A's `download_started` event covered only 3% to 4% of GitHub downloads; its all-downloads total is a marketing number and human installs the internal one ("Analytics and Attribution", Product A, May 2026).
- **Bots inflate counts.** Product A's "human" download users tripled in three weeks, 1,338 to 4,065 a week, while visitors fell: bot leakage, caught in the 2026-08-05 briefing. A count that rises while its upstream falls is a data problem until proven otherwise.
- **Pageviews are floors.** Ad blockers drop some captures; server-side events do not. Never divide a server-side count by a client-side count to get a conversion rate.
- **Know when the project starts.** Product B's analytics began at the start of its rework, website pageviews soon after, and its server-side sign-up event much later. Nothing earlier exists, so say so instead of extrapolating.

## Repository history

The source for "what changed and when". Read it with `git log` and `git show` in a fresh clone or with read-only commands; never check out, reset or stash a working copy someone else is using.

- **Enumerate every change, never a sample.** Run `git log --first-parent --since=<start>` on the default branch over every path that produces a public page: site source, docs, metadata and schema, sitemaps, robots.txt, llms.txt, agent files, redirect configuration. Then list merged PRs for the same window.
- **Reconcile commits to PRs.** Match each first-parent commit to its PR; match commits without a PR number through the hosting API; name direct commits. Squash-merging repositories keep per-commit times only in the PR's commit list.
- **Date by live date when deploys are manual.** On a site that deploys by hand, a merge is not a launch. Date each change by the first successful deploy run whose head contains the PR's merge commit, read from the CI run history. Product B's foundation PR went live well after it merged. A Product B change merged and was reverted before any deploy, and was never live. Where deploys run on merge, the merge date is the ship date.
- **Say what git cannot show.** Redirects configured outside the repository, side-branch merges, and shared components (footer, head, homepage sections) that change many pages without a per-page diff. List them in the coverage appendix.
- **Work sessions.** Rebuild them from every human commit on every branch plus PR open and merge times; events less than 2.5 hours apart form one session ([lessons-by-phase.md](lessons-by-phase.md#work-sessions-rebuilt-from-git)).

## Sign-up survey

The "How did you find us?" answers are the only source that shows AI recommendations that tracking hides. On Product B they were read from the analytics warehouse.

- **Access.** Connect with a read-only database role, inside read-only transactions with a statement timeout (60 seconds was used), and confirm a test write is refused before running anything. Find the answer field in the schema by searching the code for the question's wording.
- **Aggregates only.** Return counts and shares by month and by answer. No names, emails, organization names or free-text answers leave the database.
- **Find the dates the question changed.** Read the history of the sign-up form's code. Each change to the options breaks the series. Product B added an AI option partway through its rework (before it, about 2% typed AI in as free text), and later made "Other" require text. Shares from before and after a change are not comparable; label the break.
- **Fix one counting rule.** Count non-deleted organizations created in the window. Product B's warehouse had a burst of deleted organizations answering "Internet search" (spam or QA) that would have swung the shares.
- **State the denominator.** The AI share of Product B sign-ups was about 4% by tracking, about 20% of all net-new sign-ups since the option, 25% to 28% of each month's answers, and 27% of answers on another base. All were correct for what they measured; quote the one you use with its base.

## Scanners

Two free scanners score agent readiness: whether an agent could find, read and use the site. Neither measures citations or AI traffic (corrections, entry 2).

- **is-agentic.** Run `npx is-agentic <domain> --json`. It returns a cached scan when one exists, so the scan date can be weeks older than your run: Product A's re-run on 2026-11-03 returned a scan dated 2026-08-31.
- **Ora.** `POST https://ora.ai/api/scan` with `{"url": "https://<domain>"}`. It reports sub-scores (discovery, access, usability).
- **Citing them.** Write each score with its scanner's name and its scan date, in the form "is-agentic 100/100 (scan dated 2026-08-31)" and "Ora 87/100 (2026-11-03)". Keep the two apart. Save the raw JSON with the run.
- **Using them.** Check every gap a scanner reports against the live site before you repeat it, and keep only the gaps that matter for the site's buyers (corrections, entry 3).

## Live probes

- `curl -sI` for status, canonical, `X-Robots-Tag` and redirects; `curl` with `-H 'Accept: text/markdown'` and with an agent user agent (GPTBot, ChatGPT-User, Claude-User, Perplexity-User) to see what agents receive; view the raw HTML to confirm content is server-rendered.
- Results pages: a logged-in check may be personalized. Capture logged-out results on more than one day before a verdict, and record the date, country and whether you were logged in.

## The data contract

Every extract the run keeps records the same facts, so a later run can trust or repeat it. The method comes from a customer workflow starter, generalized.

- **Per extract:** source, extraction time, source time zone, inclusive start and end dates, filters, dimensions, metric definitions, pagination, row count, whether the last day or month is partial, and the query or tool call used. Keep the raw file; derived tables point to it.
- **Unavailable is null with a reason, never zero.** A definition change inside a series gets a labelled break.
- **Metric definitions to state:** clicks and impressions by property, page or query total; CTR as clicks over impressions; position as impression-weighted average per query; sessions (not users) for channel shares; sign-ups as organizations; AI-feature impressions as transcribed impressions only.
- **Segments kept apart:** brand and non-brand; homepage and other pages; country and device when they move differently; new and repeat; business outcomes (accepted leads, sign-ups) and supporting signals (traffic, ranks, AI impressions) in separate tables.
- **Low counts are descriptive.** Under 20 clicks, a reading is directional only. Weekly changes at low counts get no statistical or causal claim.
- **Unofficial scores** (vendor authority scores, scanner scores) are proprietary and are not ranking factors. Never infer demand or penalties from them.
