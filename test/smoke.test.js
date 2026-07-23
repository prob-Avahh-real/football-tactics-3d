import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const proj = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('capacitor android present with www webDir', () => {
  const capPath = path.join(proj, 'capacitor.config.json');
  assert.ok(fs.existsSync(capPath), 'missing capacitor.config.json');
  const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
  assert.equal(cap.appId, 'com.skat.footballtactics3d');
  assert.equal(cap.webDir, 'www');
  assert.ok(fs.existsSync(path.join(proj, 'android')), 'missing android/');
});
