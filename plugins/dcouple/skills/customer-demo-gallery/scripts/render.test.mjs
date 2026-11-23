import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { render, safeUrl, writeGallery } from './render.mjs';

const example = JSON.parse(await readFile(new URL('../examples/gallery.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(example);

test('escapes customer text and attributes without emitting internal keys', () => {
  const input = clone();
  input.title = '<script>alert("x")</script>';
  input.demos[0].tags = ['"><img src=x onerror=alert(1)>'];
  input.demos[0].key = 'PRIVATE-JOURNEY-KEY';
  input.requirements.forEach(r => { if (r.evidence.length) r.evidence = ['PRIVATE-JOURNEY-KEY']; });
  const html = render(input);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('PRIVATE-JOURNEY-KEY'));
});

test('one item covers multiple requirements while duplicate references do not duplicate a card', () => {
  const input = clone();
  input.requirements[0].evidence.push('booking-guide');
  const html = render(input);
  assert.equal((html.match(/<h3>Booking and checkout guide<\/h3>/g) || []).length, 7);
  assert.ok(html.indexOf('Reserve a tool for a time slot') < html.indexOf('See who has each tool'));
});

test('missing, duplicate or private evidence fails instead of producing misleading output', () => {
  const missing = clone(); missing.requirements[0].evidence = ['not-there'];
  assert.throws(() => render(missing), /Missing evidence/);
  const duplicate = clone(); duplicate.demos.push(duplicate.demos[0]);
  assert.throws(() => render(duplicate), /Duplicate evidence/);
  const privateData = clone(); privateData.requirements[0].source = '/private/transcript';
  assert.throws(() => render(privateData), /Unexpected requirement field/);
  const empty = clone(); empty.requirements[0].evidence = [];
  assert.throws(() => render(empty), /Omit requirements/);
  const gap = clone(); gap.requirements[0].nextStep = 'Ask about reminders';
  assert.throws(() => render(gap), /Unexpected requirement field/);
});

test('rejects executable, ambiguous, credential and escaping URL forms', () => {
  for (const url of ['javascript:alert(1)','data:text/html,x','http://example.com','//example.com','/private/x','../secret','x/../../secret','x/%2e%2e/secret','%2fetc/passwd','x\\secret','x/%252e%252e/y','https://u:p@example.com/x','https:\\example.com','\njavascript:1','./file']) {
    assert.throws(() => safeUrl(url), undefined, url);
  }
  for (const url of ['assets/demo.mp4','docs/guide%20one.html#section','https://example.com/demo.mp4?version=2']) assert.equal(safeUrl(url), url);
});

test('empty gallery is neutral and unsupported requests stay out of customer copy', () => {
  const input = clone(); input.demos = []; input.requirements = [];
  const html = render(input);
  assert.ok(html.includes('No requirements selected.'));
  assert.ok(html.includes('No demonstrations selected.'));
  assert.ok(!render(example).includes('overdue reminders'));
  assert.ok(!render(example).includes('nextStep'));
});

test('video contract includes poster, MP4 download and text alternative without autoplay', () => {
  const input = clone();
  input.requirements = [];
  input.demos = [{key:'video',kind:'video',title:'Reserve',description:'Reserve a tool.',src:'media/demo.mp4',poster:'media/poster.png',transcript:'Choose a tool, then reserve it.',captions:'media/captions.vtt'}];
  const html = render(input);
  assert.match(html, /<video controls preload="none" playsinline tabindex="0" poster=/);
  assert.match(html, /type="video\/mp4"/);
  assert.match(html, /download>Download MP4/);
  assert.match(html, /kind="captions"/);
  assert.ok(!html.includes('autoplay'));
  delete input.demos[0].poster;
  assert.throws(() => render(input), /URL/);
});

test('local output checks existence and symlink confinement before replacing a page', async () => {
  const local = clone(); local.requirements = [local.requirements[0]]; local.demos = [local.demos[0]];
  const root = await mkdtemp(path.join(tmpdir(), 'gallery-test-'));
  try {
    const customer = path.join(root, 'customer'); await mkdir(customer);
    const output = path.join(customer, 'index.html'); await writeFile(output, 'accepted');
    await assert.rejects(writeGallery(local, output), /ENOENT/);
    assert.equal(await readFile(output,'utf8'), 'accepted');
    await writeFile(path.join(root, 'secret.html'), 'private');
    await symlink(path.join(root, 'secret.html'), path.join(customer, 'booking-guide.html'));
    await assert.rejects(writeGallery(local, output), /escapes customer folder/);
    await rm(path.join(customer, 'booking-guide.html'));
    await writeFile(path.join(customer, 'booking-guide.html'), 'approved guide');
    await writeGallery(local, output);
    assert.equal(await readFile(output,'utf8'), render(local));
  } finally { await rm(root, {recursive:true,force:true}); }
});

test('rendering the same projection is deterministic', () => {
  assert.equal(render(clone()), render(clone()));
});

test('supported excerpts are labelled without publishing follow-up copy', () => {
  const input = clone();
  input.requirements[0].wordingIsExcerpt = true;
  const html = render(input);
  assert.ok(html.includes('Original wording (supported excerpt)'));
  assert.ok(!html.includes('Priority to confirm'));
  const privateProjection = clone();
  privateProjection.requirements[0].omissionReason = 'Unavailable';
  assert.throws(() => render(privateProjection), /Unexpected requirement field/);
});

test('visual reference is generated from the shared renderer without drift', async () => {
  assert.equal(await readFile(new URL('../examples/index.html', import.meta.url), 'utf8'), render(example));
});

test('customer slots are escaped once and do not become template instructions', () => {
  const input = clone();
  input.customer = '<img src=x onerror=alert(1)>';
  input.title = '{{DEMOS}}';
  input.footer = '<script>no</script>';
  input.accent = '#123abc';
  const html = render(input);
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('<h1>{{DEMOS}}</h1>'));
  assert.ok(html.includes('&lt;script&gt;no'));
  assert.ok(html.includes('--accent:#123abc'));
  input.accent = 'red;display:none';
  assert.throws(() => render(input), /hex color/);
});

test('reviewed summaries have a distinct label and cannot pretend to be source excerpts', () => {
  const input = clone(); input.requirements[0].wordingKind = 'summary';
  assert.ok(render(input).includes('Customer need: '));
  input.requirements[0].wordingIsExcerpt = true;
  assert.throws(() => render(input), /summary is not/);
});

test('customer presentation uses pill tabs, direct wording and plus disclosure without process counts', () => {
  const html = render(example);
  assert.ok(html.includes('role="tablist"'));
  assert.ok(html.includes('role="tab"'));
  assert.ok(html.includes('class="chevron" aria-hidden="true">+</span>'));
  assert.ok(html.includes('class="full-wording"'));
  assert.ok(!html.includes('items shown'));
  assert.ok(!html.includes('Must have'));
  assert.ok(!html.includes('<select'));
});
