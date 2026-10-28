# Ground truth

## Find the sources

Look, in this order, for what the product records about its use:

1. The workspace connections and tools this session has: an analytics service, a warehouse, an error tracker, a support inbox.
2. The repository's own tracking and logging code: which events it sends, where, under what consent rule, and since which commit.
3. Databases and exports the repository documents: usage tables, logs, support ticket exports.

Read every source read-only. When a source exists but you lack access, ask the person for it once, as a `needs_you`-shaped question. When no data source exists, fall back to the code and interviews with the person and their users, and say so at the top of the report.

## Correct the numbers

Apply each correction before any number is shared, and show the raw figure beside the corrected one:

- **Automated traffic.** Remove test runners, CI machines, scanners, crawlers and the team's own installs. Name each filter and how many rows it removed.
- **People, not installs.** Count people, not installs, devices or sessions. State the rule that links several installs to one person, and exclude the team's own outliers.
- **Untracked share.** Estimate the share of people who opted out or block tracking against an independent count (downloads, sign-ups, server logs), with automated and internal traffic removed from that denominator too. State the method and give a range.
- **Tracking changes.** Before reading any trend, check the window for changes in what is tracked or under what consent: a new event, a consent default, an SDK upgrade. Split the trend at each change.

## One query set

Save the corrected queries once, as files in the research bundle, each with a name, the question it answers and the filters it applies. Every study reuses this set, and every number in every report links the query that produced it. A study that needs a new query adds it to the set with the same corrections.

## The report

The ground-truth report opens with the facts that change decisions, then shows raw beside corrected for every headline number, then the caveats (what is untracked, what changed, what the range is), with every query in an appendix.
