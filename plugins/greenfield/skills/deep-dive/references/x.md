# X post recovery

Read [shared Bright Data operations](bright-data.md) for credentials, discovery, request recovery and media. Use Google `site:x.com` queries to discover posts, then the dedicated scraper to recover them. Indexed search is not exhaustive native X search.

Canonicalize `twitter.com`/`x.com` status URLs by numeric post ID, remove tracking parameters, and deduplicate before paid requests. Do not replace account handles or invent post URLs from incomplete IDs.

For known posts, POST to:

```text
https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lwxkxvnf1cynvib9co&format=json
```

Use the same bearer header and a JSON array:

```json
[{"url":"https://x.com/<author>/status/<id>"}]
```

Use the shared sync/async recovery flow for pending requests. Inspect per-record errors and requested/returned post IDs before marking the batch complete.

Posts may contain `description`, `quoted_post`, `photos`, `videos`, `external_image_urls`, `external_video_urls`, and links in the text. Preserve the original data before normalizing. A quote may be truncated, and a thread/article may require further retrieval. Do not infer missing bodies from previews. Resolve short links to their actual repository/document destination.
