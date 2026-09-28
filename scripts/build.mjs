#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

var ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
var DIST = join(ROOT, 'dist');
var CORE_ONLY = process.argv.indexOf('--core') >= 0;
var TYPESCRIPT = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
var ESTC = join(ROOT, '..', 'extendscript-toolchain', 'bin', 'estc.mjs');

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

console.log('[esfs-build] wrote dist/esfs-core.esm.mjs' + (CORE_ONLY ? '' : ', dist/types, and dist/ESFS.jsx'));
