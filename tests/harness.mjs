import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

/** Plants a link for the code under test to inspect. A default Windows install withholds the file-symlink
 *  privilege, but allows junctions, which lstat, readlink and readdir all report as links, so a junction stands
 *  in for a symlink. Give an absolute target, and a directory whenever the code follows the path rather than
 *  only inspecting it: a junction resolves only to a directory. */
export function writeLink(target,destination){
 fs.symlinkSync(target,destination,process.platform==='win32' ? 'junction' : undefined);
}

/** Identity of the file a path ends at, so the file itself, a symlink to it and a hard link to it all match. */
export function fileIdentity(file){
 const status=fs.statSync(file);
 return `${status.dev}:${status.ino}`;
}

/** Where the launcher links a file as a hard link instead of a symlink: Windows, and anywhere the forced-fallback
 *  knob selects that path. */
const hardLinksFiles=()=>process.platform==='win32' || process.env.AGENT_FARM_FORCE_LINK_FALLBACK==='1';

/** True when destination is Agent Farm's link to source rather than a copy or a file it generated: a symlink
 *  where the launcher makes one, and otherwise a hard link, which shares the target's inode. */
export function isLinked(destination,source){
 let link;
 try { link=fs.lstatSync(destination); } catch { return false; }
 if (!link.isSymbolicLink() && (!hardLinksFiles() || !link.isFile())) return false;
 try { return fileIdentity(destination)===fileIdentity(source); } catch { return false; }
}

export function assertLinked(destination,source){
 assert.ok(isLinked(destination,source),`${destination} is not Agent Farm's link to ${source}`);
}

/** Installs a fake native harness the way npm does: an executable script, or on Windows a .cmd shim. */
export function writeHarness(bin,name,script){
 if(process.platform!=='win32'){fs.writeFileSync(path.join(bin,name),script.startsWith('#!')?script:`#!${process.execPath}\n${script}`,{mode:0o755});return;}
 fs.writeFileSync(path.join(bin,name+'.js'),script);
 fs.writeFileSync(path.join(bin,name+'.cmd'),`@node "%~dp0\\${name}.js" %*\r\n`);
}
