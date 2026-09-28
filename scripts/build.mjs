#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

var ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
var DIST = join(ROOT, 'dist');
var CORE_ONLY = process.argv.indexOf('--core') >= 0;
var REQUIRE_ACCEL = process.argv.indexOf('--require-accel') >= 0;
var TYPESCRIPT = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
var ESTC = join(ROOT, '..', 'extendscript-toolchain', 'bin', 'estc.mjs');
var ESB64_RUNTIME = join(ROOT, '..', 'esb64', 'dist', 'vendor-esb64-runtime.js');
var ESB64_ACCEL = join(ROOT, '..', 'esb64', 'native', 'bin', 'ESB64Native.dll');

var ACCELERATOR = [
  '',
  '(function () {',
  '  if (typeof ESPAK !== "object" || !ESPAK || typeof ESPAK.load !== "function") return;',
  '  if (typeof ESFS !== "object" || !ESFS || typeof ESFS.enableNativeGate !== "function") return;',
  '  function useEspack() {',
  '    var loaded = ESPAK.load("ESFSNative");',
  '    if (!loaded.ok || loaded.mode !== "native" || !loaded.lib) {',
  '      return { ok: false, reason: (loaded && loaded.error) || "ESPAK load failed" };',
  '    }',
  '    var status;',
  '    try {',
  '      status = ESFS.enableNativeGate({',
  '        lib: loaded.lib,',
  '        dllPath: loaded.path,',
  '        owned: false,',
  '        source: "espack"',
  '      });',
  '    } catch (gateError) {',
  '      return { ok: false, reason: String(gateError), path: loaded.path };',
  '    }',
  '    return { ok: true, path: loaded.path, status: status };',
  '  }',
  '  ESFS.useEspack = useEspack;',
  '  ESFS.espack = useEspack();',
  '  var g = null;',
  '  try { if (typeof $ !== "undefined" && $.global) g = $.global; } catch (ignoreGlobal) {}',
  '  if (g) { g.ESFS = ESFS; g.ESPAK = ESPAK; }',
  '}());',
  ''
].join('\n');

mkdirSync(DIST, { recursive: true });

await build({
  entryPoints: [join(ROOT, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2019',
  outfile: join(DIST, 'esfs-core.esm.mjs'),
  logLevel: 'warning'
});

if (!CORE_ONLY) {
  execFileSync(process.execPath, [TYPESCRIPT, '--project', join(ROOT, 'tsconfig.types.json')], {
    cwd: ROOT,
    stdio: 'inherit'
  });
  execFileSync(process.execPath, [ESTC, 'build', '--config', './extendscript.estc.config.mjs'], {
    cwd: ROOT,
    stdio: 'inherit'
  });
}

function accelSkip(reason) {
  if (REQUIRE_ACCEL) throw new Error('[esfs-build] accelerator required: ' + reason);
  console.log('[esfs-build] accel skipped: ' + reason);
}

function estcCheck(file) {
  execFileSync(process.execPath, [ESTC, 'check', file, '--no-target'], {
    cwd: ROOT,
    stdio: 'inherit'
  });
}

function minifyAccel(accelOut) {
  var skillDir = join(ROOT, '..', 'agent-skills', 'adobe-extendscript-minification');
  var minifyScript = join(skillDir, 'scripts', 'minify-jsx.py');
  var minifyConfig = join(skillDir, 'configs', 'conservative.json');
  if (!existsSync(minifyScript) || !existsSync(minifyConfig)) {
    if (REQUIRE_ACCEL) throw new Error('[esfs-build] minification skill is required for accelerator release');
    console.log('[esfs-build] accel minify skipped: minification skill unavailable');
    return;
  }
  var bannerMatch = accelOut.match(/^\/\*[\s\S]*?\*\//);
  var banner = bannerMatch ? bannerMatch[0] : '';
  var body = bannerMatch ? accelOut.substring(banner.length) : accelOut;
  var bodyPath = join(DIST, '.esfs-accel-bundle.body.jsx');
  var minPath = join(DIST, '.esfs-accel-bundle.min.jsx');
  writeFileSync(bodyPath, body, 'utf8');
  execFileSync('python', [minifyScript, '--in', bodyPath, '--config', minifyConfig, '--out', minPath], {
    cwd: ROOT,
    stdio: 'inherit'
  });
  var minBody = readFileSync(minPath, 'utf8');
  var minOut = (banner ? banner + '\n' : '') + minBody;
  writeFileSync(join(DIST, 'ESFS.accel.min.jsx'), minOut, 'utf8');
  estcCheck('dist/ESFS.accel.min.jsx');
}

function buildAccel() {
  var espackBuild = join(ROOT, '..', 'espack', 'espack-build.mjs');
  var payloadDll = join(DIST, 'native', 'release', 'ESFSNative.dll');
  if (!existsSync(espackBuild)) return accelSkip('sibling espack build tool is unavailable');
  if (!existsSync(payloadDll)) return accelSkip('native release DLL missing; run npm run native:build');
  if (!existsSync(ESB64_RUNTIME)) return accelSkip('current ESB64 runtime missing; build ../esb64 first');
  if (!existsSync(ESB64_ACCEL)) return accelSkip('current ESB64Native accelerator missing; build ../esb64 native first');

  var loaderOut = join(DIST, '.esfs-accel-bundle.jsx');
  var manifestOut = join(DIST, 'ESFS.manifest.json');
  execFileSync(process.execPath, [
    espackBuild,
    '--embed', payloadDll,
    '--out', loaderOut,
    '--name', 'esfs',
    '--manifest-out', manifestOut,
    '--accel', ESB64_ACCEL,
    '--accel-version', '2',
    '--quiet'
  ], {
    cwd: ROOT,
    stdio: 'inherit',
    env: Object.assign({}, process.env, { ESB64_RUNTIME_PATH: ESB64_RUNTIME })
  });

  var loaderText = readFileSync(loaderOut, 'utf8');
  var facadeText = readFileSync(join(DIST, 'ESFS.jsx'), 'utf8');
  var facadeOut = facadeText + '\n' + ACCELERATOR +
    '// ESFS.facade.jsx - loader-free facade + ESPACK adapter; requires ESPAK on $.global\n';
  var accelOut = loaderText + '\n' + facadeText + '\n' + ACCELERATOR +
    '// ESFS.accel.jsx - self-extracting ESPACK bundle + ESFSNative gate\n';
  writeFileSync(join(DIST, 'ESFS.facade.jsx'), facadeOut, 'utf8');
  writeFileSync(join(DIST, 'ESFS.accel.jsx'), accelOut, 'utf8');
  estcCheck('dist/ESFS.facade.jsx');
  estcCheck('dist/ESFS.accel.jsx');
  minifyAccel(accelOut);
  console.log('[esfs-build] wrote ESPACK accelerator, facade, manifest, and minified accelerator');
}

if (!CORE_ONLY && process.argv.indexOf('--accel') >= 0) buildAccel();

console.log('[esfs-build] wrote dist/esfs-core.esm.mjs' + (CORE_ONLY ? '' : ', dist/types, and dist/ESFS.jsx'));
