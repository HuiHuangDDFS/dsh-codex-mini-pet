export const CHAT_PANEL = 'dsh-deepseek-chat';
export const DEEPSEEK_HOME = 'https://chat.deepseek.com/';
export const CHAT_PARTITION_KEY = 'session:dsh-codex-mini-pet:deepseek-chat';

export function chatDestination(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 8192) return null;
  try {
    const url = new URL(value, DEEPSEEK_HOME);
    if (url.origin !== new URL(DEEPSEEK_HOME).origin || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
export function chatSession(value) {
  const url = chatDestination(value);
  if (!url) return null;
  const path = new URL(url).pathname;
  const match = /^\/a\/([a-zA-Z0-9_-]+)\/s\/([a-zA-Z0-9_-]+)\/?$/.exec(path);
  return match ? { id: `${match[1]}:${match[2]}`, url: new URL(path, DEEPSEEK_HOME).href } : null;
}
export function normalizeChatRows(rows) {
  const result = new Map();
  for (const row of Array.isArray(rows) ? rows.slice(0, 500) : []) {
    const session = chatSession(row?.url);
    if (!session || typeof row.title !== 'string') continue;
    const title = row.title.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (title) result.set(session.id, { ...session, title });
  }
  return [...result.values()];
}
export function createWorkChatController(layout) {
  let state = { opened: false, request: null, rows: [], url: DEEPSEEK_HOME, title: 'DeepSeek', status: 'idle', error: '', revision: 0 };
  const listeners = new Set();
  const set = patch => { if (Object.entries(patch).every(([key,value])=>state[key]===value)) return; state = { ...state, ...patch }; for (const listener of listeners) listener(); };
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    open(url) {
      const destination = chatDestination(url ?? state.url);
      if (!destination) throw new Error('只能打开 DeepSeek 官方聊天页面。');
      // Returning to Chat must preserve the live page, including an unsent draft.
      if (!state.opened || url !== undefined) set({ opened: true, request: { url: destination, revision: state.revision + 1 }, revision: state.revision + 1 });
      layout.selectPanel(CHAT_PANEL);
    },
    work() { layout.selectPanel(null); },
    report(patch) { set(patch); },
    observe(snapshot) {
      const url = chatDestination(snapshot?.url);
      if (!url) return;
      if (/^\/(sign_in|sign_up|forgot_password|mobile_verification)(\/|$)/.test(new URL(url).pathname)) {
        set({ url, rows: [], title: 'DeepSeek', status: 'sign-in', error: '' }); return;
      }
      // A route transition may briefly unmount the site's navigation. Keep the
      // mirrored list until its sidebar returns; an explicitly empty sidebar clears it.
      const incoming = !snapshot.rows?.length && !snapshot.navigationReady ? state.rows : normalizeChatRows(snapshot.rows);
      const rows = JSON.stringify(incoming) === JSON.stringify(state.rows) ? state.rows : incoming;
      const current = chatSession(url);
      const title = rows.find(row => row.id === current?.id)?.title || String(snapshot.title || 'DeepSeek').slice(0, 160);
      // Only live webpage navigation labels are mirrored; no cookies, tokens or message bodies.
      set({ url, title, rows, status: 'ready', error: '' });
    },
  };
}
