#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PetStore } from './store.mjs';
import { validateAtlas } from './atlas.mjs';

const options = { 'data-dir': { type: 'string' }, file: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, visible: { type: 'string' }, mode: { type: 'string' }, surface: { type: 'string' }, 'visibility-behavior': { type: 'string' }, scope: { type: 'string' }, scale: { type: 'string' }, 'reduced-motion': { type: 'string' }, 'follow-pointer': { type: 'string' }, port: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } };
export async function run(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args: argv, options, allowPositionals: true });
  const [command = 'help', id, destination] = positionals;
  const store = new PetStore(values['data-dir']); let result;
  const boolean = value => { if (!['true', 'false'].includes(value)) throw new Error('布尔值仅接受 true 或 false。'); return value === 'true'; };
  if (values.help || command === 'help') return { usage: 'dsh-hide-pet <list|select ID|import DIR_OR_ZIP|export ID ZIP|validate --file IMAGE|update ID --name NAME|replace ID --file IMAGE|delete ID|preferences [--mode pet|mini]|reset --scope size|position|all|preview> [--data-dir DIR] [--json]' };
  if (command === 'list') result = await store.snapshot();
  else if (command === 'select') result = await store.select(id);
  else if (command === 'validate') { result = await validateAtlas(await fs.readFile(values.file ?? id)); if (!result.ok) process.exitCode = 1; }
  else if (command === 'import') { const stat = await fs.stat(id); result = stat.isDirectory() ? await store.importDirectory(id) : await store.importArchive(await fs.readFile(id)); }
  else if (command === 'export') { if (!destination) throw new Error('需要 ZIP 输出文件路径。'); await fs.writeFile(destination, await store.export(id), { flag: 'wx' }); result = { file: path.resolve(destination) }; }
  else if (command === 'update') { const patch = {}; for (const key of ['name', 'description']) if (key in values) patch[key] = values[key]; const { directory, ...pet } = await store.update(id, patch); result = pet; }
  else if (command === 'replace') { if (!values.file) throw new Error('需要 --file 指定新图集。'); result = await store.replaceBytes(id, await fs.readFile(values.file)); }
  else if (command === 'reset') result = await store.resetPreferences(values.scope);
  else if (command === 'delete') result = await store.delete(id);
  else if (command === 'preferences') {
    const patch = {};
    for (const [flag, key] of [['visible', 'visible'], ['reduced-motion', 'reducedMotion'], ['follow-pointer', 'followPointer']]) if (flag in values) patch[key] = boolean(values[flag]);
    if ('scale' in values) patch.scale = Number(values.scale);
    if ('mode' in values) patch.mode = values.mode;
    if ('surface' in values) patch.surface = values.surface;
    if ('visibility-behavior' in values) patch.visibilityBehavior = values['visibility-behavior'];
    result = Object.keys(patch).length ? await store.preferences(patch) : (await store.snapshot()).preferences;
  } else if (command === 'preview') { const { startPreview } = await import('./preview.mjs'); return startPreview({ dataDir: values['data-dir'], port: values.port, file: values.file, petId: id }); }
  else throw new Error('未知命令，请使用 --help。');
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().then(result => { if (result !== undefined) console.log(JSON.stringify(result, null, 2)); }).catch(e => { console.error(JSON.stringify({ error: e.message })); process.exitCode = 1; });
}
