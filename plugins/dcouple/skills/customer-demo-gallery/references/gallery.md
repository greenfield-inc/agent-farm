# Portable gallery and release checks

Use the [shared visual design](visual-design.md) for both an existing customer
gallery and the bundled dependency-free Node renderer. Preserve its composition
and tokens; do not create a separate look for each customer.
The renderer consumes a **reviewed customer projection**, never the private
ledger. It writes only HTML, does not copy media, and does not publish anything.

From the skill directory:

```sh
node scripts/render.mjs /private/run/gallery.json /private/run/customer/index.html
node --test scripts/*.test.mjs
```

To render the fictional example from the skill directory:

```sh
mkdir -p /tmp/gallery-example
cp examples/booking-guide.html /tmp/gallery-example/booking-guide.html
cp -R examples/media /tmp/gallery-example/media
node scripts/render.mjs examples/gallery.json /tmp/gallery-example/index.html
```

The fictional [worked input](../examples/gallery.json) illustrates documentary
evidence while keeping an unsupported reminder request private, without
claiming a fictional product recording.
The [private worked intake](../examples/intake.md) shows how that projection
was derived. Files in examples are fictional; do not substitute customer data
in this source tree.

## Customer projection

- `title`, `product`, `description`: plain text, no HTML. Optional `customer`
  fills the eyebrow; `footer` overrides the neutral sample-data footer. Optional
  `accent` is an approved six-digit hex brand color. Optional `logo`:
  `{src, alt}` pointing to an approved real logo. Omit for text branding.
- `requirements`: ordered array of `{title, wording, kind, priority,
  evidence, wordingIsExcerpt?, wordingKind?}`. `kind`: `explicit` or `inferred`;
  `priority`: `must`, `may` or `unknown`; `evidence`: array of evidence keys.
  `wordingKind` defaults to `quote`; use `summary` for an extracted, reviewed
  summary, labelled **Customer need** rather than original wording. Keep exact
  originals privately. Summaries cannot also be marked as original excerpts.
  `wording` otherwise contains reviewed original wording or a labelled inference;
  remove sensitive details with an indicated redaction. For a partially supported
  request, provide only the supported source excerpt and set `wordingIsExcerpt`
  to true, or omit the row if narrowing would mislead. Evidence must be nonempty.
  Omit unavailable and withdrawn capabilities, and claims unverified at the
  layer they require, before projection. Source review, runtime UI, backend
  correctness and delivery remain separate in the private ledger; do not require
  delivery verification for a claim limited to supported UI behavior.
  Gap, qualification and next-step fields are rejected; retain them privately.
- `demos`: ordered evidence library of `{key, title, description, kind, ...}`.
  Keys resolve mappings internally and are never emitted in HTML. Kinds:
  `video` needs `src` (MP4), `poster`, and `transcript` (accessible plain text);
  optional `captions` (WebVTT). `image` needs `src` and descriptive `alt`;
  `document` needs `href` and `linkLabel`. Optional `tags`: plain text array.
  Describe what the evidence establishes without treating UI as backend proof.
- `filters`: optional boolean; enables tag filter pills in All demos. Priorities
  stay available for selection but are not printed as process badges or counts.

Only these fields are accepted. Private ledger fields cause an error rather
than being silently spread into the customer page. This is not a privacy
classifier: a human/agent must review every allowed string and referenced file.
Use relative asset paths within the customer folder or HTTPS URLs without
credentials. No absolute filesystem paths, traversal, executable/data URLs,
HTML injection, or network-path URLs. Prefer local media: remote download links
may open instead of downloading unless the host supplies attachment headers.
The renderer checks local asset existence and confinement (including symlinks);
remote links still need publisher readback. It never fetches external evidence.

## Poster playback

Video previews use a full-area button with a centered play symbol and accessible
“Play [title]” label. A deliberate click, Enter or Space starts inline playback;
loading, expansion and filtering never start it. After activation, the overlay
stays out of the way and native pause/seek/volume/fullscreen controls remain.
Play rejection leaves those controls and the separate download link usable.
With JavaScript disabled, the native player works without the enhancement.
The fixed preview frame contains the media without cropping or layout shifts.

For an existing custom page, reuse the shared template's `.demo-player` markup and CSS plus
[enhancePlayers](../scripts/player.mjs); do not add competing video click handlers.
Keep description links, downloads and accordion controls outside the play button.
Check pointer, keyboard, mobile and rejection behavior on the actual page; keep
accepted media bytes unchanged. This is a player-only update, not a new recording.

## Acceptance and publication

1. Review claims against private evidence and target release. Verify each
   mapping and original wording/privacy. Retain the full original requirement
   ledger, omissions, reasons and follow-ups privately. Confirm the customer page
   contains no unavailable-feature rows, gap notes, placeholders or next steps,
   and never claims complete coverage. Do not publish an empty gallery.
2. Inspect final encoded video frames and playback/decoding, audio/captions and
   posters. Keep timeline and accepted media immutable. Hash final bytes in the
   private ledger; verify checksums after copying into the customer folder.
3. Verify the folder allowlist: HTML and accepted assets only, no raw input JSON,
   audit reports, hidden files, logs or transcripts from meetings. A video text
   alternative is customer copy, not a meeting transcript. Inspect the rendered
   page on desktop/mobile and keyboard controls. Close QA browsers/servers.
4. Reuse the authorized workspace/share URL and audience. Publish only accepted
   increments through one owner. If an independent audit is still pending,
   withhold those assets; do not relabel them accepted for speed. When a fresh
   audit is unavailable, report that limitation and resolve acceptance under the
   user's existing review requirements before publication.
5. Verify readback, requirement links, actual media playback/download and asset
   bytes/checksums after publication. If hosting transforms media, retain source
   hashes and audit the delivered bytes before calling that evidence accepted.
   A successful push alone is not verification. Do not reopen human browsers.

Copy-only changes do not require re-encoding accepted media. Preserve the
accepted folder and prior URL when making revisions; stage additions separately
and retain a private release manifest for rollback.
