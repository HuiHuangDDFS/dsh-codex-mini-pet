import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { validateAtlas, MAX_BYTES } from './atlas.mjs';
import lockfile from 'proper-lockfile';

export const ASSET_ROOT = fileURLToPath(new URL('../assets/pets/', import.meta.url));
export const DEFAULT_DATA_DIR = path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'hide-pet');
const DEFAULT_PREFERENCES = { selectedPetId: 'whale-girl', visible: true, scale: 0.72, reducedMotion: false, position: null, followPointer: true };
const safeId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
const text = (value, max, label) => { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label}不能为空且不能超过 ${max} 字。`); return value.trim(); };
export class PetStore {
  constructor(dataDir = DEFAULT_DATA_DIR, assetRoot = ASSET_ROOT) { this.dataDir = path.resolve(dataDir); this.assetRoot = assetRoot; this.tail = Promise.resolve(); }
  async init() { await fs.mkdir(path.join(this.dataDir, 'pets'), { recursive: true }); return this; }
  async read() {
    try { const data = JSON.parse(await fs.readFile(path.join(this.dataDir, 'state.json'), 'utf8')); if (data.version !== 1 || !data.pets || !data.preferences) throw new Error('数据格式不支持。'); return data; }
    catch (e) { if (e.code === 'ENOENT') return { version: 1, preferences: { ...DEFAULT_PREFERENCES }, pets: {}, overrides: {} }; throw new Error(`无法读取宠物数据：${e.message}`); }
  }
  async write(state) {
    await this.init(); const target = path.join(this.dataDir, 'state.json'), temp = `${target}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600 }); await fs.rename(temp, target); }
    finally { await fs.rm(temp, { force: true }); }
  }
  transaction(fn) {
    const operation = this.tail.then(async () => {
      await this.init();
      const release = await lockfile.lock(this.dataDir, {
        realpath: false, lockfilePath: path.join(this.dataDir, '.write-lock'), stale: 10000, update: 2500,
        retries: { retries: 50, factor: 1, minTimeout: 200, maxTimeout: 200 },
      });
      try { return await fn(); } finally { await release(); }
    });
    this.tail = operation.catch(() => {}); return operation;
  }
  async builtins() {
    let entries; try { entries = await fs.readdir(this.assetRoot, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    const result = [];
    for (const entry of entries.filter(x => x.isDirectory())) {
      try { const manifest = JSON.parse(await fs.readFile(path.join(this.assetRoot, entry.name, 'pet.json'), 'utf8')); if (!safeId(manifest.id)) continue; result.push({ ...manifest, spriteVersion: manifest.spriteVersion ?? manifest.spriteVersionNumber ?? 2, builtin: true, directory: path.join(this.assetRoot, entry.name) }); }
      catch (e) { throw new Error(`内置宠物 ${entry.name} 的清单无法读取：${e.message}`); }
    }
    return result.sort((a, b) => a.id === 'whale-girl' ? -1 : b.id === 'whale-girl' ? 1 : a.name.localeCompare(b.name));
  }
  async list() { const state = await this.read(); return [...await this.builtins(), ...Object.values(state.pets).map(p => ({ ...p, builtin: false, directory: path.join(this.dataDir, 'pets', p.id) }))].map(p => ({ ...p, ...state.overrides?.[p.id] })); }
  async get(id) { if (!safeId(id)) throw new Error('宠物 ID 无效。'); const pet = (await this.list()).find(p => p.id === id); if (!pet) throw new Error('找不到该宠物。'); return pet; }
  async sprite(id) { const pet = await this.get(id); const file = pet.spritesheet || 'spritesheet.png'; if (path.basename(file) !== file || !/\.(png|webp)$/i.test(file)) throw new Error('图集路径无效。'); return { bytes: await fs.readFile(path.join(pet.directory, file)), type: file.endsWith('.webp') ? 'image/webp' : 'image/png' }; }
  async snapshot() {
    const [state, pets] = await Promise.all([this.read(), this.list()]);
    const preferences = { ...DEFAULT_PREFERENCES, ...state.preferences };
    if (!pets.some(p => p.id === preferences.selectedPetId)) preferences.selectedPetId = pets[0]?.id ?? null;
    return { pets: pets.map(({ directory, ...p }) => ({ ...p, spritesheetUrl: `dsh-hide-pet/sprites/${encodeURIComponent(p.id)}` })), preferences };
  }
  async preferences(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('偏好设置必须是对象。');
    const allowed = new Set(['visible', 'scale', 'reducedMotion', 'position', 'followPointer']);
    for (const key of Object.keys(patch)) if (!allowed.has(key)) throw new Error(`未知偏好：${key}`);
    for (const key of ['visible', 'reducedMotion', 'followPointer']) if (key in patch && typeof patch[key] !== 'boolean') throw new Error(`${key} 必须是布尔值。`);
    if ('scale' in patch && (!Number.isFinite(patch.scale) || patch.scale < 0.35 || patch.scale > 1.5)) throw new Error('缩放范围为 0.35–1.5。');
    if ('position' in patch && patch.position !== null && (typeof patch.position !== 'object' || !Number.isFinite(patch.position.x) || !Number.isFinite(patch.position.y) || patch.position.x < 0 || patch.position.y < 0)) throw new Error('位置需要非负的 x、y 坐标。');
    return this.transaction(async () => { const state = await this.read(); Object.assign(state.preferences, patch); await this.write(state); return (await this.snapshot()).preferences; });
  }
  async select(id) { return this.transaction(async () => { await this.get(id); const state = await this.read(); state.preferences.selectedPetId = id; state.preferences.visible = true; await this.write(state); return this.snapshot(); }); }
  async update(id, patch) {
    const pet = await this.get(id); const changes = {};
    if ('name' in patch) changes.name = text(patch.name, 64, '名称');
    if ('description' in patch) { if (typeof patch.description !== 'string' || patch.description.length > 500) throw new Error('描述不能超过 500 字。'); changes.description = patch.description; }
    return this.transaction(async () => { const state = await this.read(); if (pet.builtin) state.overrides[id] = { ...state.overrides?.[id], ...changes }; else { if (!state.pets[id]) throw new Error('宠物已被删除。'); Object.assign(state.pets[id], changes); } await this.write(state); return this.get(id); });
  }
  async delete(id) { const pet = await this.get(id); if (pet.builtin) throw new Error('内置宠物不能删除，可在设置中隐藏。'); return this.transaction(async () => { const state = await this.read(); delete state.pets[id]; delete state.overrides?.[id]; if (state.preferences.selectedPetId === id) state.preferences.selectedPetId = (await this.builtins())[0]?.id ?? null; await this.write(state); await fs.rm(path.join(this.dataDir, 'pets', id), { recursive: true, force: true }); return this.snapshot(); }); }
  async importBytes(manifest, bytes) {
    const name = text(manifest?.name ?? '新伙伴', 64, '名称');
    const description = typeof manifest?.description === 'string' ? manifest.description.slice(0, 500) : '';
    const expected = manifest.spriteVersion ?? manifest.spriteVersionNumber;
    const report = await validateAtlas(bytes, expected); if (!report.ok) throw new Error(report.errors.join('\n'));
    const id = `pet-${randomUUID().slice(0, 12)}`;
    const extension = bytes[0] === 0x89 ? 'png' : 'webp';
    const pet = { id, name, description, spriteVersion: report.spriteVersion, spritesheet: `spritesheet.${extension}`, createdAt: new Date().toISOString(), sha256: report.sha256 };
    return this.transaction(async () => {
      const directory = path.join(this.dataDir, 'pets', id); await fs.mkdir(directory, { recursive: true });
      try { await fs.writeFile(path.join(directory, pet.spritesheet), bytes); await fs.writeFile(path.join(directory, 'pet.json'), JSON.stringify(pet, null, 2)); const state = await this.read(); state.pets[id] = pet; await this.write(state); }
      catch (e) { await fs.rm(directory, { recursive: true, force: true }); throw e; }
      return { pet, validation: report };
    });
  }
  async importArchive(bytes) {
    if (bytes.length > 24 * 1024 * 1024) throw new Error('压缩包超过 24 MiB。');
    let entries; let total = 0;
    try { entries = unzipSync(bytes, { filter: file => { if (file.originalSize > MAX_BYTES || (total += file.originalSize) > MAX_BYTES * 2) throw new Error('压缩包解压尺寸过大。'); return /(^|\/)(pet\.json|spritesheet\.(png|webp))$/.test(file.name); } }); } catch (e) { throw new Error(`无法读取宠物压缩包：${e.message}`); }
    const manifests = Object.keys(entries).filter(n => /(^|\/)pet\.json$/.test(n));
    if (manifests.length !== 1) throw new Error('压缩包必须且只能包含一个 pet.json。');
    const manifest = JSON.parse(strFromU8(entries[manifests[0]]));
    const prefix = manifests[0].slice(0, -'pet.json'.length);
    const spriteName = manifest.spritesheet ?? 'spritesheet.png';
    if (path.basename(spriteName) !== spriteName || !/^spritesheet\.(png|webp)$/.test(spriteName)) throw new Error('图集路径无效。');
    const sprite = entries[prefix + spriteName]; if (!sprite) throw new Error('压缩包缺少图集。');
    return this.importBytes(manifest, Buffer.from(sprite));
  }
  async importDirectory(directory) {
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'pet.json'), 'utf8'));
    const spriteName = manifest.spritesheet ?? 'spritesheet.png';
    if (path.basename(spriteName) !== spriteName || !/\.(png|webp)$/.test(spriteName)) throw new Error('图集路径无效。');
    return this.importBytes(manifest, await fs.readFile(path.join(directory, spriteName)));
  }
  async export(id) { const pet = await this.get(id); const { bytes } = await this.sprite(id); const { directory, builtin, spritesheetUrl, ...manifest } = pet; return Buffer.from(zipSync({ 'pet.json': strToU8(JSON.stringify(manifest, null, 2)), [manifest.spritesheet]: bytes }, { level: 6 })); }
}
