# Bright Data operations and scraper discovery

Shared by `deep-dive` and `tech-deep-dive`. Official documentation checked 18 September 2026; discover current endpoint schemas rather than treating this reference as an exhaustive scraper catalog.

## Ask once about access

Reuse a usable key supplied in the session or configured locally without displaying it. If Bright Data would help the investigation and no key is available, explicitly ask the user to provide/configure a Bright Data API key or skip. Prefer secure configuration over pasting secrets into conversation text. Offer “Configure Bright Data (recommended)” and “Skip and use accessible sources” when choices are supported.

Explain the tradeoff in the same question, matched to the sources being researched:

> Would you like to configure a Bright Data API key or skip it? Without it, I may miss complete posts, comments, reviews and media from harder-to-access sites. For X-heavy research, expect substantially weaker coverage. I can still research accessible pages and primary sources, and I’ll identify what I could not verify.

Reddit coverage may also be incomplete. Do not imply every subject will suffer equally, or that a key guarantees full coverage. Assess completeness per source; an accessible full discussion remains full evidence.

If skipped or already declined, continue without repeated prompts, state the fallback, and carry actual coverage gaps into the final artifact. Continue independent work while awaiting configuration. An absent answer is not a key or authorization to provision an account.

Use configured environment/secret storage such as `BRIGHT_DATA_API_KEY`; `BRIGHT_DATA_SERP_ZONE` is a useful local convention for search configuration, not a mandatory vendor variable. Never put actual keys into instructions, URLs in artifacts, code commits, source ledgers or error logs. A valid credential's existence does not establish access to every Bright Data product.

SERP, Web Unlocker and Browser products have product-specific zone/credential requirements; inspect their docs and available configuration. Ask for a missing zone separately. Do not invent zone names. A missing SERP zone does not prevent supported direct scraper requests with a usable key. If zone setup is skipped/unavailable, continue those requests and clearly named accessible-search fallbacks. Do not silently call another provider Bright Data.

## Find the capability that fits

Start here, then read the matching platform's endpoint page:

- [Task-oriented documentation index](https://docs.brightdata.com/llms.txt): locate current product and platform docs without loading the entire documentation corpus.
- [Scraper overview and library entry point](https://docs.brightdata.com/products/scrapers/overview): discover prebuilt scrapers and supported record types.
- [SERP API](https://docs.brightdata.com/products/serp-api/introduction): search-engine results and discovery.
- [Web Unlocker](https://docs.brightdata.com/products/web-unlocker/introduction): page retrieval when an appropriate prebuilt extractor is unavailable or raw page content is needed.
- [Browser API](https://docs.brightdata.com/products/scraping-browser/introduction): rendering and interaction when required by the task.

Use this routing as examples, not a fixed or complete list:

| Evidence needed | Candidate source/capability to inspect |
| --- | --- |
| Public discussion and user experience | X, Reddit, relevant social posts/comments |
| Products, current offers and customer reviews | Retail/marketplace scrapers, including Amazon |
| Local services, venues and experiences | Google Maps/place and review data |
| Organizations, professional context and job listings | LinkedIn/company/jobs record types and appropriate official sources |
| Demonstrations and creator explanations | YouTube/video metadata and comments; verify whether the needed transcript/media is available |
| Additional platforms or specialized records | Search the current docs index and scraper library for the target site and exact record type |

Useful platform starting points: [Amazon](https://docs.brightdata.com/products/scrapers/amazon/introduction), [LinkedIn](https://docs.brightdata.com/products/scrapers/linkedin/introduction), [YouTube](https://docs.brightdata.com/products/scrapers/youtube/introduction), [Google](https://docs.brightdata.com/products/scrapers/google/introduction), [X](https://docs.brightdata.com/products/scrapers/twitter/send-first-request), [Reddit](https://docs.brightdata.com/products/scrapers/reddit/introduction).

A site's post/product/profile scraper may not include its comments, reviews or thread replies. Verify record type, collect-versus-discover mode, input schema, filters, pagination/limits, dataset ID, response fields and account access. Start with a small useful request before scaling. Do not copy X's dataset ID or request assumptions into another platform. Inspect documentation for errors before retrying.

Use existing authenticated MCP/CLI capabilities when they fit; otherwise direct API requests are appropriate. Do not install extra toolchains, create accounts, buy datasets or launch custom-scraper projects merely because the catalog offers them. Those are separate scope decisions, not prerequisites to a useful deep dive.

## Search and collect

For Google discovery, POST `https://api.brightdata.com/request` with bearer authorization and JSON:

```json
{"zone":"<configured SERP zone>","url":"https://www.google.com/search?q=<URL-encoded query>&hl=en&gl=us&brd_json=1","format":"raw"}
```

Inspect the returned envelope. Preserve queries, locale, date filters, pagination and retrieval times. Google-indexed `site:x.com` or `site:reddit.com` discovery is not native platform search and is not exhaustive. Search both the relevant platform and wider web for primary sources, directories, official collections and counterexamples. Date filters are not proof of source publication dates.

Scraper collection generally uses bearer-authenticated `POST https://api.brightdata.com/datasets/v3/scrape?dataset_id=<verified-id>&format=json`, with inputs matching that scraper's schema. Use [X recovery](x.md) and [Reddit collection](reddit.md) for the established social workflows. Other platforms require their current docs; do not assume every surface accepts a bare URL or the same limits.

The common synchronous flow waits up to about a minute and may return `202` with a `snapshot_id`. Save that ID and [monitor progress](https://docs.brightdata.com/api-reference/scrapers/management-apis/monitor-progress) with bearer-authenticated `GET https://api.brightdata.com/datasets/v3/progress/{snapshot_id}`. `starting`/`running` are pending; `failed`/`canceled` are terminal. On `ready`, retrieve `GET https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}?format=json`. Use the documented async `/trigger` flow for discovery/larger batches. Persist results before marking work complete. Inspect per-record errors and partial results even after HTTP 200.

## Cache, budget and recover

Keep raw responses and request state in a task-owned research directory outside the deliverable. Record normalized inputs, submitted batches, response files, pending snapshots, failures and completed source IDs. Deduplicate before paid calls and reuse cache unless freshness or missing fields justify a new fetch. Preserve distinct review/comment IDs and parent context.

Expand in bounded batches after checking novelty and remaining limits. Count records, including reviews/comments, and requests; do not invent dollar costs when pricing is unknown. Use server-provided retry timing and bounded retries for transient failures. Stop authentication/permission failures and fix configuration instead of repeatedly requesting. After an ambiguous timeout, inspect known job state before resubmission; disclose unrecoverable uncertainty about acceptance.

## Media

Save useful original media locally with source attribution. Check status, content type, size and actual rendering; HTML errors are not images. For X image failures, a standard variant such as `?format=jpg&name=large` may work. For denied media delivery, seek an original author mirror or retain the source link and mark the gap. Do not invent a screenshot or describe failed media as embedded. Label explanatory diagrams and reconstructions. Use controlled playback and compatible video formats; avoid large base64 payloads when local assets are supported.
