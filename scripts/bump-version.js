#!/usr/bin/env node
/**
 * HeshRadio Version Bumping Utility
 *
 * Rules:
 * - Starts at: v0.00.1
 * - Max: v9.99.9
 * - Rollover: No number reaches 10 (patch 0..9, minor 00..99, major 0..9)
 *
 * Usage:
 *   node scripts/bump-version.js [patch|minor|major]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const versionFile = path.join(rootDir, 'VERSION');
const tsVersionFile = path.join(rootDir, 'src', 'version.ts');
const packageJsonFile = path.join(rootDir, 'package.json');
const tauriConfFile = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const cargoTomlFile = path.join(rootDir, 'src-tauri', 'Cargo.toml');

function parseVersion(vStr) {
  const clean = vStr.trim().replace(/^v/i, '');
  const [maj, min, pat] = clean.split('.').map(n => parseInt(n, 10));
  return { major: maj, minor: min, patch: pat };
}

function formatVersion({ major, minor, patch }) {
  const minPad = minor.toString().padStart(2, '0');
  return `v${major}.${minPad}.${patch}`;
}

function increment(current, type) {
  let { major, minor, patch } = parseVersion(current);

  if (type === 'major') {
    major = Math.min(9, major + 1);
    minor = 0;
    patch = 0;
  } else if (type === 'minor') {
    if (minor < 99) {
      minor += 1;
      patch = 0;
    } else {
      major = Math.min(9, major + 1);
      minor = 0;
      patch = 0;
    }
  } else {
    // Default: patch
    if (patch < 9) {
      patch += 1;
    } else {
      patch = 0;
      if (minor < 99) {
        minor += 1;
      } else {
        minor = 0;
        major = Math.min(9, major + 1);
      }
    }
  }

  return formatVersion({ major, minor, patch });
}

const action = process.argv[2] || 'patch';
const currentVersion = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8').trim() : 'v0.00.1';
const nextVersion = increment(currentVersion, action);

console.log(`Bumping HeshRadio version [${action}]: ${currentVersion} -> ${nextVersion}`);

// 1. Update VERSION file
fs.writeFileSync(versionFile, `${nextVersion}\n`);

// 2. Update src/version.ts
if (fs.existsSync(tsVersionFile)) {
  let content = fs.readFileSync(tsVersionFile, 'utf8');
  content = content.replace(/export const CURRENT_VERSION = '.*?';/, `export const CURRENT_VERSION = '${nextVersion}';`);
  fs.writeFileSync(tsVersionFile, content);
}

// 3. Update package.json
if (fs.existsSync(packageJsonFile)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
  const semverNumber = nextVersion.replace(/^v/, '');
  pkg.version = semverNumber;
  fs.writeFileSync(packageJsonFile, JSON.stringify(pkg, null, 2) + '\n');
}

// 4. Update tauri.conf.json
if (fs.existsSync(tauriConfFile)) {
  const tauri = JSON.parse(fs.readFileSync(tauriConfFile, 'utf8'));
  tauri.version = nextVersion.replace(/^v/, '');
  fs.writeFileSync(tauriConfFile, JSON.stringify(tauri, null, 2) + '\n');
}

// 5. Update Cargo.toml
if (fs.existsSync(cargoTomlFile)) {
  let cargo = fs.readFileSync(cargoTomlFile, 'utf8');
  cargo = cargo.replace(/version = ".*?"/, `version = "${nextVersion.replace(/^v/, '')}"`);
  fs.writeFileSync(cargoTomlFile, cargo);
}

console.log(`Successfully updated all version manifests to ${nextVersion}!`);
