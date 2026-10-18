// src/store.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";

// src/atlas.mjs
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { PNG } from "pngjs";
import { imageSize } from "image-size";
var CELL = Object.freeze({ width: 192, height: 208, columns: 8 });
var STATES = Object.freeze([
  { name: "idle", row: 0, frames: 6 },
  { name: "running-right", row: 1, frames: 8 },
  { name: "running-left", row: 2, frames: 8 },
  { name: "waving", row: 3, frames: 4 },
  { name: "jumping", row: 4, frames: 5 },
  { name: "failed", row: 5, frames: 8 },
  { name: "waiting", row: 6, frames: 6 },
  { name: "running", row: 7, frames: 6 },
  { name: "review", row: 8, frames: 6 }
]);
var MAX_BYTES = 20 * 1024 * 1024;
var webpDecoder;
async function decodeWebp(bytes) {
  webpDecoder ??= (async () => {
    const codec = await import("@jsquash/webp/decode.js");
    const wasmBinary = await readFile(new URL(import.meta.resolve("@jsquash/webp/codec/dec/webp_dec.wasm")));
    await codec.init({ wasmBinary });
    return codec.default;
  })();
  return (await webpDecoder)(bytes);
}
async function desktopPng(input) {
  const bytes = Buffer.from(input);
  if (bytes[0] === 137) return bytes;
  const report = await validateAtlas(bytes);
  if (!report.ok) throw new Error(report.errors.join("\n"));
  const image = await decodeWebp(bytes);
  return PNG.sync.write({ width: image.width, height: image.height, data: Buffer.from(image.data) });
}
function pngFacts(bytes, dimensions) {
  let offset = 8, headers = 0, ended = false, animated = false, hasAlpha = false;
  const compressed = [];
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    const kind = bytes.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + size;
    if (end > bytes.length) throw new Error("truncated PNG chunk");
    if (kind === "IHDR") {
      if (++headers !== 1 || offset !== 8 || size !== 13) throw new Error("invalid PNG header");
      if (bytes.readUInt32BE(offset + 8) !== dimensions.width || bytes.readUInt32BE(offset + 12) !== dimensions.height) throw new Error("PNG dimensions disagree");
      hasAlpha = Boolean(bytes[offset + 17] & 4);
    }
    if (!headers) throw new Error("missing PNG header");
    if (kind === "acTL" || kind === "fcTL" || kind === "fdAT") animated = true;
    if (kind === "tRNS") hasAlpha = true;
    if (kind === "IDAT") compressed.push(bytes.subarray(offset + 8, offset + 8 + size));
    offset = end;
    if (kind === "IEND") {
      ended = true;
      break;
    }
  }
  if (!ended || !compressed.length) throw new Error("incomplete PNG");
  return { hasAlpha, animated, compressed };
}
function validDimensions(width, height) {
  return width === 1536 && [1872, 2288].includes(height);
}
function webpFacts(bytes, dimensions) {
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") throw new Error("invalid WebP");
  const containerEnd = bytes.readUInt32LE(4) + 8;
  if (containerEnd > bytes.length || containerEnd < 20) throw new Error("truncated WebP");
  let offset = 12, images = 0, extended = 0, animated = false, hasAlpha = false;
  while (offset + 8 <= containerEnd) {
    const kind = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8, end = start + size;
    if (end > containerEnd) throw new Error("truncated WebP chunk");
    if (kind === "ANIM" || kind === "ANMF") animated = true;
    if (kind === "ALPH") hasAlpha = true;
    if (kind === "VP8X") {
      if (++extended !== 1 || size !== 10) throw new Error("invalid WebP extended header");
      animated ||= Boolean(bytes[start] & 2);
      hasAlpha ||= Boolean(bytes[start] & 16);
      const width = bytes.readUIntLE(start + 4, 3) + 1, height = bytes.readUIntLE(start + 7, 3) + 1;
      if (width !== dimensions.width || height !== dimensions.height) throw new Error("WebP canvas dimensions disagree");
    }
    if (kind === "VP8 " || kind === "VP8L") {
      if (++images !== 1) throw new Error("multiple WebP image payloads");
      let width, height;
      if (kind === "VP8L") {
        if (size < 5 || bytes[start] !== 47) throw new Error("invalid lossless WebP header");
        const bits = bytes.readUInt32LE(start + 1);
        width = (bits & 16383) + 1;
        height = (bits >>> 14 & 16383) + 1;
        hasAlpha ||= Boolean(bits >>> 28 & 1);
        if (bits >>> 29) throw new Error("unsupported lossless WebP version");
      } else {
        if (size < 10 || bytes.toString("hex", start + 3, start + 6) !== "9d012a") throw new Error("invalid lossy WebP header");
        width = bytes.readUInt16LE(start + 6) & 16383;
        height = bytes.readUInt16LE(start + 8) & 16383;
      }
      if (!validDimensions(width, height) || width !== dimensions.width || height !== dimensions.height) throw new Error("WebP payload dimensions disagree");
    }
    offset = end + (size & 1);
  }
  if (!animated && images !== 1) throw new Error("missing WebP image payload");
  if (offset !== containerEnd) throw new Error("invalid WebP chunk alignment");
  return { hasAlpha, animated };
}
async function validateAtlas(input, expectedVersion) {
  const errors = [];
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (!bytes.length || bytes.length > MAX_BYTES) return { ok: false, errors: ["\u56FE\u96C6\u4E3A\u7A7A\u6216\u8D85\u8FC7 20 MiB\u3002"] };
  let decoded;
  try {
    const metadata = imageSize(bytes);
    if (!["png", "webp"].includes(metadata.type)) return { ok: false, errors: ["\u4EC5\u652F\u6301 PNG \u6216 WebP \u56FE\u96C6\u3002"] };
    if (!validDimensions(metadata.width, metadata.height)) return { ok: false, errors: ["\u56FE\u96C6\u5FC5\u987B\u4E3A 1536\xD71872 (v1) \u6216 1536\xD72288 (v2)\u3002"] };
    const facts = metadata.type === "png" ? pngFacts(bytes, metadata) : webpFacts(bytes, metadata);
    if (facts.animated) errors.push("\u8BF7\u4F7F\u7528\u9759\u6001\u56FE\u96C6\uFF0C\u4E0D\u80FD\u4F7F\u7528\u52A8\u6001\u56FE\u7247\u3002");
    if (!facts.hasAlpha) errors.push("\u56FE\u96C6\u9700\u8981\u900F\u660E\u901A\u9053\u3002");
    if (errors.length) return { ok: false, errors };
    if (metadata.type === "png") {
      inflateSync(Buffer.concat(facts.compressed), { maxOutputLength: metadata.width * metadata.height * 8 + metadata.height * 8 + 1024 });
      const png = PNG.sync.read(bytes, { checkCRC: true });
      decoded = { data: png.data, info: { width: png.width, height: png.height } };
    } else {
      const webp = await decodeWebp(bytes);
      decoded = { data: webp.data, info: { width: webp.width, height: webp.height } };
    }
    if (decoded.info.width !== metadata.width || decoded.info.height !== metadata.height || decoded.data.length !== metadata.width * metadata.height * 4) throw new Error("decoded dimensions disagree");
  } catch {
    return { ok: false, errors: ["\u65E0\u6CD5\u89E3\u7801\u56FE\u7247\uFF0C\u6587\u4EF6\u53EF\u80FD\u635F\u574F\u6216\u5C3A\u5BF8\u8FC7\u5927\u3002"] };
  }
  const { data, info } = decoded;
  const version = info.height === 2288 ? 2 : 1;
  if (expectedVersion && expectedVersion !== version) errors.push("\u58F0\u660E\u7248\u672C\u4E0E\u56FE\u96C6\u5C3A\u5BF8\u4E0D\u4E00\u81F4\u3002");
  const cells = [];
  const frameCounts = [...STATES.map((s) => s.frames), ...version === 2 ? [8, 8] : []];
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++;
  if (!transparent) errors.push("\u80CC\u666F\u4E0D\u900F\u660E\u3002\u8BF7\u5148\u53BB\u9664\u80CC\u666F\u3002");
  for (let row = 0; row < frameCounts.length; row++) {
    for (let col = 0; col < 8; col++) {
      let visible = 0, minX = 192, minY = 208, maxX = -1, maxY = -1;
      for (let y = 0; y < 208; y++) for (let x = 0; x < 192; x++) {
        const alpha = data[((row * 208 + y) * 1536 + col * 192 + x) * 4 + 3];
        if (alpha > 8) {
          visible++;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      const required = col < frameCounts[row];
      if (required && visible < 64) errors.push(`\u7B2C ${row + 1} \u884C\u7B2C ${col + 1} \u5E27\u7F3A\u5931\u3002`);
      if (!required && visible > 0) errors.push(`\u7B2C ${row + 1} \u884C\u7B2C ${col + 1} \u683C\u5E94\u900F\u660E\u7559\u7A7A\u3002`);
      cells.push({ row, col, required, visible, bounds: visible ? { minX, minY, maxX, maxY } : null });
    }
  }
  return { ok: errors.length === 0, spriteVersion: version, width: 1536, height: info.height, sha256: createHash("sha256").update(bytes).digest("hex"), errors, cells, note: "\u7ED3\u6784\u6821\u9A8C\u4E0D\u8BC1\u660E\u52A8\u4F5C\u8BED\u4E49\u3001\u89C6\u7EBF\u65B9\u5411\u6216\u753B\u9762\u8FDE\u7EED\u6027\uFF1B\u8BF7\u9010\u9879\u9884\u89C8\u3002" };
}

// src/store.mjs
import lockfile from "proper-lockfile";
var ASSET_ROOT = fileURLToPath(new URL("../assets/pets/", import.meta.url));
var DEFAULT_DATA_DIR = path.join(process.env.DSH_HOME || path.join(os.homedir(), ".dsh"), "hide-pet");
var DEFAULT_PREFERENCES = { selectedPetId: "deepseek", language: "zh-CN", visible: true, mode: "pet", surface: "desktop", desktopPosition: null, visibilityBehavior: "always", scale: 0.72, reducedMotion: false, position: null, followPointer: true };
var safeId = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
var safeSpriteName = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9._-]{0,191}\.(png|webp)$/i.test(value);
var text = (value, max, label) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label}\u4E0D\u80FD\u4E3A\u7A7A\u4E14\u4E0D\u80FD\u8D85\u8FC7 ${max} \u5B57\u3002`);
  return value.trim();
};
async function atomicWrite(target, bytes) {
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, bytes, { mode: 384 });
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
async function spriteForPet(pet, render = false) {
  const file = render && pet.renderSpritesheet || pet.spritesheet || "spritesheet.png";
  if (!safeSpriteName(file)) throw new Error("\u56FE\u96C6\u8DEF\u5F84\u65E0\u6548\u3002");
  return { bytes: await fs.readFile(path.join(pet.directory, file)), type: /\.webp$/i.test(file) ? "image/webp" : "image/png" };
}
var spriteNameFor = (manifest) => {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("\u5BA0\u7269\u6E05\u5355\u5FC5\u987B\u662F\u5BF9\u8C61\u3002");
  return manifest.spritesheet ?? manifest.spritesheetPath ?? ("displayName" in manifest || "spriteVersionNumber" in manifest ? "spritesheet.webp" : "spritesheet.png");
};
function manifestAliases(pet) {
  return { ...pet, displayName: pet.name, spriteVersionNumber: pet.spriteVersion, spritesheetPath: pet.spritesheet || "spritesheet.png" };
}
var PetStore = class {
  constructor(dataDir = DEFAULT_DATA_DIR, assetRoot = ASSET_ROOT) {
    this.dataDir = path.resolve(dataDir);
    this.assetRoot = assetRoot;
    this.tail = Promise.resolve();
  }
  async init() {
    await fs.mkdir(path.join(this.dataDir, "pets"), { recursive: true });
    return this;
  }
  async read() {
    try {
      const data = JSON.parse(await fs.readFile(path.join(this.dataDir, "state.json"), "utf8"));
      if (data.version !== 1 || !data.pets || !data.preferences) throw new Error("\u6570\u636E\u683C\u5F0F\u4E0D\u652F\u6301\u3002");
      return data;
    } catch (e) {
      if (e.code === "ENOENT") return { version: 1, preferences: { ...DEFAULT_PREFERENCES }, pets: {}, overrides: {} };
      throw new Error(`\u65E0\u6CD5\u8BFB\u53D6\u5BA0\u7269\u6570\u636E\uFF1A${e.message}`);
    }
  }
  async write(state) {
    await this.init();
    await atomicWrite(path.join(this.dataDir, "state.json"), JSON.stringify(state, null, 2));
  }
  async writePet(state, pet) {
    const target = path.join(this.dataDir, "pets", pet.id, "pet.json");
    const previous = await fs.readFile(target);
    await atomicWrite(target, JSON.stringify(manifestAliases(pet), null, 2));
    try {
      await this.write(state);
    } catch (error) {
      await atomicWrite(target, previous);
      throw error;
    }
  }
  transaction(fn) {
    const operation = this.tail.then(async () => {
      await this.init();
      const release = await lockfile.lock(this.dataDir, {
        realpath: false,
        lockfilePath: path.join(this.dataDir, ".write-lock"),
        stale: 1e4,
        update: 2500,
        retries: { retries: 50, factor: 1, minTimeout: 200, maxTimeout: 200 }
      });
      try {
        return await fn();
      } finally {
        await release();
      }
    });
    this.tail = operation.catch(() => {
    });
    return operation;
  }
  async builtins() {
    let entries;
    try {
      entries = await fs.readdir(this.assetRoot, { withFileTypes: true });
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
    const result = [];
    for (const entry of entries.filter((x) => x.isDirectory())) {
      try {
        const manifest = JSON.parse(await fs.readFile(path.join(this.assetRoot, entry.name, "pet.json"), "utf8"));
        if (!safeId(manifest.id)) continue;
        result.push({ ...manifest, spriteVersion: manifest.spriteVersion ?? manifest.spriteVersionNumber ?? 2, builtin: true, directory: path.join(this.assetRoot, entry.name) });
      } catch (e) {
        throw new Error(`\u5185\u7F6E\u5BA0\u7269 ${entry.name} \u7684\u6E05\u5355\u65E0\u6CD5\u8BFB\u53D6\uFF1A${e.message}`);
      }
    }
    const builtinOrder = ["deepseek", "whale-girl"];
    return result.sort((a, b) => {
      const aIndex = builtinOrder.indexOf(a.id), bIndex = builtinOrder.indexOf(b.id);
      if (aIndex !== bIndex) return (aIndex < 0 ? Infinity : aIndex) - (bIndex < 0 ? Infinity : bIndex);
      return a.name.localeCompare(b.name);
    });
  }
  async list() {
    const state = await this.read();
    return [...await this.builtins(), ...Object.values(state.pets).map((p) => ({ ...p, builtin: false, directory: path.join(this.dataDir, "pets", p.id) }))].map((p) => ({ ...p, ...state.overrides?.[p.id] }));
  }
  async get(id) {
    if (!safeId(id)) throw new Error("\u5BA0\u7269 ID \u65E0\u6548\u3002");
    const pet = (await this.list()).find((p) => p.id === id);
    if (!pet) throw new Error("\u627E\u4E0D\u5230\u8BE5\u5BA0\u7269\u3002");
    return pet;
  }
  async sprite(id) {
    return spriteForPet(await this.get(id), true);
  }
  async snapshot() {
    const [state, pets] = await Promise.all([this.read(), this.list()]);
    const preferences = { ...DEFAULT_PREFERENCES, ...state.preferences };
    if (!pets.some((p) => p.id === preferences.selectedPetId)) preferences.selectedPetId = pets[0]?.id ?? null;
    return { pets: pets.map(({ directory, ...p }) => {
      const hash = p.renderSha256 || p.sha256;
      return { ...p, spritesheetUrl: `dsh-hide-pet/sprites/${encodeURIComponent(p.id)}${hash ? `?v=${encodeURIComponent(hash)}` : ""}` };
    }), preferences };
  }
  async preferences(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("\u504F\u597D\u8BBE\u7F6E\u5FC5\u987B\u662F\u5BF9\u8C61\u3002");
    const allowed = /* @__PURE__ */ new Set(["language", "visible", "mode", "surface", "desktopPosition", "visibilityBehavior", "scale", "reducedMotion", "position", "followPointer"]);
    for (const key of Object.keys(patch)) if (!allowed.has(key)) throw new Error(`\u672A\u77E5\u504F\u597D\uFF1A${key}`);
    if ("language" in patch && !["zh-CN", "en"].includes(patch.language)) throw new Error("\u8BED\u8A00\u5FC5\u987B\u4E3A zh-CN \u6216 en\u3002");
    for (const key of ["visible", "reducedMotion", "followPointer"]) if (key in patch && typeof patch[key] !== "boolean") throw new Error(`${key} \u5FC5\u987B\u662F\u5E03\u5C14\u503C\u3002`);
    if ("mode" in patch && !["pet", "mini"].includes(patch.mode)) throw new Error("\u663E\u793A\u6A21\u5F0F\u5FC5\u987B\u4E3A pet \u6216 mini\u3002");
    if ("surface" in patch && !["desktop", "app"].includes(patch.surface)) throw new Error("\u663E\u793A\u4F4D\u7F6E\u5FC5\u987B\u4E3A desktop \u6216 app\u3002");
    if ("desktopPosition" in patch && patch.desktopPosition !== null && (typeof patch.desktopPosition !== "object" || !Number.isFinite(patch.desktopPosition.x) || !Number.isFinite(patch.desktopPosition.y) || Math.abs(patch.desktopPosition.x) > 1e5 || Math.abs(patch.desktopPosition.y) > 1e5)) throw new Error("\u684C\u9762\u4F4D\u7F6E\u65E0\u6548\u3002");
    if ("visibilityBehavior" in patch && !["always", "on-demand"].includes(patch.visibilityBehavior)) throw new Error("\u663E\u793A\u65B9\u5F0F\u5FC5\u987B\u4E3A always \u6216 on-demand\u3002");
    if ("scale" in patch && (!Number.isFinite(patch.scale) || patch.scale < 0.35 || patch.scale > 1.5)) throw new Error("\u7F29\u653E\u8303\u56F4\u4E3A 0.35\u20131.5\u3002");
    if ("position" in patch && patch.position !== null && (typeof patch.position !== "object" || !Number.isFinite(patch.position.x) || !Number.isFinite(patch.position.y) || patch.position.x < 0 || patch.position.y < 0)) throw new Error("\u4F4D\u7F6E\u9700\u8981\u975E\u8D1F\u7684 x\u3001y \u5750\u6807\u3002");
    return this.transaction(async () => {
      const state = await this.read();
      Object.assign(state.preferences, patch);
      await this.write(state);
      return (await this.snapshot()).preferences;
    });
  }
  async resetPreferences(scope = "all") {
    if (!["size", "position", "all"].includes(scope)) throw new Error("\u91CD\u7F6E\u8303\u56F4\u5FC5\u987B\u4E3A size\u3001position \u6216 all\u3002");
    return this.transaction(async () => {
      const state = await this.read();
      if (scope === "all") state.preferences = { ...DEFAULT_PREFERENCES };
      else if (scope === "size") state.preferences.scale = DEFAULT_PREFERENCES.scale;
      else {
        state.preferences.position = DEFAULT_PREFERENCES.position;
        state.preferences.desktopPosition = null;
      }
      await this.write(state);
      return (await this.snapshot()).preferences;
    });
  }
  async select(id) {
    return this.transaction(async () => {
      await this.get(id);
      const state = await this.read();
      state.preferences.selectedPetId = id;
      state.preferences.visible = true;
      state.preferences.mode = "pet";
      await this.write(state);
      return this.snapshot();
    });
  }
  async update(id, patch) {
    const pet = await this.get(id);
    const changes = {};
    if ("name" in patch) changes.name = text(patch.name, 64, "\u540D\u79F0");
    if ("description" in patch) {
      if (typeof patch.description !== "string" || patch.description.length > 500) throw new Error("\u63CF\u8FF0\u4E0D\u80FD\u8D85\u8FC7 500 \u5B57\u3002");
      changes.description = patch.description;
    }
    return this.transaction(async () => {
      const state = await this.read();
      if (pet.builtin) {
        state.overrides ??= {};
        state.overrides[id] = { ...state.overrides[id], ...changes };
        await this.write(state);
      } else {
        if (!state.pets[id]) throw new Error("\u5BA0\u7269\u5DF2\u88AB\u5220\u9664\u3002");
        Object.assign(state.pets[id], changes);
        await this.writePet(state, state.pets[id]);
      }
      return this.get(id);
    });
  }
  async delete(id) {
    const pet = await this.get(id);
    if (pet.builtin) throw new Error("\u5185\u7F6E\u5BA0\u7269\u4E0D\u80FD\u5220\u9664\uFF0C\u53EF\u5728\u8BBE\u7F6E\u4E2D\u9690\u85CF\u3002");
    return this.transaction(async () => {
      const state = await this.read();
      delete state.pets[id];
      delete state.overrides?.[id];
      if (state.preferences.selectedPetId === id) state.preferences.selectedPetId = (await this.builtins())[0]?.id ?? null;
      await this.write(state);
      await fs.rm(path.join(this.dataDir, "pets", id), { recursive: true, force: true });
      return this.snapshot();
    });
  }
  async importBytes(manifest, bytes) {
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("\u5BA0\u7269\u6E05\u5355\u5FC5\u987B\u662F\u5BF9\u8C61\u3002");
    const name2 = text(manifest?.name ?? manifest?.displayName ?? "\u65B0\u4F19\u4F34", 64, "\u540D\u79F0");
    const description = typeof manifest?.description === "string" ? manifest.description.slice(0, 500) : "";
    const expected = manifest.spriteVersion ?? manifest.spriteVersionNumber ?? ("displayName" in manifest || "spritesheetPath" in manifest ? 1 : void 0);
    const report = await validateAtlas(bytes, expected);
    if (!report.ok) throw new Error(report.errors.join("\n"));
    const id = `pet-${randomUUID().slice(0, 12)}`;
    const extension = bytes[0] === 137 ? "png" : "webp";
    const pet = { id, name: name2, description, spriteVersion: report.spriteVersion, spritesheet: `spritesheet.${extension}`, createdAt: (/* @__PURE__ */ new Date()).toISOString(), sha256: report.sha256 };
    return this.transaction(async () => {
      const directory = path.join(this.dataDir, "pets", id);
      await fs.mkdir(directory, { recursive: true });
      try {
        await fs.writeFile(path.join(directory, pet.spritesheet), bytes);
        await fs.writeFile(path.join(directory, "pet.json"), JSON.stringify(manifestAliases(pet), null, 2));
        const state = await this.read();
        state.pets[id] = pet;
        await this.write(state);
      } catch (e) {
        await fs.rm(directory, { recursive: true, force: true });
        throw e;
      }
      return { pet, validation: report };
    });
  }
  async replaceBytes(id, input, expectedVersion) {
    const existing = await this.get(id);
    if (existing.builtin) throw new Error("\u5185\u7F6E\u5BA0\u7269\u4E0D\u80FD\u66FF\u6362\u56FE\u96C6\uFF0C\u8BF7\u5BFC\u5165\u4E3A\u81EA\u5B9A\u4E49\u5BA0\u7269\u3002");
    const bytes = Buffer.from(input);
    const report = await validateAtlas(bytes, expectedVersion);
    if (!report.ok) throw new Error(report.errors.join("\n"));
    const extension = bytes[0] === 137 ? "png" : "webp";
    const filename = `spritesheet-${report.sha256}.${extension}`;
    return this.transaction(async () => {
      const state = await this.read();
      const current = state.pets[id];
      if (!current) throw new Error("\u5BA0\u7269\u5DF2\u88AB\u5220\u9664\u3002");
      const target = path.join(this.dataDir, "pets", id, filename);
      try {
        await fs.writeFile(target, bytes, { flag: "wx", mode: 384 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (!(await fs.readFile(target)).equals(bytes)) throw new Error("\u5DF2\u6709\u56FE\u96C6\u6587\u4EF6\u4E0E\u5185\u5BB9\u6458\u8981\u4E0D\u4E00\u81F4\u3002");
      }
      const pet = { ...current, spritesheet: filename, spriteVersion: report.spriteVersion, sha256: report.sha256, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      state.pets[id] = pet;
      await this.writePet(state, pet);
      return { pet, validation: report };
    });
  }
  async importArchive(bytes) {
    if (bytes.length > 24 * 1024 * 1024) throw new Error("\u538B\u7F29\u5305\u8D85\u8FC7 24 MiB\u3002");
    let entries;
    let total = 0;
    try {
      entries = unzipSync(bytes, { filter: (file) => {
        if (file.originalSize > MAX_BYTES || (total += file.originalSize) > MAX_BYTES * 2) throw new Error("\u538B\u7F29\u5305\u89E3\u538B\u5C3A\u5BF8\u8FC7\u5927\u3002");
        return /(^|\/)(pet|avatar)\.json$/.test(file.name) || safeSpriteName(file.name.slice(file.name.lastIndexOf("/") + 1));
      } });
    } catch (e) {
      throw new Error(`\u65E0\u6CD5\u8BFB\u53D6\u5BA0\u7269\u538B\u7F29\u5305\uFF1A${e.message}`);
    }
    let manifests = Object.keys(entries).filter((n) => /(^|\/)pet\.json$/.test(n));
    if (!manifests.length) manifests = Object.keys(entries).filter((n) => /(^|\/)avatar\.json$/.test(n));
    if (manifests.length !== 1) throw new Error("\u538B\u7F29\u5305\u5FC5\u987B\u4E14\u53EA\u80FD\u5305\u542B\u4E00\u4E2A pet.json\uFF08\u6216\u65E7\u7248 avatar.json\uFF09\u3002");
    const manifest = JSON.parse(strFromU8(entries[manifests[0]]));
    const prefix = manifests[0].slice(0, manifests[0].lastIndexOf("/") + 1);
    const spriteName = spriteNameFor(manifest);
    if (!safeSpriteName(spriteName)) throw new Error("\u56FE\u96C6\u8DEF\u5F84\u65E0\u6548\u3002");
    const sprite = entries[prefix + spriteName];
    if (!sprite) throw new Error("\u538B\u7F29\u5305\u7F3A\u5C11\u56FE\u96C6\u3002");
    return this.importBytes(manifest, Buffer.from(sprite));
  }
  async importDirectory(directory) {
    let source;
    try {
      source = await fs.readFile(path.join(directory, "pet.json"), "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      source = await fs.readFile(path.join(directory, "avatar.json"), "utf8");
    }
    const manifest = JSON.parse(source);
    const spriteName = spriteNameFor(manifest);
    if (!safeSpriteName(spriteName)) throw new Error("\u56FE\u96C6\u8DEF\u5F84\u65E0\u6548\u3002");
    return this.importBytes(manifest, await fs.readFile(path.join(directory, spriteName)));
  }
  async export(id) {
    const pet = await this.get(id);
    const { bytes } = await spriteForPet(pet);
    const { directory, builtin, spritesheetUrl, renderSpritesheet, renderSha256, renderScale, ...manifest } = pet;
    return Buffer.from(zipSync({ "pet.json": strToU8(JSON.stringify(manifestAliases(manifest), null, 2)), [manifest.spritesheet || "spritesheet.png"]: bytes }, { level: 6 }));
  }
};

// src/actions.mjs
async function performAction(store, request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("\u8BF7\u6C42\u5FC5\u987B\u662F\u5BF9\u8C61\u3002");
  switch (request.action) {
    case "select":
      return store.select(request.id);
    case "preferences":
      return store.preferences(request.patch ?? request.preferences);
    case "reset":
      return store.resetPreferences(request.scope);
    case "replace": {
      if (!request.spritesheetBase64) throw new Error("\u7F3A\u5C11\u56FE\u96C6\u3002");
      return store.replaceBytes(request.id, Buffer.from(request.spritesheetBase64, "base64"), request.spriteVersion);
    }
    case "update": {
      const patch = request.patch ?? Object.fromEntries(["name", "description"].filter((key) => Object.hasOwn(request, key)).map((key) => [key, request[key]]));
      const pet = await store.update(request.id, patch);
      const { directory, ...result } = pet;
      return result;
    }
    case "delete":
      return store.delete(request.id);
    case "import": {
      if (request.archiveBase64) return store.importArchive(Buffer.from(request.archiveBase64, "base64"));
      if (!request.spritesheetBase64) throw new Error("\u7F3A\u5C11\u56FE\u96C6\u3002");
      return store.importBytes(request.manifest ?? { name: request.name }, Buffer.from(request.spritesheetBase64, "base64"));
    }
    case "validate":
      return validateAtlas(Buffer.from(request.spritesheetBase64 ?? "", "base64"), request.spriteVersion);
    case "export":
      return { filename: `${request.id}.zip`, archiveBase64: (await store.export(request.id)).toString("base64") };
    default:
      throw new Error("\u672A\u77E5\u5BA0\u7269\u64CD\u4F5C\u3002");
  }
}

// src/http.mjs
var API_PREFIX = "/dsh-hide-pet";
var BODY_LIMIT = 34 * 1024 * 1024;
function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) throw new Error("\u9700\u8981 application/json\u3002");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new Error("\u8BF7\u6C42\u8FC7\u5927\u3002");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function createHandler(store, admit = () => ({ peer: {} }), desktop = null) {
  return async (req, res) => {
    try {
      const admission = admit(req);
      if ("rejection" in admission) return json(res, admission.rejection, { error: "\u8BF7\u901A\u8FC7 DeepSeek Harness \u7684\u6709\u6548\u8FDE\u63A5\u8BBF\u95EE\u5BA0\u7269\u3002" });
      const url = new URL(req.url, "http://localhost");
      if (!url.pathname.startsWith(API_PREFIX + "/")) return json(res, 404, { error: "\u627E\u4E0D\u5230\u5BA0\u7269\u8D44\u6E90\u3002" });
      const route = url.pathname.slice(API_PREFIX.length + 1);
      if (req.method === "GET" && route === "api/state") return json(res, 200, { ...await store.snapshot(), ...desktop ? { desktop: desktop.status() } : {} });
      if (req.method === "POST" && route === "api/desktop/sync" && desktop) return json(res, 200, desktop.sync(await readJson(req)));
      if (req.method === "POST" && route === "api/desktop/command" && desktop) return json(res, 200, desktop.command((await readJson(req)).name));
      if (req.method === "POST" && route === "api/action") return json(res, 200, await performAction(store, await readJson(req)));
      if (req.method === "GET" && /^sprites\/[a-z0-9_-]+$/.test(route)) {
        const { bytes, type } = await store.sprite(route.slice("sprites/".length));
        res.writeHead(200, { "Content-Type": type, "Content-Length": bytes.length, "Cache-Control": "private, max-age=0", "X-Content-Type-Options": "nosniff" });
        return res.end(bytes);
      }
      return json(res, 404, { error: "\u627E\u4E0D\u5230\u5BA0\u7269\u8D44\u6E90\u3002" });
    } catch (e) {
      if (!res.headersSent) json(res, 400, { error: e.message });
      else res.end();
    }
  };
}

// src/index.mjs
import { promises as fs2 } from "node:fs";

// src/desktop-companion.mjs
import { spawn } from "node:child_process";
import path2 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/client-model.mjs
var ANIMATIONS = Object.freeze([
  { id: "idle", label: "\u5F85\u673A", count: 6, fps: 6 },
  { id: "running-right", label: "\u5411\u53F3\u8DD1", count: 8, fps: 10 },
  { id: "running-left", label: "\u5411\u5DE6\u8DD1", count: 8, fps: 10 },
  { id: "waving", label: "\u6253\u62DB\u547C", count: 4, fps: 5 },
  { id: "jumping", label: "\u8DF3\u8DC3", count: 5, fps: 7 },
  { id: "failed", label: "\u9047\u5230\u95EE\u9898", count: 8, fps: 6 },
  { id: "waiting", label: "\u7B49\u5F85", count: 6, fps: 6 },
  { id: "running", label: "\u5DE5\u4F5C\u4E2D", count: 6, fps: 7 },
  { id: "review", label: "\u68C0\u67E5", count: 6, fps: 6 }
]);
var CELL2 = Object.freeze({ width: 192, height: 208, columns: 8 });
var FRAME_TIMES = Object.freeze({
  idle: [1680, 660, 660, 840, 840, 1920],
  "running-right": [120, 120, 120, 120, 120, 120, 120, 220],
  "running-left": [120, 120, 120, 120, 120, 120, 120, 220],
  waving: [140, 140, 140, 280],
  jumping: [140, 140, 140, 140, 280],
  failed: [140, 140, 140, 140, 140, 140, 140, 240],
  waiting: [150, 150, 150, 150, 150, 260],
  running: [120, 120, 120, 120, 120, 220],
  review: [150, 150, 150, 150, 150, 280]
});
function frameFor(animation, elapsedMs, { reducedMotion = false, gaze = null, version = 2, loop = false } = {}) {
  if (!reducedMotion && ["idle", "running", "waving"].includes(animation) && version === 2 && Number.isInteger(gaze) && gaze >= 0 && gaze < 16) {
    return { row: 9 + Math.floor(gaze / 8), column: gaze % 8, rows: 11 };
  }
  let row = Math.max(0, ANIMATIONS.findIndex((item) => item.id === animation));
  if (reducedMotion) return { row, column: 0, rows: version === 1 ? 9 : 11 };
  let times = FRAME_TIMES[ANIMATIONS[row].id];
  let duration = times.reduce((a, b) => a + b, 0);
  let time = Math.max(0, elapsedMs);
  if (!loop && row !== 0 && time >= duration * 3) {
    time -= duration * 3;
    row = 0;
    times = FRAME_TIMES.idle;
    duration = times.reduce((a, b) => a + b, 0);
  }
  time %= duration;
  let column = 0;
  while (column < times.length - 1 && time >= times[column]) time -= times[column++];
  return { row, column: reducedMotion ? 0 : column, rows: version === 1 ? 9 : 11 };
}
var ACTIVITY_STATES = Object.freeze({
  "needs-input": { priority: 0, animation: "waiting", label: "\u9700\u8981\u4F60\u7684\u56DE\u5E94" },
  blocked: { priority: 1, animation: "failed", label: "\u9047\u5230\u4E86\u4E00\u70B9\u95EE\u9898" },
  ready: { priority: 2, animation: "review", label: "\u5DF2\u5B8C\u6210\uFF0C\u5F85\u67E5\u770B" },
  running: { priority: 3, animation: "running", label: "\u6B63\u5728\u5DE5\u4F5C" },
  idle: { priority: 4, animation: "idle", label: "\u968F\u65F6\u51C6\u5907\u597D" }
});

// src/i18n.mjs
var LANGUAGES = Object.freeze([
  { value: "zh-CN", label: "\u7B80\u4F53\u4E2D\u6587" },
  { value: "en", label: "English" }
]);
var ENGLISH_MESSAGES = Object.freeze({
  "\u8BF7\u5148\u6253\u5F00\u804A\u5929\u7F51\u9875\u540E\u91CD\u8BD5\u3002": "Open the chat website first, then try again.",
  "\u641C\u7D22\u804A\u5929\u6807\u9898": "Search chat titles",
  "\u7BA1\u7406\u4F1A\u8BDD\uFF1A{title}": "Manage conversation: {title}",
  "\u6CA1\u6709\u5339\u914D\u7684\u804A\u5929\u6807\u9898\u3002": "No matching chat titles.",
  "\u4F1A\u8BDD\u64CD\u4F5C": "Conversation actions",
  "\u91CD\u547D\u540D": "Rename",
  "\u91CD\u547D\u540D\u804A\u5929": "Rename chat",
  "\u4F1A\u8BDD\u540D\u79F0": "Conversation name",
  "\u6B63\u5728\u4FDD\u5B58\u2026": "Saving\u2026",
  "\u4FDD\u5B58": "Save",
  "\u8BF7\u7B49\u5F85 DeepSeek \u7F51\u9875\u52A0\u8F7D\u5B8C\u6210\u3002": "Wait for the DeepSeek website to finish loading.",
  "\u8BF7\u5148\u6253\u5F00 DeepSeek \u5B98\u65B9\u804A\u5929\u9875\u9762\u3002": "Open the official DeepSeek chat website first.",
  "\u8BF7\u5148\u5B8C\u6210\u6216\u5173\u95ED\u7F51\u9875\u4E2D\u7684\u5BF9\u8BDD\u6846\u3002": "Complete or close the dialog on the website first.",
  "\u8FD9\u6761\u4F1A\u8BDD\u5C1A\u672A\u5728\u7F51\u9875\u4E2D\u52A0\u8F7D\uFF0C\u8BF7\u5148\u6253\u5F00\u5B83\u540E\u91CD\u8BD5\u3002": "This conversation is not loaded on the website. Open it first, then try again.",
  "\u7F51\u9875\u7684\u4F1A\u8BDD\u83DC\u5355\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002": "The website conversation menu is unavailable. Reload and retry.",
  "\u672A\u627E\u5230\u5B98\u7F51\u7684\u4F1A\u8BDD\u64CD\u4F5C\uFF0C\u8BF7\u5728\u7F51\u9875\u4E2D\u64CD\u4F5C\u540E\u91CD\u8BD5\u3002": "The official conversation action could not be found. Try it on the website.",
  "\u5B98\u7F51\u672A\u663E\u793A\u5220\u9664\u786E\u8BA4\uFF0C\u8BF7\u5728\u7F51\u9875\u4E2D\u786E\u8BA4\u72B6\u6001\u3002": "The website did not show a delete confirmation. Check the website.",
  "\u672A\u627E\u5230\u5B98\u7F51\u7684\u91CD\u547D\u540D\u8F93\u5165\u6846\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002": "The website rename field could not be found. Reload and retry.",
  "\u7F51\u9875\u8F93\u5165\u6846\u6682\u4E0D\u53EF\u7528\u3002": "The website input field is unavailable.",
  "\u5C1A\u672A\u786E\u8BA4\u91CD\u547D\u540D\u7ED3\u679C\uFF0C\u8BF7\u68C0\u67E5\u5B98\u7F51\u63D0\u793A\u3002": "The rename could not be confirmed. Check the website notice.",
  "\u7F51\u9875\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5\u3002": "The website action did not complete. Please retry.",
  "\u4F1A\u8BDD\u6A21\u5F0F": "Conversation mode",
  "\u804A\u5929": "Chat",
  "\u5DE5\u4F5C": "Work",
  "\u7F51\u9875\u804A\u5929\u4F1A\u8BDD": "Web chat conversations",
  "\u540C\u6B65\u7F51\u9875\u4F1A\u8BDD": "Sync web conversations",
  "\u65B0\u804A\u5929": "New chat",
  "\u5728 DeepSeek \u5F00\u59CB\u804A\u5929": "Start a chat in DeepSeek",
  "\u767B\u5F55\u5B98\u7F51\u540E\uFF0C\u4F1A\u8BDD\u663E\u793A\u5728\u8FD9\u91CC\u3002": "Your conversations appear here after signing in on the official website.",
  "\u540C\u6B65\u7F51\u9875\u4FA7\u680F\u4E2D\u7684\u804A\u5929\u4F1A\u8BDD\u3002": "Syncing conversations from the website sidebar.",
  "\u4E0E\u5DE5\u4F5C\u533A\u5206\u5F00\uFF0C\u8FDE\u63A5 DeepSeek \u5B98\u65B9\u7F51\u9875\u3002": "Separate from workspaces, connected to the official DeepSeek website.",
  "DeepSeek \u804A\u5929\u6A21\u5F0F": "DeepSeek chat mode",
  "\u5237\u65B0\u7F51\u9875": "Reload website",
  "\u5206\u4EAB\u804A\u5929": "Share chat",
  "\u6682\u65F6\u627E\u4E0D\u5230\u5B98\u7F51\u5206\u4EAB\u6309\u94AE\uFF0C\u8BF7\u786E\u8BA4\u4F1A\u8BDD\u9875\u9762\u5DF2\u52A0\u8F7D\u3002": "The official share button is unavailable. Make sure a conversation is open.",
  "\u6B63\u5728\u6253\u5F00 DeepSeek \u5B98\u65B9\u7F51\u9875\u2026": "Opening the official DeepSeek website\u2026",
  "DeepSeek \u5B98\u65B9\u7F51\u9875": "Official DeepSeek website",
  "\u8BF7\u5728\u5B98\u7F51\u4F7F\u7528\u4E0E Harness \u76F8\u540C\u7684\u8D26\u53F7\u767B\u5F55\u3002": "Sign in on the official website with the same account you use in Harness.",
  "\u6682\u65F6\u65E0\u6CD5\u6253\u5F00\u804A\u5929\u7F51\u9875": "Unable to open the chat website",
  "\u91CD\u8BD5": "Retry",
  "\u8FD4\u56DE\u5DE5\u4F5C": "Back to Work",
  "\u804A\u5929\u6A21\u5F0F\u9700\u8981 Harness \u684C\u9762\u7248\u7684\u5185\u5D4C\u6D4F\u89C8\u5668\u652F\u6301\u3002": "Chat mode requires the embedded browser in Harness for desktop.",
  "\u7F51\u9875\u5DF2\u6253\u5F00\uFF0C\u4F1A\u8BDD\u5217\u8868\u6682\u672A\u540C\u6B65\u3002\u53EF\u5728\u7F51\u9875\u4E2D\u7EE7\u7EED\u4F7F\u7528\u3002": "The website is open, but its conversation list could not sync. You can continue on the website.",
  "DeepSeek \u7F51\u9875\u6682\u65F6\u65E0\u6CD5\u52A0\u8F7D\uFF0C\u8BF7\u91CD\u8BD5\u3002": "The DeepSeek website could not load. Please retry.",
  "DeepSeek \u7F51\u9875\u52A0\u8F7D\u5931\u8D25\u3002": "The DeepSeek website failed to load.",
  "\u7F51\u9875\u8FDB\u7A0B\u5DF2\u9000\u51FA\uFF0C\u8BF7\u5173\u95ED\u540E\u91CD\u65B0\u6253\u5F00\u804A\u5929\u6A21\u5F0F\u3002": "The website process closed. Reopen chat mode to continue.",
  "\u62D6\u52A8\u79FB\u52A8": "Drag to move",
  "\u81EA\u5B9A\u4E49\u5916\u89C2": "Customize",
  "Mini \u4E0E\u865A\u62DF\u5BA0\u7269": "Mini & pets",
  "\u6309\u4E0B": "Press",
  "\u5373\u53EF\u5524\u51FA\u4F19\u4F34\u5E76\u5F00\u59CB\u804A\u5929": "to show your companion and start chatting",
  "\u9690\u85CF Mini": "Hide Mini",
  "\u663E\u793A Mini": "Show Mini",
  "\u52A8\u4F5C\u9884\u89C8": "Preview animations",
  "\u6211\u7684\u865A\u62DF\u5BA0\u7269": "My pets",
  "\u5237\u65B0\u5BA0\u7269\u5E93": "Refresh pet library",
  "\u521B\u5EFA\u865A\u62DF\u5BA0\u7269": "Create a pet",
  "\u65E0": "None",
  "\u8F7B\u91CF\u6A21\u5F0F\uFF0C\u4FDD\u7559\u804A\u5929\u4E0E\u52A8\u6001": "Compact mode with chat and activity",
  "\u7BA1\u7406\u5F53\u524D\u4F19\u4F34": "Manage current pet",
  "\u8BBE\u7F6E \u203A codex-mini-pet \u4E2D\u7BA1\u7406\u5F62\u8C61": "Manage characters in Settings \u203A codex-mini-pet",
  "\u539F\u521B\u84DD\u767D\u9CB8\u9C7C\u5A18 Q \u7248\u684C\u9762\u4F19\u4F34\uFF1A\u9CB8\u9C7C\u5E3D\u3001\u6DF1\u84DD\u77ED\u53D1\u4E0E\u767D\u8272\u5218\u6D77\uFF0C\u652F\u6301\u4E5D\u7C7B\u52A8\u4F5C\u548C\u5341\u516D\u65B9\u5411\u6CE8\u89C6\u3002": "An original blue-and-white whale companion with a whale hat, dark-blue hair and white bangs. Nine animations and sixteen gaze directions.",
  "\u7528\u6237\u9009\u5B9A\u7684\u667A\u57DF\u98CE\u683C Q \u7248\u684C\u9762\u4F19\u4F34\uFF0C\u590D\u7528\u5DF2\u6279\u51C6\u7684\u767D\u53D1\u9ED1\u8863\u5BA0\u7269\u56FE\u96C6\u3002": "A Zhiyu-style companion with white hair and a black outfit, using the approved character sprite sheet.",
  "\u57FA\u4E8E\u7528\u6237\u63D0\u4F9B\u8BBE\u5B9A\u56FE\u7684\u84DD\u53D1\u9CB8\u9C7C\u5973\u4EC6\u98CE Q \u7248\u684C\u9762\u4F19\u4F34\uFF0C\u652F\u6301\u4E5D\u7C7B\u52A8\u4F5C\u548C\u5341\u516D\u65B9\u5411\u6CE8\u89C6\u3002": "A blue-haired, whale-and-maid-inspired chibi companion based on the user-provided character sheet, with nine animations and sixteen gaze directions.",
  "\u8BED\u8A00": "Language",
  "\u9009\u62E9\u754C\u9762\u8BED\u8A00\uFF0C\u7ACB\u5373\u751F\u6548\u3002": "Choose the interface language. Changes apply immediately.",
  "\u5F62\u8C61\u6682\u672A\u52A0\u8F7D": "Character not loaded",
  "\u51C6\u5907\u5F62\u8C61\u4E2D\u2026": "Loading character\u2026",
  "\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25": "Could not read the file",
  "\u5BFC\u51FA\u6CA1\u6709\u8FD4\u56DE\u6587\u4EF6": "The export did not return a file",
  "\u8BF7\u4ECE\u66F4\u591A \u2192 \u8BBE\u7F6E\u6253\u5F00\u5BA0\u7269\u4F19\u4F34\u3002": "Open Pets from More \u2192 Settings.",
  "\u5DF2\u8F6C\u5165\u4E3B\u4F1A\u8BDD\u8349\u7A3F\uFF0C\u7531\u4F60\u53D1\u9001": "Added to the Harness draft. Send it when ready.",
  "\u6587\u4EF6\u8D85\u8FC7 24 MB\uFF0C\u8BF7\u538B\u7F29\u540E\u5BFC\u5165\u3002": "The file exceeds 24 MB. Compress it before importing.",
  "\u5DF2\u52A0\u5165\u5BA0\u7269\u5E93": "Added to your pet library",
  "\u5BFC\u5165\u7684\u81EA\u5B9A\u4E49\u4F19\u4F34": "Imported custom pet",
  "\u6587\u4EF6\u8D85\u8FC7 24 MB\uFF0C\u8BF7\u538B\u7F29\u540E\u6821\u9A8C\u3002": "The file exceeds 24 MB. Compress it before validating.",
  "\u7ED3\u6784\u6821\u9A8C\u901A\u8FC7\uFF0C\u53EF\u5BFC\u5165\u3002": "Structure validated. Ready to import.",
  "\u6821\u9A8C\u672A\u901A\u8FC7\uFF1A{details}": "Validation failed: {details}",
  "\u6587\u4EF6\u8D85\u8FC7 24 MB\u3002": "The file exceeds 24 MB.",
  "\u56FE\u96C6\u5DF2\u66FF\u6362\uFF0C\u4F19\u4F34 ID \u4E0E\u663E\u793A\u504F\u597D\u5DF2\u4FDD\u7559": "Sprite sheet replaced. Pet ID and preferences kept.",
  "\u5173\u95ED\u5B8C\u6210\u63D0\u9192": "Dismiss completion notice",
  "\u4EFB\u52A1\u5B8C\u6210\u5566": "Task complete",
  "\u67E5\u770B\u7ED3\u679C \u203A": "View result \u203A",
  "\u67E5\u770B\u7ED3\u679C  \u203A": "View result  \u203A",
  "\u5411\u6211\u6253\u62DB\u547C": "Say hello",
  "\u8DF3\u4E00\u4E0B": "Jump",
  "\u663E\u793A\u5BA0\u7269\u5F62\u8C61": "Show character",
  "\u7CBE\u7B80\u6A21\u5F0F": "Compact mode",
  "\u6536\u8D77\u4F19\u4F34": "Hide pet",
  "\u5524\u51FA\u4F19\u4F34": "Show pet",
  "\u8BBE\u7F6E \u203A \u5BA0\u7269\u4F19\u4F34 \u4E2D\u7BA1\u7406\u5F62\u8C61": "Manage characters in Settings \u203A Pets",
  "\u5BA0\u7269\u4F19\u4F34": "Pets",
  "\u9009\u62E9\u5F62\u8C61\uFF0C\u8BBE\u7F6E\u684C\u9762\u663E\u793A\u4E0E\u4E92\u52A8\u3002": "Choose a character and customize its appearance and behavior.",
  "\u5237\u65B0": "Refresh",
  "\u5BA0\u7269\u4F19\u4F34\u9009\u9879": "Pet options",
  "\u8FDE\u63A5\u4F19\u4F34\u5E93\u2026": "Loading pet library\u2026",
  "\u521D\u59CB\u4F19\u4F34": "Built-in pet",
  "\u81EA\u5B9A\u4E49\u4F19\u4F34": "Custom pet",
  "\u7ECF\u5178\u52A8\u4F5C": "Classic animations",
  "16 \u5411\u76EE\u5149": "16 gaze directions",
  "\u5185\u7F6E": "Built-in",
  "\u81EA\u5B9A\u4E49": "Custom",
  "\u4F19\u4F34\u540D\u79F0": "Pet name",
  "\u63CF\u8FF0": "Description",
  "\u5BFC\u51FA ZIP": "Export ZIP",
  "\u4F19\u4F34\u4FE1\u606F\u5DF2\u66F4\u65B0": "Pet details updated",
  "\u4FDD\u5B58\u4FE1\u606F": "Save details",
  "\u66FF\u6362\u56FE\u96C6": "Replace sprite sheet",
  "\u5DF2\u79FB\u51FA\u5BA0\u7269\u5E93": "Removed from your pet library",
  "\u786E\u8BA4\u5220\u9664\u6B64\u4F19\u4F34": "Confirm deletion",
  "\u5220\u9664": "Delete",
  "\u53D6\u6D88": "Cancel",
  "\u521B\u5EFA\u65B0\u4F19\u4F34\u2026": "Create a pet\u2026",
  "\u5347\u7EA7\u4E3A v2\u2026": "Upgrade to v2\u2026",
  "\u7CBE\u7B80\u6A21\u5F0F \xB7 \u53EA\u663E\u793A\u64CD\u4F5C\u680F": "Compact mode \xB7 toolbar only",
  "\u62D6\u52A8\u65F6\u5DE6\u53F3\u8DD1\u52A8 \xB7 \u70B9\u51FB\u6253\u62DB\u547C \xB7 \u5728\u64CD\u4F5C\u680F\u804A\u5929\u6216\u67E5\u770B\u52A8\u6001": "Drag to move \xB7 Click to say hello \xB7 Chat and check activity from the toolbar",
  "\u76EE\u5149\u65B9\u5411 \xB7 0\xB0 \u671D\u4E0A\uFF0C\u987A\u65F6\u9488": "Gaze direction \xB7 0\xB0 is up, clockwise",
  "\u5DE5\u4F5C\u3001\u7B49\u5F85\u548C\u786E\u8BA4\u72B6\u6001\u4F1A\u8DDF\u968F\u5F53\u524D\u5BF9\u8BDD\u81EA\u52A8\u5207\u6362\u3002\u9884\u89C8\u4EC5\u5728\u6B64\u9762\u677F\u64AD\u653E\u3002": "Working, waiting and review animations follow the current chat. Previews play only in this panel.",
  "\u684C\u9762\u7F6E\u9876": "Keep on desktop",
  "Harness \u5728\u540E\u53F0\u6216\u6700\u5C0F\u5316\u65F6\uFF0C\u4F19\u4F34\u4ECD\u663E\u793A\u5728\u684C\u9762\u4E0A\u3002": "Keep your pet on the desktop when Harness is in the background or minimized.",
  "\u72EC\u7ACB\u684C\u9762\u7A97\u53E3\u9002\u7528\u4E8E Windows \u684C\u9762\u7248 Harness\u3002": "The separate desktop window is available in Harness for Windows.",
  "\u684C\u9762\u7A97\u53E3\u6682\u4E0D\u53EF\u7528\uFF0C\u5DF2\u56DE\u5230\u5E94\u7528\u5185\u663E\u793A\u3002\u8BF7\u91CD\u542F Harness \u540E\u91CD\u8BD5\u3002": "The desktop window is unavailable. Your pet is shown in the app. Restart Harness to try again.",
  "\u4F19\u4F34\u5927\u5C0F": "Pet size",
  "\u663E\u793A\u4F19\u4F34": "Show pet",
  "\u6536\u8D77\u540E\u53EF\u5728\u6B64\u5904\u6216\u7528 /pet show \u5524\u56DE\u3002": "Show your pet again here or with /pet show.",
  "\u4FDD\u7559\u804A\u5929\u4E0E\u52A8\u6001\u64CD\u4F5C\uFF0C\u6682\u65F6\u6536\u8D77\u5F62\u8C61\u3002": "Keep Chat and Activity while hiding the character.",
  "\u663E\u793A\u65B9\u5F0F": "Visibility",
  "\u59CB\u7EC8\u663E\u793A": "Always visible",
  "\u6309\u9700\u663E\u793A \xB7 \u70B9\u51FB\u7A7A\u767D\u6536\u8D77": "On demand \xB7 click outside to hide",
  "\u76EE\u5149\u8DDF\u968F\u6307\u9488": "Follow pointer",
  "\u95F2\u6687\u65F6\u671D\u4F60\u7684\u9F20\u6807\u65B9\u5411\u671B\u4E00\u671B\u3002": "Look toward your pointer when idle.",
  "\u51CF\u5C11\u52A8\u6001\u6548\u679C": "Reduce motion",
  "\u7CFB\u7EDF\u5DF2\u542F\u7528\u51CF\u5C11\u52A8\u6001\u6548\u679C\u3002": "Reduce motion is enabled in your system settings.",
  "\u4FDD\u7559\u9759\u6001\u59FF\u6001\uFF0C\u51CF\u5C11\u5FAA\u73AF\u52A8\u4F5C\u3002": "Use still poses and reduce looping animations.",
  "\u91CD\u7F6E\u4F4D\u7F6E": "Reset position",
  "\u91CD\u7F6E\u5927\u5C0F": "Reset size",
  "\u504F\u597D\u4FDD\u5B58\u5728\u672C\u673A\u3002\u684C\u9762\u6A21\u5F0F\u4E0B\uFF0CCtrl+Alt+Shift+P \u53EF\u5728\u5176\u4ED6\u5E94\u7528\u4E2D\u5524\u51FA\u5FEB\u901F\u804A\u5929\uFF1B\u82E5\u70ED\u952E\u88AB\u5360\u7528\uFF0C\u53EF\u70B9\u51FB\u4F19\u4F34\u64CD\u4F5C\u680F\u3002\u5E94\u7528\u5185\u5FEB\u6377\u952E\u53EF\u5728 Harness \u8BBE\u7F6E\u4E2D\u8C03\u6574\u3002": "Preferences are saved locally. In desktop mode, Ctrl+Alt+Shift+P opens Chat from other apps. Use the toolbar if the shortcut is taken. In-app shortcuts can be changed in Harness settings.",
  "\u8BA9\u65B0\u4F19\u4F34\u52A0\u5165": "Add a new pet",
  "\u5BFC\u5165\u5BA0\u7269 ZIP \u5305\uFF0C\u6216\u900F\u660E PNG / WebP \u52A8\u4F5C\u56FE\u3002": "Import a pet ZIP, or a transparent PNG / WebP sprite sheet.",
  "v2\uFF1A1536 \xD7 2288 \xB7 9 \u7EC4\u52A8\u4F5C + 16 \u4E2A\u76EE\u5149\u65B9\u5411": "v2: 1536 \xD7 2288 \xB7 9 animations + 16 gaze directions",
  "\u9009\u62E9\u6587\u4EF6": "Choose file",
  "\u4E3A\u65B0\u4F19\u4F34\u53D6\u4E2A\u540D\u5B57": "Name your new pet",
  "\u5BFC\u5165\u4F19\u4F34": "Import pet",
  "\u5148\u68C0\u67E5\u52A8\u4F5C\u56FE": "Validate sprite sheet",
  "ZIP \u5305\u4FDD\u7559\u540D\u79F0\u4E0E\u63CF\u8FF0\uFF1B\u5355\u5F20\u56FE\u7247\u81EA\u52A8\u8BC6\u522B v1 / v2\u3002\u8BF7\u4F7F\u7528\u4F60\u6709\u6743\u4F7F\u7528\u7684\u5F62\u8C61\uFF0C\u5BFC\u5165\u524D\u4F1A\u68C0\u67E5\u6587\u4EF6\u7ED3\u6784\u3002": "ZIP imports keep names and descriptions. Images are detected as v1 or v2. Use artwork you have permission to use. File structure is checked before import.",
  "\u5FEB\u901F\u804A\u5929": "Quick chat",
  "\u804A\u4E00\u804A": "Chat",
  "\u4F19\u4F34\u5FEB\u901F\u804A\u5929": "Pet quick chat",
  "\u4EFB\u52A1\u52A8\u6001": "Task activity",
  "\u4EFB\u52A1\u52A8\u6001 {count} \u6761": "Task activity: {count}",
  "\u5DE5\u4F5C\u533A": "Workspace",
  "\u5FEB\u901F\u804A\u5929\u5DE5\u4F5C\u533A": "Quick chat workspace",
  "\u8BF7\u9009\u62E9\u5DE5\u4F5C\u533A": "Select a workspace",
  "\u6B63\u5728\u8BFB\u53D6\u5DE5\u4F5C\u533A\u2026": "Loading workspaces\u2026",
  "\u4F1A\u8BDD": "Chat",
  "\u53D1\u9001\u5230": "Send to",
  "+ \u65B0\u4F1A\u8BDD": "+ New chat",
  "\u5FEB\u901F\u804A\u5929\u5185\u5BB9": "Quick chat message",
  "\u6B64\u523B\uFF0C\u4F60\u60F3\u4E00\u8D77\u505A\u70B9\u4EC0\u4E48\uFF1F": "What would you like to work on?",
  "\u8FD9\u6761\u60F3\u6CD5\u5305\u542B\u4E0A\u4E0B\u6587\uFF0C\u8BF7\u8F6C\u5230\u4E3B\u4F1A\u8BDD\u7EE7\u7EED\u7F16\u8F91\u3002": "This message needs context. Continue editing in Harness.",
  "Enter \u53D1\u9001 \xB7 Shift+Enter \u6362\u884C": "Enter to send \xB7 Shift+Enter for a new line",
  "\u5728\u4E3B\u4F1A\u8BDD\u7F16\u8F91": "Edit in Harness",
  "\u5904\u7406\u4E2D\u2026": "Working\u2026",
  "\u53D1\u9001 \u2197": "Send \u2197",
  "\u6587\u4EF6\u3001@ \u4E0A\u4E0B\u6587\u3001\u6280\u80FD\u548C\u8BED\u97F3\u8F93\u5165\u53EF\u5728\u4E3B\u4F1A\u8BDD\u4E2D\u6DFB\u52A0\u3002\u8349\u7A3F\u8F6C\u5165\u540E\u7531\u4F60\u53D1\u9001\u3002": "Add files, @ context, skills or voice input in Harness. Review and send the transferred draft there.",
  "\u63D0\u9192\u5DF2\u6536\u8D77": "Notices hidden",
  "\u9700\u8981\u65F6\u53EF\u4EE5\u6062\u590D\u67E5\u770B\u3002": "Restore notices whenever you need them.",
  "\u6682\u65F6\u6CA1\u6709\u9700\u8981\u5173\u6CE8\u7684\u4EFB\u52A1\u3002": "No tasks need your attention right now.",
  "\u524D\u5F80\u5904\u7406": "Review in Harness",
  "\u6253\u5F00": "Open",
  "\u56DE\u590D": "Reply",
  "\u505C\u6B62": "Stop",
  "\u6536\u8D77": "Dismiss",
  "\u9759\u97F3": "Mute",
  "\u5173\u95ED\u4F19\u4F34\u64CD\u4F5C": "Close pet panel",
  "\u6709\u4E2A\u60F3\u6CD5\uFF1F\u968F\u65F6\u544A\u8BC9\u6211\u3002": "Have an idea? Tell me anytime.",
  "{count} \u9879\u8FDB\u5C55\uFF0C\u966A\u4F60\u4E00\u8D77\u7559\u610F\u3002": "Keeping an eye on {count} tasks with you.",
  "\u6062\u590D\u63D0\u9192": "Restore notices",
  "\uFF08\u5DF2\u9690\u85CF {count} \u6761\uFF09": " ({count} hidden)",
  "\u4F19\u4F34": "Library",
  "\u5916\u89C2\u4E0E\u884C\u4E3A": "Appearance & behavior",
  "\u52A8\u4F5C": "Animations",
  "\u5BFC\u5165": "Import",
  "\u5BA0\u7269\u4F19\u4F34\u8BBE\u7F6E": "Pet settings",
  "\u968F\u65F6\u51C6\u5907\u597D": "Ready when you are",
  "DeepSeek Harness \xB7 \u5BA0\u7269\u4F19\u4F34": "DeepSeek Harness \xB7 Pets",
  "\u52A8\u6001": "Activity",
  "\u5173\u95ED\u804A\u5929": "Close chat",
  "\u65B0\u4F1A\u8BDD \xB7 \u5DE5\u4F5C\u533A": "New chat \xB7 Workspace",
  "\u53D1\u9001": "Send",
  "\u5FEB\u901F\u804A\u5929\u4F1A\u8BDD": "Quick chat target",
  "\u5173\u95ED\u52A8\u6001": "Close activity",
  "\u67E5\u770B\u5B8C\u6210\u7684\u4EFB\u52A1": "View completed task",
  "\u6211\u5728\uFF0C\u968F\u65F6\u966A\u4F60\u4E00\u8D77\u3002": "I\u2019m here, ready to help.",
  "\u8BF7\u9009\u62E9": "Select\u2026",
  "\u663E\u793A / \u6536\u8D77\u5F62\u8C61": "Show / hide character",
  "\u6539\u4E3A\u5E94\u7528\u5185\u663E\u793A": "Show in Harness",
  "\u9690\u85CF\u4F19\u4F34": "Hide pet",
  "\u8BF7\u5148\u5728 Harness \u4E2D\u6DFB\u52A0\u5DE5\u4F5C\u533A": "Add a workspace in Harness first",
  "\u9009\u62E9\u65B0\u4F1A\u8BDD\u7684\u5DE5\u4F5C\u533A": "Choose a workspace for the new chat",
  "\u672A\u547D\u540D\u4F1A\u8BDD": "Untitled chat",
  "\u9009\u62E9\u672A\u5F52\u6863\u4F1A\u8BDD\uFF0C\u6216\u5F00\u59CB\u65B0\u4F1A\u8BDD": "Choose an unarchived chat, or start a new one",
  "\u8BF7\u5148\u9009\u62E9\u5DE5\u4F5C\u533A\u3002": "Select a workspace first.",
  "\u6B63\u5728\u6253\u5F00\u4E3B\u4F1A\u8BDD\u2026": "Opening Harness\u2026",
  "\u6B63\u5728\u53D1\u9001\u2026": "Sending\u2026",
  "Harness \u6682\u672A\u54CD\u5E94\uFF0C\u8BF7\u6253\u5F00\u4E3B\u7A97\u53E3\u68C0\u67E5\u3002": "Harness has not responded. Open its main window to check.",
  "\u4EFB\u52A1\u5DF2\u5B8C\u6210": "Task complete",
  "\u5DF2\u53D1\u9001\u5230 Harness": "Sent to Harness",
  "\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u5728\u4E3B\u4F1A\u8BDD\u4E2D\u91CD\u8BD5\u3002": "Sending failed. Try again in Harness.",
  "\u5B89\u5FC3\u505A\u4F60\u7684\u4E8B\uFF0C\u65B0\u8FDB\u5C55\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002": "Focus on your work. New activity will appear here.",
  "{count} \u9879\u8FDB\u5C55 \xB7 \u70B9\u51FB\u56DE\u5230\u5BF9\u5E94\u4F1A\u8BDD": "{count} tasks \xB7 Click to open a chat",
  "\u90FD\u5B89\u6392\u597D\u4E86": "All caught up",
  "\u6682\u65F6\u6CA1\u6709\u9700\u8981\u5173\u6CE8\u7684\u4EFB\u52A1": "No tasks need your attention right now",
  "\u5F85\u673A": "Idle",
  "\u5411\u53F3\u8DD1": "Run right",
  "\u5411\u5DE6\u8DD1": "Run left",
  "\u6253\u62DB\u547C": "Wave",
  "\u8DF3\u8DC3": "Jump",
  "\u9047\u5230\u95EE\u9898": "Error",
  "\u7B49\u5F85": "Waiting",
  "\u5DE5\u4F5C\u4E2D": "Working",
  "\u68C0\u67E5": "Review",
  "\u9700\u8981\u4F60\u7684\u56DE\u5E94": "Needs your response",
  "\u9047\u5230\u4E86\u4E00\u70B9\u95EE\u9898": "Something went wrong",
  "\u5DF2\u5B8C\u6210\uFF0C\u5F85\u67E5\u770B": "Complete, ready to view",
  "\u6B63\u5728\u5DE5\u4F5C": "Working",
  "\u7B49\u5F85\u4F60\u7684\u786E\u8BA4": "Waiting for your approval",
  "\u4F60\u7684\u5DE5\u4F5C\u4F19\u4F34": "Your work companion",
  "\u8BF7\u5148\u8F93\u5165\u8981\u53D1\u9001\u7684\u5185\u5BB9\u3002": "Enter a message first.",
  "\u8BF7\u9009\u62E9\u4E00\u4E2A\u4F1A\u8BDD\u3002": "Choose a chat.",
  "\u8FD9\u4E2A\u4F1A\u8BDD\u5DF2\u5F52\u6863\u6216\u4E0D\u518D\u53EF\u7528\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002": "This chat was archived or is no longer available. Choose another.",
  "\u8BF7\u5148\u9009\u62E9\u5DE5\u4F5C\u533A\uFF1B\u65B0\u4F1A\u8BDD\u5C06\u5728\u4F60\u9009\u62E9\u7684\u76EE\u5F55\u4E2D\u521B\u5EFA\u3002": "Choose a workspace first. The new chat will be created in that directory.",
  "\u5F53\u524D\u73AF\u5883\u672A\u63D0\u4F9B Harness \u4F1A\u8BDD\u64CD\u4F5C\uFF0C\u8BF7\u5728\u5DF2\u5B89\u88C5\u63D2\u4EF6\u7684\u5BBF\u4E3B\u4E2D\u4F7F\u7528\u3002": "Harness chat actions are unavailable in this environment. Use the installed plugin in Harness.",
  "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u521B\u5EFA\u539F\u751F\u4F1A\u8BDD\u3002": "This environment does not support creating Harness chats.",
  "\u5F53\u524D\u73AF\u5883\u672A\u63D0\u4F9B\u539F\u751F\u4F1A\u8BDD\u5BFC\u822A\u3002": "Harness chat navigation is unavailable in this environment.",
  "\u542B @\u3001$ \u6216\u547D\u4EE4\u7684\u5185\u5BB9\u8BF7\u4F7F\u7528\u201C\u5728\u4E3B\u4F1A\u8BDD\u7F16\u8F91\u201D\uFF0C\u901A\u8FC7\u539F\u751F\u8F93\u5165\u680F\u9009\u62E9\u4E0A\u4E0B\u6587\u540E\u53D1\u9001\u3002": "Use \u201CEdit in Harness\u201D for @ context, skills or commands, then send from its composer.",
  "\u5BBF\u4E3B\u672A\u63A5\u53D7\u8FD9\u6761\u6D88\u606F\u3002": "Harness did not accept this message.",
  "\u5BBF\u4E3B\u672A\u80FD\u505C\u6B62\u8FD9\u4E2A\u4F1A\u8BDD\u3002": "Harness could not stop this chat.",
  "\u8349\u7A3F\u5185\u5BB9\u5FC5\u987B\u662F\u6587\u5B57\u3002": "The draft must be text.",
  "\u5F53\u524D\u73AF\u5883\u672A\u63D0\u4F9B\u539F\u751F\u8F93\u5165\u680F\u3002": "The Harness composer is unavailable in this environment.",
  "\u539F\u751F\u8F93\u5165\u680F\u6B63\u5728\u5904\u7406\u5185\u5BB9\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\uFF1B\u539F\u6709\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002": "The Harness composer is busy. Try again shortly. Your draft has been kept.",
  "\u4E3B\u4F1A\u8BDD\u5C1A\u672A\u6253\u5F00\uFF0C\u8349\u7A3F\u5DF2\u4FDD\u7559\uFF0C\u8BF7\u5728 Harness \u4E2D\u67E5\u770B\u3002": "The chat has not opened yet. Your draft has been kept. Check Harness.",
  "{name}\uFF0C\u70B9\u51FB\u6253\u62DB\u547C\uFF0C\u62D6\u52A8\u79FB\u52A8\uFF0C\u65B9\u5411\u952E\u8C03\u6574\u4F4D\u7F6E\uFF0C\u53F3\u952E\u6253\u5F00\u83DC\u5355": "{name}. Click to say hello, drag to move, use arrow keys to adjust, or right-click for the menu."
});
var chineseByEnglish = new Map(Object.entries(ENGLISH_MESSAGES).map(([zh, en]) => [en, zh]));

// src/desktop-companion.mjs
function isWindowsDesktopHost(platform = process.platform, argv = process.argv) {
  return platform === "win32" && argv.some((value) => /dsh-desktop-host[\\/]lib[\\/]index\.js$/.test(value));
}
var launchCode = `Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase,System.Xaml,System.Web.Extensions,System.Windows.Forms,System.Drawing; $refs=@('System.dll','System.Core.dll',[System.Windows.Application].Assembly.Location,[System.Windows.Media.ImageSource].Assembly.Location,[System.Windows.DependencyObject].Assembly.Location,[System.Xaml.XamlReader].Assembly.Location,[System.Web.Script.Serialization.JavaScriptSerializer].Assembly.Location,[System.Windows.Forms.Screen].Assembly.Location,[System.Drawing.Point].Assembly.Location); Add-Type -Path $env:DSH_PET_NATIVE_SOURCE -ReferencedAssemblies $refs; [DshPet.NativeApp]::Run()`;
var DesktopCompanion = class {
  constructor(store, { enabled = isWindowsDesktopHost(), spawnImpl = spawn, ownerPid = process.ppid } = {}) {
    this.store = store;
    this.supported = enabled;
    this.spawnImpl = spawnImpl;
    this.ownerPid = ownerPid;
    this.active = false;
    this.error = null;
    this.events = [];
    this.facts = {};
    this.sequence = 0;
    this.started = Date.now();
    this.animation = "idle";
    this.gaze = null;
    this.closed = false;
  }
  status() {
    return { supported: this.supported, active: this.active, error: this.error, hotkey: this.hotkey || false };
  }
  start() {
    if (!this.supported || this.child || this.closed) return;
    try {
      const exe = path2.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
      this.child = this.spawnImpl(exe, ["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-WindowStyle", "Hidden", "-Command", launchCode], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, DSH_PET_NATIVE_SOURCE: fileURLToPath2(new URL("../native/PetWindow.cs", import.meta.url)), DSH_PET_OWNER_PID: String(this.ownerPid) }
      });
      this.child.stdin.on("error", () => {
      });
      let buffer = "", diagnostic = "";
      this.child.stdout.setEncoding("utf8");
      this.child.stderr.setEncoding("utf8");
      this.child.stderr.on("data", (chunk) => {
        diagnostic = (diagnostic + chunk).slice(-4e3);
      });
      this.child.stdout.on("data", (chunk) => {
        buffer += chunk;
        if (buffer.length > 256 * 1024) {
          buffer = "";
          return;
        }
        let end;
        while ((end = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, end).trim();
          buffer = buffer.slice(end + 1);
          try {
            this.onNative(JSON.parse(line));
          } catch {
          }
        }
      });
      this.child.on("error", (error) => {
        this.error = error.message;
        this.active = false;
        clearInterval(this.stateTimer);
        clearInterval(this.frameTimer);
        clearTimeout(this.startTimer);
      });
      this.child.on("exit", (code) => {
        this.active = false;
        this.child = null;
        if (!this.closed && code !== 0) this.error = diagnostic || `\u684C\u9762\u7A97\u53E3\u9000\u51FA\uFF08${code}\uFF09`;
        clearInterval(this.stateTimer);
        clearInterval(this.frameTimer);
        clearTimeout(this.startTimer);
      });
      this.startTimer = setTimeout(() => {
        if (!this.active && this.child) {
          this.error = diagnostic || "\u684C\u9762\u7A97\u53E3\u542F\u52A8\u8D85\u65F6";
          this.child.kill();
        }
      }, 2e4);
      this.startTimer.unref?.();
      this.stateTimer = setInterval(() => this.refresh().catch((error) => {
        this.error = error.message;
      }), 1e3);
      this.frameTimer = setInterval(() => this.draw(), 80);
      this.stateTimer.unref?.();
      this.frameTimer.unref?.();
    } catch (error) {
      this.error = error.message;
      this.active = false;
    }
  }
  send(value) {
    if (this.child?.stdin.writable && !this.closed) this.child.stdin.write(JSON.stringify(value) + "\n");
  }
  async refresh() {
    if (!this.active || this.refreshing) return;
    this.refreshing = true;
    try {
      const state = await this.store.snapshot();
      this.preferences = state.preferences;
      const pet = state.pets.find((item) => item.id === state.preferences.selectedPetId) || state.pets[0];
      if (!pet) return;
      const key = `${pet.id}:${pet.renderSha256 || pet.sha256 || pet.spritesheet}`;
      this.imageVersion = Number(pet.spriteVersion) === 1 ? 1 : 2;
      if (this.imageKey !== key) {
        const image = await this.store.sprite(pet.id);
        const png = await desktopPng(image.bytes);
        this.send({ type: "atlas", base64: png.toString("base64") });
        this.imageKey = key;
      }
      const value = {
        type: "state",
        preferences: { ...state.preferences, reducedMotion: Boolean(state.preferences.reducedMotion || this.facts.osReduced) },
        name: pet.name,
        label: this.facts.presentation?.label || "\u968F\u65F6\u51C6\u5907\u597D",
        rows: (this.facts.rows || []).slice(0, 30),
        context: this.facts.context || {},
        theme: this.facts.theme || {},
        completions: (this.facts.completions || []).slice(-10),
        messages: ENGLISH_MESSAGES
      };
      const serialized = JSON.stringify(value);
      if (serialized !== this.previousState) {
        this.send(value);
        this.previousState = serialized;
      }
    } finally {
      this.refreshing = false;
    }
  }
  draw() {
    if (!this.active || !this.preferences) return;
    const base = this.facts.presentation?.animation || "idle";
    const next = this.dragging ? this.dragDirection : Date.now() < (this.interactionUntil || 0) ? this.interaction : base;
    if (this.animation !== next) {
      this.animation = next;
      this.started = Date.now();
    }
    const frame = frameFor(next, Date.now() - this.started, {
      reducedMotion: Boolean(this.preferences.reducedMotion || this.facts.osReduced),
      gaze: this.dragging || base !== "idle" || this.preferences.followPointer === false || Date.now() < (this.interactionUntil || 0) ? null : this.gaze,
      version: this.imageVersion || 2,
      loop: Boolean(this.dragging)
    });
    const key = `${frame.row}:${frame.column}`;
    if (key !== this.previousFrame) {
      this.send({ type: "frame", row: frame.row, column: frame.column });
      this.previousFrame = key;
    }
  }
  onNative(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "ready") {
      clearTimeout(this.startTimer);
      this.active = true;
      this.error = null;
      this.hwnd = message.hwnd;
      this.refresh().catch((error) => {
        this.error = error.message;
      });
      return;
    }
    if (message.type === "hotkey") {
      this.hotkey = message.registered === true;
      return;
    }
    if (message.type === "gaze") {
      this.gaze = Number.isInteger(message.direction) && message.direction >= 0 && message.direction < 16 ? message.direction : null;
      return;
    }
    if (message.type === "hover") {
      this.hover = message.value === true;
      return;
    }
    if (message.type === "drag") {
      this.dragging = message.active === true;
      this.dragDirection = message.direction === "left" ? "running-left" : "running-right";
      if (this.dragging) {
        this.interactionUntil = 0;
        this.gaze = null;
      }
      this.draw();
      return;
    }
    if (message.type === "greet") {
      this.interaction = "waving";
      this.interactionUntil = Date.now() + 2100;
      return;
    }
    if (message.type === "position" && Number.isFinite(message.x) && Number.isFinite(message.y)) {
      this.store.preferences({ desktopPosition: { x: message.x, y: message.y } }).catch((error) => {
        this.error = error.message;
      });
      return;
    }
    if (message.type === "preferences") {
      const patch = message.patch || {};
      const safe = Object.fromEntries(["visible", "mode", "surface"].filter((key) => Object.hasOwn(patch, key)).map((key) => [key, patch[key]]));
      this.store.preferences(safe).then(() => this.refresh()).catch((error) => {
        this.error = error.message;
      });
      return;
    }
    if (!["open-settings", "open-session", "send-chat", "edit-chat"].includes(message.type)) return;
    if (message.sessionId != null && (typeof message.sessionId !== "string" || message.sessionId.length > 1e3)) return;
    if (["send-chat", "edit-chat"].includes(message.type) && (typeof message.text !== "string" || message.text.length > 64e3 || message.type === "send-chat" && !message.text.trim() || message.workspaceId != null && (typeof message.workspaceId !== "string" || message.workspaceId.length > 1e3))) return;
    if (this.events.length >= 20) return;
    this.events.push({ ...message, id: String(++this.sequence) });
  }
  sync(input = {}) {
    if (input.facts && typeof input.facts === "object" && JSON.stringify(input.facts).length < 128e3) this.facts = input.facts;
    for (const reply of Array.isArray(input.replies) ? input.replies.slice(0, 20) : []) this.send({ id: String(reply.id || ""), kind: String(reply.kind || ""), ok: reply.ok === true, error: String(reply.error || "").slice(0, 1e3), ...typeof reply.message === "string" ? { message: reply.message.slice(0, 1e3) } : {}, type: "reply" });
    const events = this.events.splice(0);
    this.refresh().catch((error) => {
      this.error = error.message;
    });
    return { ...this.status(), events };
  }
  command(name2) {
    if (name2 !== "toggle-chat") throw new Error("\u672A\u77E5\u684C\u9762\u4F19\u4F34\u64CD\u4F5C\u3002");
    this.send({ type: name2 });
    return { ok: true };
  }
  dispose() {
    this.closed = true;
    clearInterval(this.stateTimer);
    clearInterval(this.frameTimer);
    clearTimeout(this.startTimer);
    this.child?.stdin.end();
    const child = this.child;
    const timer = setTimeout(() => child?.kill(), 2e3);
    timer.unref?.();
  }
};

// src/index.mjs
var name = "dsh-codex-mini-pet";
var inject = ["webServer", "connection", "tools", "commands"];
var object = (properties = {}, required = []) => ({ type: "object", properties, required, additionalProperties: false });
var string = (description) => ({ type: "string", description });
function apply(ctx, config = {}) {
  const store = new PetStore(config.dataDir);
  const desktop = new DesktopCompanion(store);
  ctx.effect(() => {
    desktop.start();
    return () => desktop.dispose();
  });
  const handler = createHandler(store, (req) => ctx.connection.admit(req), desktop);
  ctx.effect(() => ctx.webServer.register({ kind: "prefix", path: API_PREFIX, handler }));
  const register = (toolName, description, parameters, execute) => ctx.effect(() => ctx.tools.register({
    name: toolName,
    description,
    parameters,
    output: { schema: {}, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] },
    execute
  }));
  register("pet_list", "\u5217\u51FA\u5DF2\u5B89\u88C5\u5BA0\u7269\u548C\u5F53\u524D\u663E\u793A\u504F\u597D\u3002", object(), () => store.snapshot());
  register("pet_select", "\u9009\u62E9\u5BA0\u7269\u5E76\u663E\u793A\u3002", object({ id: string("\u5BA0\u7269 ID") }, ["id"]), (args) => store.select(args.id));
  register("pet_update", "\u4FEE\u6539\u5BA0\u7269\u540D\u79F0\u6216\u63CF\u8FF0\uFF0C\u4E0D\u6539\u52A8\u56FE\u96C6\u3002", object({ id: string("\u5BA0\u7269 ID"), name: string("\u65B0\u540D\u79F0"), description: string("\u65B0\u63CF\u8FF0") }, ["id"]), async ({ id, ...patch }) => {
    const { directory, ...pet } = await store.update(id, patch);
    return pet;
  });
  register("pet_replace", "\u66FF\u6362\u81EA\u5B9A\u4E49\u5BA0\u7269\u56FE\u96C6\uFF0C\u4FDD\u7559\u5176 ID\u3001\u540D\u79F0\u3001\u63CF\u8FF0\u548C\u5168\u90E8\u663E\u793A\u504F\u597D\u3002", object({ id: string("\u81EA\u5B9A\u4E49\u5BA0\u7269 ID"), file: string("\u65B0\u56FE\u96C6\u7684\u7EDD\u5BF9\u8DEF\u5F84") }, ["id", "file"]), async (args) => store.replaceBytes(args.id, await fs2.readFile(args.file)));
  register("pet_delete", "\u5220\u9664\u7528\u6237\u5BFC\u5165\u7684\u5BA0\u7269\u3002\u5185\u7F6E\u5F62\u8C61\u4FDD\u7559\uFF0C\u53EF\u9690\u85CF\u3002", object({ id: string("\u81EA\u5B9A\u4E49\u5BA0\u7269 ID") }, ["id"]), (args) => store.delete(args.id));
  register("pet_validate", "\u6821\u9A8C\u672C\u673A PNG/WebP \u56FE\u96C6\u7684\u5C3A\u5BF8\u3001\u900F\u660E\u5EA6\u3001\u5FC5\u586B\u5E27\u548C\u7A7A\u683C\uFF1B\u4E0D\u8BC1\u660E\u52A8\u4F5C\u8BED\u4E49\u3002", object({ file: string("\u56FE\u96C6\u7684\u7EDD\u5BF9\u6587\u4EF6\u8DEF\u5F84") }, ["file"]), async (args) => validateAtlas(await fs2.readFile(args.file)));
  register("pet_import", "\u5BFC\u5165\u672C\u673A\u5BA0\u7269\u76EE\u5F55\uFF08pet.json \u548C PNG/WebP\uFF09\u6216 ZIP\uFF1B\u6821\u9A8C\u901A\u8FC7\u540E\u4FDD\u5B58\u3002", object({ file: string("\u76EE\u5F55\u6216 ZIP \u7EDD\u5BF9\u8DEF\u5F84") }, ["file"]), async (args) => {
    const stat = await fs2.stat(args.file);
    return stat.isDirectory() ? store.importDirectory(args.file) : store.importArchive(await fs2.readFile(args.file));
  });
  register("pet_export", "\u5BFC\u51FA\u5BA0\u7269\u4E3A ZIP \u5230\u6307\u5B9A\u7684\u5168\u65B0\u6587\u4EF6\u3002", object({ id: string("\u5BA0\u7269 ID"), file: string("ZIP \u8F93\u51FA\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u4E0D\u8986\u76D6\u5DF2\u6709\u6587\u4EF6") }, ["id", "file"]), async (args) => {
    await fs2.writeFile(args.file, await store.export(args.id), { flag: "wx" });
    return { file: args.file };
  });
  register("pet_set_preferences", "\u8BBE\u7F6E\u754C\u9762\u8BED\u8A00\uFF08zh-CN / en\uFF09\u3001\u663E\u793A\u3001\u5BA0\u7269\u6216\u7CBE\u7B80\u6A21\u5F0F\u3001\u6309\u9700\u663E\u793A\u3001\u7F29\u653E\u3001\u9F20\u6807\u8DDF\u968F\u548C\u51CF\u5C11\u52A8\u6001\u6548\u679C\u3002", object({ language: { type: "string", enum: ["zh-CN", "en"] }, surface: { type: "string", enum: ["desktop", "app"] }, visible: { type: "boolean" }, mode: { type: "string", enum: ["pet", "mini"] }, visibilityBehavior: { type: "string", enum: ["always", "on-demand"] }, scale: { type: "number" }, reducedMotion: { type: "boolean" }, followPointer: { type: "boolean" } }), (args) => store.preferences(args));
  register("pet_reset_preferences", "\u91CD\u7F6E\u5BA0\u7269\u5927\u5C0F\u3001\u4F4D\u7F6E\u6216\u5168\u90E8\u663E\u793A\u504F\u597D\u3002\u53EA\u91CD\u7F6E\u5927\u5C0F\u6216\u4F4D\u7F6E\u65F6\u4FDD\u7559\u5DF2\u9009\u5BA0\u7269\u3002", object({ scope: { type: "string", enum: ["size", "position", "all"] } }, ["scope"]), (args) => store.resetPreferences(args.scope));
  ctx.effect(() => ctx.commands.register({
    name: "pet",
    description: "\u663E\u793A\u3001\u9690\u85CF\u3001\u7CBE\u7B80\u3001\u5217\u51FA\u6216\u9009\u62E9\u52A8\u753B\u5BA0\u7269\uFF1B\u5728\u8BBE\u7F6E \u203A codex-mini-pet\u7BA1\u7406",
    input: { hint: "show | hide | mini | list | select <id> | reset [size|position|all]" },
    handler: async (invocation) => {
      try {
        const [verb = "toggle", id] = (invocation.rawInput || "").trim().split(/\s+/).filter(Boolean);
        if (verb === "select") await store.select(id);
        else if (verb === "mini") await store.preferences({ mode: "mini", visible: true });
        else if (verb === "reset") await store.resetPreferences(id || "all");
        else if (verb === "list") return { kind: "success", text: (await store.list()).map((p) => `${p.id}: ${p.name}`).join("\n") };
        else if (["show", "hide", "toggle"].includes(verb)) await store.preferences({ visible: verb === "toggle" ? !(await store.snapshot()).preferences.visible : verb === "show" });
        else throw new Error("\u7528\u6CD5\uFF1A/pet [show | hide | mini | list | select <id> | reset [size|position|all]]\uFF1B\u7BA1\u7406\u5165\u53E3\uFF1A\u8BBE\u7F6E \u203A codex-mini-pet");
        return { kind: "success", text: "\u5BA0\u7269\u8BBE\u7F6E\u5DF2\u66F4\u65B0\u3002" };
      } catch (e) {
        return { kind: "error", text: e.message };
      }
    }
  }));
}
export {
  apply,
  inject,
  name
};
