# Reuse the gallery design

Use this visual system for new customer galleries and updates. Start from the
shared assets, not a fresh layout or a request to “make it polished.” Keep an
established customer page aligned with this composition; change its reviewed
content and branding slots without reintroducing a second template.

- [gallery.html](../assets/gallery.html): the reusable composition and slots.
- [gallery.css](../assets/gallery.css): the portable tokens and responsive rules.
- [Fictional visual reference](../examples/index.html): concrete rendered HTML,
  including requirement rows, a documentary cover, filter pills and the player.
- [Reference input](../examples/gallery.json): fictional product/customer/content.
- [Gallery interactions](../scripts/gallery.mjs) and
  [player enhancement](../scripts/player.mjs): embedded into the standalone page.

The renderer consumes these assets directly. The reference is generated from
its input by the same renderer, and a test checks that it stays in sync:

```sh
node scripts/render.mjs examples/gallery.json examples/index.html
```

The reference contains fictional names, an illustrated document and a clearly
labelled abstract playback sample. They establish presentation, not a product's
capabilities. Replace them with approved customer-safe evidence in real runs.
Do not copy source inputs, private proof or fictitious assets into a real gallery.

## Composition to preserve

1. Product logo at the top, or a restrained text brand when no approved logo is
   supplied. A small uppercase customer eyebrow starts the hero below it.
2. Large, tightly spaced hero title and a single concise introduction.
3. **By requirement / All demos** pill tabs. Requirements are the default view;
   switching tabs changes panels in place, with keyboard arrows/Home/End.
4. White rounded requirement rows with a right-side **+**. Opening a row reveals
   reviewed wording and its evidence directly, without another wording accordion,
   a repeated section heading, priority badges or coverage counts. Source quotes
   remain accessible; reviewed summaries must be labelled **Customer need**.
5. Media touches the card's top and side edges; titles, one-line descriptions,
   downloads and text alternatives sit in the padded card body below. Two columns
   become one on mobile. Use the full-preview play button and preserve native
   controls after activation. Never add a second video click-toggle handler.
6. All demos uses optional wrapping filter pills and small topic chips, without
   process wording or item counts. Hidden media pauses; changing views never
   starts playback. Finish with a neutral sample-data footer.

## Tokens and dimensions

| Element | Default |
| --- | --- |
| Page / text | `#faf9fd` / `#252039` |
| Surface / muted copy | white / `#645b73` |
| Primary accent | `#653cb5` |
| Main shell | 1200px maximum; 32px 26px padding |
| Mobile shell | 24px 18px padding below 760px |
| Brand height / eyebrow gap | 32px / 48px |
| Hero | system UI font; 62px maximum, 40px mobile; 1.1 line height; −.045em tracking |
| Intro | 19px; 800px maximum width |
| Tab spacing | 30px above, 24px below; 8px between pills |
| Requirement row | 14px radius; 18px 22px summary padding; 10px separation |
| Media card | 18px radius; 24px grid gap; subtle `0 8px 28px #35205a07` shadow |
| Media frame | 1100:744; contain, never crop or stretch |
| Card body | 22px padding; 16px within requirement rows |

Configure `product`, `customer`, `logo`, `title`, `description`, `footer`, and the
reviewed requirements/evidence in the projection. Optional `accent` is a six-digit
hex color for approved brand adaptation; check contrast if overriding it. Keep
geometry, typography and surfaces consistent. Defaults are reusable starting
points, not authorization to override an explicit customer preference.

## Compare rendered output

Inspect both 1440px desktop and 390px mobile, including closed rows, an expanded
row, All demos/filter pills and the player. Compare actual whitespace, type size,
row geometry and media-card edges against the fictional reference. Behavior tests
alone cannot establish visual consistency. Keep screenshots and customer-specific
comparisons private, close owned QA browsers, and do not open pages for humans.
