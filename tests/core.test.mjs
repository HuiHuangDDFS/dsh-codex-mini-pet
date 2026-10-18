import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { validateAtlas, MAX_BYTES, STATES, gazeFrame } from '../src/atlas.mjs';
import { ASSET_ROOT, PetStore } from '../src/store.mjs';
import { createHandler, API_PREFIX } from '../src/http.mjs';
import { apply } from '../src/index.mjs';
import { performAction } from '../src/actions.mjs';

let goodAtlas;
async function atlas(version = 2) {
  const counts = [...STATES.map(s => s.frames), ...(version === 2 ? [8, 8] : [])];
  const tiles = [];
  const tile = await sharp({ create: { width: 30, height: 60, channels: 4, background: '#65a4d9' } }).png().toBuffer();
  for (let row = 0; row < counts.length; row++) for (let col = 0; col < counts[row]; col++) tiles.push({ input: tile, top: row * 208 + 100, left: col * 192 + 80 });
  return sharp({ create: { width: 1536, height: version === 2 ? 2288 : 1872, channels: 4, background: '#00000000' } }).composite(tiles).png().toBuffer();
}
async function workspace(t) { const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-pet-test-')); t.after(() => fs.rm(directory, { recursive: true, force: true })); return directory; }
test('v1/v2 geometry, missing frames and unused cells are validated from decoded pixels', async () => {
  goodAtlas = await atlas();
  assert.equal((await validateAtlas(goodAtlas)).ok, true);
  const v1 = await validateAtlas(await atlas(1)); assert.equal(v1.ok, true); assert.equal(v1.spriteVersion, 1);
  assert.equal((await validateAtlas(goodAtlas, 1)).ok, false);
  const empty = await sharp({ create: { width: 1536, height: 2288, channels: 4, background: '#00000000' } }).png().toBuffer();
  assert.equal((await validateAtlas(empty)).ok, false);
  assert.equal((await validateAtlas(Buffer.from('not a png'))).ok, false);
  const extra = await sharp(goodAtlas).composite([{ input: await sharp({ create: { width: 20, height: 20, channels: 4, background: 'red' } }).png().toBuffer(), top: 10, left: 7 * 192 }]).png().toBuffer();
  assert.match((await validateAtlas(extra)).errors.join(), /应透明留空/);
});
test('clockwise gaze maps exact viewer cardinals and row boundary', () => {
  assert.deepEqual(gazeFrame(0, -10), { direction: 0, row: 9, column: 0 });
  assert.equal(gazeFrame(10, 0).direction, 4); assert.equal(gazeFrame(0, 10).direction, 8); assert.equal(gazeFrame(-10, 0).direction, 12);
});
test('deepseek is the first-install default while existing pet selections remain intact', async t => {
  const store = new PetStore(await workspace(t));
  const initial = await store.snapshot();
  const deepseek = initial.pets.find(pet => pet.id === 'deepseek');
  assert.equal(initial.preferences.selectedPetId, 'deepseek');
  assert.equal(initial.pets[0].id, 'deepseek');
  assert.equal(deepseek.name, 'deepseek');
  assert.equal(deepseek.builtin, true);
  const bytes = await fs.readFile(path.join(ASSET_ROOT, 'deepseek', 'spritesheet.png'));
  const report = await validateAtlas(bytes, 2);
  assert.equal(report.ok, true, report.errors.join('; '));
  assert.equal(deepseek.sha256, report.sha256);
  assert.deepEqual(deepseek.artwork.frameCounts, [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8]);
  assert.equal(deepseek.renderScale, 2);
  const hd = (await store.sprite('deepseek')).bytes;
  const hdInfo = await sharp(hd).metadata();
  assert.equal(hdInfo.width, 3072); assert.equal(hdInfo.height, 4576); assert.equal(hdInfo.hasAlpha, true);
  assert.ok(hd.length <= MAX_BYTES, 'HD PNG must fit the desktop delivery budget');
  assert.equal(createHash('sha256').update(hd).digest('hex'), deepseek.renderSha256);
  assert.deepEqual(await sharp(hd).resize(1536, 2288).raw().toBuffer(), await sharp(bytes).raw().toBuffer(), 'standard export and HD display must have identical poses and cell positions');
  for (const cell of report.cells.filter(cell => cell.required)) {
    assert.ok(cell.bounds.minX >= 12 && cell.bounds.minY >= 12 && cell.bounds.maxX <= 179 && cell.bounds.maxY <= 195, `frame ${cell.row}:${cell.col} needs transparent safety margins`);
  }

  await store.select('whale-girl');
  assert.equal((await store.snapshot()).preferences.selectedPetId, 'whale-girl');
});
test('lossless WebP is decoded and validated with the same occupied-cell contract', async () => {
  const input = goodAtlas ?? await atlas();
  const webp = await sharp(input).webp({ lossless: true }).toBuffer();
  const report = await validateAtlas(webp); assert.equal(report.ok, true, report.errors.join('; ')); assert.equal(report.spriteVersion, 2);
});
test('import/select/edit/export/reimport/delete persist without changing builtin bytes', async t => {
  const dir = await workspace(t), assets = path.join(dir, 'assets');
  await fs.mkdir(path.join(assets, 'whale-girl'), { recursive: true });
  const bytes = goodAtlas ?? await atlas();
  await fs.writeFile(path.join(assets, 'whale-girl', 'pet.json'), JSON.stringify({ id: 'whale-girl', name: '鲸鱼娘', spritesheet: 'spritesheet.png', spriteVersion: 2 }));
  await fs.writeFile(path.join(assets, 'whale-girl', 'spritesheet.png'), bytes);
  const store = new PetStore(path.join(dir, 'data'), assets);
  const { pet } = await store.importBytes({ name: '伙伴' }, bytes);
  await store.select(pet.id); await store.update(pet.id, { name: '新伙伴' });
  const imported = await store.importArchive(await store.export(pet.id)); assert.equal(imported.pet.name, '新伙伴');
  assert.deepEqual((await store.sprite(imported.pet.id)).bytes, bytes);
  await store.update('whale-girl', { name: '蓝蓝' }); assert.equal((await new PetStore(store.dataDir, assets).get('whale-girl')).name, '蓝蓝');
  assert.deepEqual((await store.sprite('whale-girl')).bytes, bytes);
  await assert.rejects(store.delete('whale-girl'), /内置/);
  await store.delete(pet.id); assert.equal((await store.snapshot()).preferences.selectedPetId, 'whale-girl');
  await assert.rejects(store.get('../state'), /ID/);
});
test('HD presentation serves the render atlas and digest while export remains a standard Codex atlas',async t=>{
  const directory=await workspace(t), assets=path.join(directory,'assets'), petDirectory=path.join(assets,'deepseek');
  await fs.mkdir(petDirectory,{recursive:true});
  const standard=goodAtlas??await atlas(), hd=await sharp(standard).resize(3072,4576).png().toBuffer();
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const manifest={id:'deepseek',name:'deepseek',spriteVersion:2,spritesheet:'spritesheet.png',sha256:hash(standard),renderSpritesheet:'spritesheet-2x.png',renderSha256:hash(hd),renderScale:2};
  await fs.writeFile(path.join(petDirectory,'pet.json'),JSON.stringify(manifest));
  await fs.writeFile(path.join(petDirectory,manifest.spritesheet),standard);
  await fs.writeFile(path.join(petDirectory,manifest.renderSpritesheet),hd);
  const store=new PetStore(path.join(directory,'data'),assets);
  assert.deepEqual((await store.sprite('deepseek')).bytes,hd);
  assert.equal((await store.sprite('deepseek')).type,'image/png');
  assert.equal((await store.snapshot()).pets[0].spritesheetUrl,`dsh-hide-pet/sprites/deepseek?v=${manifest.renderSha256}`);
  const server=http.createServer(createHandler(store));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/dsh-hide-pet/sprites/deepseek?v=${manifest.renderSha256}`);
  assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),hd);
  const exported=unzipSync(await store.export('deepseek')), saved=JSON.parse(strFromU8(exported['pet.json']));
  assert.deepEqual(Object.keys(exported).sort(),['pet.json','spritesheet.png']);
  assert.deepEqual(Buffer.from(exported['spritesheet.png']),standard);
  assert.equal(saved.sha256,manifest.sha256);assert.equal(saved.spritesheetPath,'spritesheet.png');
  for(const key of ['renderSpritesheet','renderSha256','renderScale'])assert.equal(Object.hasOwn(saved,key),false);
  const reimported=await store.importArchive(await store.export('deepseek'));
  assert.deepEqual((await store.sprite(reimported.pet.id)).bytes,standard);
  // Display metadata cannot escape the pet directory; standard exports remain available independently.
  await fs.writeFile(path.join(petDirectory,'pet.json'),JSON.stringify({...manifest,renderSpritesheet:'../outside.png'}));
  await assert.rejects(store.sprite('deepseek'),/图集路径/);
  assert.deepEqual(Buffer.from(unzipSync(await store.export('deepseek'))['spritesheet.png']),standard);
});

test('concurrent stores retain both preference patches; invalid preferences leave state untouched', async t => {
  const dir = await workspace(t), a = new PetStore(dir), b = new PetStore(dir);
  await Promise.all([a.preferences({ visible: false }), b.preferences({ scale: 1.1 })]);
  const prefs = (await a.snapshot()).preferences; assert.equal(prefs.visible, false); assert.equal(prefs.scale, 1.1);
  await assert.rejects(a.preferences({ scale: NaN })); await assert.rejects(a.preferences({ position: { x: -1, y: 0 } }));
  assert.deepEqual((await a.snapshot()).preferences, prefs);
});
test('archive traversal is never extracted and manifest path escape rejected', async t => {
  const store = new PetStore(await workspace(t));
  const archive = zipSync({ 'pet.json': strToU8(JSON.stringify({ name: 'bad', spritesheet: '../state.json' })), '../state.json': strToU8('{}') });
  await assert.rejects(store.importArchive(archive), /图集路径/);
});
test('abandoned write locks expire and a metadata patch changes only the supplied field', async t => {
  const directory = await workspace(t), store = new PetStore(directory);
  await store.init(); const lock = path.join(directory, '.write-lock'); await fs.mkdir(lock);
  const expired = new Date(Date.now() - 20000); await fs.utimes(lock, expired, expired);
  await store.preferences({ visible: false });
  assert.equal((await store.snapshot()).preferences.visible, false);
  const { pet } = await store.importBytes({ name: '测试', description: '原始描述' }, goodAtlas ?? await atlas());
  const edited = await performAction(store, { action: 'update', id: pet.id, name: '新名称' });
  assert.equal(edited.name, '新名称'); assert.equal(edited.description, '原始描述');
});
test('HTTP protects state, sprites and mutations through host admission', async t => {
  const store = new PetStore(await workspace(t));
  const server = http.createServer(createHandler(store, req => req.headers.authorization === 'operator' ? { peer: {} } : { rejection: 401 }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(url + '/dsh-hide-pet/api/state')).status, 401);
  const headers = { authorization: 'operator', 'content-type': 'application/json' };
  assert.equal((await fetch(url + '/dsh-hide-pet/api/state', { headers })).status, 200);
  const response = await fetch(url + '/dsh-hide-pet/api/action', { method: 'POST', headers, body: JSON.stringify({ action: 'preferences', patch: { visible: false } }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).visible, false);
  assert.equal((await fetch(url + '/dsh-hide-pet/api/action', { method: 'POST', headers, body: '{' })).status, 400);
});
test('host owns route/tool/command lifetime and uses prefix matching without a trailing slash', async t => {
  const effects = [], tools = new Map(), commands = [], routes = [];
  const ctx = { effect: fn => effects.push(fn()), connection: { admit: () => ({ rejection: 403 }) }, webServer: { register: route => { routes.push(route); return () => routes.pop(); } }, tools: { register: tool => { tools.set(tool.name, tool); return () => tools.delete(tool.name); } }, commands: { register: command => { commands.push(command); return () => commands.pop(); } } };
  apply(ctx, { dataDir: await workspace(t) }); assert.equal(routes[0].path, API_PREFIX); assert.equal('/dsh-hide-pet/api/state'.startsWith(`${routes[0].path}/`), true);
  assert.equal(tools.size, 10); assert.ok(tools.has('pet_replace')); assert.ok(tools.has('pet_reset_preferences'));
  assert.equal((await commands[0].handler({ rawInput: 'hide' })).kind, 'success');
  assert.equal((await tools.get('pet_list').execute({})).preferences.visible, false);
  for (const dispose of effects.reverse()) dispose(); assert.equal(tools.size, 0); assert.equal(routes.length, 0); assert.equal(commands.length, 0);
});

test('Codex default WebP and legacy avatar manifests round-trip with display aliases', async t => {
  const directory = await workspace(t), store = new PetStore(path.join(directory, 'data'));
  const bytes = await sharp(await atlas(1)).webp({ lossless: true }).toBuffer();
  const manifest = { displayName: 'Codex 旧版伙伴', description: '保留描述' };
  const archive = zipSync({ 'legacy/avatar.json': strToU8(JSON.stringify(manifest)), 'legacy/spritesheet.webp': bytes });
  const { pet } = await store.importArchive(archive);
  assert.equal(pet.name, manifest.displayName); assert.equal(pet.spriteVersion, 1);
  const { unzipSync, strFromU8 } = await import('fflate');
  const exported = unzipSync(await store.export(pet.id));
  const saved = JSON.parse(strFromU8(exported['pet.json']));
  assert.equal(saved.displayName, manifest.displayName); assert.equal(saved.spriteVersionNumber, 1); assert.equal(saved.spritesheetPath, 'spritesheet.webp');
  assert.deepEqual(Buffer.from(exported[saved.spritesheetPath]), bytes);
  const source = path.join(directory, 'local'); await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'pet.json'), JSON.stringify({ displayName: '新版', spriteVersionNumber: 2, spritesheetPath: 'atlas.png' }));
  await fs.writeFile(path.join(source, 'atlas.png'), goodAtlas ?? await atlas());
  assert.equal((await store.importDirectory(source)).pet.spriteVersion, 2);
});

test('art replacement preserves identity/preferences, invalid input preserves the previous revision', async t => {
  const store = new PetStore(await workspace(t));
  const { pet } = await store.importBytes({ name: '原名', description: '原描述' }, goodAtlas ?? await atlas());
  await store.select(pet.id); await store.preferences({ mode: 'mini', position: { x: 24, y: 31 }, scale: 1.1 });
  const before = await store.snapshot();
  await assert.rejects(store.replaceBytes(pet.id, Buffer.from('invalid')));
  assert.deepEqual(await store.snapshot(), before);
  const bytes = await atlas(1), replaced = await store.replaceBytes(pet.id, bytes);
  assert.equal(replaced.pet.id, pet.id); assert.equal(replaced.pet.name, '原名'); assert.equal(replaced.pet.description, '原描述');
  assert.equal(replaced.pet.spriteVersion, 1); assert.notEqual(replaced.pet.sha256, pet.sha256);
  assert.deepEqual((await store.snapshot()).preferences, before.preferences);
  assert.deepEqual((await store.sprite(pet.id)).bytes, bytes);
  const refreshed = (await store.snapshot()).pets.find(row => row.id === pet.id);
  assert.match(refreshed.spritesheetUrl, new RegExp(replaced.pet.sha256));
  await store.resetPreferences('size'); assert.equal((await store.snapshot()).preferences.scale, .72);
  assert.deepEqual((await store.snapshot()).preferences.position, { x: 24, y: 31 });
  await store.select(pet.id); assert.equal((await store.snapshot()).preferences.mode, 'pet');
  await assert.rejects(store.replaceBytes('whale-girl', bytes), /内置/);
  await assert.rejects(store.importBytes(null, bytes), /清单/);
});
