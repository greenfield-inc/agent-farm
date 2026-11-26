// Loaded before every test file (package.json): a test run started from an agent's shell (a Pane tab, a launch link)
// inherits that launch's parent token, snapshot and CLI argv, which would steer the launches under test.
// AGENT_FARM_CONFIG_ROOT stays: docs/development.md points it at a scratch folder on purpose.
for (const key of ['AGENT_FARM_PARENT','AGENT_FARM_SNAPSHOT','AGENT_FARM_CLI']) delete process.env[key];
