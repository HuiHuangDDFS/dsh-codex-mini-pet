import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { DesktopCompanion, isWindowsDesktopHost } from '../src/desktop-companion.mjs';
import { PetStore } from '../src/store.mjs';
import { desktopPng } from '../src/atlas.mjs';

const host = 'K:/app/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js';
test('only Windows desktop hosts launch a native companion; launch failure stays optional', () => {
  assert.equal(isWindowsDesktopHost('win32', [host]), true);
  assert.equal(isWindowsDesktopHost('linux', [host]), false);
  assert.equal(isWindowsDesktopHost('win32', ['dsh-desktop-host/lib/cli.js']), false);
  const d = new DesktopCompanion({}, { enabled: true, spawnImpl() { throw new Error('blocked'); } });
  assert.doesNotThrow(() => d.start());
  assert.deepEqual(d.status(), { supported: true, active: false, error: 'blocked', hotkey: false });
  d.dispose();
});
test('private child lifecycle, event bounds, commands and replies remain controlled', async () => {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill() {} });
  let launch;
  const d = new DesktopCompanion({ snapshot: async () => ({pets:[],preferences:{}}) }, { enabled:true, spawnImpl(...args) { launch=args;return child; } });
  let written='';child.stdin.on('data',c=>{written+=c});
  d.start();
  assert.equal(launch[2].windowsHide,true);
  assert.equal(launch[2].stdio[0],'pipe');
  child.stdout.write('{"type":"ready","hwnd":42}\n');
  assert.equal(d.active,true);
  child.stdout.write('{"type":"send-chat","text":"hello"}\n');
  d.onNative({type:'execute',file:'untrusted'});
  d.onNative({type:'send-chat',text:''});
  for(let i=0;i<40;i++)d.onNative({type:'open-settings'});
  assert.equal(d.events.length,20);
  const response=d.sync({replies:[{id:'1',kind:'send-chat',ok:false,error:'rejected'}]});
  assert.equal(response.events[0].text,'hello');
  assert.equal(d.sync().events.length,0);
  assert.throws(()=>d.command('execute'));
  d.sync({replies:[{type:'inspect',capturePath:'do-not-write',id:'2'}]});
  assert.equal(written.includes('do-not-write'),false);
  assert.equal(written.includes('inspect'),false);
  d.command('toggle-chat');
  assert.match(written,/toggle-chat/);
  assert.match(written,/rejected/);
  d.dispose();assert.equal(child.stdin.writableEnded,true);
  child.emit('exit',0);assert.equal(d.active,false);
});
test('desktop position supports monitors left of primary and remains separate from app position',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dsh-desktop-prefs-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const store=new PetStore(dir);
 await store.preferences({surface:'desktop',desktopPosition:{x:-1600,y:-100},position:{x:20,y:30}});
 assert.equal((await store.snapshot()).preferences.desktopPosition.x,-1600);
 await assert.rejects(store.preferences({surface:'invalid'}));
 await assert.rejects(store.preferences({desktopPosition:{x:Infinity,y:0}}));
 await store.resetPreferences('position');
 const prefs=(await store.snapshot()).preferences;
 assert.equal(prefs.desktopPosition,null);assert.equal(prefs.position,null);
});

test('desktop chat preserves the selected workspace and permits opening an empty native draft', () => {
  const d = new DesktopCompanion({}, { enabled: false });
  d.onNative({ type: 'send-chat', text: 'hello', workspaceId: 'chosen' });
  d.onNative({ type: 'edit-chat', text: '', workspaceId: 'other' });
  d.onNative({ type: 'send-chat', text: '   ', workspaceId: 'chosen' });
  d.onNative({ type: 'edit-chat', text: '', workspaceId: {} });
  assert.deepEqual(d.events.map(({ type, text, workspaceId }) => ({ type, text, workspaceId })), [
    { type: 'send-chat', text: 'hello', workspaceId: 'chosen' },
    { type: 'edit-chat', text: '', workspaceId: 'other' },
  ]);
  d.dispose();
});
test('desktop PNG normalization retains existing atlas pixels without changing bytes',async()=>{
 const png=await fs.readFile(new URL('../assets/pets/zhiyu/spritesheet.png',import.meta.url));
 assert.deepEqual(await desktopPng(png),png);
});

test('desktop refresh uses the HD atlas digest and does not reload it for a standard export-only update',async()=>{
  const hd=await sharp({create:{width:3072,height:4576,channels:4,background:'#00000000'}}).png().toBuffer();
  const pet={id:'hd-pet',name:'HD',spriteVersion:2,spritesheet:'spritesheet.png',sha256:'standard-one',renderSpritesheet:'spritesheet-2x.png',renderSha256:'render-one',renderScale:2};
  let reads=0;
  const store={snapshot:async()=>({pets:[pet],preferences:{selectedPetId:pet.id,scale:.72}}),sprite:async id=>{assert.equal(id,pet.id);reads++;return{bytes:hd,type:'image/png'};}};
  const d=new DesktopCompanion(store,{enabled:false}), messages=[];
  d.active=true;d.send=message=>messages.push(message);
  try{
    await d.refresh();await d.refresh();
    assert.equal(reads,1);assert.equal(d.imageKey,'hd-pet:render-one');
    assert.deepEqual(Buffer.from(messages.find(message=>message.type==='atlas').base64,'base64'),hd);
    pet.sha256='standard-two';await d.refresh();assert.equal(reads,1);
    pet.renderSha256='render-two';await d.refresh();assert.equal(reads,2);
    assert.equal(d.imageKey,'hd-pet:render-two');
    assert.equal(messages.filter(message=>message.type==='atlas').length,2);
    assert.equal(d.preferences.scale,.72,'HD source pixels must not change logical display size');
  }finally{d.dispose();}
});

test('native atlas crops preserve 1x/2x source pixels and reject incomplete or unsupported geometry without opening a window',{skip:process.platform!=='win32',timeout:30000},async()=>{
  const script=`$ErrorActionPreference='Stop'
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase,System.Xaml,System.Web.Extensions,System.Windows.Forms,System.Drawing
$refs=@('System.dll','System.Core.dll',[System.Windows.Application].Assembly.Location,[System.Windows.Media.ImageSource].Assembly.Location,[System.Windows.DependencyObject].Assembly.Location,[System.Xaml.XamlReader].Assembly.Location,[System.Web.Script.Serialization.JavaScriptSerializer].Assembly.Location,[System.Windows.Forms.Screen].Assembly.Location,[System.Drawing.Point].Assembly.Location)
Add-Type -Path $env:DSH_PET_NATIVE_TEST_SOURCE -ReferencedAssemblies $refs
foreach($case in @(@{scale=1;rows=9},@{scale=1;rows=11},@{scale=2;rows=9},@{scale=2;rows=11})){
  $scale=$case.scale; $rows=$case.rows
  $image=[System.Windows.Media.Imaging.WriteableBitmap]::new(1536*$scale,208*$rows*$scale,96,96,[System.Windows.Media.PixelFormats]::Bgra32,$null)
  $marker=[byte[]](13,24,35,255)
  $image.WritePixels([System.Windows.Int32Rect]::new((7*192+42)*$scale,(($rows-1)*208+55)*$scale,1,1),$marker,4,0)
  $frames=[DshPet.PetWindow]::CreateAtlasFrames($image)
  if($frames.Length -ne $rows*8){throw 'Frame count changed'}
  if($frames[-1].PixelWidth -ne 192*$scale -or $frames[-1].PixelHeight -ne 208*$scale){throw 'Frame pixels were downsampled or cropped incorrectly'}
  $sample=[byte[]]::new(4)
  $frames[-1].CopyPixels([System.Windows.Int32Rect]::new(42*$scale,55*$scale,1,1),$sample,4,0)
  if(($sample -join ',') -ne '13,24,35,255'){throw 'Last frame lost the original source pixel'}
}
foreach($size in @(@(1537,2288),@(3072,2288),@(4608,208),@(1536,2080))){
  $image=[System.Windows.Media.Imaging.WriteableBitmap]::new($size[0],$size[1],96,96,[System.Windows.Media.PixelFormats]::Bgra32,$null)
  $rejected=$false
  try{[DshPet.PetWindow]::CreateAtlasFrames($image)|Out-Null}catch{$rejected=$true}
  if(!$rejected){throw 'Invalid atlas geometry was accepted'}
}
Write-Output 'Native atlas crop checks passed'
`;
  const result=await new Promise((resolve,reject)=>execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-STA','-WindowStyle','Hidden','-Command',script],{windowsHide:true,env:{...process.env,DSH_PET_NATIVE_TEST_SOURCE:fileURLToPath(new URL('../native/PetWindow.cs',import.meta.url))},maxBuffer:256*1024},(error,stdout,stderr)=>error?reject(new Error(`${error.message}\n${stderr}`)):resolve(stdout)));
  assert.match(result,/Native atlas crop checks passed/);
});

test('captured drag takes priority over gaze and task state, loops, reverses and releases', () => {
  const d = new DesktopCompanion({}, {enabled:false});
  d.active=true;d.preferences={followPointer:true};d.imageVersion=2;
  d.facts={presentation:{animation:'waiting'}};d.gaze=4;
  const frames=[];d.send=value=>frames.push(value);
  d.onNative({type:'greet'});
  d.onNative({type:'drag',active:true,direction:'right'});
  assert.equal(frames.at(-1).row,1);
  d.started=Date.now()-10000;d.previousFrame=null;d.draw();
  assert.equal(frames.at(-1).row,1,'sustained drag must not fall back to idle after three cycles');
  d.onNative({type:'drag',active:true,direction:'left'});
  assert.equal(frames.at(-1).row,2);
  d.preferences.reducedMotion=true;d.previousFrame=null;d.draw();
  assert.equal(frames.at(-1).row,2);assert.equal(frames.at(-1).column,0);
  d.onNative({type:'drag',active:false,direction:'left'});
  assert.equal(frames.at(-1).row,6,'release restores the real waiting state');
  d.facts={presentation:{animation:'idle'}};d.hover=true;d.previousFrame=null;d.draw();
  assert.equal(frames.at(-1).row,0,'hover must not cause endless jumping');
  d.dispose();
});

test('working pose stays visible when the pointer is away from the pet', () => {
  const d = new DesktopCompanion({}, { enabled: false });
  d.active = true; d.preferences = { followPointer: true }; d.gaze = 4;
  const frames = []; d.send = value => frames.push(value);
  d.facts = { presentation: { animation: 'running' } }; d.draw();
  assert.equal(frames.at(-1).row, 7);
  d.facts = { presentation: { animation: 'idle' } }; d.previousFrame = null; d.draw();
  assert.equal(frames.at(-1).row, 9);
  d.dispose();
});
