import { readFile, writeFile, mkdir, realpath, stat, rename } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { enhancePlayers } from './player.mjs';
import { enhanceGallery } from './gallery.mjs';

const template = await readFile(new URL('../assets/gallery.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../assets/gallery.css', import.meta.url), 'utf8');

const fail = message => { throw new Error(message); };
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fields(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`Unexpected ${label} field: ${key}`);
}
function string(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be nonempty text`);
}
function oneOf(value, options, label) {
  if (!options.includes(value)) fail(`Invalid ${label}`);
}
function array(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
}
export function safeUrl(value) {
  string(value, 'URL');
  if (value !== value.trim() || /[\x00-\x20\x7f\\]/.test(value)) fail(`Unsafe URL: ${value}`);
  if (/^https:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.username || url.password) fail('URL credentials are forbidden');
    return value;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || /^[/?#]/.test(value)) fail(`Unsupported URL: ${value}`);
  const base = value.split(/[?#]/)[0];
  let decoded;
  try { decoded = decodeURIComponent(base); } catch { fail('Invalid URL encoding'); }
  if (/[\\%:\x00-\x1f\x7f]/.test(decoded) || decoded.split('/').some(p => !p || p === '.' || p === '..')) fail(`Unsafe asset path: ${value}`);
  return value;
}

export function validate(input) {
  fields(input, ['title','product','customer','description','logo','requirements','demos','filters','accent','footer'], 'gallery');
  for (const key of ['title','product','description']) string(input[key], key);
  for (const key of ['customer','footer']) if (input[key] !== undefined) string(input[key], key);
  if (input.accent !== undefined && !/^#[0-9a-f]{6}$/i.test(input.accent)) fail('accent must be a six-digit hex color');
  if (input.filters !== undefined && typeof input.filters !== 'boolean') fail('filters must be boolean');
  const urls = [];
  const url = value => { urls.push(safeUrl(value)); };
  if (input.logo) {
    fields(input.logo, ['src','alt'], 'logo');
    string(input.logo.alt, 'logo alt'); url(input.logo.src);
  }
  array(input.demos, 'demos'); array(input.requirements, 'requirements');
  const keys = new Set();
  for (const demo of input.demos) {
    const common = ['key','title','description','kind','tags'];
    oneOf(demo.kind, ['video','image','document'], 'evidence kind');
    const extras = {video:['src','poster','transcript','captions'],image:['src','alt'],document:['href','linkLabel']}[demo.kind];
    fields(demo, [...common,...extras], 'demo');
    for (const key of ['key','title','description']) string(demo[key], key);
    if (keys.has(demo.key)) fail(`Duplicate evidence key: ${demo.key}`);
    keys.add(demo.key);
    if (demo.tags !== undefined) { array(demo.tags, 'tags'); demo.tags.forEach(t => string(t, 'tag')); }
    if (demo.kind === 'video') {
      url(demo.src); url(demo.poster); string(demo.transcript, 'video transcript');
      if (!/\.mp4(?:[?#]|$)/i.test(demo.src)) fail('Video source must be MP4');
      if (demo.captions !== undefined) url(demo.captions);
    } else if (demo.kind === 'image') { url(demo.src); string(demo.alt, 'image alt'); }
    else { url(demo.href); string(demo.linkLabel, 'document linkLabel'); }
  }
  for (const req of input.requirements) {
    fields(req, ['title','wording','kind','priority','evidence','wordingIsExcerpt','wordingKind'], 'requirement');
    string(req.title, 'requirement title'); string(req.wording, 'requirement wording');
    oneOf(req.kind, ['explicit','inferred'], 'requirement kind');
    oneOf(req.priority, ['must','may','unknown'], 'priority');
    array(req.evidence, 'requirement evidence');
    for (const key of req.evidence) if (!keys.has(key)) fail(`Missing evidence: ${key}`);
    if (!req.evidence.length) fail('Omit requirements without accepted evidence; keep follow-up private');
    if (req.wordingKind !== undefined) oneOf(req.wordingKind, ['quote','summary'], 'wordingKind');
    if (req.wordingKind === 'summary' && req.wordingIsExcerpt) fail('A summary is not an original-wording excerpt');
    if (req.wordingIsExcerpt !== undefined && typeof req.wordingIsExcerpt !== 'boolean') fail('wordingIsExcerpt must be boolean');
  }
  return [...new Set(urls)];
}

function demoCard(demo, filterable = false) {
  const e = escape;
  let preview = '', action, text = '';
  if (demo.kind === 'video') {
    preview = `<div class="demo-player"><div class="media-preview"><video controls preload="none" playsinline tabindex="0" poster="${e(demo.poster)}" aria-label="${e(demo.title)}"><source src="${e(demo.src)}" type="video/mp4">${demo.captions ? `<track kind="captions" src="${e(demo.captions)}" srclang="en" label="English" default>` : ''}Your browser does not support video. Use the download link below.</video><button class="play-preview" type="button" hidden aria-label="Play ${e(demo.title)}"><span class="play-disc" aria-hidden="true"><span class="play-icon"></span></span></button></div><p class="player-status" role="status" hidden>Playback could not start. Use the player controls or download the MP4.</p></div>`;
    action = `<a href="${e(demo.src)}" download>Download MP4</a>`;
    text = `<details class="transcript"><summary>Text version</summary><p>${e(demo.transcript)}</p></details>`;
  } else if (demo.kind === 'image') {
    preview = `<img class="screenshot" src="${e(demo.src)}" alt="${e(demo.alt)}" loading="lazy">`;
    action = `<a href="${e(demo.src)}">View full image</a>`;
  } else action = `<a href="${e(demo.href)}">${e(demo.linkLabel)}</a>`;
  const tags = filterable && demo.tags?.length ? `<div class="chips">${demo.tags.map(tag => `<span class="chip">${e(tag)}</span>`).join('')}</div>` : '';
  return `<article class="card"${filterable ? ` data-tags="${e(JSON.stringify(demo.tags || []))}"` : ''}>${preview}<div class="card-body">${tags}<h3>${e(demo.title)}</h3><p class="desc">${e(demo.description)}</p><p class="links">${action}</p>${text}</div></article>`;
}

export function render(input) {
  validate(input);
  const e = escape;
  const library = new Map(input.demos.map(demo => [demo.key,demo]));
  const requirements = input.requirements.map(req => {
    const label = req.kind === 'inferred' ? 'Suggested need' : req.wordingKind === 'summary' ? 'Customer need' : req.wordingIsExcerpt ? 'Original wording (supported excerpt)' : 'Original wording';
    const labelClass = req.kind === 'inferred' || req.wordingKind === 'summary' || req.wordingIsExcerpt ? '' : ' class="sr-only"';
    return `<details class="requirement"><summary><span>${e(req.title)}</span><span class="chevron" aria-hidden="true">+</span></summary><div class="requirement-body"><p class="full-wording"><span${labelClass}>${label}: </span>${e(req.wording)}</p><div class="grid">${[...new Set(req.evidence)].map(key => demoCard(library.get(key))).join('')}</div></div></details>`;
  }).join('');
  const tags = [...new Set(input.demos.flatMap(demo => demo.tags || []))].sort();
  const filters = input.filters && tags.length ? `<div class="filters" role="group" aria-label="Filter demos" hidden><button type="button" aria-pressed="true" data-filter="">All demos</button>${tags.map(tag => `<button type="button" aria-pressed="false" data-filter="${e(tag)}">${e(tag)}</button>`).join('')}</div>` : '';
  const slots = {
    TITLE: e(input.title),
    STYLE: css + (input.accent ? `\n:root{--accent:${input.accent};--link:${input.accent}}` : ''),
    BRAND: input.logo ? `<img class="logo" src="${e(input.logo.src)}" alt="${e(input.logo.alt)}">` : `<div class="brand">${e(input.product)}</div>`,
    CUSTOMER: input.customer ? `<div class="eyebrow">${e(input.customer)}</div>` : '<div class="eyebrow" aria-hidden="true"></div>',
    DESCRIPTION: e(input.description),
    REQUIREMENTS: requirements || '<p>No requirements selected.</p>',
    FILTERS: filters,
    DEMOS: input.demos.map(demo => demoCard(demo,true)).join(''),
    EMPTY_DEMOS: input.demos.length ? '' : '<p>No demonstrations selected.</p>',
    FOOTER: e(input.footer || 'Demonstrations use sample data.'),
    SCRIPT: `(${enhanceGallery.toString()})(document);${input.demos.some(demo => demo.kind === 'video') ? `(${enhancePlayers.toString()})(document);` : ''}`
  };
  // One replacement pass prevents customer strings from becoming template code.
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => slots[key]);
}

export async function writeGallery(input, output) {
  const urls = validate(input);
  const parent = path.dirname(path.resolve(output));
  await mkdir(parent, {recursive:true});
  const root = await realpath(parent);
  for (const url of urls.filter(u => !/^https:\/\//i.test(u))) {
    const target = await realpath(path.resolve(root, decodeURIComponent(url.split(/[?#]/)[0])));
    const relative = path.relative(root, target);
    if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) fail(`Asset escapes customer folder: ${url}`);
    if (!(await stat(target)).isFile()) fail(`Asset is not a file: ${url}`);
    if (target === path.join(root, path.basename(output))) fail('Output cannot be its own evidence');
  }
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, render(input), {flag:'wx'});
  await rename(temporary, output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) fail('Usage: node render.mjs INPUT.json OUTPUT/index.html');
    await writeGallery(JSON.parse(await readFile(process.argv[2], 'utf8')), process.argv[3]);
    process.stdout.write(`Rendered ${process.argv[3]}\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
