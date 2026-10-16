import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPetShortcut } from '../src/shortcuts.mjs';

test('a host shortcut collision on any platform leaves an unbound command and does not abort plugin boot', () => {
  const calls = [], warnings = []; let fired = 0, disposed = false;
  const dispose = registerPetShortcut({ register(command) {
    calls.push(command);
    if (Object.keys(command.defaults).length) throw new Error('Conflicting shortcut defaults: dsh-hide-pet.quick-chat and workspace.files (web:macos)');
    return () => { disposed = true; };
  } }, () => fired++, (...args) => warnings.push(args));
  assert.equal(calls.length, 2); assert.deepEqual(calls[1].defaults, {});
  assert.equal(calls[1].id, calls[0].id); calls[1].resolve().run(); assert.equal(fired, 1);
  assert.equal(warnings.length, 1); dispose(); assert.equal(disposed, true);
});

test('an unavailable shortcut registry never takes down the pet UI', () => {
  assert.doesNotThrow(() => registerPetShortcut(undefined, () => {})());
  const off = registerPetShortcut({ register() { throw new Error('Registry unavailable'); } }, () => {}, () => {});
  assert.doesNotThrow(off);
});
