import React from 'react';
import { createRoot } from 'react-dom/client';
import { apply } from './client-entry.jsx';

function signal(initial) {
  let value = initial; const listeners = new Set();
  return { getSnapshot: () => value, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); }, set: next => { value = next; for (const fn of listeners) fn(); } };
}
const sessionStatus = signal(new Map());
const sessionList = signal({ ids: ['preview'], byId: { preview: { id: 'preview', title: '宠物工作台', retainedBy: { mainView: true } } }, phase: 'ready' });
const cleanup = [];
const ctx = {
  effect: fn => { const dispose = fn(); if (dispose) cleanup.push(dispose); },
  on: () => () => {},
  uiSession: { sessionStatus }, sessions: { list: sessionList },
  slots: {
    inject: (_slot, fn) => { const dispose = fn(); if (dispose) cleanup.push(dispose); },
    register: (_meta, Component) => { createRoot(document.getElementById('pet-root')).render(<Component />); return () => {}; },
  },
};
apply(ctx);
window.addEventListener('pagehide', () => { for (const dispose of cleanup) dispose(); });
document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => {
  const mode = button.dataset.status;
  sessionStatus.set(new Map([['preview', { running: mode === 'running', pendingInteraction: mode === 'waiting' ? { type: 'approval' } : null, completionUnread: mode === 'review', error: mode === 'failed' }]]));
  document.querySelectorAll('[data-status]').forEach(b => b.dataset.active = String(b === button));
}));
