import test from 'node:test';
import assert from 'node:assert/strict';
import { activityRows, taskPresentation } from '../src/client-model.mjs';
import { combineSessionSources, sessionActivitySource } from '../src/activity-source.mjs';

const sessions = { byId: {
  working: { id: 'working', title: '当前工作', retainedBy: { mainView: 1 } },
  waiting: { id: 'waiting', title: '等待审批' },
  failed: { id: 'failed', title: '发生错误' },
  done: { id: 'done', title: '完成结果' },
} };
test('all-chat activity prioritizes needs input, blocked, ready, running and identifies the actual target', () => {
  const statuses = new Map([['working', { running: true }], ['waiting', { pendingInteraction: { kind: 'approval' } }], ['done', { completionUnread: true }]]);
  const facts = new Map([['failed', { lastAgentError: '模型失败' }]]);
  const rows = activityRows(sessions, statuses, facts);
  assert.deepEqual(rows.map(row => row.state), ['needs-input', 'blocked', 'ready', 'running']);
  assert.equal(rows[0].animation, 'waiting'); assert.equal(rows[2].animation, 'review');
  assert.equal(taskPresentation(sessions, statuses, null, facts).sessionId, 'waiting');
  statuses.delete('waiting'); assert.equal(taskPresentation(sessions, statuses, null, facts).sessionId, 'failed');
  facts.clear(); assert.equal(taskPresentation(sessions, statuses, null, facts).sessionId, 'done');
});

test('durable turn failures are observed without api-session/error and a new turn clears them', () => {
  let events = { entries: [{ type: 'persisted', event: { type: 'turn/end', seq: 17, data: { turn: 1, reason: { kind: 'error', error: { code: 'MISSING_CREDENTIAL', message: 'No credential' } } } } }] };
  const listeners = new Set(); let disposed = 0;
  const snapshot = { lastAgentError: null };
  const source = sessionActivitySource({ getSnapshot: () => snapshot, subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); disposed++; }; }, eventSource: { getSnapshot: () => events, subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); disposed++; }; } } });
  const first = source.getSnapshot(); assert.equal(first.lastTurnError.code, 'MISSING_CREDENTIAL');
  assert.equal(source.getSnapshot(), first);
  assert.equal(activityRows(sessions, new Map(), new Map([['failed', first]]))[0].state, 'blocked');
  const off = source.subscribe(() => {});
  events = { entries: [...events.entries, { event: { type: 'turn/start', seq: 18, data: { turn: 2 } } }] };
  assert.equal(source.getSnapshot().lastTurnError, null);
  assert.notEqual(source.getSnapshot().activityVersion, first.activityVersion);
  off(); assert.equal(disposed, 2); assert.equal(listeners.size, 0);
});
test('idle and cleared errors never create false alerts; a retry clears a stale failure presentation', () => {
  assert.deepEqual(activityRows(sessions, new Map()), []);
  const facts = new Map([['failed', { lastAgentError: '旧错误' }]]);
  const rows = activityRows(sessions, new Map([['failed', { running: true }]]), facts);
  assert.equal(rows[0].state, 'running');
  assert.equal(activityRows(sessions, new Map(), new Map(), { includeIdle: true }).length, 4);
});
test('combined source returns stable cached snapshots and cleans every subscription', () => {
  let value = { lastAgentError: null }, listener, cleaned = false;
  const combined = combineSessionSources([{ id: 'one', source: { getSnapshot: () => value, subscribe: fn => { listener = fn; return () => { cleaned = true; }; } } }]);
  const first = combined.getSnapshot(); assert.equal(combined.getSnapshot(), first);
  let changes = 0; const stop = combined.subscribe(() => changes++);
  value = { lastAgentError: 'changed' }; listener();
  assert.equal(changes, 1); assert.notEqual(combined.getSnapshot(), first);
  assert.equal(combined.getSnapshot().get('one'), value); stop(); assert.equal(cleaned, true);
});
