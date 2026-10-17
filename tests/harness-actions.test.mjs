import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarnessActions, createPetPrompt, requiresNativeComposer } from '../src/harness-actions.mjs';

function fixture({ current = true, workspaces = true, promptOk = true, draft = 'Existing draft' } = {}) {
  const calls = [], listeners = new Map();
  const input = {
    actions: {
      captureInsertion: () => ({ start: draft.length, end: draft.length, draftRev: 4 }),
      insertText: (text, span) => { calls.push(['insertText', text, span]); draft += text; return true; },
      setDraft: () => { throw new Error('must not overwrite existing native draft'); },
    },
    focus: () => calls.push(['focus']),
  };
  const session = {
    prompt: async (...args) => { calls.push(['prompt', ...args]); return promptOk ? { ok: true, value: { accepted: true } } : { ok: false, error: { code: 'writer-held', message: 'Session is busy' } }; },
    cancel: async () => { calls.push(['cancel']); return { ok: true }; },
  };
  const ctx = {
    sessions: {
      list: { getSnapshot: () => ({ phase: 'ready', ids: ['current'], byId: { current: { id: 'current', displayTitle: 'Current chat', retainedBy: current ? { mainView: 1 } : {} } } }) },
      create: async opts => { calls.push(['create', opts]); return 'created'; },
      using: async (id, opts, operation) => { calls.push(['using', id, opts]); return operation({ binding: { ctx: { sessionId: id }, session } }); },
    },
    workspaces: { list: { getSnapshot: () => ({ phase: 'ready', items: workspaces ? [{ workspaceId: 'ws', path: 'K:/selected-project', sessionIds: ['current'] }] : [] }) } },
    uiWorkspace: { openSession: id => calls.push(['openSession', id]) },
    conversation: { input: { for: actx => { calls.push(['input.for', actx]); return input; } } },
    remote: { $on: (event, listener) => { listeners.set(event, listener); return () => listeners.delete(event); } },
  };
  return { ctx, actions: createHarnessActions(ctx), calls, listeners, readDraft: () => draft };
}

test('new quick chat explicitly creates in current workspace and sends complete text through native Session', async () => {
  const { actions, calls } = fixture();
  const text = '完整提示\n第二行 ' + '鲸'.repeat(8000);
  const result = await actions.sendMessage({ text });
  assert.deepEqual(result, { sessionId: 'created', created: true, workspaceId: 'ws', workspacePath: 'K:/selected-project' });
  assert.deepEqual(calls[0], ['create', { workspaceId: 'ws' }]);
  assert.deepEqual(calls.find(call => call[0] === 'prompt'), ['prompt', [{ type: 'text', text }], 'queue']);
  assert.deepEqual(calls.find(call => call[0] === 'using'), ['using', 'created', { source: 'hidePet' }]);
  assert.equal(calls.some(call => ['openSession', 'input.for', 'focus'].includes(call[0])), false);
});

test('sending to an existing chat prompts in the background without navigating or focusing the composer', async () => {
  const { actions, calls, readDraft } = fixture();
  await actions.sendMessage({ sessionId: 'current', text: 'Continue in background' });
  assert.deepEqual(calls, [
    ['using', 'current', { source: 'hidePet' }],
    ['prompt', [{ type: 'text', text: 'Continue in background' }], 'queue'],
  ]);
  assert.equal(readDraft(), 'Existing draft');
});

test('an existing session does not create a chat and surfaces host admission failures', async () => {
  const { actions, calls } = fixture({ promptOk: false });
  await assert.rejects(actions.sendMessage({ sessionId: 'current', text: 'Hello' }), error => error.code === 'writer-held' && error.message === 'Session is busy');
  assert.equal(calls.some(call => call[0] === 'create'), false);
});

test('no workspace is guessed when there is no current selection', async () => {
  const { actions, calls } = fixture({ current: false });
  await assert.rejects(actions.sendMessage({ text: 'Hello' }), error => error.code === 'WORKSPACE_REQUIRED');
  assert.equal(calls.length, 0);
  await actions.sendMessage({ text: 'Hello', workspaceId: 'ws' });
  assert.deepEqual(calls[0], ['create', { workspaceId: 'ws' }]);
});

test('context mentions, skills, and slash commands require the native composer before creation', async () => {
  const { actions, calls } = fixture();
  for (const text of ['看看 @file.txt', '$dsh-hide-pet 创建宠物', '/pet list']) {
    assert.equal(requiresNativeComposer(text), true);
    await assert.rejects(actions.sendMessage({ text }), error => error.code === 'NATIVE_COMPOSER_REQUIRED');
  }
  assert.equal(requiresNativeComposer('Contact a@b.example; costs $5'), true);
  assert.equal(requiresNativeComposer('a@b.example'), false);
  assert.equal(calls.length, 0);
});

test('native composer transfer inserts intact text and preserves existing draft without sending', async () => {
  const { actions, calls, readDraft } = fixture();
  const text = ' @file $skill\nDo this';
  await actions.openMainComposer({ sessionId: 'current', text });
  assert.equal(readDraft(), 'Existing draft' + text);
  assert.equal(calls.some(call => call[0] === 'prompt' || call[0] === 'create'), false);
  assert.equal(calls.some(call => call[0] === 'focus'), true);
  assert.deepEqual(calls.find(call => call[0] === 'openSession'), ['openSession', 'current']);
});

test('composer waits for asynchronous navigation and honors the explicitly selected workspace', async () => {
  const { ctx, actions, calls, readDraft } = fixture({ current: false });
  let listener, opened = false, disposed = false;
  ctx.sessions.list = {
    getSnapshot: () => ({ phase: 'ready', byId: opened ? { created: { id: 'created', retainedBy: { mainView: 1 } } } : {} }),
    subscribe: fn => { listener = fn; return () => { disposed = true; }; },
  };
  const transfer = actions.openMainComposer({ text: 'draft', workspaceId: 'ws' });
  // Session creation and insertion settle before the main view mounts.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.some(call => call[0] === 'focus'), false);
  assert.equal(readDraft(), 'Existing draftdraft');
  opened = true; listener(); await transfer;
  assert.equal(disposed, true);
  assert.deepEqual(calls.find(call => call[0] === 'create'), ['create', { workspaceId: 'ws' }]);
  assert.equal(calls.at(-1)[0], 'focus');
});

test('stop and error subscriptions use exact native APIs; unavailable capabilities remain explicit', async () => {
  const { actions, calls, listeners } = fixture();
  await actions.stopSession('current');
  assert.equal(calls.some(call => call[0] === 'cancel'), true);
  let seen;
  const dispose = actions.subscribeErrors(value => { seen = value; });
  listeners.get('api-session/error')('current', 'Rate limited');
  assert.deepEqual(seen, { id: 'current', message: 'Rate limited' });
  dispose(); assert.equal(listeners.size, 0);
  const context = actions.getContext();
  assert.equal(context.currentWorkspaceId, 'ws');
  assert.equal(context.capabilities.systemFloatingWindow, false);
  assert.equal(context.capabilities.globalShortcut, false);
  assert.equal(context.capabilities.voice, false);
  assert.match(createPetPrompt(), /如果已安装/);
});

test('preview contexts fail safely without inventing native services', async () => {
  const actions = createHarnessActions({});
  assert.equal(actions.getContext().capabilities.sendMessage, false);
  await assert.rejects(actions.sendMessage({ text: 'Hello' }), error => error.code === 'CAPABILITY_UNAVAILABLE');
  assert.throws(() => actions.openSession('any'), error => error.code === 'CAPABILITY_UNAVAILABLE');
  actions.subscribeErrors(() => {})();
});

test('context includes inactive unarchived sessions, preserves workspace titles, and tracks live archive changes', async () => {
  const { ctx, actions, calls } = fixture();
  let archivedSessionIds = ['archived'];
  ctx.workspaces.list.getSnapshot = () => ({ phase: 'ready', archivedSessionIds, items: [
    { workspaceId: 'ws', title: '我的项目', path: 'K:/selected-project', sessionIds: ['current', 'background', 'archived'] },
    { workspaceId: 'empty', title: '空工作区', path: 'K:/empty', sessionIds: ['not-loaded'] },
  ] });
  ctx.sessions.list.getSnapshot = () => ({ phase: 'ready', byId: {
    current: { id: 'current', retainedBy: { mainView: 1 }, displayTitle: '主会话' },
    background: { id: 'background', title: '未打开的会话', retainedBy: {} },
    archived: { id: 'archived', title: '归档会话' },
    detached: { id: 'detached', title: '路径关联', cwd: 'k:\\selected-project\\' },
    child: { id: 'child', parentId: 'background' },
  } });
  const context = actions.getContext();
  assert.equal(context.workspaces.length, 2); assert.equal(context.workspaces[0].title, '我的项目');
  assert.deepEqual(new Set(context.sessions.map(item => item.sessionId)), new Set(['current', 'background', 'detached', 'not-loaded']));
  assert.equal(context.sessions.find(item => item.sessionId === 'detached').workspaceId, 'ws');
  await actions.sendMessage({ text: '继续', sessionId: 'background' });
  assert.equal(calls.some(call => call[0] === 'create'), false);
  archivedSessionIds = ['archived', 'background'];
  assert.equal(actions.getContext().sessions.some(item => item.sessionId === 'background'), false);
  await assert.rejects(actions.sendMessage({ text: '继续', sessionId: 'background' }), error => error.code === 'SESSION_UNAVAILABLE');
});

test('empty host placeholders do not appear as workspace-named chats; real untitled conversations stay selectable', () => {
  const { ctx, actions } = fixture();
  ctx.workspaces.list.getSnapshot = () => ({ phase: 'ready', items: [{ workspaceId: 'ws', path: 'K:/default-workspace', sessionIds: ['empty', 'untitled', 'named'] }] });
  ctx.sessions.list.getSnapshot = () => ({ phase: 'ready', byId: {
    empty: { id: 'empty', cwd: 'K:/default-workspace', displayTitle: 'default-workspace', blank: true },
    untitled: { id: 'untitled', cwd: 'K:/default-workspace', displayTitle: 'default-workspace', blank: false },
    named: { id: 'named', cwd: 'K:/default-workspace', title: 'default-workspace', displayTitle: 'default-workspace', blank: false },
  } });
  const context = actions.getContext();
  assert.deepEqual(context.sessions.map(item => [item.sessionId, item.title]), [
    ['untitled', '未命名会话'], ['named', 'default-workspace'],
  ]);
});
