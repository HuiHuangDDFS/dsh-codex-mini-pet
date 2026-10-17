import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetStore } from '../src/store.mjs';
import { ENGLISH_MESSAGES, LANGUAGES, createTranslator, translate } from '../src/i18n.mjs';

test('Chinese is the default for new and existing preferences; English persists without changing other settings', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-language-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new PetStore(directory);
  assert.equal((await store.snapshot()).preferences.language, 'zh-CN');
  await store.preferences({ scale: 1.1, mode: 'mini', visible: false });
  const legacy = JSON.parse(await fs.readFile(path.join(directory, 'state.json'), 'utf8'));
  delete legacy.preferences.language;
  await fs.writeFile(path.join(directory, 'state.json'), JSON.stringify(legacy));
  const before = (await store.snapshot()).preferences;
  assert.equal(before.language, 'zh-CN');
  await store.preferences({ language: 'en' });
  assert.deepEqual((await new PetStore(directory).snapshot()).preferences, { ...before, language: 'en' });
  for (const language of ['en-US', 'auto', '', null, 1]) await assert.rejects(store.preferences({ language }));
  assert.equal((await store.snapshot()).preferences.language, 'en');
  await store.resetPreferences('position');
  await store.resetPreferences('size');
  assert.equal((await store.snapshot()).preferences.language, 'en');
  assert.equal((await store.resetPreferences('all')).language, 'zh-CN');
});

test('translations interpolate safely and keep unknown titles and user text intact', () => {
  const zh = createTranslator(), en = createTranslator('en');
  assert.deepEqual(LANGUAGES.map(item => item.value), ['zh-CN', 'en']);
  assert.equal(zh('外观与行为'), '外观与行为');
  assert.equal(en('外观与行为'), 'Appearance & behavior');
  assert.equal(en('任务动态 {count} 条', { count: 3 }), 'Task activity: 3');
  assert.equal(en('{name}，点击打招呼，拖动移动，方向键调整位置，右键打开菜单', { name: '<中文 & {count}>' }), '<中文 & {count}>. Click to say hello, drag to move, use arrow keys to adjust, or right-click for the menu.');
  assert.equal(en('我的项目 / my chat'), '我的项目 / my chat');
  assert.equal(translate('unsupported', '语言'), '语言');
  assert.equal(zh(en('已加入宠物库')), '已加入宠物库', 'existing notices can switch back to Chinese');
});

test('every static browser translation and animation/status label has an English entry', async () => {
  const { ANIMATIONS, ACTIVITY_STATES } = await import('../src/client-model.mjs');
  const required = new Set([...ANIMATIONS.map(item => item.label), ...Object.values(ACTIVITY_STATES).map(item => item.label)]);
  for (const file of ['client-entry.jsx', 'native-ui.jsx', 'pet-dock.jsx', 'work-chat.jsx']) {
    const source = await fs.readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/\bt\(\s*(['"])([^'"\n]+)\1/g)) required.add(match[2]);
  }
  for (const key of required) {
    assert.equal(typeof ENGLISH_MESSAGES[key], 'string', `missing English translation: ${key}`);
    assert.equal(/\p{Script=Han}/u.test(ENGLISH_MESSAGES[key]), false, `untranslated entry: ${key}`);
  }
});
