#!/usr/bin/env node
// Render an .excalidraw file to PNG with a global Playwright install.
// Usage: node render.mjs <file.excalidraw> [--out <file.png>] [--scale 2]
// Elements may be short skeletons (type, x, y, size, colors, label, start/end);
// Excalidraw fills in the rest, and the full file is written to <name>.full.excalidraw.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const args = process.argv.slice(2), input = args.find(a => !a.startsWith('--'));
const opt = name => { const i = args.indexOf('--' + name); return i < 0 ? undefined : args[i + 1]; };
if (!input) { console.error('Usage: node render.mjs <file.excalidraw> [--out file.png] [--scale 2]'); process.exit(2); }
const out = opt('out') ?? input.replace(/\.excalidraw$/, '') + '.png', scale = Number(opt('scale') ?? 2);

function playwright() {
  const roots = [import.meta.url, path.join(execFileSync('npm', ['root', '-g'], {encoding: 'utf8'}).trim(), 'noop.js')];
  for (const root of roots) { try { return createRequire(root)('playwright'); } catch {} }
  console.error('Playwright is missing. Install it once: npm install -g playwright (it uses Google Chrome if present, or run npx playwright install chromium)');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const defaults = {roughness: 0, fontFamily: 3, strokeWidth: 2};
const elements = (data.elements ?? []).map(e => ({...defaults, ...e, ...(e.label && {label: {fontFamily: 3, fontSize: 16, ...e.label}})}));
if (!elements.length) { console.error('No elements to render'); process.exit(1); }

const page_html = `<body style="margin:0;background:#fff"><script type="module">
import {exportToSvg, convertToExcalidrawElements} from 'https://esm.sh/@excalidraw/excalidraw@0.18.0?bundle';
window.render = async (elements, appState) => {
  const full = elements.every(e => e.seed) ? elements : convertToExcalidrawElements(elements, {regenerateIds: false});
  const svg = await exportToSvg({elements: full, appState: {viewBackgroundColor: '#ffffff', exportPadding: 40, ...appState, exportBackground: true}, files: {}});
  document.body.replaceChildren(svg);
  return full;
};
window.ready = true;
</script></body>`;

const {chromium} = playwright();
const browser = await chromium.launch().catch(() => chromium.launch({channel: 'chrome'}));
try {
  const page = await browser.newPage({deviceScaleFactor: scale, viewport: {width: 2400, height: 1600}});
  await page.setContent(page_html);
  await page.waitForFunction('window.ready', null, {timeout: 60000});
  const full = await page.evaluate(([els, state]) => window.render(els, state), [elements, data.appState ?? {}]);
  await page.locator('svg').screenshot({path: out});
  fs.writeFileSync(input.replace(/\.excalidraw$/, '') + '.full.excalidraw', JSON.stringify({...data, elements: full}, null, 1));
  console.log(out);
} finally { await browser.close(); }
