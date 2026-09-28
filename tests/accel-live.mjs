#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createComToolRunner } from '../../extendscript-toolchain/src/comtool-compat.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const arg = process.argv.indexOf('--bundle');
const BUNDLE = arg >= 0 && process.argv[arg + 1] ? resolve(process.argv[arg + 1]) : join(ROOT, 'dist', 'ESFS.accel.jsx');
if (!existsSync(BUNDLE)) throw new Error('accelerator bundle missing: ' + BUNDLE);
const PROBE = join(ROOT, 'tests', '.esfs-accel-live.jsx');
const bundlePath = BUNDLE.replace(/\\/g, '/').replace(/"/g, '\\"');

writeFileSync(PROBE, [
  '#target illustrator',
  '(function () {',
  '  $.global["ESFS"] = null;',
  '  $.global["ESPAK"] = null;',
  '  $.evalFile(File("' + bundlePath + '"));',
  '  var F = $.global["ESFS"];',
  '  var P = $.global["ESPAK"];',
  '  var out = { ok: false, checks: [] };',
  '  var root = null, source = null, nativeTarget = null, adobeTarget = null;',
  '  function check(name, value) { out.checks.push({ name: name, ok: value === true }); if (value !== true) throw new Error(name); }',
  '  try {',
  '    check("globals", !!F && !!P);',
  '    check("payload", P.config.payloads.length === 1 && P.config.payloads[0].name === "ESFSNative");',
  '    check("shared accel", P.config.accel && P.config.accel.name === "ESB64Native" && P.config.accel.version === "2");',
  '    check("auto espack", F.espack && F.espack.ok === true);',
  '    var s = F["native"].status();',
  '    check("adopted", s.loaded === true && s.source === "espack" && s.owned === false && s.abiRevision === 1);',
  '    root = new Folder(Folder.temp.fsName + "/esfs-accel-" + (new Date()).getTime());',
  '    check("mkdir", root.create() === true);',
  '    source = new File(root.fsName + "/source.bin"); nativeTarget = new File(root.fsName + "/native.bin"); adobeTarget = new File(root.fsName + "/adobe.bin");',
  '    F.writeBinary(source, String.fromCharCode(0, 1, 127, 128, 255));',
  '    F["native"].copyFile(source, nativeTarget);',
  '    F.copyFile(source, adobeTarget);',
  '    check("native bytes", F.readBinary(new File(nativeTarget.fsName)) === F.readBinary(source));',
  '    check("default bytes", F.readBinary(new File(adobeTarget.fsName)) === F.readBinary(source));',
  '    var before = P.load("ESFSNative");',
  '    check("detach", F["native"].unload() === true && F["native"].status().loaded === false);',
  '    var after = P.load("ESFSNative");',
  '    check("espak owns lib", before.ok && after.ok && before.lib === after.lib);',
  '    check("readopt", F.useEspack().ok === true && F["native"].status().source === "espack");',
  '    out.mode = P.mode(); out.status = F["native"].status(); out.ok = true;',
  '  } catch (error) { out.error = String(error); }',
  '  try { if (F && F["native"]) F["native"].unload(); } catch (ignoreUnload) {}',
  '  try { if (nativeTarget && nativeTarget.exists) nativeTarget.remove(); } catch (ignoreNative) {}',
  '  try { if (adobeTarget && adobeTarget.exists) adobeTarget.remove(); } catch (ignoreAdobe) {}',
  '  try { if (source && source.exists) source.remove(); } catch (ignoreSource) {}',
  '  try { if (root && root.exists) root.remove(); } catch (ignoreRoot) {}',
  '  return out.toSource();',
  '}());'
].join('\n'), 'utf8');

const COM = createComToolRunner();
try {
  const result = await COM.run(['eval', '--file', PROBE], { timeoutMs: 180000 });
  if (!result.ok) throw new Error(JSON.stringify(result.error || result));
  const text = String(result.result);
  assert.match(text, /ok:true/);
  assert.doesNotMatch(text, /ok:false/);
  console.log('[esfs-accel-live] PASS ' + BUNDLE + ' ' + text);
} finally {
  await COM.close().catch(() => {});
  rmSync(PROBE, { force: true });
}