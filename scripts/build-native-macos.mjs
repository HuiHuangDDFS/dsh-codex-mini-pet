import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

if (process.platform !== 'darwin') throw new Error('Build this AppKit companion on macOS.');
await mkdir('work/macos', { recursive: true });
await mkdir('native/macos', { recursive: true });
for (const arch of ['arm64', 'x86_64']) {
  execFileSync('xcrun', ['swiftc', '-swift-version', '5', '-O', '-target', `${arch}-apple-macosx12.0`, 'native/PetWindow.swift', '-o', `work/macos/pet-${arch}`], { stdio: 'inherit' });
}
execFileSync('lipo', ['-create', 'work/macos/pet-arm64', 'work/macos/pet-x86_64', '-output', 'work/macos/pet-window'], { stdio: 'inherit' });
execFileSync('codesign', ['--force', '--sign', '-', 'work/macos/pet-window'], { stdio: 'inherit' });
execFileSync('codesign', ['--verify', '--strict', 'work/macos/pet-window'], { stdio: 'inherit' });
execFileSync('lipo', ['-info', 'work/macos/pet-window'], { stdio: 'inherit' });
await writeFile('native/macos/pet-window.gz', gzipSync(await readFile('work/macos/pet-window'), { level: 9 }));
