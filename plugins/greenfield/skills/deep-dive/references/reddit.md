# Reddit collection

Use alongside X to find practical experience, failures, workarounds and follow-ups. Follow the main skill's API-key question and [shared request/cache handling](bright-data.md). Documentation checked 18 September 2026:

- [Reddit introduction](https://docs.brightdata.com/products/scrapers/reddit/introduction)
- [Reddit endpoint examples](https://docs.brightdata.com/products/scrapers/reddit/send-first-request)

## Discover and recover

Use Google `site:reddit.com` discovery through the configured SERP API, supplied links, and relevant subreddit or keyword discovery. For bounded Reddit-native discovery, the scraper's keyword/subreddit inputs do not require a SERP zone.

Use bearer authorization and JSON with the common `/datasets/v3/scrape` endpoint for known URLs. Select the dataset for the record type:

| Data | Dataset ID | Example input |
| --- | --- | --- |
| Post | `gd_lvz8ah06191smkebj4` | `[{"url":"https://www.reddit.com/r/<community>/comments/<post_id>/<slug>/"}]` |
| Comments | `gd_lvzdpsdlw09j6t702` | `[{"url":"<post-or-comment-url>","days_back":7}]` |

Include `dataset_id` and `format=json` in the request query. Omit `days_back` when older context matters. A post record or comment count does not mean comments have been recovered; use the comments endpoint for selected threads.

Discovery uses the posts dataset. Prefer `/datasets/v3/trigger`, followed by the shared snapshot progress/download flow:

- Keyword: add `type=discover_new&discover_by=keyword`; input such as `[{"keyword":"<technology>","date":"Past week","num_of_posts":20}]`.
- Subreddit: add `type=discover_new&discover_by=subreddit_url`; input such as `[{"url":"https://www.reddit.com/r/<community>/","sort_by":"Hot"}]`.

Verify current enums and result limits before running. The endpoint guide specifies case-sensitive `Hot` and rejects lowercase `hot`, despite lowercase labels in the introduction. Use bounded counts/limits supported by the current endpoint. Budget comments as records too; a small post count can yield many comments. If a discovery limit cannot be established, use targeted known URLs instead of an unbounded subreddit crawl.

## Preserve discussion context

Deduplicate posts by post ID and comments by comment ID; preserve subreddit, author, date, parent relationships and source permalinks. A comment permalink is distinct evidence, not a duplicate of its parent post. Resolve short/share links before stripping tracking parameters. Treat cross-posts as related evidence rather than independent confirmations.

Read the parent claim, relevant replies and later corrections. If parent links or nested replies are missing, report partial thread coverage. Prioritize firsthand use with concrete details; upvotes and repeated anecdotes do not verify technical claims. Follow linked documentation/code to check mechanisms and mark deleted, inaccessible or unverified content explicitly.
