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
  isOffside,
  classifyOutOfBounds,
  setPieceBallPosition,
  validateGoalSide,
  ROLE_DUTY,
  FIELD_HALF_X,
  FIELD_HALF_Z,
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

test('away side mirrors along pitch length with independent offset', () => {
  const roles = FORMATIONS['4-4-2'].positions;
  const home = getFormationPositions(roles, -10, 'home');
  const away = getFormationPositions(roles, 10, 'away');
  assert.equal(home.length, away.length);
  assert.equal(home[0].z, -away[0].z);
  assert.ok(away[0].x > 0);
  assert.ok(home[0].x < 0);
});

test('averageAttr and ball clamp', () => {
  assert.equal(averageAttr([], 'speed'), 0);
  assert.equal(averageAttr([{ speed: 80 }, { speed: 90 }], 'speed'), 85);
  const c = clampBall({ x: 100, z: -100 });
  assert.equal(c.x, FIELD_HALF_X);
  assert.equal(c.z, -FIELD_HALF_Z);
});

test('role duties exist and ST presses more than GK', () => {
  assert.ok(ROLE_DUTY.ST.press > ROLE_DUTY.GK.press);
  assert.ok(ROLE_DUTY.GK.slotPull > ROLE_DUTY.ST.slotPull);
});

test('stepPlayer is role-driven not pure jitter', () => {
  const slot = { x: -10, z: 14 };
  const ball = { x: 5, z: 0 };
  const gk = stepPlayer({ x: -10, z: 14 }, slot, ball, { speed: 80, team: 'home' }, 'GK');
  const st = stepPlayer({ x: -8, z: 2 }, { x: -8, z: 2 }, ball, { speed: 90, team: 'home' }, 'ST');
  // GK stays near defensive slot; ST moves toward ball more
  assert.ok(Math.hypot(gk.x - slot.x, gk.z - slot.z) < 1.5);
  assert.ok(st.x > -8 || Math.hypot(st.x - ball.x, st.z - ball.z) < Math.hypot(-8 - ball.x, 2 - ball.z));
});

test('stepBall uses carrier passing/speed (finite)', () => {
  const near = [
    { team: 'home', x: 0.5, z: 0, speed: 90, passing: 95, shooting: 80, position: 'CM' },
    { team: 'home', x: 4, z: 1, speed: 80, passing: 85, shooting: 70, position: 'ST' },
  ];
  const ball = stepBall({ x: 0, z: 0 }, near, () => 0.2);
  assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.z));
});

test('goalProbability scales with shooting edge', () => {
  const weak = goalProbability({
    homeAttackers: [{ shooting: 70, passing: 70 }],
    awayAttackers: [],
    homeDefenders: [],
    awayDefenders: [{ defense: 90 }],
  });
  const strong = goalProbability({
    homeAttackers: [{ shooting: 95, passing: 90 }],
    awayAttackers: [],
    homeDefenders: [],
    awayDefenders: [{ defense: 60 }],
  });
  assert.ok(strong.chance > weak.chance);
  assert.ok(strong.chance <= 0.01);
});

test('resolveGoal respects chance and weights', () => {
  assert.equal(resolveGoal({ chance: 0, homeWeight: 1, awayWeight: 1 }, () => 0), null);
  assert.equal(
    resolveGoal({ chance: 1, homeWeight: 1, awayWeight: 0 }, () => 0.1),
    'home'
  );
});

test('isOffside detects attacker beyond second-last defender', () => {
  const attacker = { team: 'home', x: 10, z: 0 };
  const opponents = [
    { team: 'away', x: 12, z: 0 }, // GK
    { team: 'away', x: 8, z: 1 }, // last outfield
    { team: 'away', x: 6, z: -1 },
  ];
  const ball = { x: 7, z: 0 };
  assert.equal(isOffside(attacker, opponents, ball), true);

  const onside = { team: 'home', x: 7, z: 0 };
  assert.equal(isOffside(onside, opponents, ball), false);
});

test('validateGoalSide rejects offside finish', () => {
  const ball = { x: 9, z: 0 };
  const near = [
    { team: 'home', x: 11, z: 0, position: 'ST' },
    { team: 'away', x: 13, z: 0, position: 'GK' },
    { team: 'away', x: 8, z: 0, position: 'CB' },
  ];
  assert.equal(validateGoalSide('home', near, ball), false);
});

test('classifyOutOfBounds throw-in and corner', () => {
  const throwIn = classifyOutOfBounds({ x: 0, z: 20 }, { x: 1, z: FIELD_HALF_Z + 1 });
  assert.equal(throwIn.kind, 'throw_in');

  const corner = classifyOutOfBounds({ x: 13, z: 10 }, { x: FIELD_HALF_X + 1, z: 10 });
  assert.equal(corner.kind, 'corner');
  assert.equal(corner.restartTeam, 'home');

  const pos = setPieceBallPosition(corner);
  assert.ok(pos.x > 10);
});
