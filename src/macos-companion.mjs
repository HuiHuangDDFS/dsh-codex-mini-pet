import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFileSync, mkdirSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** Ship the universal executable so users do not need Xcode or developer tools. */
export function macOSExecutable({ read = readFileSync, home = homedir(), mkdir = mkdirSync, write = writeFileSync, rename = renameSync, chmod = chmodSync } = {}) {
  const bytes = gunzipSync(read(new URL('../native/macos/pet-window.gz', import.meta.url)));
  const digest = createHash('sha256').update(bytes).digest('hex');
  const directory = path.join(home, 'Library', 'Caches', 'dsh-codex-mini-pet', digest);
  const target = path.join(directory, 'pet-window');
  mkdir(directory, { recursive: true, mode: 0o700 });
  let current;
  try { current = read(target); } catch { /* First launch or cleared cache. */ }
  if (!current?.equals(bytes)) {
    const temporary = `${target}.${process.pid}.tmp`;
    write(temporary, bytes, { mode: 0o700 });
    rename(temporary, target);
  }
  chmod(target, 0o700);
  return target;
}
