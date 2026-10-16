import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import sharp from 'sharp';
import { zipSync, strToU8 } from 'fflate';
import { validateAtlas, STATES, gazeFrame } from '../src/atlas.mjs';
import { PetStore } from '../src/store.mjs';
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
  assert.equal(tools.size, 8); assert.equal((await commands[0].handler({ rawInput: 'hide' })).kind, 'success');
  assert.equal((await tools.get('pet_list').execute({})).preferences.visible, false);
  for (const dispose of effects.reverse()) dispose(); assert.equal(tools.size, 0); assert.equal(routes.length, 0); assert.equal(commands.length, 0);
});
