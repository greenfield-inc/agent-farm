import fs from 'node:fs';
import path from 'node:path';

/** Installs a fake native harness the way npm does: an executable script, or on Windows a .cmd shim. */
export function writeHarness(bin,name,script){
 if(process.platform!=='win32'){fs.writeFileSync(path.join(bin,name),script,{mode:0o755});return;}
 fs.writeFileSync(path.join(bin,name+'.js'),script);
 fs.writeFileSync(path.join(bin,name+'.cmd'),`@node "%~dp0\\${name}.js" %*\r\n`);
}
