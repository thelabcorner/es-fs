#!/usr/bin/env node
import { resolve } from 'node:path';
import { createComToolRunner } from '../../extendscript-toolchain/src/comtool-compat.mjs';

const COM = createComToolRunner();
try {
  const result = await COM.run(['eval', '--file', resolve('tests/native-probe.jsx')], { timeoutMs: 120000 });
  if (!result.ok) throw new Error(JSON.stringify(result.error || result));
  console.log('[esfs-native-live] PASS ' + String(result.result));
} catch (error) {
  console.error('[esfs-native-live] FAIL ' + String(error && error.message ? error.message : error));
  process.exitCode = 1;
} finally {
  await COM.close().catch(() => {});
}
