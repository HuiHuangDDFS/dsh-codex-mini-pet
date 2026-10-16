import { validateAtlas } from './atlas.mjs';

export async function performAction(store, request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('请求必须是对象。');
  switch (request.action) {
    case 'select': return store.select(request.id);
    case 'preferences': return store.preferences(request.patch ?? request.preferences);
    case 'update': {
      const patch = request.patch ?? Object.fromEntries(['name', 'description'].filter(key => Object.hasOwn(request, key)).map(key => [key, request[key]]));
      const pet = await store.update(request.id, patch); const { directory, ...result } = pet; return result;
    }
    case 'delete': return store.delete(request.id);
    case 'import': {
      if (request.archiveBase64) return store.importArchive(Buffer.from(request.archiveBase64, 'base64'));
      if (!request.spritesheetBase64) throw new Error('缺少图集。');
      return store.importBytes(request.manifest ?? { name: request.name }, Buffer.from(request.spritesheetBase64, 'base64'));
    }
    case 'validate': return validateAtlas(Buffer.from(request.spritesheetBase64 ?? '', 'base64'), request.spriteVersion);
    case 'export': return { filename: `${request.id}.zip`, archiveBase64: (await store.export(request.id)).toString('base64') };
    default: throw new Error('未知宠物操作。');
  }
}
