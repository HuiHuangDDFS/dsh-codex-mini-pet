import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const info = JSON.parse(await readFile('native/macos/build.json', 'utf8'));
const binary = gunzipSync(await readFile('native/macos/pet-window.gz'));
assert.equal(info.sourceSha256, sha(await readFile('native/PetWindow.swift')), 'Rebuild the macOS helper after changing its Swift source.');
assert.equal(info.executableSha256, sha(binary), 'macOS helper does not match its build metadata.');
assert.equal(binary.readUInt32BE(0), 0xcafebabe, 'Expected a universal Mach-O executable.');
assert.equal(binary.readUInt32BE(4), 2);
assert.deepEqual([binary.readUInt32BE(8), binary.readUInt32BE(28)].sort(), [0x01000007, 0x0100000c].sort(), 'Both Intel and Apple silicon must be included.');
console.log('macOS bundle matches its source and contains Intel + Apple silicon code.');
