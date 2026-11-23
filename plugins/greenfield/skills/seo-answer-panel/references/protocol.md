# Answer panel protocol

The full protocol for the AI answer panel: how to choose and freeze the prompts, run and capture each slot, score it, summarize it and compare rounds. Examples use a made-up company, Example Co (example.com), that sells booking software to small fitness studios.

## 1. Terms

- **Prompt**: one unbranded question, with an id (`P01`) and a buyer intent.
- **Engine**: one AI answer product with fixed settings, for example ChatGPT with search on, Perplexity, Claude with web search, Gemini, Google AI Mode.
- **Slot**: one prompt asked once on one engine (one repetition). A round plans prompts x engines x repetitions slots.
- **Round**: one run of the whole panel, stored as `.seo/answer-panel/runs/<YYYY-MM-DD>.csv`, named by its first day.

## 2. Choose the prompts

1. List the buyer intents: the jobs a buyer is doing when they ask. For Example Co: choose a tool ("what is the best booking software for a small yoga studio?"), compare named tools ("what are good alternatives to [the market leader] for a two-room studio?"), check a requirement ("which studio booking tools send text reminders and take deposits?"), set it up ("how do I move my studio's class bookings to a new system?").
2. Write three to six prompts per intent, in the words buyers use. Keep the counts per intent equal so no intent dominates the rates.
3. Validate each prompt against real buyer language before freezing it: a phrase from a sales or support call, a survey answer, or a Search Console query with impressions. Record the source next to the prompt. Drop or rewrite a prompt nobody phrases that way.
4. Keep the product's name, and any hint of the wanted answer, out of every unbranded prompt. Branded diagnostic prompts ("does Example Co take deposits?") go in a separate study with its own file; they never enter the unbranded rates.
5. Start small. A pilot of five prompts covering most intents, on three engines, with three repetitions over at least two days, is 45 planned slots. Expand to the whole list only when the pilot is useful and the budget allows.

## 3. Freeze the settings: `panel.md`

`.seo/answer-panel/panel.md` holds everything a later round must match:

```markdown
# Answer panel: Example Co

Prompt version: v1 (frozen 2026-11-01)
Engines: chatgpt (search on), perplexity (default), claude (web search on)
Locale and country: en-US, United States
Signed-in state: signed out where the engine allows; otherwise a clean account with memory off
Search mode: on for every engine
Repetitions: 2 per prompt and engine
Run dates: 2026-11-02 and 2026-11-03 (repetition 1 on day one, repetition 2 on day two)
Prompt order: shuffled with seed 20261101
Budget: authorized up to $20 of API or subscription cost per round

| id | intent | prompt | validated against |
|---|---|---|---|
| P01 | choose a tool | what is the best booking software for a small yoga studio? | 3 sales calls (Oct), Search Console query "best yoga studio booking software" |
| P02 | check a requirement | which studio booking tools send text reminders and take deposits? | survey answers, support tickets |
| P03 | set it up | how do I move my studio's class bookings to a new system? | Search Console query "move class bookings to new software" |
```

Any change to the prompts, engines, locale, search mode, signed-in state or repetitions starts a new prompt version. A new version is a new baseline: never compare rates across versions.

## 4. Validate one manual run first

Run the first round by hand. Then check it end to end: every planned slot has a row, every answered slot has a capture file, the scores follow section 6, and the summarizer accepts the CSV. Show the person the table and one capture per engine. Repeat or schedule the panel only after they confirm it reads correctly. A scheduled job that records bad rows yields months of data that cannot be repaired.

## 5. Run and capture

1. Write a CSV row for every planned slot before running anything, and fill in `status` as each slot runs. The summarizer rejects an empty status, so a round with a slot that never ran fails until that slot is marked.
2. Shuffle the prompt order with the recorded seed.
3. Run each slot in a fresh session: a new chat with memory and personalization off, signed out where the engine allows, or a fresh API call. Never ask two prompts in one session.
4. When the engine refuses, errors or is down, mark the slot `unavailable` and move on. Never substitute another engine or model.
5. Save the capture in `.seo/answer-panel/runs/<YYYY-MM-DD>/<prompt_id>-<engine>-<repetition>.md`:

```markdown
prompt: P02 (v1)
engine: perplexity, model shown: default
captured: 2026-11-02 14:31 UTC, en-US, signed out, search on
cited URLs:
- https://example.com/features/reminders
- https://competitor.example.org/blog/studio-deposits
answer:
<the full answer text, verbatim>
```

6. Never ask the engine why it did or did not name the product inside a panel slot. An engine's explanation of its own retrieval is not evidence; that question is a separate qualitative probe.

## 6. Score each slot

The CSV header, exactly:

```
prompt_id,engine,repetition,run_date,status,mentioned,recommended,cited,citation_correct
```

- `status`: `answered` or `unavailable`.
- `mentioned`: `yes` when the answer names the product anywhere.
- `recommended`: `yes` when the answer proposes the product as a fitting option for the buyer. A name in a disclaimer or a list of things to avoid is a mention only.
- `cited`: `yes` when at least one linked source in the answer is the product's own page or a page that makes a specific claim about the product. Record which URL in the capture.
- `citation_correct`: on a cited slot, `yes` when the cited source supports what the answer says about the product, `no` when it does not or the claim contradicts the fact ledger in `.seo/facts.md`. A person checks this against the ledger; another model's confidence is not a check. Leave it empty until a person has checked it.
- An empty outcome value means unscored. On an unavailable slot, leave every outcome empty; the summarizer ignores outcome values on unavailable slots.

## 7. Summarize

```bash
node <this skill>/scripts/summarize-panel.mjs .seo/answer-panel/runs/2026-11-02.csv [--json]
```

Per engine, sorted by name:

| Metric | Numerator | Denominator |
|---|---|---|
| availability | answered slots | planned slots (every row) |
| mentioned | answered slots with `mentioned` yes | answered slots with `mentioned` yes or no |
| recommended | answered slots with `recommended` yes | answered slots with `recommended` yes or no |
| cited | answered slots with `cited` yes | answered slots with `cited` yes or no |
| correctness | scored citations with `citation_correct` yes | answered slots with `cited` yes and `citation_correct` yes or no |

Each rate is numerator / denominator rounded to 4 decimals, or null when the denominator is 0. Unavailable slots and unscored values leave the denominator; missing is never zero. The script exits 1 and names the line on a wrong header, an unknown status or value, or a row with the wrong number of fields.

## 8. Report

- The per-engine table with every numerator and denominator, the prompt version, the round dates and the engines' shown models.
- Never average engines into one score, and never call any rate market share, citation share of the market, query volume or a forecast. Write it as "ChatGPT named Example Co in 4 of 5 answered slots on these questions".
- Factual errors: each wrong claim with engine, prompt, cited URL and the ledger fact it contradicts.
- At most three proposed changes, each tied to a page: the page an engine cites for a competitor on our question, the page whose claim was cited wrongly, the question no page of ours answers.
- AI referral visits, the Search Console Generative AI report and survey answers go beside the panel with their own denominators. Readiness scanner scores go in their own line, dated and named.

## 9. Compare rounds

- Compare only rounds with the same prompt version and settings, engine by engine.
- Check the spread first: on each prompt and engine, how often the outcome flips between repetitions. A change smaller than that spread is noise.
- Note engine or model changes between rounds next to the comparison; they break the series.
- Preserve the first baseline, and record the date of every page change the experiment records name, so a later read can line rounds up with changes.
- Citations are a leading signal. Report direct buyer outcomes (sign-ups, leads) separately.

## 10. Worked example

A made-up round: 2 engines x 3 prompts x 2 repetitions = 12 planned slots. It includes three unavailable slots, one unscored `recommended` value, and one cited slot whose correctness has not been checked yet.

```
prompt_id,engine,repetition,run_date,status,mentioned,recommended,cited,citation_correct
P01,chatgpt,1,2026-11-02,answered,yes,yes,yes,yes
P01,chatgpt,2,2026-11-03,answered,yes,no,yes,no
P02,chatgpt,1,2026-11-02,answered,no,no,no,
P02,chatgpt,2,2026-11-03,unavailable,,,,
P03,chatgpt,1,2026-11-02,answered,yes,yes,yes,
P03,chatgpt,2,2026-11-03,answered,yes,no,no,
P01,perplexity,1,2026-11-02,answered,yes,yes,yes,yes
P01,perplexity,2,2026-11-03,answered,yes,yes,yes,yes
P02,perplexity,1,2026-11-02,answered,yes,,no,
P02,perplexity,2,2026-11-03,unavailable,,,,
P03,perplexity,1,2026-11-02,unavailable,,,,
P03,perplexity,2,2026-11-03,answered,yes,no,yes,no
```

Hand computation, ChatGPT (rows 1 to 6 of the data):
- Planned 6. Answered 5 (P02 repetition 2 is unavailable). Availability 5/6.
- Mentioned over the 5 answered slots: yes, yes, no, yes, yes = 4/5.
- Recommended: yes, no, no, yes, no = 2/5.
- Cited: yes, yes, no, yes, no = 3/5.
- Correctness: three cited slots; P03 repetition 1 is unchecked, so the scored citations are P01 repetitions 1 (yes) and 2 (no) = 1/2.

Hand computation, Perplexity (rows 7 to 12):
- Planned 6. Answered 4 (P02 repetition 2 and P03 repetition 1 are unavailable). Availability 4/6.
- Mentioned over the 4 answered slots: yes, yes, yes, yes = 4/4.
- Recommended: P02 repetition 1 is unscored, so 3 scored: yes, yes, no = 2/3.
- Cited: yes, yes, no, yes = 3/4.
- Correctness: cited slots P01 repetition 1 (yes), P01 repetition 2 (yes), P03 repetition 2 (no) = 2/3.

| engine | planned | answered | availability | mentioned | recommended | cited | correctness |
|---|---|---|---|---|---|---|---|
| chatgpt | 6 | 5 | 5/6 (0.8333) | 4/5 (0.8) | 2/5 (0.4) | 3/5 (0.6) | 1/2 (0.5) |
| perplexity | 6 | 4 | 4/6 (0.6667) | 4/4 (1) | 2/3 (0.6667) | 3/4 (0.75) | 2/3 (0.6667) |

Two mistakes this example guards against. Counting the unavailable slots as "not mentioned" would give ChatGPT 4/6 and Perplexity 4/6, and hide that Perplexity named the product every time it answered. Pooling the engines would give 8 of 9 answered slots mentioned, a number that describes neither engine.

Source: method generalized from the independent answer panel in a customer workflow starter (confidential, method only, 2026-11); the monthly AI check in "Growth, phase by phase" (v2, 2026-11-04), The monthly loop step 4.
