#!/usr/bin/env node
/**
 * HeshRadio test runner.
 *
 * Bundles tests/regression.test.ts with esbuild (the bundler Vite already
 * ships) so `node --test` can execute the TypeScript sources, which use
 * extensionless relative imports that Node cannot resolve natively.
 * Bundle output stays in node_modules/.cache and is never committed.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'node_modules', '.cache', 'heshradio-tests');
const outFile = path.join(outDir, 'regression.test.mjs');

mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'tests', 'regression.test.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: 'inline',
  outfile: outFile,
  logLevel: 'warning',
});

const result = spawnSync(process.execPath, ['--test', outFile], { stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);
