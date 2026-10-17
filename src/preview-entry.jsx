import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { apply } from './client-entry.jsx';

function signal(initial) {
  let value = initial; const listeners = new Set();
  return { getSnapshot: () => value, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); }, set: next => { value = next; for (const fn of listeners) fn(); } };
}
const sessionStatus = signal(new Map());
const sessionList = signal({ ids: ['preview', 'background'], byId: { preview: { id: 'preview', displayTitle: '宠物工作台', retainedBy: { mainView: 1 } }, background: { id: 'background', displayTitle: '后台任务示例', retainedBy: {} } }, phase: 'ready' });
const snapshots = new Map([['preview', signal({})], ['background', signal({})]]);
const workspaces = signal({ phase: 'ready', items: [{ workspaceId: 'preview-workspace', path: '预览工作区（模拟）', sessionIds: ['preview', 'background'] }] });
const cleanup = [], components = new Map();
let draft = '';
const ctx = {
  effect: fn => { const dispose = fn(); if (dispose) cleanup.push(dispose); },
  uiSession: { sessionStatus }, workspaces: { list: workspaces },
  uiWorkspace: { openSession: id => {
    const current = sessionList.getSnapshot();
    sessionList.set({ ...current, byId: Object.fromEntries(Object.entries(current.byId).map(([key, row]) => [key, { ...row, retainedBy: key === id ? { mainView: 1 } : {} }])) });
  } },
  sessions: {
    list: sessionList, binding: id => ({ session: snapshots.get(id) }), create: async () => 'preview',
    using: async (id, _options, fn) => fn({ binding: { ctx: { id }, session: {
      prompt: async () => { sessionStatus.set(new Map([[id, { running: true }]])); return { ok: true }; },
      cancel: async () => { sessionStatus.set(new Map()); return { ok: true }; },
    } } }),
  },
  conversation: { input: { for: () => ({ actions: { captureInsertion: () => ({}), insertText: text => { draft += text; document.getElementById('preview-draft').textContent = `模拟主会话草稿：${draft}`; return true; } }, focus: () => document.getElementById('preview-draft').focus() }) } },
  slots: {
    inject: (_slot, fn) => { const dispose = fn(); if (dispose) cleanup.push(dispose); },
    register: (meta, Component) => { components.set(meta.name, Component); return () => components.delete(meta.name); },
  },
};
apply(ctx);
function Preview() {
  const [settings, setSettings] = useState(false);
  const Overlay = components.get('shell.overlay'), Settings = components.get('settings.section');
  return <><Overlay /><button style={{ position: 'fixed', left: 24, bottom: 24, pointerEvents: 'auto' }} onClick={() => setSettings(true)}>设置</button>
    {settings && <div style={{ position: 'fixed', inset: 0, background: '#10203366', pointerEvents: 'auto', display: 'grid', placeItems: 'center', zIndex: 10 }}><section aria-label="预览设置" role="dialog" style={{ width: 760, maxWidth: '95vw', height: 'min(660px,90vh)', display: 'flex', background: 'var(--dsw-alias-bg-base,#fff)', color: '#182c41', borderRadius: 16, overflow: 'hidden' }}><nav style={{ width: 180, flexShrink: 0, padding: 24, background: '#f5f7fa' }}><h3>设置</h3><p>通用</p><p>模型</p><p>内置插件</p><p>智能体预设</p><button aria-current="true">codex-mini-pet</button></nav><div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 24 }}><button aria-label="关闭设置" style={{ float: 'right', position: 'relative', zIndex: 2 }} onClick={() => setSettings(false)}>×</button><Settings close={() => setSettings(false)} /></div></section></div>}
  </>;
}
createRoot(document.getElementById('pet-root')).render(<Preview />);
window.addEventListener('pagehide', () => { for (const dispose of cleanup) dispose(); });
document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => {
  const mode = button.dataset.status;
  snapshots.get('preview').set({ lastAgentError: mode === 'failed' ? '模拟模型错误' : null });
  sessionStatus.set(new Map(mode === 'multi' ? [['preview', { running: true }], ['background', { pendingInteraction: { type: 'approval', id: 'demo-request' } }]] : [['preview', { running: mode === 'running', pendingInteraction: mode === 'waiting' ? { type: 'approval' } : null, completionUnread: mode === 'review' }]]));
  document.querySelectorAll('[data-status]').forEach(b => b.dataset.active = String(b === button));
}));
