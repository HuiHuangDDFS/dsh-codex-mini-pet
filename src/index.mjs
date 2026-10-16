import { PetStore } from './store.mjs';
import { createHandler, API_PREFIX } from './http.mjs';
import { promises as fs } from 'node:fs';
import { validateAtlas } from './atlas.mjs';

export const name = 'dsh-hide-pet';
export const inject = ['webServer', 'connection', 'tools', 'commands'];
const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const string = description => ({ type: 'string', description });
export function apply(ctx, config = {}) {
  const store = new PetStore(config.dataDir);
  const handler = createHandler(store, req => ctx.connection.admit(req));
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler }));
  const register = (toolName, description, parameters, execute) => ctx.effect(() => ctx.tools.register({
    name: toolName, description, parameters,
    output: { schema: {}, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] }, execute,
  }));
  register('pet_list', '列出已安装宠物和当前显示偏好。', object(), () => store.snapshot());
  register('pet_select', '选择宠物并显示。', object({ id: string('宠物 ID') }, ['id']), args => store.select(args.id));
  register('pet_update', '修改宠物名称或描述，不改动图集。', object({ id: string('宠物 ID'), name: string('新名称'), description: string('新描述') }, ['id']), async ({ id, ...patch }) => { const { directory, ...pet } = await store.update(id, patch); return pet; });
  register('pet_delete', '删除用户导入的宠物。内置形象保留，可隐藏。', object({ id: string('自定义宠物 ID') }, ['id']), args => store.delete(args.id));
  register('pet_validate', '校验本机 PNG/WebP 图集的尺寸、透明度、必填帧和空格；不证明动作语义。', object({ file: string('图集的绝对文件路径') }, ['file']), async args => validateAtlas(await fs.readFile(args.file)));
  register('pet_import', '导入本机宠物目录（pet.json 和 PNG/WebP）或 ZIP；校验通过后保存。', object({ file: string('目录或 ZIP 绝对路径') }, ['file']), async args => { const stat = await fs.stat(args.file); return stat.isDirectory() ? store.importDirectory(args.file) : store.importArchive(await fs.readFile(args.file)); });
  register('pet_export', '导出宠物为 ZIP 到指定的全新文件。', object({ id: string('宠物 ID'), file: string('ZIP 输出绝对路径，不覆盖已有文件') }, ['id', 'file']), async args => { await fs.writeFile(args.file, await store.export(args.id), { flag: 'wx' }); return { file: args.file }; });
  register('pet_set_preferences', '设置显示、缩放、鼠标跟随和减少动态效果。', object({ visible: { type: 'boolean' }, scale: { type: 'number' }, reducedMotion: { type: 'boolean' }, followPointer: { type: 'boolean' } }), args => store.preferences(args));
  ctx.effect(() => ctx.commands.register({
    name: 'pet', description: '显示、隐藏、列出或选择动画宠物', input: { hint: 'show | hide | list | select <id>' },
    handler: async invocation => {
      try {
        const [verb = 'toggle', id] = (invocation.rawInput || '').trim().split(/\s+/).filter(Boolean);
        if (verb === 'select') await store.select(id);
        else if (verb === 'list') return { kind: 'success', text: (await store.list()).map(p => `${p.id}: ${p.name}`).join('\n') };
        else if (['show', 'hide', 'toggle'].includes(verb)) await store.preferences({ visible: verb === 'toggle' ? !(await store.snapshot()).preferences.visible : verb === 'show' });
        else throw new Error('用法：/pet [show | hide | list | select <id>]');
        return { kind: 'success', text: '宠物设置已更新。' };
      } catch (e) { return { kind: 'error', text: e.message }; }
    },
  }));
}
