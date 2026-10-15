#!/usr/bin/env node
// Dispatch one bigbrain worker through Pane: check the brief, launch the tab with
// no initial input, wait for the composer, submit "Read and follow <brief>", confirm
// delivery, and print the paths plus the exit-to-wake watch command as JSON.
// Uses only runpane (and `agent-farm profiles list` to pick the harness) and Node built-ins.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const USAGE = `Usage: node dispatch.mjs --profile <bigbrain/role[:variant]> --brief <file>
  (--pane <pane id> | --repo <selector> --name <new Pane name> [--base <ref>])
  [--arg key=value]... [--agent claude|codex] [--title <tab title>]
  [--session <id|name>] [--as <cursor name>] [--ready-timeout-ms 180000] [--dry-run]`;

const FIELDS = {
  full: ['Goal', 'Source', 'Known state', 'Constraints', 'Stop when', 'Return', 'Status file', 'Destination'],
  quick: ['Quick fix', 'Done when', 'Branch', 'Constraints', 'Status file'],
};
const WATCH_KINDS = 'agent.report,agent.blocked,agent.ready,panel.exited,pane.gone';
const RUNPANE = process.env.PANE_RUNPANE_BIN || 'runpane';

function fail(code, error, extra = {}) {
  console.log(JSON.stringify({ ok: false, error, ...extra }, null, 2));
  process.exit(code);
}

function runpane(args, { allowFail = false } = {}) {
  let out;
  try {
    out = execFileSync(RUNPANE, [...args, '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    out = error.stdout || '';
    if (!allowFail && !out.trim()) fail(2, `runpane ${args.slice(0, 2).join(' ')} failed`, { stderr: String(error.stderr || error.message).trim() });
  }
  try {
    return JSON.parse(out);
  } catch {
    if (allowFail) return { ok: false, raw: out };
    fail(2, `runpane ${args.slice(0, 2).join(' ')} printed no JSON`, { raw: out.slice(0, 2000) });
  }
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const quote = (value) => (/^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`);

// A field is a line that starts with its label (optionally bulleted or bold) followed by
// a colon or a run of spaces, then a value: the layout of the contract.md template.
function field(text, label) {
  const name = label.replace(/ /g, '\\s+');
  const match = text.match(new RegExp(`^[\\s>*#-]*(?:\\*\\*)?${name}(?:\\*\\*)?(?::|\\s{2,}|\\t)[ \\t]*(\\S.*)$`, 'im'));
  return match ? match[1].trim() : null;
}

function checkBrief(text) {
  const variant = field(text, 'Quick fix') ? 'quick' : 'full';
  const missing = FIELDS[variant].filter((label) => !field(text, label));
  return { variant, missing, statusFile: field(text, 'Status file')?.split(/\s+/)[0] ?? null };
}

function harnessFor(profile) {
  const [base, variant] = profile.split(':');
  let listing = '';
  try {
    listing = execFileSync('agent-farm', ['profiles', 'list'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
  const line = listing.split('\n').find((row) => row.startsWith(`${base} `));
  if (!line) return null;
  const model = variant ? line.match(new RegExp(`[(·]\\s*${variant}:\\s*(\\S+)`))?.[1] : null;
  if (model) return model.startsWith('claude') ? 'claude' : 'codex';
  if (variant) return null;
  return line.split('|').map((part) => part.trim()).find((part) => part === 'claude' || part === 'codex') ?? null;
}

function findDeep(value, key) {
  if (!value || typeof value !== 'object') return undefined;
  if (typeof value[key] === 'string') return value[key];
  for (const child of Object.values(value)) {
    const found = findDeep(child, key);
    if (found) return found;
  }
  return undefined;
}

function sessionFor(paneId) {
  if (process.env.PANE_ORCHESTRATION_SESSION_ID) return process.env.PANE_ORCHESTRATION_SESSION_ID;
  const listed = runpane(['sessions', 'list'], { allowFail: true });
  const owner = (listed.sessions ?? []).find((s) => !s.archived && (s.associations ?? []).some((a) => a.paneId === paneId));
  return owner?.id ?? null;
}

// Wait for the agent's composer. Escape Codex's update screen; report any other
// first-run screen instead of guessing an answer to it.
async function waitForComposer(panelId, agent, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let escapes = 0;
  let screen;
  while (Date.now() < deadline) {
    screen = runpane(['panels', 'screen', '--panel', panelId, '--limit', '40'], { allowFail: true });
    const text = screen.text ?? '';
    if (agent === 'codex' && /update available/i.test(text) && escapes < 3) {
      runpane(['panels', 'input', '--panel', panelId, '--keys', 'escape', '--yes']);
      escapes += 1;
    } else if (/Allow external CLAUDE\.md (file )?imports\?/i.test(text)) {
      return { ready: false, reason: 'Claude asks "Allow external CLAUDE.md imports?"; answer it in the tab, then submit the brief', screen: text };
    } else if (screen.state?.running === false) {
      return { ready: false, reason: 'the agent process exited before its composer appeared', screen: text };
    } else if (screen.composer?.isPresent && screen.state?.isCliReady !== false) {
      if (screen.composer.hasUndeliveredText) return { ready: false, reason: 'the composer already holds unsent text', screen: text };
      return { ready: true, escapes };
    }
    await sleep(1000);
  }
  return { ready: false, reason: `no composer after ${timeoutMs} ms`, screen: screen?.text ?? '' };
}

async function main() {
  const { values } = parseArgs({
    options: {
      profile: { type: 'string' }, brief: { type: 'string' }, pane: { type: 'string' },
      repo: { type: 'string' }, name: { type: 'string' }, base: { type: 'string' },
      arg: { type: 'string', multiple: true, default: [] }, agent: { type: 'string' },
      title: { type: 'string' }, session: { type: 'string' }, as: { type: 'string', default: 'bigbrain-orch' },
      'ready-timeout-ms': { type: 'string', default: '180000' }, 'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) return console.log(USAGE);
  if (!values.profile || !values.brief) fail(1, 'missing --profile or --brief', { usage: USAGE });
  if (!values.pane === !(values.repo && values.name)) fail(1, 'give either --pane, or --repo and --name', { usage: USAGE });

  const brief = resolve(values.brief);
  if (!existsSync(brief)) fail(1, `brief not found: ${brief}`);
  const { variant, missing, statusFile } = checkBrief(readFileSync(brief, 'utf8'));
  if (missing.length) fail(1, `brief refused: missing starting-message field(s) ${missing.join(', ')} (contract.md, ${variant === 'quick' ? 'quick-fix variant' : 'starting message'})`, { brief, missing });
  if (!isAbsolute(statusFile)) fail(1, `brief refused: Status file must be an absolute path, got "${statusFile}"`, { brief });
  if (values.arg.some((a) => a.startsWith('parent='))) fail(1, 'do not pass --arg parent=; it comes from the brief\'s Status file');

  const agent = values.agent ?? harnessFor(values.profile);
  if (agent !== 'claude' && agent !== 'codex') fail(1, `cannot tell whether ${values.profile} runs claude or codex; pass --agent`);
  const toolCommand = ['agent-farm', 'run', values.profile, '--arg', `parent=${statusFile}`, ...values.arg.flatMap((a) => ['--arg', a])].map(quote).join(' ');
  const title = values.title ?? values.profile.replace(/^.*\//, '');

  if (values['dry-run']) {
    return console.log(JSON.stringify({ ok: true, dryRun: true, variant, agent, statusFile, toolCommand, brief }, null, 2));
  }

  // Launch with no initial input: the brief goes in only after the composer is on screen.
  let paneId = values.pane;
  let panelId;
  if (paneId) {
    const created = runpane(['panels', 'create', '--pane', paneId, '--agent', agent, '--tool-command', toolCommand, '--title', title, '--source', 'agent', '--no-focus', '--yes']);
    if (!created.ok) fail(2, 'panels create failed', { result: created });
    panelId = created.panelId;
  } else {
    const args = ['panes', 'create', '--repo', values.repo, '--name', values.name, '--agent', agent, '--tool-command', toolCommand, '--title', title, '--source', 'agent', '--no-focus', '--yes'];
    if (values.base) args.push('--base', values.base);
    const created = runpane(args);
    if (!created.ok) fail(2, 'panes create failed', { result: created });
    paneId = findDeep(created, 'paneId');
    panelId = findDeep(created, 'panelId');
    // A queued create (setup running elsewhere) returns no panel yet; find it once the agent starts.
    for (let tries = 0; !panelId && tries < 900; tries += 1) {
      await sleep(2000);
      const panels = runpane(['panels', 'list', '--pane', paneId], { allowFail: true }).panels ?? [];
      panelId = panels.find((p) => p.isCliPanel)?.id;
    }
    if (!panelId) fail(3, 'the new Pane never started its agent panel', { pane: paneId });
  }

  const worktree = (runpane(['panes', 'list']).panes ?? []).find((p) => p.id === paneId)?.worktreePath ?? null;
  mkdirSync(dirname(statusFile), { recursive: true });
  const session = values.session ?? sessionFor(paneId);
  const scope = session ? ['--session', session] : ['--pane', paneId];
  const watch = ['runpane', 'watch', ...scope, '--as', values.as, '--until-event', '--quiet', '--json', '--kinds', WATCH_KINDS].map(quote).join(' ');
  const where = { pane: paneId, panel: panelId, worktree, statusFile, brief, agent, session, watch };
  if (worktree && !statusFile.startsWith(`${worktree}/`)) where.warning = `status file is outside the Pane's worktree ${worktree}`;

  const ready = await waitForComposer(panelId, agent, Number(values['ready-timeout-ms']));
  if (!ready.ready) fail(3, `not submitted: ${ready.reason}`, { ...where, screen: ready.screen.split('\n').filter((l) => l.trim()).slice(-20).join('\n') });

  const sent = runpane(['panels', 'submit', '--panel', panelId, '--text', `Read and follow ${brief}`, '--yes'], { allowFail: true });
  const delivery = sent.delivery?.state ?? null;
  if (!sent.ok || !sent.verifiedSubmitted || delivery !== 'taken') {
    fail(4, 'the brief was sent but not confirmed taken; read the screen once before resending', { ...where, submit: sent });
  }
  console.log(JSON.stringify({ ok: true, ...where, submitted: { verifiedSubmitted: true, delivery, escapes: ready.escapes } }, null, 2));
}

main();
