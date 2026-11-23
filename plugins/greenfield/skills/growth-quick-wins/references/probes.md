# Probes

Each probe lists its tier, the exact command or query, and the result that triggers an item. `$SITE` is the canonical origin, such as `https://www.example.com`, and `$DOMAIN` its host. Run the Public probes on every audit.

## Public: crawlability and indexing

**P1. Sitemap inventory.** `curl -sL $SITE/robots.txt` then fetch each `Sitemap:` line (and `$SITE/sitemap.xml`). List every URL with its `lastmod`.
- No sitemap, or robots.txt without a `Sitemap:` line: Indexing quick win.
- Most URLs share one `lastmod` (the build date), which Google then ignores: make it the real last change. Count with `curl -s $SITE/sitemap.xml | grep -o '<lastmod>[^<]*' | sort | uniq -c | sort -rn | head`.
- Sitemap lists a URL that is noindex, redirects, or 404s (from P2): remove it.

**P2. Every page's status, robots, and canonical.** For every sitemap URL and every page linked from the homepage, menu, and footer:
```sh
curl -sIL -o /dev/null -w '%{http_code} %{url_effective}\n' "$URL"
curl -sL "$URL" | grep -ioE '<meta[^>]+name="robots"[^>]*>|<link[^>]+rel="canonical"[^>]*>'
curl -sI "$URL" | grep -i '^x-robots-tag'
```
- A money page (pricing, product, sign-up, plans) carrying noindex, or missing from the sitemap, or canonical to another URL: top Indexing quick win.
- Redirect chains, 302s for permanent moves, `/slug` to `/slug/index.html`: Cleanup quick win, one 301 hop to the final URL.
- Canonical pointing at a different page: confirm the intent before calling it a bug.

**P3. Find the money pages directly.** Fetch `$SITE/pricing`, `$SITE/plans`, `$SITE/price`, and any URL in the menu or footer whose text says pricing, plans, buy, or free. Follow redirects to the final URL and run P2 on it. A pricing page can live outside the sitemap and the menu; P1 alone misses it.
- Final pricing URL is noindex, unlisted, or linked only from old posts: Indexing quick win #1 for this site.

**P4. Internal links to each page.** Crawl internal links from the homepage, following listing, pagination, and tag pages as well as sitemap pages (or read the link graph from the repository at Full tier). Sitemap pages alone produce false orphans. For each URL, count inbound links and note which come from the homepage, menu, footer, or a page with traffic.
- A page with zero inbound links outside the sitemap (an orphan): link it from a reachable page that earns traffic.
- A family of pages (comparisons, alternatives, integrations) linked only from each other or only from the blog: link the family's hub from the menu or footer and each page from its matching product page.

**P5. Broken and legacy URLs.** Collect old URLs from the sitemap history (Repo), from internal links, and from search results (`site:$DOMAIN pricing`, `site:$DOMAIN <old product name>`). Check each with P2.
- A 404 that once earned traffic or has links: redirect to the closest live page, not the homepage.
- Internal links to pages that do not exist yet: remove until the page is live.

**P6. Canonical host and URL variants.** `curl -sIL` on `http://$DOMAIN`, `https://$DOMAIN`, `https://www.$DOMAIN`, and for three key pages `/x`, `/x/`, and `/x/index.html`.
- More than one hop, a 302, or a page reachable at several URLs: one 301 to the canonical URL.

## Public: page content

**P7. Title and raw HTML.** `curl -s $SITE/ | grep -o '<title>[^<]*'` for the homepage and money pages, next to the top 3 competitors' titles. Compare the words in `curl -s -A Googlebot $URL` with the rendered page.
- A title that is only the brand name: add what the product is.
- Main text missing from the raw HTML (behind client rendering, tabs, or accordions): server-render it.

**P8. Money page answers.** Read the homepage, pricing, and top product pages. Note: is the price on the page; is there a pricing link beside the main call to action; what is the first paragraph; does the Product or Offer structured data carry a price.
- Product page without price or pricing link: add both near the top.
- First block is a definition ("What is X?") on a page meant to sell: move the buying answer up.
- Offer markup with no price: add the real price. Never add made-up reviews or ratings.

**P9. One fact, everywhere.** Collect the price, plan limits, and key numbers from the pricing page, `/facts` or about pages, llms.txt, structured data, blog posts, and comparison pages. Use today's pages, not an older audit's quotes.
- Any page disagreeing with the pricing page: Cleanup quick win listing each page and the wrong value.
- An earlier audit reported a conflict: re-read every page involved today and report only what is still wrong.

**P10. Page families present and missing.** Map the site's pages to the intent gradient: alternatives, vs, pricing, free plan, best-of, vertical or use case, definitions, docs.
- No "<competitor> alternatives" page while competitors are named in P12 and P13: Pages item (and the alternatives workstream).
- No page aimed at "free <category>" while the product has a free plan: Pages item.
- Many definition or explainer pages: judge them by AI views, write no more.

**P11. Template batches.** Look for groups of near-identical pages (one per city, per integration, per term). Count them and check P2 and, at Search tier, their index status.
- A large batch with many unindexed pages: stop the batch, link the indexed ones, fold the rest.

## Public: competitors and results pages

**P12. Competitor sitemaps.** For each competitor, fetch its sitemap and list URL patterns: `/alternatives/`, `/vs/`, `/compare/`, `/pricing`, `/free-`, `/for-<vertical>`, `/integrations/`, `/templates/`, and localized prefixes.
- A pattern two or more competitors have and this site lacks: Pages item or workstream, sized by the intent gradient.
- A competitor publishing "<this product> alternatives": the "own your alternatives page" item.

**P13. Results-page reading.** Search each of these and record the top results, whether an AI Overview appears, and whether the site appears: `<product>`, `<product> pricing`, `<product> alternatives`, `<competitor> alternatives`, `<product> vs <competitor>`, `best <category>`, `free <category>`, `<category> for <vertical>`. Read Google in a real browser (Playwright or Chrome), logged out, with `&gl=us&pws=0` on the URL, and save a dated screenshot of any results page you cite. A search tool that returns a written answer from an unnamed engine is not a results page: label its output "search tool", never "Google".
- The site ranks below #1 for its own name: entity and brand items (Organization data, Wikidata, consistent name).
- Another site owns "<product> alternatives": Pages item.
- AI Overview answers the query fully: do not promise clicks from a rewrite.

**P14. Citation probe.** Ask ChatGPT, Claude, Perplexity, and Gemini (and Google's AI Mode when available) 5 buyer questions: "<product> alternatives", "best <category> for <buyer>", "<product> pricing", "is <product> free", "<product> vs <top competitor>". Log, per assistant: named or not, position, which URLs it cites, and any wrong fact. Use whichever assistants this session can reach, logged out, and name each one on the page. Assistants that cannot be reached become a quick win for the team ("run the citation probe") and a line in the limits, never a guessed answer.
- An assistant states a wrong price or "prices are not public": fix the source page (P3, P8, P9), then re-ask.
- Assistants cite a third-party list instead of the site: best-of or alternatives page, and outreach to that list.
- Competitors named by every assistant: build their alternatives pages first.

**P15. What others say.** Search `"<product>" vs`, `"<product>" alternatives`, `"<product>" pricing`, and `"<product>" review`, and open each third-party page that ranks or is cited: competitor `/vs/` and `/compare/` pages, alternatives posts, review sites. Note each fact about the product and whether today's site agrees.
- A third-party page states a wrong or retired price, or "quote only" while prices are public: AI discovery item to email the owner a correction, after the site's own pages agree (P9). Several such pages: the "correct what others say" workstream.
- A competitor's page about the product ranks where the product has none: own the page (P10, P12).

## Public: AI readability

**P16. Readiness scanner.** is-agentic is ora.ai's short "essentials" score built on the same scan, so the two scores are one reading, not two:
```sh
curl -s "https://ora.ai/api/score/$DOMAIN" > ora.json
npx -y is-agentic $DOMAIN --json > is-agentic.json
```
Check `scannedAt` in the JSON: results can be cached from an earlier scan. Record each score under its own name with its scan date. Scores measure readiness for agents, not citations: never present a score as AI visibility.
- Take items only where the gap matters for this buyer. Developer items (MCP servers, OAuth discovery, API catalogs, agent cards) apply only when the product sells to developers or has an API agents would call. List the rest in "checked and left out on purpose".

**P17. What the site serves to agents.**
```sh
curl -sI -H 'Accept: text/markdown' "$SITE/"
curl -sI -H 'Accept: text/markdown' "$SITE/pricing"
curl -s "$SITE/llms.txt" | head -50
for f in agents.md pricing.md index.md; do curl -s -o /dev/null -w "$f %{http_code}\n" "$SITE/$f"; done
```
- llms.txt missing, or without a "when to use / when not to use" section or prices: AI discovery quick win.
- A file (agents.md, llms.txt, `.well-known/*`) that describes endpoints or claims the site does not serve: make it true or remove the claim.
- Markdown served for docs but not for marketing pages: candidate item, ranked below fixing facts; it has shown no measurable search effect on its own.
- Recommend agents.md only for products agents operate (developer tools, APIs).

**P18. Entity.** Check Wikidata (`https://www.wikidata.org/w/index.php?search=<product>`) and the Organization structured data on the homepage (name, URL, logo, sameAs, address for local or event businesses).
- Missing and the name is ambiguous or shared with another product: AI discovery item, and the entity workstream.

## Public: measurement

**P19. What can be read from outside.** In the homepage and form-page HTML, look for a Search Console verification tag (`google-site-verification`), analytics and tag manager scripts (GA4, GTM, PostHog, HubSpot, Segment), and whether each lead or sign-up form asks how the person heard about the product.
- A verification tag exists: a Search Console property exists; getting read access is a this-week item.
- No form asks the source question: the survey item (F2) is backed by this live check.

## Public: technical and demand

**P20. Technical basics.** For the homepage and every money page:
```sh
curl -sL "$URL" | grep -ioE '<link[^>]+hreflang[^>]*>' | head
curl -sL "$URL" | grep -o '<script type="application/ld+json">' | wc -l
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=$URL&strategy=mobile" > "psi-$(date +%F).json"
```
- hreflang pointing at a URL that is noindex, redirects or 404s, or locales without a return link: Cleanup quick win.
- No JSON-LD on the homepage: covered by P18.
- Field data (`loadingExperience`) failing Google's thresholds on a money page (LCP over 2.5 s, INP over 200 ms, CLS over 0.1): Cleanup item, ranked below every fact and indexing item.

**P21. Demand without Search Console.** At the Public tier, estimate demand for each planned page from outside data and say on the page that search volume was not measured.
```sh
curl -s "https://suggestqueries.google.com/complete/search?client=firefox&q=<term>"
curl -s "https://hn.algolia.com/api/v1/search?query=<term>&tags=story" | grep -o '"points":[0-9]*' | head
curl -s "https://api.github.com/repos/<owner>/<repo>" | grep -E '"(stargazers_count|created_at)"'
```
Read Google Trends for the term in a browser, and search Reddit and Hacker News threads that name the term. Grade each planned page's demand Full (autocomplete completes it and threads ask it), Partial (one signal) or Weak (none).
- Weak demand: drop the page or fold it into an existing one.
- A competitor with a fast-rising GitHub repo or a recent Hacker News launch and no alternatives page yet: Pages item, this week.

## Search tier (Search Console)

Pull through the connected Search Console tool. Data lags about 3 days; end every window 3 days before today.

**S1. Query export, last 90 days and last 28 days**, by query and by page. Split brand vs non-brand, homepage vs other pages, this year vs last.
- Brand carries most clicks: the plan is non-brand pages; say so in the summary.

**S2. Intent buckets.** Classify every query by the intent gradient and sum impressions, clicks, and click rate per bucket.
- A high-intent bucket (alternatives, free, pricing) with impressions and no matching page: Pages item, sized by impressions times the bucket's click rate.

**S3. The gap filter.** Non-brand queries with more than 100 impressions over 90 days and under 1% click rate; plus queries and pages with 200+ impressions and 0 clicks, and queries at position 4 to 20 with 100+ impressions.
- An unbuilt pool (no page whose URL and H1 match the query): Pages item. Product A's pools were "conductor competitors" (2,155 impressions at position 18.6), "claude squad" (1,882) and "is conductor free" (150).
- A page that exists: fix the first paragraph, merge into a winning page, or leave it if the results page already answers it (P13).

**S4. Conversational backlog.** Non-brand queries of 5+ words with 30+ impressions and under 1% click rate. This list is the page backlog keyword tools do not show.

**S5. Index coverage.** The Pages report (indexed vs not, and why) and URL Inspection on every page launched in the last 60 days.
- "Discovered, not indexed" or "Crawled, not indexed" on new pages: compare inbound links from traffic-earning pages for indexed vs unindexed (P4); link test as a quick win.
- Pages not re-crawled since a 404: request indexing and bump `lastmod`.

**S5b. Demand check for planned pages.** Before proposing a new page, filter Search Console for its head term. Zero impressions site-wide and no competitor page for it: drop the page or fold it into a glossary.

**S6. Cannibalization.** Queries where two or more of the site's pages appear. A newer page splitting an older page's query: redirect or fold.

**S7. Click-rate drop at flat rank.** For the top 20 non-brand queries, compare click rate before and after at similar positions.
- Click rate fell at the same rank: check P13 for a new AI Overview before rewriting.

**S8. AI-feature impressions.** Search Console's Generative AI report, read in the UI and transcribed with its date (the API does not expose it). Judge explainer pages by AI views, not clicks.

## Analytics tier

**A1. Referrers by AI assistant.** Landings from chatgpt.com, claude.ai, perplexity.ai, gemini.google.com, copilot.microsoft.com, by month.
- A sharp drop for one assistant: date the drop, then click a citation in that assistant and see which referrer arrives before calling it lost citations.

**A2. Tracking health.** Daily event counts for the last 90 days.
- A gap of a day or more with no events: alert item; mark the gap in every reading.
- Two systems counting conversions differently: one conversion event, matched.

**A3. Landing to conversion by page family and locale.**
- A locale with impressions and near-zero clicks: find out why before adding locales.
- A locale converting well on one page family: localize the winners.

## Full tier (repository, survey)

**F1. Launch dates.** `git log --diff-filter=A --format='%ad %h' -- <page path>` for each page, and the deploy history. Compare launch date to index status and clicks.
- Merged changes not deployed: Measurement quick win, deploy.
- Links committed before their target pages: build check that fails on internal links to pages not built.

**F2. Sign-up survey.** If a "how did you hear about us" question exists, compare its AI share with the analytics AI share over the same window.
- No survey: add one with each AI assistant as its own choice.
- One "AI" option: split it by assistant.

**F3. Experiment log.** Find the record of past changes and their readings (in `.seo/experiments/` when the repository follows `seo-experiments`).
- None: open one (date, pages, baseline, expected effect, 3-week and 6-week review dates, untouched control pages).
