# Routing: each step, its worker and its starting message

Every item is one workspace in the product's repository, created with its first worker as `orchestrate-sessions` says. Every starting message names: the source and its revision, the access tier and the missing sources, the status-file path, the document destination and the Session folder, the Session name, the validation level for a writer, the product's local folder (the pre-check's `memory`; raw pulls go in its `data/`), and "follow the rules in seo-loop, Rules for the whole loop". A worker that opens a `.seo/` PR also gets the answers saved only in memory (autonomy, cadence, sources to go without, the loop decision) and writes them into `.seo/access.md` in that PR. Write it to an absolute file and pass that file as the message.

The strategist, measurer and investigator also take `--arg source=<file>` and `--arg parent=<status file>`, and `--arg docs=<destination>` when the repository's workspace instructions name no document destination (see `orchestrate-sessions`, Document destinations).

## Step 2: history read-back (measurer)

- **Needs:** Search tier and the repository. Without Search Console, ask (seo-loop section 0); without the repository, the step does not run and the handover says so.
- **Message:** "Read back every merged change to the public site since <start date, default the first public commit or 12 months> against Search Console at 21 and 42 days, with a control group, as seo-read-back's history mode says. Group changes into experiments and write them as records under `.seo/experiments/` on your own branch and draft PR. Name every drop you cannot explain in your report's `drops` list."
- **Done when:** every merged change to a public path is classified (coverage appendix), every experiment has its reads or its review date, the draft PR touches only `.seo/`, and the report lists unexplained drops with their numbers.
- **Then:** each unexplained drop becomes a step 4 item; the deep dive (step 5) follows.

## Step 3: agent discovery (measurer)

- **Needs:** Public tier at least. AI referral counts need Analytics; the survey needs Full.
- **Message:** "Check agent discovery for <url>: both scanners named and dated (readiness, not citations), AI referral visits by assistant by month, what sign-ups say sent them, and the answer panel (validate one manual run before any repeat), as seo-read-back and seo-answer-panel say."
- **Done when:** each signal has its number, denominator, window and source, and every missing source is named.

## Step 4: one drop, read-only (investigator)

- **Needs:** whatever the drop's evidence lives in; the investigator asks for a missing source rather than reasoning around it.
- **Message:** "Why did <metric> on <pages or segment> fall from <before> to <after> between <dates>? One question, read-only, as seo-search-diagnosis says. Rule known data issues in or out first. End with the root cause, its confidence and the one measurement that would settle it. No fixes."
- **Done when:** the report has evidence with the queries that produced it, ranked hypotheses, the confirming trace, what was ruled out and why, the confidence, and the settling measurement.
- **Then:** the reviewer reviews the report; the strategist reads it before the ranked page.

## Step 5: the deep dive (measurer, then reviewer)

- **Message:** "Write the product's deep dive from your read-back and the investigations, as seo-read-back's deep-dive output says: a five-minute summary that opens with the actions, then the phases and experiments, then the coverage appendix that classifies every change and re-verifies headline numbers by a separate script."
- **Done when:** the reviewer's latest findings say `Ready for the person: yes`.

## Step 6: the evidence merge (strategist)

- **Runs when:** the Session covers more than one product, or a deep dive found a lesson `seo-evidence` lacks.
- **Message:** "Merge this run's evidence with `seo-evidence`'s references into one evidence page: where the products agree and where they differ, each claim with its number and source, and a list of new lessons proposed for the references, each with its number and source. Change nothing in the references."
- **Done when:** reviewed, with every claim sourced.

## Step 7: the ranked page (strategist)

- **Message:** "Build the ranked quick-wins page for <url> at the <tier> tier with growth-quick-wins: 25 to 50 quick wins and 10 to 15 workstreams, each with its action, time, category, evidence line and review date, opening with the top actions. Read the deep dive, the investigations and `seo-evidence` first, then the picks history and approach changes at <memory path>: leave declined items out unless this product's evidence changed (say what changed), rank items not picked twice below the rest, and drop any kind of change that lost twice on this product, saying so with the reads. On a scheduled review, your `.seo/` PR also sets `last_review` in `.seo/access.md` to the review's date. Then run the rerun and gap check and list what the first pass got wrong or missed. For a new site, run seo-foundations first."
- **Done when:** the page and its gap check are in the bundle, then the reviewer says `Ready for the person: yes`.

## Step 8: picks, briefs and the writer

1. Relay the reviewed page's picks to the person (seo-loop section 4). Record each pick as a D-n.
2. Per pick, the strategist writes the page brief (seo-page-brief) in the pick's workspace, or a cover sheet when the pick changes site code. A cover sheet waits for the person's approval.
3. Then the writer, in the same workspace: "Build the brief at <path> (revision <n>) as seo-page-brief says, write its experiment record as `seo-experiments` says, and open a draft PR. Validation: full." The writer's own skills cover QA and babysitting.
4. When the writer reports done, the review starts on its own (seo-loop section 3).

## Questions workers raise

A worker's `needs_you` reaches the person as `orchestrate-sessions` says. Three SEO questions recur; answer from the ledger before relaying when you can:

| Question | Answer from |
| --- | --- |
| A source is missing | `seo.access`; when the person already chose "continue at the current tier" for this source, send that answer and record it |
| Which drop to investigate first | the drop with the most lost clicks or sign-ups, unless the person ranked them |
| Whether a fourth experiment may start this review | always the person: the cap is a rule of the loop |
| Anything already answered | working memory's `questions` and `.seo/access.md`; never ask the person twice |
