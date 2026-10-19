#!/usr/bin/env node
/**
 * Guard against the committed `lib/` drifting from `src/`.
 *
 * `lib/index.js` and `lib/client.js` are committed on purpose. pnpm only builds
 * a git dependency when its declared entry file is missing (see pnpm's
 * `packageShouldBeBuilt`), and the plugin market's
 * `dsh plugin add github:<owner>/<repo>` cannot approve a build script, so
 * shipping these two files is what makes that install path work at all.
 *
 * The cost is that a stale commit quietly ships old code: `lib/index.js` still
 * exists, so nothing fails anywhere — the plugin just runs whatever was
 * committed last. This script rebuilds and fails when the committed pair no
 * longer matches `src/`.
 *
 *   npm run release-check     # requires devDependencies; run before tagging
 *
 * It rewrites `lib/` as a side effect of verifying, leaving the tree with a
 * fresh build.
 */
import { execFileSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import './verify-native-bundle.mjs';

/** The files a git install loads, and therefore the ones committed. */
const COMMITTED = ['index.js', 'client.js'];

/** Read the committed pair, or null per file when absent. */
async function snapshot() {
  const files = {};
  for (const file of COMMITTED) {
    try {
      files[file] = await readFile(join('lib', file));
    }
    catch {
      files[file] = null;
    }
  }
  return files;
}

const missing = [];
const before = await snapshot();
for (const file of COMMITTED) {
  if (before[file] === null) missing.push(file);
}
if (missing.length > 0) {
  console.error(
    `release-check: lib/ is missing ${missing.join(', ')}.\n` +
    'A `github:` install loads these directly and cannot build them, so commit them:\n' +
    '  npm run build && git add lib/index.js lib/client.js',
  );
  process.exit(1);
}

execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
const after = await snapshot();

const drifted = COMMITTED.filter((file) => {
  const next = after[file];
  const prev = before[file];
  if (next === null) return true;
  return prev === null || !next.equals(prev);
});

if (drifted.length > 0) {
  console.error(
    `release-check: committed lib/ does not match a fresh build: ${drifted.join(', ')}\n` +
    'Commit the rebuilt files so a git install gets this version:',
  );
  for (const file of drifted) console.error(`  git add lib/${file}`);
  process.exit(1);
}

// The build also emits client.cjs and preview.js; they are gitignored, and
// leaving them around would only confuse the next release.
await rm(join('lib', 'client.cjs'), { force: true });
await rm(join('lib', 'preview.js'), { force: true });

console.log(`release-check: lib/ is current — ${COMMITTED.length} committed files match a fresh build.`);
