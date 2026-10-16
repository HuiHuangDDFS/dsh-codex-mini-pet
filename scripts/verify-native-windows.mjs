import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DesktopCompanion } from '../src/desktop-companion.mjs';
import { PetStore } from '../src/store.mjs';

if (process.platform !== 'win32') throw new Error('Run this interactive integration check on Windows.');
const run = promisify(execFile);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 20000) {
  const start = Date.now(); while (!check()) { if (Date.now() - start > timeout) throw new Error(`Timed out: ${label}`); await delay(30); }
}
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-native-check-'));
const store = new PetStore(directory);
await store.preferences({ desktopPosition: { x: 250, y: 180 }, followPointer: true, reducedMotion: false });
const d = new DesktopCompanion(store, { enabled: true, ownerPid: 0 });
const messages = [], frames = [];
const accept = d.onNative.bind(d), send = d.send.bind(d);
d.onNative = value => { messages.push(value); accept(value); };
d.send = value => { if (value.type === 'frame') frames.push({ ...value, dragging: d.dragging }); send(value); };
d.facts = { rows: [{ id: 'one', title: 'Native check one', label: '需要回应' }, { id: 'two', title: 'Native check two', label: '工作中' }] };
async function inspect(extra = {}) {
  const count = messages.length; d.send({ type: 'inspect', ...extra });
  await until(() => messages.slice(count).some(v => v.type === 'inspection'), 'native inspection');
  return messages.slice(count).find(v => v.type === 'inspection');
}
const pointerHeader = `Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class NativePointer {
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint x,uint y,uint data,UIntPtr extra);
}
"@\n[NativePointer]::SetProcessDPIAware() | Out-Null;\n`;
async function pointer(code) { await run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', pointerHeader + code], { windowsHide: true }); }
function center(bounds) { assert.ok(bounds);return [Math.round(bounds.x + bounds.width / 2), Math.round(bounds.y + bounds.height / 2)]; }
const move = ([x,y]) => `[NativePointer]::SetCursorPos(${x},${y}) | Out-Null; `;
const down = '[NativePointer]::mouse_event(2,0,0,0,[UIntPtr]::Zero); ';
const up = '[NativePointer]::mouse_event(4,0,0,0,[UIntPtr]::Zero); ';
const pause = '[Threading.Thread]::Sleep(130); ';
async function click(bounds) { await pointer(move(center(bounds)) + pause + down + pause + up); await delay(200); }
try {
  d.start(); await until(() => d.active || d.error, 'helper startup'); assert.equal(d.error, null);
  await until(() => Boolean(d.preferences), 'atlas and preferences'); await delay(300);
  await pointer(move([20,20]));
  let view = await inspect(); assert.equal(view.topmost, true); assert.equal(view.toolbarVisible, true);
  const button = (state, label) => state.buttons.find(v => v.label === label);
  for (const label of ['聊一聊', '动态 2']) { assert.equal(button(view,label)?.text,label);assert.equal(button(view,label)?.visible,true); }
  // Travel from the pet across the gap into its toolbar, then use a real OS click.
  await pointer(move(center(view.spriteBounds)) + pause + move(center(button(view,'聊一聊').bounds)) + pause);
  await click(button(view,'聊一聊').bounds);
  view = await inspect();if(!view.chatOpen)console.log('CLICK DIAGNOSTIC',JSON.stringify({view,messages}));assert.equal(view.chatOpen,true);assert.equal(view.inputFocused,true);
  for (const label of ['发送','在主会话编辑']) assert.equal(button(view,label)?.text,label);
  const captureDir = process.argv[2] && path.resolve(process.argv[2]);
  if (captureDir) { await fs.mkdir(captureDir,{recursive:true});await inspect({capturePath:path.join(captureDir,'pet-toolbar-v1.png'),captureChatPath:path.join(captureDir,'pet-chat-v1.png')}); }
  await click(button(view,'×').bounds);
  view = await inspect();assert.equal(view.chatOpen,false);
  await click(button(view,'动态 2').bounds);
  view = await inspect();assert.equal(view.activityCount,2);
  await click(button(view,'Native check one\n需要回应').bounds);
  assert.ok(d.sync().events.some(v=>v.type==='open-session' && v.sessionId==='one'));
  // Keep the native event loop processing while mouse capture moves the window.
  view = await inspect();const [x,y]=center(view.spriteBounds);let code=move([x,y])+pause+down;
  for(let n=1;n<=20;n++)code+=move([x+n*10,y])+pause;
  for(let n=19;n>=0;n--)code+=move([x+n*10,y])+pause;
  await pointer(code+up);await delay(250);
  assert.ok(messages.some(v=>v.type==='drag' && v.active && v.direction==='right'));
  assert.ok(messages.some(v=>v.type==='drag' && v.active && v.direction==='left'));
  for(const row of [1,2]) assert.ok(new Set(frames.filter(v=>v.dragging && v.row===row).map(v=>v.column)).size>=3,`animated drag row ${row}`);
  assert.equal(d.dragging,false);assert.ok((await store.snapshot()).preferences.desktopPosition);
  await pointer(move([20,20]));view=await inspect();assert.equal(view.toolbarVisible,true);
  await store.preferences({surface:'app'});await d.refresh();await delay(150);assert.equal((await inspect()).visible,false);
  await store.preferences({surface:'desktop',mode:'mini'});await d.refresh();await delay(150);view=await inspect();assert.equal(view.toolbarVisible,true);assert.equal(view.spriteBounds,null);
  console.log('PASS: actual pointer travel/click, toolbar and popup text, session action, both animated drag directions, independent topmost, app/mini switching.');
} finally {
  const child=d.child;d.dispose();if(child)await new Promise(resolve=>child.once('exit',resolve));
  assert.equal(d.active,false);
  assert.equal(path.dirname(directory),os.tmpdir());assert.ok(path.basename(directory).startsWith('dsh-native-check-'));
  await fs.rm(directory,{recursive:true,force:true});
}
