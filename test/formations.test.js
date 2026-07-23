import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMATIONS, getFormationPositions, averageAttr } from '../lib/formations.js';
import {
  clampBall,
  stepBall,
  stepPlayer,
  goalProbability,
  resolveGoal,
} from '../lib/matchSim.js';

const proj = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('package scripts and public entry exist', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(proj, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'football-tactics-3d');
  assert.ok(pkg.scripts?.build, 'missing build');
  assert.ok(pkg.scripts?.test, 'missing test');
  assert.ok(fs.existsSync(path.join(proj, 'public/index.html')));
  assert.ok(fs.existsSync(path.join(proj, 'public/main.js')));
  assert.ok(fs.existsSync(path.join(proj, 'lib/formations.js')));
});

test('formations have 11 roles each', () => {
  for (const [name, f] of Object.entries(FORMATIONS)) {
    assert.equal(f.positions.length, 11, `${name} should have 11`);
  }
});

test('duplicate roles get distinct lateral slots', () => {
  const positions = FORMATIONS['4-3-3'].positions;
  const home = getFormationPositions(positions, -10, 'home');
  assert.equal(home.length, 11);

  const cbs = home.filter((_, i) => positions[i] === 'CB');
  assert.equal(cbs.length, 2);
  assert.notEqual(cbs[0].x, cbs[1].x, 'CBs should not stack');

  const cms = home.filter((_, i) => positions[i] === 'CM');
  assert.equal(cms.length, 3);
  const cmXs = new Set(cms.map((p) => p.x));
  assert.equal(cmXs.size, 3, 'CMs should spread');
});

test('away side mirrors along pitch length', () => {
  const roles = ['GK', 'ST'];
  const home = getFormationPositions(roles, -10, 'home');
  const away = getFormationPositions(roles, 10, 'away');
  assert.equal(home[0].z, -away[0].z);
  assert.ok(away[0].z < 0 || home[0].z > 0 || home[0].z === -away[0].z);
});

test('averageAttr and ball clamp', () => {
  assert.equal(averageAttr([], 'speed'), 0);
  assert.equal(averageAttr([{ speed: 80 }, { speed: 90 }], 'speed'), 85);
  const c = clampBall({ x: 100, z: -100 });
  assert.equal(c.x, 14);
  assert.equal(c.z, -21);
});

test('stepBall / stepPlayer stay finite', () => {
  const ball = stepBall({ x: 0, z: 0 }, [{ team: 'home', speed: 90 }], () => 0.5);
  assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.z));

  const next = stepPlayer(
    { x: 0, z: 0 },
    { x: 1, z: 1 },
    { x: 2, z: 2 },
    { speed: 80 },
    () => 0.5
  );
  assert.ok(Number.isFinite(next.x) && Number.isFinite(next.z));
});

test('goalProbability scales with shooting edge', () => {
  const weak = goalProbability({
    homeAttackers: [{ shooting: 70 }],
    awayAttackers: [],
    homeDefenders: [],
    awayDefenders: [{ defense: 90 }],
  });
  const strong = goalProbability({
    homeAttackers: [{ shooting: 95 }],
    awayAttackers: [],
    homeDefenders: [],
    awayDefenders: [{ defense: 60 }],
  });
  assert.ok(strong.chance > weak.chance);
  assert.ok(strong.chance <= 0.012);
});

test('resolveGoal respects chance and weights', () => {
  assert.equal(resolveGoal({ chance: 0, homeWeight: 1, awayWeight: 1 }, () => 0), null);
  assert.equal(
    resolveGoal({ chance: 1, homeWeight: 1, awayWeight: 0 }, () => 0.1),
    'home'
  );
  assert.equal(
    resolveGoal({ chance: 1, homeWeight: 0, awayWeight: 1 }, () => 0.1),
    'away'
  );
});
