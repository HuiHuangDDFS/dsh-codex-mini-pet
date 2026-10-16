import test from 'node:test';
import assert from 'node:assert/strict';
import { ANIMATIONS, clampPosition, frameFor, gazeForPoint, resolveAssetUrl, taskPresentation } from '../src/client-model.mjs';

test('clockwise look coordinates agree with the v2 atlas cardinals', () => {
  const center = { x: 100, y: 100 };
  for (const [point, direction] of [[{ x: 100, y: 0 }, 0], [{ x: 200, y: 100 }, 4], [{ x: 100, y: 200 }, 8], [{ x: 0, y: 100 }, 12]]) {
    assert.equal(gazeForPoint(point, center), direction);
    assert.deepEqual(frameFor('idle', 0, { gaze: direction }), { row: 9 + Math.floor(direction / 8), column: direction % 8, rows: 11 });
  }
  assert.equal(gazeForPoint({ x: 100, y: 101 }, center), null);
});

test('animation frames stay in occupied cells and v1 has no gaze rows', () => {
  for (let row = 0; row < ANIMATIONS.length; row++) {
    const animation = ANIMATIONS[row];
    for (let time = 0; time < 4000; time += 71) {
      const frame = frameFor(animation.id, time);
      assert.equal(frame.row, row);
      assert.ok(frame.column >= 0 && frame.column < animation.count);
    }
  }
  assert.deepEqual(frameFor('jumping', 500, { reducedMotion: true }), { row: 4, column: 0, rows: 11 });
  assert.equal(frameFor('idle', 500, { gaze: 12, version: 1 }).rows, 9);
  assert.ok(frameFor('idle', 500, { gaze: 12, version: 1 }).row < 9);
});

test('drag positions remain reachable after shrinking the window', () => {
  assert.deepEqual(clampPosition({ x: -50, y: 900 }, { width: 500, height: 400 }, { width: 100, height: 120 }), { x: 8, y: 272 });
  assert.deepEqual(clampPosition({ x: 100, y: 100 }, { width: 20, height: 20 }, { width: 100, height: 120 }), { x: 8, y: 8 });
});

test('task states follow active-session facts and never infer failure from inactivity', () => {
  const sessions = { byId: { a: { id: 'a', title: 'Current', running: true, retainedBy: { mainView: 1 } }, b: { id: 'b', running: true, retainedBy: {} } } };
  assert.equal(taskPresentation(sessions, new Map()).animation, 'running');
  assert.equal(taskPresentation(sessions, new Map([['a', { running: true, pendingInteraction: { kind: 'approval' } }]])).animation, 'review');
  assert.equal(taskPresentation(sessions, new Map([['a', { running: true, pendingInteraction: { kind: 'question' } }]])).animation, 'waiting');
  assert.equal(taskPresentation({ byId: {} }, new Map()).animation, 'idle');
  assert.equal(taskPresentation({ byId: {} }, new Map([['b', { completionUnread: true }]])).animation, 'waving');
});

test('a native agent error produces failed while a retry or cleared error restores the current state', () => {
  const sessions = { byId: { a: { id: 'a', title: 'Current', running: false, retainedBy: { mainView: 1 } } } };
  assert.equal(taskPresentation(sessions, new Map(), { lastAgentError: 'Native model failure' }).animation, 'failed');
  assert.equal(taskPresentation(sessions, new Map([['a', { running: true }]]), { lastAgentError: 'Previous failure' }).animation, 'running');
  assert.equal(taskPresentation(sessions, new Map(), { lastAgentError: null }).animation, 'idle');
  assert.equal(taskPresentation(sessions, new Map([['a', { pendingInteraction: { kind: 'approval' } }]]), { lastAgentError: 'Previous failure' }).animation, 'review');
  assert.equal(taskPresentation({ byId: {} }, new Map(), { lastAgentError: 'Unrelated error' }).animation, 'idle');
});

test('resource URLs retain a reverse-proxy mount', () => {
  assert.equal(resolveAssetUrl('dsh-hide-pet/sprites/whale-girl', 'https://example.com/harness/'), 'https://example.com/harness/dsh-hide-pet/sprites/whale-girl');
});
