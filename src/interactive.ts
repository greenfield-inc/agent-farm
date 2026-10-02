import {resolveInteractiveWorkspace} from './workspaces.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execSync} from 'node:child_process';
import * as p from '@clack/prompts';
import {listProfiles, inspectProfile} from './inspect.js';
import {build,modelSummary,orderedVariants,resolveProfile,splitVariant} from './compiler.js';
import type {ResolvedWorkspace} from './workspaces.js';
import {nativeCommand,run} from './runtime.js';
import {installPlugin} from './plugins.js';
import {fileURLToPath} from 'node:url';
import {stringify} from 'yaml';

// ANSI helpers
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const italic = (s: string) => `\x1b[3m${s}\x1b[23m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[39m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[39m`;
const bgCyan = (s: string) => `\x1b[46m\x1b[30m ${s} \x1b[39m\x1b[49m`;
const bgMagenta = (s: string) => `\x1b[45m\x1b[37m ${s} \x1b[39m\x1b[49m`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function harnessBadge(h: string) { return h === 'claude' ? bgMagenta('claude') : bgCyan('codex'); }

function isCancel(value: unknown): value is symbol {
  return p.isCancel(value);
}

function bail(): never {
  p.cancel('Cancelled.');
  process.exit(0);
}

function which(name: string): boolean {
  return path.isAbsolute(nativeCommand([name],process.env)[0]!);
}

function listSkills(configRoot: string): string[] {
  const dir = path.join(configRoot, 'skills');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => {
    const skillFile = path.join(dir, name, 'SKILL.md');
    return fs.existsSync(skillFile);
  }).sort();
}

function openInEditor(file: string) {
  const editor = process.env.EDITOR ?? process.env.VISUAL ?? (process.platform==='win32' ? 'notepad' : 'nano');
  try { execSync(`${editor} "${file}"`, {stdio: 'inherit'}); }
  catch { p.log.warn(`Could not open ${editor}. Edit manually: ${file}`); }
}

async function pickDirectory(defaultDir: string): Promise<string> {
  const dirChoice = await p.text({
    message: 'Repository directory',
    initialValue: defaultDir,
    validate: (val) => {
      if (!val || !val.trim()) return 'Required';
      const resolved = path.resolve(val);
      if (!fs.existsSync(resolved)) return `Not found: ${resolved}`;
      if (!fs.statSync(resolved).isDirectory()) return 'Not a directory';
    },
  });
  if (isCancel(dirChoice)) bail();
  return path.resolve(dirChoice as string);
}

function rawCommand(profile: string, targetDir: string): string {
  const parts = ['agent-farm run', profile];
  parts.push('--directory', targetDir);
  return parts.join(' ');
}

/** Asks which variant to launch when a profile has more than one and none was named. */
export async function chooseVariant(configRoot: string, requested: string, workspace?: ResolvedWorkspace): Promise<string> {
  if (splitVariant(requested).variant !== undefined) return requested;
  const resolved = resolveProfile(configRoot, requested, workspace);
  if (!resolved.variants || resolved.variants.length < 2) return requested;
  const choice = await p.select({
    message: `Which ${bold(requested)} variant?`,
    options: orderedVariants(resolved.variants, resolved.default_variant).map(variant => {
      // A broken variant shows its error instead of blocking the ones that work.
      let hint: string;
      try { const agent = resolveProfile(configRoot, `${requested}:${variant}`, workspace).nodes.main!; hint = `${agent.harness} · ${modelSummary({name: agent.model, reasoning: agent.reasoning_effort, speed: agent.speed})}`; }
      catch (error) { hint = `cannot launch: ${error instanceof Error ? error.message : error}`; }
      return {value: variant, label: variant, hint: `${hint}${variant === resolved.default_variant ? ' · default' : ''}`};
    }),
  });
  if (isCancel(choice)) bail();
  return `${requested}:${choice as string}`;
}

async function launchProfile(configRoot: string, profile: string, targetDir: string) {
  const workspace=await resolveInteractiveWorkspace(configRoot,{directory:targetDir});
  profile = await chooseVariant(configRoot, profile, workspace);
  const s = p.spinner();
  s.start('Building configuration');
  const bundle = build(configRoot, profile, targetDir, workspace);
  s.stop(`${green('✓')} Bundle ready`);

  const cmd = rawCommand(profile, targetDir);
  p.log.message(`  ${dim('$')} ${bold(cmd)}`);

  await sleep(300);
  p.outro(`Launching ${bold(profile)}`);
  const child = run(bundle, 'main', [], undefined, configRoot);
  // POSIX replaced this process with the harness; Windows only spawned it, so hold the console until it exits.
  if (child) await new Promise(resolve => child.on('close', resolve).on('error', resolve));
}

async function createProfileFlow(configRoot: string): Promise<string | undefined> {
  p.log.step(`Create a new profile`);
  p.log.message(dim('  Each step builds your agent configuration.'));

  // 1. Name
  const name = await p.text({
    message: 'Profile name',
    placeholder: 'my-planner',
    validate: (val) => {
      if (!val || !val.trim()) return 'Required';
      if (!/^[a-z][a-z0-9_-]{0,63}$/.test(val)) return 'Lowercase letters, numbers, hyphens. Start with a letter.';
      if (fs.existsSync(path.join(configRoot, 'profiles', val + '.yaml'))) return 'Already exists';
    },
  });
  if (isCancel(name)) return undefined;
  const profileName = name as string;

  // 2. Harness
  const harness = await p.select({
    message: 'AI terminal',
    options: [
      {value: 'codex', label: `Codex  ${dim('OpenAI')}`},
      {value: 'claude', label: `Claude Code  ${dim('Anthropic')}`},
    ],
  });
  if (isCancel(harness)) return undefined;

  // 3. Model — preset picker instead of text field
  const modelOptions: Record<string, {value: string; label: string; hint: string}[]> = {
    codex: [
      {value: 'gpt-6-astra', label: 'gpt-6-astra', hint: 'flagship'},
      {value: 'gpt-5.6-luna', label: 'gpt-5.6-luna', hint: 'fast'},
      {value: 'gpt-5.6-sol', label: 'gpt-5.6-sol', hint: 'balanced'},
    ],
    claude: [
      {value: 'claude-sonnet-5', label: 'claude-sonnet-5', hint: 'fast'},
      {value: 'claude-opus-4-6', label: 'claude-opus-4-6', hint: 'strongest'},
      {value: 'claude-fable-5-1', label: 'claude-fable-5-1', hint: 'reasoning'},
    ],
  };
  const model = await p.select({
    message: 'Model',
    options: [
      ...modelOptions[harness as string]!,
      {value: '__custom__', label: 'Other…', hint: 'type a model ID'},
    ],
  });
  if (isCancel(model)) return undefined;
  let modelName = model as string;
  if (modelName === '__custom__') {
    const custom = await p.text({
      message: 'Model ID',
      placeholder: 'model-name',
      validate: (val) => { if (!val || !val.trim()) return 'Required'; },
    });
    if (isCancel(custom)) return undefined;
    modelName = custom as string;
  }

  // 4. Reasoning
  const reasoning = await p.select({
    message: 'Reasoning effort',
    options: [
      {value: 'high', label: 'High', hint: 'thorough'},
      {value: 'medium', label: 'Medium', hint: 'balanced'},
      {value: 'low', label: 'Low', hint: 'fast'},
      {value: '__none__', label: 'Default', hint: 'model decides'},
    ],
  });
  if (isCancel(reasoning)) return undefined;

  // 5. Skills — gate behind a yes/no so multiselect doesn't auto-skip
  const skills = listSkills(configRoot);
  let selectedSkills: string[] = [];
  if (skills.length) {
    const wantSkills = await p.confirm({
      message: `Add skills? ${dim(`${skills.length} available`)}`,
      initialValue: true,
    });
    if (isCancel(wantSkills)) return undefined;
    if (wantSkills) {
      p.log.message(dim(`  ${bold('space')} toggle · ${bold('a')} toggle all · ${bold('enter')} confirm`));
      const skillChoice = await p.multiselect({
        message: 'Skills',
        options: skills.map(s => ({value: s, label: s})),
        required: true,
      });
      if (isCancel(skillChoice)) return undefined;
      selectedSkills = skillChoice as string[];
    }
  }

  // 6. Instructions — gate behind yes/no
  const wantInstructions = await p.confirm({
    message: 'Add custom instructions?',
    initialValue: false,
  });
  if (isCancel(wantInstructions)) return undefined;
  let instructionText = '';
  if (wantInstructions) {
    const instructions = await p.text({
      message: 'Instructions',
      placeholder: 'Help the user plan features and create tickets.',
      validate: (val) => { if (!val || !val.trim()) return 'Write something or go back'; },
    });
    if (isCancel(instructions)) return undefined;
    instructionText = (instructions as string).trim();
  }

  // 7. Summary + confirm
  const hBadge = harnessBadge(harness as string);
  console.log('');
  const summaryLines = [
    `  ${bold(profileName)}  ${hBadge}  ${dim(modelName)}${reasoning !== '__none__' ? '  ' + dim(reasoning as string) : ''}`,
    `  ${dim('Skills')}  ${selectedSkills.length ? selectedSkills.map(s => cyan(s)).join(dim(' · ')) : dim('none')}`,
  ];
  if (instructionText) summaryLines.push(`  ${dim('Instructions')}  ${italic(instructionText.length > 50 ? instructionText.slice(0, 50) + '…' : instructionText)}`);
  for (const line of summaryLines) console.log(line);
  console.log('');

  const confirm = await p.confirm({message: 'Create this profile?', initialValue: true});
  if (isCancel(confirm) || !confirm) return undefined;

  // Write files
  const agentDir = path.join(configRoot, 'agents');
  const profileDir = path.join(configRoot, 'profiles');
  fs.mkdirSync(agentDir, {recursive: true});
  fs.mkdirSync(profileDir, {recursive: true});

  const frontmatter: Record<string, unknown> = {
    harness: harness as string,
    model: reasoning === '__none__' ? modelName : {name: modelName, reasoning: reasoning as string},
  };
  if (selectedSkills.length) frontmatter.skills = selectedSkills;

  const agentContent = '---\n' + stringify(frontmatter) + '---\n' + (instructionText || 'Wait for a request when no starter message is supplied.') + '\n';
  const profileContent = stringify({agent: profileName});

  fs.writeFileSync(path.join(agentDir, profileName + '.md'), agentContent);
  fs.writeFileSync(path.join(profileDir, profileName + '.yaml'), profileContent);

  p.log.success(`Created ${bold(profileName)}`);
  p.log.message(`  ${dim(path.join(agentDir, profileName + '.md'))}`);

  return profileName;
}

export async function bareCommand(configRoot: string, directory: string) {
  p.intro(bold('agent-farm'));

  const profiles = listProfiles(configRoot);

  if (!profiles.length) {
    p.log.warn(`No profiles found. Run ${bold('agent-farm init')} to get started.`);
    p.outro('');
    process.exit(1);
  }

  type Choice = { value: string; label: string; hint?: string };
  const separator = {value: '__sep__', label: dim('─────────────────────'), hint: ''};
  // Tab shows every description under its profile; otherwise only the highlighted one shows, as its hint.
  let showDescriptions = false;
  const options: Choice[] = [
    ...profiles.map(prof => {
      const name = prof.qualified + (prof.variants ? dim(` (${prof.variants.length})`) : '');
      const summary = prof.description ?? (prof.variants ? `default ${prof.default_variant}` : `${prof.harness} · ${modelSummary({name: prof.model.name, reasoning: prof.model.reasoning === 'default' ? undefined : prof.model.reasoning, speed: prof.model.speed})}`);
      return {
        value: 'launch:' + prof.qualified,
        get label() { return showDescriptions && prof.description ? `${name}\n${indentWrap(prof.description, '    ').map(dim).join('\n')}` : name; },
        get hint() { return showDescriptions && prof.description ? undefined : summary; },
      };
    }),
    separator,
    {value: 'create', label: `${green('+')} Create new profile`},
    {value: 'edit', label: `${yellow('✎')} Edit a profile`},
    {value: 'inspect', label: `${cyan('⊕')} Inspect a profile`},
  ];

  // Registered before the prompt's own listener, so the flag flips before it re-renders.
  const toggleDescriptions = (_: unknown, key?: {name?: string}) => { if (key?.name === 'tab') showDescriptions = !showDescriptions; };
  process.stdin.on('keypress', toggleDescriptions);
  const selection = await p.select({message: `What would you like to do? ${dim('Tab: show all descriptions')}`, options});
  process.stdin.off('keypress', toggleDescriptions);
  if (isCancel(selection)) bail();
  const action = selection as string;
  if (action === '__sep__') { await bareCommand(configRoot, directory); return; }

  if (action === 'create') {
    const created = await createProfileFlow(configRoot);
    if (created) {
      const launch = await p.confirm({message: `Launch ${bold(created)} now?`, initialValue: true});
      if (isCancel(launch)) bail();
      if (launch) {
        const targetDir = await pickDirectory(directory);
        await launchProfile(configRoot, created, targetDir);
      }
    }
    return;
  }

  if (action === 'edit') {
    const editChoice = await p.select({
      message: 'Which profile?',
      options: profiles.map(prof => ({
        value: prof.qualified,
        label: prof.qualified,
        hint: `${prof.harness} · ${prof.model.name}`,
      })),
    });
    if (isCancel(editChoice)) bail();
    const info = inspectProfile(configRoot, editChoice as string);
    const agentFile = info.agents.main?.source_file;
    if (agentFile) {
      p.log.info(`Opening ${dim(agentFile)}`);
      openInEditor(agentFile);
    } else {
      p.log.warn('Agent file not found');
    }
    return;
  }

  if (action === 'inspect') {
    const inspectChoice = await p.select({
      message: 'Which profile?',
      options: profiles.map(prof => ({
        value: prof.qualified,
        label: prof.qualified,
        hint: `${prof.harness} · ${prof.model.name}`,
      })),
    });
    if (isCancel(inspectChoice)) bail();
    const info = inspectProfile(configRoot, inspectChoice as string);
    const main = info.agents.main!;
    const hBadge = harnessBadge(main.harness);
    console.log('');
    console.log(`  ${bold(inspectChoice as string)}  ${hBadge}`);
    console.log(`  ${dim('Agent')}     ${main.agent}`);
    console.log(`  ${dim('Model')}     ${main.model.name}  ${dim('reasoning:')} ${main.model.reasoning ?? 'default'}`);
    console.log(`  ${dim('Skills')}    ${main.skills.length ? main.skills.map(s => cyan(s.name)).join(dim(' · ')) : dim('none')}`);
    const subs = Object.entries(main.subagents);
    if (subs.length) console.log(`  ${dim('Children')}  ${subs.map(([alias]) => yellow(alias)).join(dim(' · '))}`);
    const conns = Object.keys(main.connections);
    if (conns.length) console.log(`  ${dim('MCPs')}      ${conns.map(c => green(c)).join(dim(' · '))}`);
    console.log(`  ${dim('Source')}    ${dim(main.source_file ?? '')}`);
    console.log('');
    console.log(`  ${dim('$')} ${bold('agent-farm run ' + (inspectChoice as string))} --directory <repo>`);
    console.log('');
    return;
  }

  // Launch
  const profile = action.replace('launch:', '');
  const targetDir = await pickDirectory(directory);
  await launchProfile(configRoot, profile, targetDir);
}

function indentWrap(text: string, indent: string): string[] {
  const width = Math.max((process.stdout.columns || 80) - indent.length - 20, 30), lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + word.length + 1 > width) { lines.push(indent + line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  return [...lines, indent + line];
}

function truncateSkills(names: string[], max: number): string {
  if (!names.length) return 'none';
  if (names.length <= max) return names.join(', ');
  return names.slice(0, max).join(', ') + ` +${names.length - max} more`;
}

async function continuePrompt(): Promise<void> {
  const next = await p.confirm({message: 'Continue', initialValue: true, active: '↵', inactive: 'quit'});
  if (isCancel(next) || !next) bail();
}

export async function initCommand(configRoot: string, directory: string, full = false) {
  // Animated banner
  const bannerLines = [
    '  ╔═══════════════════════════════════════════╗',
    '  ║                                           ║',
    '  ║   🌱  a g e n t - f a r m                 ║',
    '  ║                                           ║',
    '  ║   Load the right skills for each job.      ║',
    '  ║   Keep your native terminal.               ║',
    '  ║                                           ║',
    '  ╚═══════════════════════════════════════════╝',
  ];
  console.log('');
  if (!full) {
    for (const line of bannerLines) { console.log(line); await sleep(40); }
  } else {
    for (const line of bannerLines) console.log(line);
  }
  console.log('');

  p.intro(bold('First-time setup'));

  // Prerequisites — show as a batch with a spinner
  const s1 = p.spinner();
  s1.start('Checking prerequisites');
  await sleep(full ? 0 : 400);

  const nodeVersion = process.versions.node;
  const nodeMajor = parseInt(nodeVersion.split('.')[0]!, 10);
  const nodeMinor = parseInt(nodeVersion.split('.')[1]!, 10);
  const nodeOk = nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 15);
  const hasClaude = which('claude');
  const hasCodex = which('codex');

  const checks = [
    nodeOk ? `${green('✓')} Node ${nodeVersion}` : `${yellow('✗')} Node ${nodeVersion} ${dim('(need 22.15+)')}`,
    hasClaude ? `${green('✓')} claude CLI` : `${yellow('–')} claude CLI ${dim('(not found)')}`,
    hasCodex ? `${green('✓')} codex CLI` : `${yellow('–')} codex CLI ${dim('(not found)')}`,
  ];
  s1.stop(checks.join('  '));

  if (!nodeOk) { p.cancel('Install Node 22.15+ first.'); process.exit(1); }
  if (!hasClaude && !hasCodex) { p.cancel('Install claude or codex CLI first.'); process.exit(1); }

  if (!full) await continuePrompt();

  // Concepts
  p.log.step(bold('How Agent Farm works'));
  p.log.message([
    `  ${bold('Profile')}    ${dim('=')} agent + model + skills for a job`,
    `  ${bold('Workspace')}  ${dim('=')} MCP connections ${dim('(Linear, Sentry, …)')}`,
    '',
    `  Pick a profile → pick a repo → go.`,
  ].join('\n'));

  // Plugin install
  const profiles = listProfiles(configRoot);
  if (!profiles.length) {
    const install = await p.confirm({
      message: `Install the default profiles and skills? ${dim('(recommended)')}`,
      initialValue: true,
    });
    if (isCancel(install)) bail();
    if (install) {
      const s2 = p.spinner();
      s2.start('Installing dcouple plugin');
      const source = fileURLToPath(new URL('../plugins/dcouple', import.meta.url));
      installPlugin(source, configRoot);
      await sleep(full ? 0 : 300);
      s2.stop(`${green('✓')} Installed`);
    }
  } else {
    p.log.success(`${profiles.length} profiles already installed`);
  }

  const allProfiles = listProfiles(configRoot);
  if (!allProfiles.length) {
    p.outro('No profiles available. Add your own to ~/.config/agent-farm/');
    return;
  }

  if (!full) await continuePrompt();

  // Profiles
  p.log.step(bold('Installed profiles'));
  for (const prof of allProfiles) {
    const info = inspectProfile(configRoot, prof.qualified);
    const agent = info.agents.main!;
    const desc = agent.description ?? '';
    const skillNames = agent.skills.map(s => s.name);
    const hBadge = harnessBadge(prof.harness);
    const skillPills = skillNames.slice(0, 4).map(s => cyan(s)).join(dim(' · '));
    const extra = skillNames.length > 4 ? dim(` +${skillNames.length - 4}`) : '';
    p.log.message([
      `  ${bold(prof.qualified)}  ${hBadge}  ${dim(prof.model.name)}`,
      desc ? `  ${dim(desc)}` : '',
      `  ${skillPills}${extra}`,
    ].filter(Boolean).join('\n'));
  }

  p.log.info('Project connections: .agent-farm/workspace.yaml; approve with agent-farm workspace trust.');

  if (!full) await continuePrompt();

  // Quick ref
  p.log.step(bold('Quick reference'));
  p.log.message([
    `  ${bold('agent-farm')}            Interactive picker`,
    `  ${bold('agent-farm init')}       This setup ${dim('(rerun any time)')}`,
    `  ${bold('agent-farm run')} ${cyan('NAME')}   Launch directly`,
    `  ${bold('agent-farm --help')}     All commands`,
    '',
    `  ${dim('Config:')} ~/.config/agent-farm/`,
    `  ${dim('profiles/ · agents/ · skills/ · workspace.yaml')}`,
  ].join('\n'));

  // Launch
  const shouldLaunch = await p.confirm({
    message: `Launch a profile now?`,
    initialValue: true,
  });
  if (isCancel(shouldLaunch)) bail();

  if (shouldLaunch) {
    await bareCommand(configRoot, directory);
  } else {
    p.outro(`Run ${bold('agent-farm')} any time to pick a profile.`);
  }
}

import {commands as commandDefs, findCommand, groupLabels, groupOrder} from './commands.js';

export function doctorCommand(configRoot: string) {
  const nodeVersion = process.versions.node;
  const nodeMajor = parseInt(nodeVersion.split('.')[0]!, 10);
  const nodeMinor = parseInt(nodeVersion.split('.')[1]!, 10);
  const nodeOk = nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 15);
  const hasClaude = which('claude');
  const hasCodex = which('codex');

  console.log('');
  console.log(`  ${bold('agent-farm doctor')}`);
  console.log('');

  // Prerequisites
  console.log(`  ${bold('Prerequisites')}`);
  console.log(`    Node        ${nodeOk ? green('✓') : yellow('✗')} ${nodeVersion}${nodeOk ? '' : dim(' (need 22.15+)')}`);
  console.log(`    claude      ${hasClaude ? green('✓') : yellow('–')} ${hasClaude ? 'found' : dim('not found')}`);
  console.log(`    codex       ${hasCodex ? green('✓') : yellow('–')} ${hasCodex ? 'found' : dim('not found')}`);
  console.log('');

  // Config directory
  const configExists = fs.existsSync(configRoot);
  console.log(`  ${bold('Config')}  ${dim(configRoot)}`);
  if (!configExists) {
    console.log(`    ${yellow('–')} Directory does not exist. Run ${bold('agent-farm init')} to set up.`);
    console.log('');
    return;
  }
  console.log(`    ${green('✓')} Directory exists`);

  // Profiles
  try {
    const profiles = listProfiles(configRoot);
    console.log(`    ${green('✓')} ${profiles.length} profile(s): ${profiles.map(p => p.qualified).join(', ') || dim('none')}`);
    let broken = 0;
    for (const prof of profiles) {
      try { inspectProfile(configRoot, prof.qualified); }
      catch (e) { broken++; console.log(`    ${yellow('✗')} ${prof.qualified}: ${e instanceof Error ? e.message : e}`); }
    }
    if (!broken && profiles.length) console.log(`    ${green('✓')} All profiles resolve`);
  } catch (e) {
    console.log(`    ${yellow('✗')} Profile scan failed: ${e instanceof Error ? e.message : e}`);
  }

  // Skills
  const skills = listSkills(configRoot);
  console.log(`    ${green('✓')} ${skills.length} skill(s)`);

  console.log('');
}

export function helpCommand(query?: string) {
  if (query) {
    const cmd = findCommand(query);
    if (!cmd) {
      console.log(`  Unknown command: ${query}. Run ${bold('agent-farm help')} for all commands.`);
      process.exitCode = 1;
      return;
    }
    console.log('');
    console.log(`  ${bold(cmd.usage)}`);
    console.log(`  ${cmd.description}`);
    if (cmd.flags?.length) {
      console.log('');
      console.log(`  ${bold('Flags:')}`);
      for (const f of cmd.flags) {
        const def = f.default ? dim(` (default: ${f.default})`) : '';
        console.log(`    ${dim('--' + f.name)}  ${f.description}${def}`);
      }
    }
    if (cmd.examples?.length) {
      console.log('');
      console.log(`  ${bold('Examples:')}`);
      for (const e of cmd.examples) {
        if (!e) { console.log(''); continue; }
        if (e.startsWith('#')) { console.log(`    ${dim(e)}`); continue; }
        console.log(`    ${dim('$')} ${e}`);
      }
    }
    console.log('');
    return;
  }

  console.log('');
  console.log(`  ${bold('agent-farm')} — Load the right skills for each job.`);

  for (const group of groupOrder) {
    const cmds = commandDefs.filter(c => c.group === group);
    if (!cmds.length) continue;
    console.log('');
    console.log(`  ${bold(groupLabels[group]!)}`);
    for (const cmd of cmds) {
      const short = cmd.description.split('.')[0]!;
      console.log(`    ${bold(cmd.name.padEnd(22))}  ${dim(short)}`);
    }
  }

  console.log('');
  console.log(`  ${dim('Config directory:')} ~/.config/agent-farm/`);
  console.log(`  ${dim('Run')} ${bold('agent-farm help')} ${cyan('COMMAND')} ${dim('for details on any command.')}`);
  console.log('');
}
