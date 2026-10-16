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
  return { actions: createHarnessActions(ctx), calls, listeners, readDraft: () => draft };
}

test('new quick chat explicitly creates in current workspace and sends complete text through native Session', async () => {
  const { actions, calls } = fixture();
  const text = '完整提示\n第二行 ' + '鲸'.repeat(8000);
  const result = await actions.sendMessage({ text });
  assert.deepEqual(result, { sessionId: 'created', created: true, workspaceId: 'ws', workspacePath: 'K:/selected-project' });
  assert.deepEqual(calls[0], ['create', { workspaceId: 'ws' }]);
  assert.deepEqual(calls.find(call => call[0] === 'prompt'), ['prompt', [{ type: 'text', text }], 'queue']);
  assert.deepEqual(calls.find(call => call[0] === 'using'), ['using', 'created', { source: 'hidePet' }]);
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
