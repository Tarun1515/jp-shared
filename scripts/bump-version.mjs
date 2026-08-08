#!/usr/bin/env node
/*
  Bumps the patch version in package.json AND the JP_SHARED_VERSION constant in
  src/lib/version.ts, so the two can never disagree.

  They must not disagree, because the drift check compares the version an app
  INSTALLED (package.json) with the version it LOGS at bootstrap (the constant).
  If those two were maintained separately, the check would eventually report
  agreement between two numbers that were both wrong.
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(here, '..', 'package.json');
const versionPath = resolve(here, '..', 'src', 'lib', 'version.ts');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
const next = process.argv[2] ?? `${major}.${minor}.${patch + 1}`;

pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const source = readFileSync(versionPath, 'utf8');
writeFileSync(
  versionPath,
  source.replace(/export const JP_SHARED_VERSION = '[^']*';/, `export const JP_SHARED_VERSION = '${next}';`),
);

console.log(`@tarun1515/jp-shared ${next}`);
console.log('Now run `npm run sync:all` at the repo root, or the apps keep the old copy.');
