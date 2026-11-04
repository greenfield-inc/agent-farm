#!/usr/bin/env node
// Bundled as codex-otel.mjs. codex-acp starts Codex as `$CODEX_PATH app-server` and reads only hooks from
// CODEX_CONFIG at that point, so the telemetry wrapper points CODEX_PATH here to add the collector's
// -c otel settings to the app-server's own command line, exactly as a terminal launch does.
import {execute} from './runtime.js';

const codex=process.env.AGENT_FARM_CODEX_PATH || 'codex';
const config: string[]=JSON.parse(process.env.AGENT_FARM_CODEX_OTEL || '[]');
const env={...process.env};
delete env.AGENT_FARM_CODEX_PATH; delete env.AGENT_FARM_CODEX_OTEL;
const args=process.argv.slice(2),separator=args.indexOf('--'),index=separator<0?args.length:separator;
execute([codex,...args.slice(0,index),...config,...args.slice(index)],process.cwd(),env);
