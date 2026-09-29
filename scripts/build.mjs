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
var ESB64_ACCEL = join(ROOT, '..', 'esb64', 'native', 'bin', 'ESB64Native.dll');

var ACCELERATOR = [
  '',
  '(function () {',
  '  var g = null;',
  '  try { if (typeof $ !== "undefined" && $.global) g = $.global; } catch (ignoreGlobal) {}',
  '  var P = g && g.ESPAK;',
  '  if (typeof P !== "object" || !P || typeof P.load !== "function") return;',
  '  if (typeof ESFS !== "object" || !ESFS || typeof ESFS.enableNativeGate !== "function") return;',
  '  function useEspack() {',
  '    var loaded = P.load("ESFSNative");',
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
  '  if (g) g.ESFS = ESFS;',
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

async function buildAccel() {
  var espackBuild = join(ROOT, '..', 'espack', 'espack-build.mjs');
  var payloadDll = join(DIST, 'native', 'release', 'ESFSNative.dll');
  if (!existsSync(espackBuild)) return accelSkip('sibling espack build tool is unavailable');
  if (!existsSync(payloadDll)) return accelSkip('native release DLL missing; run npm run native:build');
  if (!existsSync(ESB64_ACCEL)) return accelSkip('current ESB64Native accelerator missing; build ../esb64 native first');
  var esb64ManifestPath = join(ROOT, '..', 'esb64', 'dist', 'ESB64.manifest.json');
  if (!existsSync(esb64ManifestPath)) return accelSkip('current ESB64 v2 manifest missing; build ../esb64 first');

  var loaderOut = join(DIST, '.esfs-accel-bundle.jsx');
  var manifestOut = join(DIST, 'ESFS.manifest.json');
  var facadeText = readFileSync(join(DIST, 'ESFS.jsx'), 'utf8');
  var facadeOut = facadeText + '\n' + ACCELERATOR +
    '// ESFS.facade.jsx - loader-free facade + ESPACK adapter; requires ESPAK on $.global\n';
  writeFileSync(join(DIST, 'ESFS.facade.jsx'), facadeOut, 'utf8');
  var esb64Manifest = JSON.parse(readFileSync(esb64ManifestPath, 'utf8'));
  var packageInfo = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  var esb64Package = JSON.parse(readFileSync(join(ROOT, '..', 'esb64', 'package.json'), 'utf8'));
  var espackBuildApi = await import(new URL('../../espack/espack-build.mjs', import.meta.url).href);
  var espackMergeApi = await import(new URL('../../espack/espack-merge.mjs', import.meta.url).href);
  var espackLibraries = await import(new URL('../../espack/espack-libraries.mjs', import.meta.url).href);
  var payloadBytes = readFileSync(payloadDll);
  var accelBytes = readFileSync(ESB64_ACCEL);
  var library = espackLibraries.libraryFromFile({
    id: 'esfs', version: packageInfo.version, global: 'ESFS', path: join(DIST, 'ESFS.facade.jsx'),
    requires: [{ id: 'esb64', range: '^' + esb64Package.version }],
    contract: [{ name: 'readText', type: 'function' }, { name: 'writeText', type: 'function' },
      { name: 'readBinary', type: 'function' }, { name: 'writeBinary', type: 'function' }],
    provenance: { package: packageInfo.name, repository: packageInfo.repository && packageInfo.repository.url,
      commit: gitHead(), artifact: 'dist/ESFS.facade.jsx' }
  });
  var ownManifest = espackBuildApi.makeManifest({
    bundleName: 'esfs', cacheDir: '',
    payloads: [{ name: 'ESFSNative', version: '1', len: payloadBytes.length,
      b64: payloadBytes.toString('base64'), fileName: 'ESFSNative_v1.dll' }],
    accel: { name: 'ESB64Native', version: '2', len: accelBytes.length,
      b64: accelBytes.toString('base64'), fileName: 'ESB64Native_v2.dll' },
    libraries: [library], entries: [{ id: 'esfs', range: '=' + packageInfo.version }],
    capabilities: [{ id: 'esfs.native', provider: 'esfs', mode: 'required', payloads: ['ESFSNative'], accel: null }]
  });
  var composed = espackMergeApi.merge({ manifests: [esb64Manifest, ownManifest], out: loaderOut,
    manifestOut: manifestOut, name: 'esfs', entries: [{ id: 'esfs', range: '=' + packageInfo.version }], deferB64: true });
  var accelOut = composed.text + '\n// ESFS.accel.jsx - ESPACK v2 flattened ESB64 -> ESFS composition with one loader/control plane\n';
  writeFileSync(join(DIST, 'ESFS.facade.jsx'), facadeOut, 'utf8');
  writeFileSync(join(DIST, 'ESFS.accel.jsx'), accelOut, 'utf8');
  estcCheck('dist/ESFS.facade.jsx');
  estcCheck('dist/ESFS.accel.jsx');
  minifyAccel(accelOut);
  console.log('[esfs-build] wrote ESPACK accelerator, facade, manifest, and minified accelerator');
}

function gitHead() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch (ignore) { return ''; }
}

if (!CORE_ONLY && process.argv.indexOf('--accel') >= 0) await buildAccel();

console.log('[esfs-build] wrote dist/esfs-core.esm.mjs' + (CORE_ONLY ? '' : ', dist/types, and dist/ESFS.jsx'));
