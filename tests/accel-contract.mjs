#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(ROOT, 'dist', 'ESFS.manifest.json'), 'utf8'));
const payload = manifest.payloads.find((item) => item.name === 'ESFSNative');
const payloadBytes = readFileSync(join(ROOT, 'dist', 'native', 'release', 'ESFSNative.dll'));
const accelBytes = readFileSync(join(ROOT, '..', 'esb64', 'native', 'bin', 'ESB64Native.dll'));
const esb64FacadeBytes = readFileSync(join(ROOT, '..', 'esb64', 'dist', 'ESB64.facade.jsx'));
const esfsFacadeBytes = readFileSync(join(ROOT, 'dist', 'ESFS.facade.jsx'));
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const esb64Pkg = JSON.parse(readFileSync(join(ROOT, '..', 'esb64', 'package.json'), 'utf8'));

assert.equal(manifest.format, 'espack-manifest');
assert.equal(manifest.version, 2);
assert.equal(manifest.bundleName, 'esfs');
assert.deepEqual(manifest.libraries.map((library) => library.id), ['esb64', 'esfs']);
assert.deepEqual(manifest.entries, [{ id: 'esfs', range: '=' + pkg.version }]);
assert.equal(manifest.libraries[0].version, esb64Pkg.version);
assert.equal(manifest.libraries[1].version, pkg.version);
assert.deepEqual(manifest.libraries[1].requires, [{ id: 'esb64', range: '^' + esb64Pkg.version, optional: false }]);
for (const [library, bytes] of [[manifest.libraries[0], esb64FacadeBytes], [manifest.libraries[1], esfsFacadeBytes]]) {
  const artifact = Buffer.from(library.artifact.b64, 'base64');
  assert.equal(library.artifact.encoding, 'utf8-base64');
  assert.equal(library.artifact.len, bytes.length);
  assert.equal(library.artifact.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(artifact, bytes, library.id + ' facade provenance must be byte exact');
}
assert.deepEqual(manifest.capabilities, [
  { id: 'esb64.native', provider: 'esb64', mode: 'optional', payloads: [], accel: 'ESB64Native' },
  { id: 'esfs.native', provider: 'esfs', mode: 'required', payloads: ['ESFSNative'], accel: null }
]);
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
assert.match(facade, /P\.load\("ESFSNative"\)/);
assert.match(accel, /ESFSNative_v1\.dll/);
assert.match(accel, /ESB64Native_v2\.dll/);
assert.equal((accel.match(/var ESPACK =/g) || []).length, 1, 'composition must contain one loader/control plane');
assert.doesNotMatch(accel, /vendor-esb64-runtime|self-extracting ESPACK bundle \+ ESFSNative/);
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
