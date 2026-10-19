import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { macOSExecutable } from '../src/macos-companion.mjs';

if (process.platform !== 'darwin') throw new Error('Run this integration check on macOS.');
const executable = macOSExecutable();
const child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, DSH_PET_NATIVE_TEST: '1', DSH_PET_OWNER_PID: String(process.pid), DSH_PET_NATIVE_TEST_OUTPUT:'work/macos' } });
let buffer = '', diagnostics = '', pending = [], queued = [];
const closed = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Native exit ${code}/${signal}: ${diagnostics}`))); });
// Retain a rejection handler even if startup fails before we await exit.
closed.catch(() => {});
child.stderr.on('data', chunk => { diagnostics += chunk; });
child.stdout.on('data', chunk => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
    const message = JSON.parse(line);
    const index = pending.findIndex(item => item.type === message.type);
    if (index >= 0) pending.splice(index, 1)[0].resolve(message);
    else if (['ready', 'inspection'].includes(message.type)) queued.push(message);
  }
});
function wait(type) {
  const index = queued.findIndex(item => item.type === type);
  if (index >= 0) return Promise.resolve(queued.splice(index, 1)[0]);
  return Promise.race([new Promise(resolve => pending.push({ type, resolve })), closed.then(() => { throw new Error('Native closed before ' + type); })]);
}
const timeout = setTimeout(() => { console.error('Native check timed out', diagnostics); child.kill('SIGKILL'); process.exitCode = 1; }, 30000);
const send = value => child.stdin.write(JSON.stringify(value) + '\n');
const inspect = async () => { send({ type: 'inspect' }); return wait('inspection'); };
try {
  await wait('ready');
  const preferences = { surface: 'desktop', visible: true, mode: 'pet', scale: .72, language: 'en', reducedMotion: true };
  const context = { workspaces: [{ workspaceId: 'w', title: 'Workspace' }], sessions: [{ workspaceId: 'w', sessionId: 's', title: 'Session' }], currentWorkspaceId: 'w' };
  const state = { type: 'state', preferences, context, rows: [], name: 'deepseek', messages: {} };
  send(state);
  assert.equal((await inspect()).visible, true);
  // Test complete v1/v2, 1x/2x atlases using actual AppKit decoding/cropping.
  for (const [scale, rows] of [[1,9],[1,11],[2,9],[2,11]]) {
    const atlas = await sharp({ create: { width:1536*scale, height:208*rows*scale, channels:4, background:'#5588ddff' } }).png().toBuffer();
    send({ type:'atlas', base64:atlas.toString('base64') }); send({ type:'frame', row:rows-1, column:7 });
    const result = await inspect();
    assert.equal(result.frameCount, rows*8); assert.equal(result.frameRow, rows-1); assert.equal(result.frameColumn, 7);
  }
  send({ type:'toggle-chat' });
  const before = await inspect();
  assert.equal(before.chatOpen,true); assert.equal(before.floating,true); assert.equal(before.workspaceCount,1); assert.equal(before.sessionCount,1);
  send({ ...state, preferences:{...preferences,desktopPosition:{x:before.x-40,y:before.y+30}} });
  const after = await inspect();
  assert.notEqual(after.x,before.x); assert.notEqual(after.chatX,before.chatX,'chat panel must follow pet movement');
  send({ type:'toggle-chat' }); assert.equal((await inspect()).chatOpen,false,'second click closes chat');
  send({ ...state, preferences:{...preferences,mode:'mini'} }); assert.equal((await inspect()).mini,true);
  send({ ...state, preferences:{...preferences,surface:'app'} }); assert.equal((await inspect()).visible,false);
  send(state); assert.equal((await inspect()).visible,true);
  send({ type:'atlas', base64:(await readFile('assets/pets/deepseek/spritesheet-2x.png')).toString('base64') });
  send({ type:'frame', row:0, column:0 }); send({ type:'toggle-chat' });
  send({ type:'inspect', capture:true }); await wait('inspection');
  child.stdin.end(); await closed;
  console.log('macOS native smoke passed: atlas crops, floating window, context, panel toggling/following, mini mode, fallback and EOF shutdown.');
} finally { clearTimeout(timeout); if (child.exitCode === null) child.kill(); }
