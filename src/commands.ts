export interface Flag {
  name: string;
  description: string;
  type: 'string' | 'boolean';
  default?: string;
}

export interface Command {
  name: string;
  usage: string;
  group: 'start' | 'launch' | 'inspect' | 'configure' | 'plugins';
  description: string;
  flags?: Flag[];
  examples?: string[];
}

export const commands: Command[] = [
  {name:'ui',usage:'agent-farm ui [--project DIR] [--config-root DIR] [--directory STORE] [--scope project|machine] [--no-open] [--port PORT]',group:'inspect',description:'Launch the local Agent Farm dashboard for sessions and profile management. Opens your browser, not an agent session. --directory selects the telemetry store; --config-root selects editable host configuration.'},
  {name:'traces',usage:'agent-farm traces [UI OPTIONS]',group:'inspect',description:'Compatibility alias for agent-farm ui. Opens the dashboard; it does not launch an agent.'},
  {name:'telemetry',usage:'agent-farm telemetry mcp [--project DIR] [--directory STORE] [--scope project|machine]\n       agent-farm telemetry export --bundle DIR [--session ID ...] [--project DIR] [--directory STORE] [--include-content] [--require-finished]',group:'inspect',description:'Serve read-only telemetry tools over stdio MCP, or export selected sessions and descendants into an existing artifact bundle. Export is project-scoped and local only; publishing remains the workspace workflow’s responsibility.'},
  {
    name: 'run',
    usage: 'agent-farm run [PLUGIN/]NAME[:VARIANT] [options] [-- native arguments...]',
    group: 'launch',
    description: 'Launch a profile in the native Claude Code or Codex terminal. For a profile with variants, it asks which one; add :VARIANT to skip the question.',
    flags: [
      {name: 'no-workspace', description: 'Skip workspace connections, instructions, and telemetry overrides; host telemetry defaults still apply', type: 'boolean'},
      {name: 'directory', description: 'Repository to open', type: 'string', default: 'cwd'},
      {name: 'message', description: 'Send an initial message after launch', type: 'string'},
      {name: 'model', description: 'Override the entry agent model for this launch', type: 'string'},
      {name: 'reasoning', description: 'Override the entry agent reasoning effort for this launch', type: 'string'},
      {name: 'speed', description: 'Override Codex speed (fast or standard) for this launch', type: 'string'},
      {name: 'arg', description: 'Repeatable declared launch argument in key=value form', type: 'string'},
      {name: 'build', description: 'Generate the bundle and print its path (no launch)', type: 'boolean'},
      {name: 'explain', description: 'Print the resolved launch command as JSON (no launch)', type: 'boolean'},
      {name: 'exec', description: 'Headless execution (no interactive terminal)', type: 'boolean'},
      {name: 'print-launch', description: 'Prepare a headless launch and print argv, cwd, bundle and env overrides as JSON. Consumers spawn the printed argv verbatim and must never assume argv[0] is the harness binary; it may be a wrapper with prefix arguments before the harness flags.', type: 'boolean'},
      {name: 'native-arg', description: 'Repeatable native argument, before the message; use --native-arg=--flag for flags', type: 'string'},
      {name: 'config-root', description: 'Configuration directory, including host provider targeting in settings.json', type: 'string', default: '~/.config/agent-farm'},
    ],
    examples: [
      'agent-farm run planner',
      'agent-farm run dcouple/implementer',
      'agent-farm run implementer --directory ~/repos/my-app',
      'agent-farm run implementer --model gpt-6-astra --speed fast --arg review=full',
      'agent-farm run greenfield/planner --directory ~/repos/my-project --message "Plan issue #42"',
      'agent-farm run planner --directory ~/repos/my-app --print-launch',
      'agent-farm run implementer --print-launch --message "Continue" -- exec resume THREAD --json',
    ],
  },
  {
    name: 'init',
    usage: 'agent-farm init [--full]',
    group: 'start',
    description: 'First-time setup. Checks prerequisites, installs the default plugin, and walks through available profiles.',
    flags: [
      {name: 'full', description: 'Show everything at once (no step-by-step prompts)', type: 'boolean'},
    ],
    examples: [
      'agent-farm init',
      'agent-farm init --full',
    ],
  },
  {
    name: 'profiles list',
    usage: 'agent-farm profiles list',
    group: 'inspect',
    description: 'List local and installed profiles with qualified name, plugin/version, ambiguity, agent, harness, and model.',
    flags: [
      {name: 'config-root', description: 'Configuration directory', type: 'string', default: '~/.config/agent-farm'},
    ],
    examples: [
      'agent-farm profiles list',
    ],
  },
  {
    name: 'inspect',
    usage: 'agent-farm inspect [PLUGIN/]NAME[:VARIANT] [--directory PATH] [--no-workspace]',
    group: 'inspect',
    description: 'Show the resolved agent graph for a profile: model, skills, children, connections, and source files. Output is JSON.',
    flags: [
      {name: 'directory', description: 'Directory whose repository workspace to inspect', type: 'string'},
      {name: 'no-workspace', description: 'Inspect without a workspace', type: 'boolean'},
      {name: 'config-root', description: 'Configuration directory', type: 'string', default: '~/.config/agent-farm'},
    ],
    examples: [
      'agent-farm inspect planner',
      'agent-farm inspect greenfield/planner --directory ~/repos/my-project',
    ],
  },
  {
    name: 'status global',
    usage: 'agent-farm status global [--harness claude|codex]',
    group: 'inspect',
    description: 'Show all global skills: managed (by Agent Farm), unmanaged (pre-existing), or changed (modified managed links).',
    flags: [
      {name: 'harness', description: 'Filter to one harness', type: 'string'},
    ],
    examples: [
      'agent-farm status global',
      'agent-farm status global --harness claude',
    ],
  },
  {
    name: 'set global',
    usage: 'agent-farm set global [PROFILE[:VARIANT]] [--harness claude|codex]',
    group: 'configure',
    description: "Install a profile's skills into the native user skill directory so they are available in every repository. Only skills are mounted — not the model, identity, or sub-agents.",
    flags: [
      {name: 'harness', description: 'Target harness (default: profile harness)', type: 'string'},
      {name: 'directory', description: 'Mount this directory’s resolved workspace when PROFILE is omitted', type: 'string'},
      {name: 'config-root', description: 'Configuration directory', type: 'string', default: '~/.config/agent-farm'},
    ],
    examples: [
      'agent-farm set global planner --harness claude',
      'agent-farm set global --directory ~/repos/my-project --harness codex',
    ],
  },
  {
    name: 'unset global',
    usage: 'agent-farm unset global [PROFILE[:VARIANT]] [--harness claude|codex]',
    group: 'configure',
    description: "Remove a profile's managed skills from the native user directory.",
    flags: [
      {name: 'harness', description: 'Target harness', type: 'string'},
      {name: 'directory', description: 'Unmount this directory’s workspace when PROFILE is omitted', type: 'string'},
      {name: 'save', description: 'Save pre-existing unmanaged skills as a new profile before removing', type: 'string'},
      {name: 'model', description: 'Model ID for the saved profile (required with --save)', type: 'string'},
      {name: 'config-root', description: 'Configuration directory', type: 'string', default: '~/.config/agent-farm'},
    ],
    examples: [
      'agent-farm unset global planner --harness claude',
      'agent-farm unset global --save my-old-skills --harness codex --model gpt-6-astra',
    ],
  },
  {
    name: 'mcp login',
    usage: 'agent-farm mcp login CONNECTION [--directory PATH] --harness claude|codex',
    group: 'configure',
    description: "Sign in to a remote MCP connection using the native harness's OAuth flow. Run once per connection per harness. Launch inside the repository to use its approved workspace.",
    examples: [
      '# Authenticate each MCP connection once per harness:',
      'agent-farm mcp login linear --directory ~/repos/my-project --harness codex',
      'agent-farm mcp login sentry --directory ~/repos/my-project --harness codex',
      'agent-farm mcp login posthog --directory ~/repos/my-project --harness claude',
      '',
      '# Then launch with the workspace:',
      'agent-farm run greenfield/planner --directory ~/repos/my-project',
    ],
  },
  ...['trust','untrust','show','load','unload','loaded'].map(operation=>({
    name: 'workspace '+operation,
    usage: 'agent-farm workspace '+operation+(operation==='loaded'?'':' [--directory PATH]')+(operation==='trust'?' [--yes]':['load','unload'].includes(operation)?' --harness claude|codex':''),
    group: 'configure' as const,
    description: ({trust:'Review and approve the repository workspace; approval is shared by linked worktrees.',untrust:'Revoke all workspace approvals for this repository.',show:'Show workspace connections, instructions, telemetry settings, field provenance, and trust state.',load:'Mount workspace connections and instructions in a native harness configuration; telemetry applies only to Agent Farm launches.',unload:'Remove only the owned workspace connections and instructions.',loaded:'List mounted workspaces.'} as Record<string,string>)[operation]!,
  })),
  {
    name: 'provider set',
    usage: 'agent-farm provider set NAME --base-url URL --api-key-env VAR',
    group: 'configure',
    description: 'Configure a model provider for all launches by default. Set provider.match to "slash-models" in settings.json to route only model slugs containing /.',
    flags: [
      {name: 'base-url', description: 'Provider API base URL', type: 'string'},
      {name: 'api-key-env', description: 'Environment variable holding the API key', type: 'string'},
      {name: 'config-root', description: 'Configuration directory', type: 'string', default: '~/.config/agent-farm'},
    ],
    examples: [
      'agent-farm provider set openrouter --base-url https://openrouter.ai/api --api-key-env OPENROUTER_API_KEY',
      'agent-farm provider set deepseek --base-url https://api.deepseek.com --api-key-env DEEPSEEK_API_KEY',
    ],
  },
  {
    name: 'provider show',
    usage: 'agent-farm provider show',
    group: 'inspect',
    description: 'Show the currently configured provider, if any.',
    flags: [
      {name: 'config-root', description: 'Configuration directory', type: 'string', default: '~/.config/agent-farm'},
    ],
    examples: [
      'agent-farm provider show',
    ],
  },
  {
    name: 'provider clear',
    usage: 'agent-farm provider clear',
    group: 'configure',
    description: 'Remove the provider configuration. All profiles will use their native harness.',
    flags: [
      {name: 'config-root', description: 'Configuration directory', type: 'string', default: '~/.config/agent-farm'},
    ],
    examples: [
      'agent-farm provider clear',
    ],
  },
  {
    name: 'plugin install',
    usage: 'agent-farm plugin install [SOURCE|BUNDLED-NAME]',
    group: 'plugins',
    description: 'Install or update one isolated plugin. With no source, install bundled dcouple; a bundled name selects another plugins/ folder.',
    examples: [
      'agent-farm plugin install',
      'agent-farm plugin install /path/to/config',
    ],
  },
  {
    name: 'plugin list',
    usage: 'agent-farm plugin list',
    group: 'plugins',
    description: 'List installed plugin names, versions, sources, and profile counts.',
    examples: ['agent-farm plugin list'],
  },
  {
    name: 'plugin uninstall',
    usage: 'agent-farm plugin uninstall NAME',
    group: 'plugins',
    description: 'Uninstall receipt-owned files that are unchanged and report modified files left in place.',
    examples: ['agent-farm plugin uninstall roles'],
  },
  {
    name: 'plugin validate',
    usage: 'agent-farm plugin validate SOURCE',
    group: 'plugins',
    description: 'Validate a configuration directory: check all profiles resolve, skills exist, and agent definitions parse.',
    examples: [
      'agent-farm plugin validate /path/to/config',
    ],
  },
  {
    name: 'plugin pack',
    usage: 'agent-farm plugin pack SOURCE OUTPUT',
    group: 'plugins',
    description: 'Create a checksummed plugin package from a source configuration directory.',
    examples: ['agent-farm plugin pack ./plugins/roles /tmp/roles-package'],
  },
  {
    name: 'doctor',
    usage: 'agent-farm doctor',
    group: 'inspect',
    description: 'Check your setup: prerequisites, config directory, profiles, workspaces, and global skills.',
    examples: [
      'agent-farm doctor',
    ],
  },
  {
    name: 'help',
    usage: 'agent-farm help [COMMAND]',
    group: 'start',
    description: 'Show command reference. With a command name, show details for that command.',
    examples: [
      'agent-farm help',
      'agent-farm help run',
    ],
  },
];

export function findCommand(name: string): Command | undefined {
  return commands.find(c => c.name === name);
}

export const groupLabels: Record<string, string> = {
  start: 'Getting started',
  launch: 'Launch',
  inspect: 'Inspect',
  configure: 'Configure',
  plugins: 'Plugins',
};

export const groupOrder = ['start', 'launch', 'inspect', 'configure', 'plugins'];
