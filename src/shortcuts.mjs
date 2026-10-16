/** Shortcut installation is optional: host collisions must never prevent boot. */
export function registerPetShortcut(shortcuts, run, warn = console.warn) {
  if (!shortcuts?.register) return () => {};
  const command = {
    id: 'dsh-hide-pet.quick-chat', label: () => '宠物：快速聊天', aliases: ['pet', '伙伴'],
    defaults: Object.fromEntries(['desktop:windows', 'desktop:linux', 'desktop:macos', 'web:windows', 'web:macos'].map(platform => [platform, { code: 'KeyP', modifiers: ['primary', 'alt', 'shift'] }])),
    regions: ['page', 'editable'], modals: [], resolve: () => ({ status: 'handled', run }),
  };
  try { return shortcuts.register(command); }
  catch (error) {
    warn('宠物快捷键未使用默认按键，将尝试保留为可自定义命令。', error);
    try { return shortcuts.register({ ...command, defaults: {} }); }
    catch (fallbackError) { warn('宠物快捷键不可用；仍可使用设置页和宠物操作栏。', fallbackError); return () => {}; }
  }
}
