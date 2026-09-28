#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(ROOT, 'dist', 'ESFS.manifest.json'), 'utf8'));
const payload = manifest.payloads.find((item) => item.name === 'ESFSNative');
const payloadBytes = readFileSync(join(ROOT, 'dist', 'native', 'release', 'ESFSNative.dll'));
const accelBytes = readFileSync(join(ROOT, '..', 'esb64', 'native', 'bin', 'ESB64Native.dll'));
const runtimeText = readFileSync(join(ROOT, '..', 'esb64', 'dist', 'vendor-esb64-runtime.js'), 'utf8');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

assert.equal(manifest.format, 'espack-manifest');
assert.equal(manifest.version, 1);
assert.equal(manifest.bundleName, 'esfs');
assert.equal(manifest.payloads.length, 1);
assert.equal(manifest.accel.name, 'ESB64Native');
assert.equal(manifest.accel.version, '2');
assert.equal(manifest.accel.len, accelBytes.length);
assert.deepEqual(Buffer.from(manifest.accel.b64, 'base64'), accelBytes);
assert.ok(payload, 'ESFSNative payload missing');
assert.equal(payload.version, '1');
assert.equal(payload.fileName, 'ESFSNative_v1.dll');
assert.equal(payload.len, payloadBytes.length);
assert.deepEqual(Buffer.from(payload.b64, 'base64'), payloadBytes);

const facade = readFileSync(join(ROOT, 'dist', 'ESFS.facade.jsx'), 'utf8');
const accel = readFileSync(join(ROOT, 'dist', 'ESFS.accel.jsx'), 'utf8');
const min = readFileSync(join(ROOT, 'dist', 'ESFS.accel.min.jsx'), 'utf8');
assert.match(facade, /ESPAK\.load\("ESFSNative"\)/);
assert.match(accel, /ESFSNative_v1\.dll/);
assert.match(accel, /ESB64Native_v2\.dll/);
assert.ok(accel.includes(runtimeText), 'accelerator must inline the current sibling ESB64 runtime byte-for-byte');
assert.ok(min.length > 0);

for (const artifact of [
  'dist/ESFS.facade.jsx',
  'dist/ESFS.accel.jsx',
  'dist/ESFS.accel.min.jsx',
  'dist/ESFS.manifest.json'
]) {
  assert.ok(pkg.files.includes(artifact), 'npm package whitelist missing ' + artifact);
}
const packagedDlls = pkg.files.filter((item) => /^dist\/native\/.*\.dll$/i.test(item));
assert.deepEqual(packagedDlls, ['dist/native/release/ESFSNative.dll']);

console.log('[esfs-accel-contract] PASS payload=' + payloadBytes.length + ' accel=' + accelBytes.length +
  ' bundle=' + Buffer.byteLength(accel) + ' min=' + Buffer.byteLength(min));
