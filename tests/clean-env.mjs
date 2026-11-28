// Loaded before every test file (package.json): a test run started from an agent's shell (a Pane tab, a launch link)
// inherits that launch's parent token, snapshot and CLI argv, which would steer the launches under test, and the
// person's gcloud identity, which would make every launch under test ask the real gcloud.
// AGENT_FARM_CONFIG_ROOT stays: docs/development.md points it at a scratch folder on purpose.
for (const key of ['AGENT_FARM_PARENT','AGENT_FARM_SNAPSHOT','AGENT_FARM_CLI','CLOUDSDK_ACTIVE_CONFIG_NAME','GOOGLE_APPLICATION_CREDENTIALS','AGENT_FARM_GCLOUD_CHECK']) delete process.env[key];
