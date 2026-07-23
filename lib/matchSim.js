/** Match simulation helpers (pure, testable). */

import { averageAttr } from './formations.js';

const FIELD_HALF_X = 14;
const FIELD_HALF_Z = 21;

/**
 * Clamp ball into playable bounds.
 * @param {{ x: number, z: number }} ball
 */
export function clampBall(ball) {
  return {
    x: Math.max(-FIELD_HALF_X, Math.min(FIELD_HALF_X, ball.x)),
    z: Math.max(-FIELD_HALF_Z, Math.min(FIELD_HALF_Z, ball.z)),
  };
}

/**
 * One frame of ball drift, biased toward the stronger nearby attack.
 * @param {{ x: number, z: number }} ball
 * @param {{ speed?: number, team?: 'home'|'away' }[]} nearPlayers
 * @param {() => number} rng Math.random-like
 */
export function stepBall(ball, nearPlayers, rng = Math.random) {
  let dx = (rng() - 0.5) * 0.25;
  let dz = (rng() - 0.5) * 0.25;

  const homeNear = nearPlayers.filter((p) => p.team === 'home');
  const awayNear = nearPlayers.filter((p) => p.team === 'away');
  const homePush = averageAttr(homeNear, 'speed') / 400;
  const awayPush = averageAttr(awayNear, 'speed') / 400;
  // Home attacks toward +x (away goal); away toward -x
  dx += homePush - awayPush;

  return clampBall({ x: ball.x + dx, z: ball.z + dz });
}

/**
 * Move a player toward formation slot + optional chase toward ball.
 * @param {{ x: number, z: number }} pos current
 * @param {{ x: number, z: number }} slot formation home
 * @param {{ x: number, z: number }} ball
 * @param {{ speed?: number }} player
 * @param {() => number} rng
 */
export function stepPlayer(pos, slot, ball, player, rng = Math.random) {
  const speedFactor = ((player.speed || 75) / 100) * 0.12;
  const jitter = ((rng() - 0.5) * 0.4 * (player.speed || 75)) / 100;

  let x = slot.x + (pos.x - slot.x) * 0.85 + jitter;
  let z = slot.z + (pos.z - slot.z) * 0.85 + jitter;

  const dx = ball.x - x;
  const dz = ball.z - z;
  const dist = Math.hypot(dx, dz);
  if (dist < 6 && dist > 1.2) {
    x += (dx / dist) * speedFactor;
    z += (dz / dist) * speedFactor;
  }

  return { x, z };
}

/**
 * Per-frame goal probability from nearby shooters vs defenders.
 * Base is low; attrs scale it. Caps keep chaos bounded.
 *
 * @param {object} opts
 * @param {object[]} opts.homeAttackers near ball, home
 * @param {object[]} opts.awayAttackers near ball, away
 * @param {object[]} opts.homeDefenders near ball, home
 * @param {object[]} opts.awayDefenders near ball, away
 * @param {number} [opts.base=0.0004]
 */
export function goalProbability({
  homeAttackers,
  awayAttackers,
  homeDefenders,
  awayDefenders,
  base = 0.0004,
}) {
  const homeShot = averageAttr(homeAttackers, 'shooting');
  const awayShot = averageAttr(awayAttackers, 'shooting');
  const homeDef = averageAttr(homeDefenders, 'defense') || 70;
  const awayDef = averageAttr(awayDefenders, 'defense') || 70;

  const homeEdge = Math.max(0, homeShot - awayDef * 0.85) / 100;
  const awayEdge = Math.max(0, awayShot - homeDef * 0.85) / 100;
  const total = base * (1 + homeEdge * 3 + awayEdge * 3);

  return {
    chance: Math.min(0.012, total),
    homeWeight: 0.35 + homeEdge,
    awayWeight: 0.35 + awayEdge,
  };
}

/**
 * Resolve which side scores given weights; null if no goal.
 * @param {{ chance: number, homeWeight: number, awayWeight: number }} p
 * @param {() => number} rng
 * @returns {'home'|'away'|null}
 */
export function resolveGoal(p, rng = Math.random) {
  if (rng() >= p.chance) return null;
  const sum = p.homeWeight + p.awayWeight;
  if (sum <= 0) return rng() > 0.5 ? 'home' : 'away';
  return rng() < p.homeWeight / sum ? 'home' : 'away';
}

export { FIELD_HALF_X, FIELD_HALF_Z };
