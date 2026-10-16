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
const DEFAULT_PREFERENCES = { selectedPetId: 'whale-girl', visible: true, mode: 'pet', visibilityBehavior: 'always', scale: 0.72, reducedMotion: false, position: null, followPointer: true };
const safeId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
const safeSpriteName = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,191}\.(png|webp)$/i.test(value);
const text = (value, max, label) => { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label}不能为空且不能超过 ${max} 字。`); return value.trim(); };
async function atomicWrite(target, bytes) {
  const temporary = `${target}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, bytes, { mode: 0o600 }); await fs.rename(temporary, target); }
  finally { await fs.rm(temporary, { force: true }); }
}
async function spriteForPet(pet) {
  const file = pet.spritesheet || 'spritesheet.png';
  if (!safeSpriteName(file)) throw new Error('图集路径无效。');
  return { bytes: await fs.readFile(path.join(pet.directory, file)), type: /\.webp$/i.test(file) ? 'image/webp' : 'image/png' };
}
const spriteNameFor = manifest => {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('宠物清单必须是对象。');
  return manifest.spritesheet ?? manifest.spritesheetPath ?? (('displayName' in manifest || 'spriteVersionNumber' in manifest) ? 'spritesheet.webp' : 'spritesheet.png');
};
function manifestAliases(pet) {
  return { ...pet, displayName: pet.name, spriteVersionNumber: pet.spriteVersion, spritesheetPath: pet.spritesheet || 'spritesheet.png' };
}
export class PetStore {
  constructor(dataDir = DEFAULT_DATA_DIR, assetRoot = ASSET_ROOT) { this.dataDir = path.resolve(dataDir); this.assetRoot = assetRoot; this.tail = Promise.resolve(); }
  async init() { await fs.mkdir(path.join(this.dataDir, 'pets'), { recursive: true }); return this; }
  async read() {
    try { const data = JSON.parse(await fs.readFile(path.join(this.dataDir, 'state.json'), 'utf8')); if (data.version !== 1 || !data.pets || !data.preferences) throw new Error('数据格式不支持。'); return data; }
    catch (e) { if (e.code === 'ENOENT') return { version: 1, preferences: { ...DEFAULT_PREFERENCES }, pets: {}, overrides: {} }; throw new Error(`无法读取宠物数据：${e.message}`); }
  }
  async write(state) {
    await this.init(); await atomicWrite(path.join(this.dataDir, 'state.json'), JSON.stringify(state, null, 2));
  }
  async writePet(state, pet) {
    const target = path.join(this.dataDir, 'pets', pet.id, 'pet.json');
    const previous = await fs.readFile(target);
    await atomicWrite(target, JSON.stringify(manifestAliases(pet), null, 2));
    try { await this.write(state); }
    catch (error) { await atomicWrite(target, previous); throw error; }
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
  async sprite(id) { return spriteForPet(await this.get(id)); }
  async snapshot() {
    const [state, pets] = await Promise.all([this.read(), this.list()]);
    const preferences = { ...DEFAULT_PREFERENCES, ...state.preferences };
    if (!pets.some(p => p.id === preferences.selectedPetId)) preferences.selectedPetId = pets[0]?.id ?? null;
    return { pets: pets.map(({ directory, ...p }) => ({ ...p, spritesheetUrl: `dsh-hide-pet/sprites/${encodeURIComponent(p.id)}${p.sha256 ? `?v=${encodeURIComponent(p.sha256)}` : ''}` })), preferences };
  }
  async preferences(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('偏好设置必须是对象。');
    const allowed = new Set(['visible', 'mode', 'visibilityBehavior', 'scale', 'reducedMotion', 'position', 'followPointer']);
    for (const key of Object.keys(patch)) if (!allowed.has(key)) throw new Error(`未知偏好：${key}`);
    for (const key of ['visible', 'reducedMotion', 'followPointer']) if (key in patch && typeof patch[key] !== 'boolean') throw new Error(`${key} 必须是布尔值。`);
    if ('mode' in patch && !['pet', 'mini'].includes(patch.mode)) throw new Error('显示模式必须为 pet 或 mini。');
    if ('visibilityBehavior' in patch && !['always', 'on-demand'].includes(patch.visibilityBehavior)) throw new Error('显示方式必须为 always 或 on-demand。');
    if ('scale' in patch && (!Number.isFinite(patch.scale) || patch.scale < 0.35 || patch.scale > 1.5)) throw new Error('缩放范围为 0.35–1.5。');
    if ('position' in patch && patch.position !== null && (typeof patch.position !== 'object' || !Number.isFinite(patch.position.x) || !Number.isFinite(patch.position.y) || patch.position.x < 0 || patch.position.y < 0)) throw new Error('位置需要非负的 x、y 坐标。');
    return this.transaction(async () => { const state = await this.read(); Object.assign(state.preferences, patch); await this.write(state); return (await this.snapshot()).preferences; });
  }
  async resetPreferences(scope = 'all') {
    if (!['size', 'position', 'all'].includes(scope)) throw new Error('重置范围必须为 size、position 或 all。');
    return this.transaction(async () => {
      const state = await this.read();
      if (scope === 'all') state.preferences = { ...DEFAULT_PREFERENCES };
      else if (scope === 'size') state.preferences.scale = DEFAULT_PREFERENCES.scale;
      else state.preferences.position = DEFAULT_PREFERENCES.position;
      await this.write(state); return (await this.snapshot()).preferences;
    });
  }
  async select(id) { return this.transaction(async () => { await this.get(id); const state = await this.read(); state.preferences.selectedPetId = id; state.preferences.visible = true; state.preferences.mode = 'pet'; await this.write(state); return this.snapshot(); }); }
  async update(id, patch) {
    const pet = await this.get(id); const changes = {};
    if ('name' in patch) changes.name = text(patch.name, 64, '名称');
    if ('description' in patch) { if (typeof patch.description !== 'string' || patch.description.length > 500) throw new Error('描述不能超过 500 字。'); changes.description = patch.description; }
    return this.transaction(async () => {
      const state = await this.read();
      if (pet.builtin) { state.overrides ??= {}; state.overrides[id] = { ...state.overrides[id], ...changes }; await this.write(state); }
      else { if (!state.pets[id]) throw new Error('宠物已被删除。'); Object.assign(state.pets[id], changes); await this.writePet(state, state.pets[id]); }
      return this.get(id);
    });
  }
  async delete(id) { const pet = await this.get(id); if (pet.builtin) throw new Error('内置宠物不能删除，可在设置中隐藏。'); return this.transaction(async () => { const state = await this.read(); delete state.pets[id]; delete state.overrides?.[id]; if (state.preferences.selectedPetId === id) state.preferences.selectedPetId = (await this.builtins())[0]?.id ?? null; await this.write(state); await fs.rm(path.join(this.dataDir, 'pets', id), { recursive: true, force: true }); return this.snapshot(); }); }
  async importBytes(manifest, bytes) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('宠物清单必须是对象。');
    const name = text(manifest?.name ?? manifest?.displayName ?? '新伙伴', 64, '名称');
    const description = typeof manifest?.description === 'string' ? manifest.description.slice(0, 500) : '';
    const expected = manifest.spriteVersion ?? manifest.spriteVersionNumber ?? (('displayName' in manifest || 'spritesheetPath' in manifest) ? 1 : undefined);
    const report = await validateAtlas(bytes, expected); if (!report.ok) throw new Error(report.errors.join('\n'));
    const id = `pet-${randomUUID().slice(0, 12)}`;
    const extension = bytes[0] === 0x89 ? 'png' : 'webp';
    const pet = { id, name, description, spriteVersion: report.spriteVersion, spritesheet: `spritesheet.${extension}`, createdAt: new Date().toISOString(), sha256: report.sha256 };
    return this.transaction(async () => {
      const directory = path.join(this.dataDir, 'pets', id); await fs.mkdir(directory, { recursive: true });
      try { await fs.writeFile(path.join(directory, pet.spritesheet), bytes); await fs.writeFile(path.join(directory, 'pet.json'), JSON.stringify(manifestAliases(pet), null, 2)); const state = await this.read(); state.pets[id] = pet; await this.write(state); }
      catch (e) { await fs.rm(directory, { recursive: true, force: true }); throw e; }
      return { pet, validation: report };
    });
  }
  async replaceBytes(id, input, expectedVersion) {
    const existing = await this.get(id);
    if (existing.builtin) throw new Error('内置宠物不能替换图集，请导入为自定义宠物。');
    const bytes = Buffer.from(input);
    const report = await validateAtlas(bytes, expectedVersion);
    if (!report.ok) throw new Error(report.errors.join('\n'));
    const extension = bytes[0] === 0x89 ? 'png' : 'webp';
    const filename = `spritesheet-${report.sha256}.${extension}`;
    return this.transaction(async () => {
      const state = await this.read();
      const current = state.pets[id];
      if (!current) throw new Error('宠物已被删除。');
      const target = path.join(this.dataDir, 'pets', id, filename);
      try { await fs.writeFile(target, bytes, { flag: 'wx', mode: 0o600 }); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (!(await fs.readFile(target)).equals(bytes)) throw new Error('已有图集文件与内容摘要不一致。');
      }
      const pet = { ...current, spritesheet: filename, spriteVersion: report.spriteVersion, sha256: report.sha256, updatedAt: new Date().toISOString() };
      state.pets[id] = pet;
      await this.writePet(state, pet);
      return { pet, validation: report };
    });
  }
  async importArchive(bytes) {
    if (bytes.length > 24 * 1024 * 1024) throw new Error('压缩包超过 24 MiB。');
    let entries; let total = 0;
    try { entries = unzipSync(bytes, { filter: file => { if (file.originalSize > MAX_BYTES || (total += file.originalSize) > MAX_BYTES * 2) throw new Error('压缩包解压尺寸过大。'); return /(^|\/)(pet|avatar)\.json$/.test(file.name) || safeSpriteName(file.name.slice(file.name.lastIndexOf('/') + 1)); } }); } catch (e) { throw new Error(`无法读取宠物压缩包：${e.message}`); }
    let manifests = Object.keys(entries).filter(n => /(^|\/)pet\.json$/.test(n));
    if (!manifests.length) manifests = Object.keys(entries).filter(n => /(^|\/)avatar\.json$/.test(n));
    if (manifests.length !== 1) throw new Error('压缩包必须且只能包含一个 pet.json（或旧版 avatar.json）。');
    const manifest = JSON.parse(strFromU8(entries[manifests[0]]));
    const prefix = manifests[0].slice(0, manifests[0].lastIndexOf('/') + 1);
    const spriteName = spriteNameFor(manifest);
    if (!safeSpriteName(spriteName)) throw new Error('图集路径无效。');
    const sprite = entries[prefix + spriteName]; if (!sprite) throw new Error('压缩包缺少图集。');
    return this.importBytes(manifest, Buffer.from(sprite));
  }
  async importDirectory(directory) {
    let source;
    try { source = await fs.readFile(path.join(directory, 'pet.json'), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; source = await fs.readFile(path.join(directory, 'avatar.json'), 'utf8'); }
    const manifest = JSON.parse(source);
    const spriteName = spriteNameFor(manifest);
    if (!safeSpriteName(spriteName)) throw new Error('图集路径无效。');
    return this.importBytes(manifest, await fs.readFile(path.join(directory, spriteName)));
  }
  async export(id) { const pet = await this.get(id); const { bytes } = await spriteForPet(pet); const { directory, builtin, spritesheetUrl, ...manifest } = pet; return Buffer.from(zipSync({ 'pet.json': strToU8(JSON.stringify(manifestAliases(manifest), null, 2)), [manifest.spritesheet || 'spritesheet.png']: bytes }, { level: 6 })); }
}
