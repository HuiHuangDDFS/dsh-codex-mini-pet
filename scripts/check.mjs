import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for (const dir of ['src', 'scripts', 'tests']) {
  for (const file of await readdir(dir)) if (file.endsWith('.mjs')) {
    const check = spawnSync(process.execPath, ['--check', `${dir}/${file}`], { encoding: 'utf8' });
    if (check.status !== 0) { console.error(check.stderr); process.exitCode = 1; }
  }
}
