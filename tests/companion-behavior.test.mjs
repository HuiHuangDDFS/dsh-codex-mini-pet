import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompletionTracker, inwardBubblePosition, sidePanelPosition } from '../src/companion-behavior.mjs';

test('notices ignore old unread tasks, detect main-chat completion, and do not repeat on refresh', () => {
  const track = createCompletionTracker();
  assert.deepEqual(track([{ id: 'old', state: 'ready' }, { id: 'main', title: '工作', running: true, activityVersion: '1:1' }]), []);
  const end = { id: 'main', title: '工作', running: false, activityVersion: '1:2', turnEnded: true, turnOutcome: 'completed', state: 'idle' };
  const [notice] = track([end]); assert.equal(notice.sessionId, 'main'); assert.equal(notice.title, '工作');
  assert.ok(notice.expiresAt > Date.now()); assert.deepEqual(track([end]), []);
  track([{ ...end, running: true, turnEnded: false, activityVersion: '2:3' }]);
  assert.equal(track([{ ...end, activityVersion: '2:4' }]).length, 1);
});

test('notices wait for durable ends and suppress failures, cancellations and pending questions', () => {
  for (const finish of [{ turnOutcome: 'cancelled' }, { error: 'failed' }, { pendingInteraction: {} }]) {
    const track = createCompletionTracker(); track([{ id: 'a', running: true }]);
    assert.deepEqual(track([{ id: 'a', running: false, ...finish }]), []);
  }
  const track = createCompletionTracker(); track([{ id: 'a', running: true, activityVersion: 'start' }]);
  assert.deepEqual(track([{ id: 'a', running: false, activityVersion: 'start' }]), []);
  assert.equal(track([{ id: 'a', running: false, activityVersion: 'end', turnEnded: true }]).length, 1);
  assert.deepEqual(track([]), []);
});

test('lazy loading of an old completed turn after the list baseline is not a new completion', () => {
  const track = createCompletionTracker();
  track([{ id: 'history', state: 'idle', running: false }]);
  assert.deepEqual(track([{ id: 'history', state: 'idle', running: false, turnEnded: true, turnOutcome: 'completed', activityVersion: 'old:20' }]), []);
});

test('panels avoid the pet and bubbles choose the inward upper corner on either screen side', () => {
  const viewport = { width: 1440, height: 900 };
  for (const pet of [{ x: 40, y: 80, width: 192, height: 208 }, { x: 1190, y: 680, width: 192, height: 208 }]) {
    const panel = sidePanelPosition(pet, viewport), bubble = inwardBubblePosition(pet, viewport);
    assert.ok(panel.x + panel.width <= pet.x || panel.x >= pet.x + pet.width);
    assert.ok(panel.y >= 8); assert.ok(panel.x >= 8); assert.ok(panel.x + panel.width <= viewport.width - 8);
    assert.equal(bubble.side, pet.x < viewport.width / 2 ? 'right' : 'left');
    assert.ok(bubble.x >= 8); assert.ok(bubble.y >= 8); assert.ok(bubble.y < pet.y);
  }
});
