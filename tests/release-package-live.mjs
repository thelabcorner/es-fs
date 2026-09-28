#!/usr/bin/env node
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createComToolRunner } from '../../extendscript-toolchain/src/comtool-compat.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const stage = mkdtempSync(join(tmpdir(), 'esfs-release-live-'));
const nativeDir = join(stage, 'native', 'release');
mkdirSync(nativeDir, { recursive: true });
copyFileSync(join(ROOT, 'dist', 'ESFS.jsx'), join(stage, 'ESFS.jsx'));
copyFileSync(join(ROOT, 'dist', 'native', 'release', 'ESFSNative.dll'), join(nativeDir, 'ESFSNative.dll'));

const jsx = join(stage, 'ESFS.jsx').replace(/\\/g, '/');
const probe = join(stage, 'probe.jsx');
writeFileSync(probe, [
  '#target illustrator',
  '(function () {',
  '  var bundlePath = ' + JSON.stringify(jsx) + ';',
  '  $.evalFile(File(bundlePath));',
  '  var releaseLoaded = ESFS["native"].load();',
  '  var releaseStatus = ESFS["native"].status();',
  '  var releaseExists = ESFS["native"].fileExists(new File(bundlePath));',
  '  var ok = releaseLoaded && releaseStatus.abiRevision === 1 && releaseExists === true;',
  '  ESFS["native"].unload();',
  '  return ({ok:ok,status:releaseStatus}).toSource();',
  '}());'
].join('\n'), 'utf8');

const COM = createComToolRunner();
try {
  const result = await COM.run(['eval', '--file', probe], { timeoutMs: 120000 });
  if (!result.ok) throw new Error(JSON.stringify(result.error || result));
  const text = String(result.result);
  assert.match(text, /ok:true/);
  assert.match(text, /abiRevision:1/);
  assert.match(text, /native\\\\release\\\\ESFSNative\.dll|native\/release\/ESFSNative\.dll/);
  console.log('[esfs-release-package-live] PASS ' + text);
} finally {
  await COM.close().catch(() => {});
  try {
    rmSync(stage, { recursive: true, force: true });
  } catch (error) {
    if (!error || error.code !== 'EPERM') throw error;
    console.log('[esfs-release-package-live] cleanup deferred: Illustrator still holds the unloaded DLL mapping at ' + stage);
  }
}
