/** Match simulation helpers (pure, testable). */

import { averageAttr } from './formations.js';

export const FIELD_HALF_X = 14;
export const FIELD_HALF_Z = 21;
export const GOAL_MOUTH_Z = 3.5;

/** Role duty: how tightly to hold slot vs chase ball / push attack. */
export const ROLE_DUTY = {
  GK: { chaseRadius: 2.5, slotPull: 0.96, press: 0.05, support: 0.1 },
  CB: { chaseRadius: 5, slotPull: 0.9, press: 0.15, support: 0.2 },
  LB: { chaseRadius: 6.5, slotPull: 0.82, press: 0.25, support: 0.35 },
  RB: { chaseRadius: 6.5, slotPull: 0.82, press: 0.25, support: 0.35 },
  CDM: { chaseRadius: 6, slotPull: 0.84, press: 0.3, support: 0.4 },
  CM: { chaseRadius: 7.5, slotPull: 0.7, press: 0.45, support: 0.55 },
  CAM: { chaseRadius: 8, slotPull: 0.55, press: 0.6, support: 0.65 },
  LM: { chaseRadius: 8, slotPull: 0.55, press: 0.55, support: 0.6 },
  RM: { chaseRadius: 8, slotPull: 0.55, press: 0.55, support: 0.6 },
  LW: { chaseRadius: 8.5, slotPull: 0.48, press: 0.7, support: 0.55 },
  RW: { chaseRadius: 8.5, slotPull: 0.48, press: 0.7, support: 0.55 },
  ST: { chaseRadius: 9.5, slotPull: 0.38, press: 0.85, support: 0.35 },
};

const DEF_ROLES = new Set(['GK', 'CB', 'LB', 'RB', 'CDM']);
const ATT_ROLES = new Set(['ST', 'LW', 'RW', 'CAM', 'LM', 'RM']);

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
 * Attack direction on x axis: home → +x, away → -x.
 * @param {'home'|'away'} team
 */
export function attackDir(team) {
  return team === 'home' ? 1 : -1;
}

/**
 * Role-driven target: blend formation slot, ball chase, and attack support.
 * @param {{ x: number, z: number }} pos
 * @param {{ x: number, z: number }} slot
 * @param {{ x: number, z: number }} ball
 * @param {object} player attrs + position/role + team
 * @param {string} [role] formation role override
 */
export function stepPlayer(pos, slot, ball, player, role = player.position || 'CM') {
  const duty = ROLE_DUTY[role] || ROLE_DUTY.CM;
  const speed = (player.speed || 75) / 100;
  const stamina = Math.max(0.55, (player.stamina ?? 100) / 100);
  const step = 0.1 * speed * stamina;

  const dxBall = ball.x - pos.x;
  const dzBall = ball.z - pos.z;
  const distBall = Math.hypot(dxBall, dzBall) || 1;

  // Hold shape toward slot
  let tx = slot.x;
  let tz = slot.z;

  // Chase when ball in duty radius
  if (distBall < duty.chaseRadius) {
    tx = pos.x + (dxBall / distBall) * duty.press * 4;
    tz = pos.z + (dzBall / distBall) * duty.press * 4;
  } else if (ATT_ROLES.has(role) || role === 'CM' || role === 'CAM') {
    // Offer ahead of ball toward goal (support run)
    const dir = attackDir(player.team || 'home');
    const passLink = (player.passing || 75) / 100;
    tx = ball.x + dir * duty.support * 3 * passLink;
    tz = slot.z * 0.55 + ball.z * 0.45;
  } else if (DEF_ROLES.has(role) && role !== 'GK') {
    // Drop between ball and own goal
    const dir = attackDir(player.team || 'home');
    tx = slot.x * 0.6 + (ball.x - dir * 2) * 0.4;
    tz = slot.z * 0.7 + ball.z * 0.3;
  }

  // Blend with slot pull
  const pull = duty.slotPull;
  const targetX = slot.x * pull + tx * (1 - pull);
  const targetZ = slot.z * pull + tz * (1 - pull);

  const dx = targetX - pos.x;
  const dz = targetZ - pos.z;
  const dist = Math.hypot(dx, dz) || 1;
  const move = Math.min(step, dist);

  return {
    x: pos.x + (dx / dist) * move,
    z: pos.z + (dz / dist) * move,
  };
}

/**
 * Pick carrier: closest teammate within control radius.
 * @param {{ x: number, z: number }} ball
 * @param {object[]} nearPlayers with x,z,team,passing,speed
 */
export function pickCarrier(ball, nearPlayers) {
  let best = null;
  let bestDist = 1.6;
  for (const p of nearPlayers) {
    if (p.x == null || p.z == null) continue;
    const d = Math.hypot(p.x - ball.x, p.z - ball.z);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/**
 * Find forward teammate for a pass (same team, further toward goal).
 */
export function pickPassTarget(carrier, teammates) {
  const dir = attackDir(carrier.team);
  let best = null;
  let bestScore = -Infinity;
  for (const t of teammates) {
    if (t === carrier) continue;
    if ((t.x - carrier.x) * dir <= 0.5) continue;
    const dist = Math.hypot(t.x - carrier.x, t.z - carrier.z);
    if (dist < 2 || dist > 12) continue;
    const score = (t.x - carrier.x) * dir * 2 + (t.passing || 70) / 50 - dist * 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/**
 * Ball step: dribble / pass / shoot bias using speed, passing, shooting.
 * @returns {{ x: number, z: number, event?: string }}
 */
export function stepBall(ball, nearPlayers, rng = Math.random) {
  const carrier = pickCarrier(ball, nearPlayers);
  if (!carrier) {
    // Loose ball: slight random drift only
    return clampBall({
      x: ball.x + (rng() - 0.5) * 0.08,
      z: ball.z + (rng() - 0.5) * 0.08,
    });
  }

  const dir = attackDir(carrier.team);
  const speed = (carrier.speed || 75) / 100;
  const passing = (carrier.passing || 75) / 100;
  const shooting = (carrier.shooting || 75) / 100;
  const teammates = nearPlayers.filter((p) => p.team === carrier.team);
  const opponents = nearPlayers.filter((p) => p.team !== carrier.team);

  // Near opposition goal → shot push
  const goalX = dir * FIELD_HALF_X;
  const distGoal = Math.abs(goalX - ball.x);
  if (distGoal < 6 && ATT_ROLES.has(carrier.position || carrier.role) && rng() < 0.08 * shooting) {
    return clampBall({
      x: ball.x + dir * (0.35 + shooting * 0.35),
      z: ball.z * 0.85,
      event: 'shot',
    });
  }

  // Pass when pressured or to advance
  const pressured = opponents.some(
    (o) => Math.hypot(o.x - carrier.x, o.z - carrier.z) < 2.2
  );
  const target = pickPassTarget(carrier, teammates);
  if (target && (pressured || rng() < 0.04 * passing)) {
    const tdx = target.x - ball.x;
    const tdz = target.z - ball.z;
    const len = Math.hypot(tdx, tdz) || 1;
    const power = 0.45 + passing * 0.55;
    return clampBall({
      x: ball.x + (tdx / len) * power,
      z: ball.z + (tdz / len) * power,
      event: 'pass',
    });
  }

  // Dribble toward goal
  return clampBall({
    x: ball.x + dir * (0.12 + speed * 0.18),
    z: ball.z + (rng() - 0.5) * 0.1 * (1 - passing * 0.3),
    event: 'dribble',
  });
}

/**
 * Simplified offside: attacker beyond second-last opponent and beyond ball
 * at the moment of a shot/goal chance.
 */
export function isOffside(attacker, opponents, ball) {
  if (!attacker || !opponents.length) return false;
  const dir = attackDir(attacker.team);
  const sorted = [...opponents].sort((a, b) => (b.x - a.x) * dir);
  // Second-last defender (last is usually GK)
  const secondLast = sorted[1] || sorted[0];
  if (!secondLast) return false;
  const aheadOfDef = (attacker.x - secondLast.x) * dir > 0.3;
  const aheadOfBall = (attacker.x - ball.x) * dir > 0.3;
  return aheadOfDef && aheadOfBall;
}

/**
 * Classify ball leaving the pitch.
 * @returns {null|{ kind: 'throw_in'|'goal_kick'|'corner', restartTeam: 'home'|'away', x: number, z: number }}
 */
export function classifyOutOfBounds(prev, next) {
  // Sideline → throw-in (restart for opposite of half that ball drifted toward)
  if (Math.abs(next.z) > FIELD_HALF_Z) {
    const movedTowardPlusZ = next.z > prev.z;
    return {
      kind: 'throw_in',
      restartTeam: movedTowardPlusZ ? 'home' : 'away',
      x: Math.max(-FIELD_HALF_X + 0.5, Math.min(FIELD_HALF_X - 0.5, next.x)),
      z: Math.sign(next.z) * FIELD_HALF_Z,
    };
  }

  if (Math.abs(next.x) > FIELD_HALF_X) {
    const exitedPositive = next.x > 0;
    const wide = Math.abs(next.z) > GOAL_MOUTH_Z;
    // Through the mouth → goal chance handled elsewhere
    if (!wide) return null;

    // Wide behind goal line → corner for attacking team of that end
    if (exitedPositive) {
      return {
        kind: 'corner',
        restartTeam: 'home',
        x: FIELD_HALF_X - 0.5,
        z: Math.sign(next.z || 1) * FIELD_HALF_Z,
      };
    }
    return {
      kind: 'corner',
      restartTeam: 'away',
      x: -FIELD_HALF_X + 0.5,
      z: Math.sign(next.z || 1) * FIELD_HALF_Z,
    };
  }

  // Just inside end line but out of mouth → goal kick for defending side
  if (Math.abs(next.x) >= FIELD_HALF_X - 0.01 && Math.abs(next.z) <= GOAL_MOUTH_Z) {
    return null;
  }

  return null;
}

/**
 * Restart position for a set piece.
 */
export function setPieceBallPosition(piece) {
  if (!piece) return { x: 0, z: 0 };
  if (piece.kind === 'throw_in') {
    return { x: piece.x, z: piece.z * 0.98 };
  }
  if (piece.kind === 'corner') {
    return {
      x: piece.restartTeam === 'home' ? FIELD_HALF_X - 0.4 : -FIELD_HALF_X + 0.4,
      z: piece.z >= 0 ? FIELD_HALF_Z - 0.4 : -FIELD_HALF_Z + 0.4,
    };
  }
  if (piece.kind === 'goal_kick') {
    return {
      x: piece.restartTeam === 'home' ? -FIELD_HALF_X + 3 : FIELD_HALF_X - 3,
      z: 0,
    };
  }
  return { x: 0, z: 0 };
}

/**
 * Kickoff ball at center; kickoff team ST nudged near ball.
 */
export function kickoffBallPosition() {
  return { x: 0, z: 0 };
}

/**
 * Per-frame goal probability; ignores offside attackers.
 */
export function goalProbability({
  homeAttackers,
  awayAttackers,
  homeDefenders,
  awayDefenders,
  base = 0.00035,
}) {
  const homeShot = averageAttr(homeAttackers, 'shooting');
  const awayShot = averageAttr(awayAttackers, 'shooting');
  const homeDef = averageAttr(homeDefenders, 'defense') || 70;
  const awayDef = averageAttr(awayDefenders, 'defense') || 70;
  const homePass = averageAttr(homeAttackers, 'passing') || 70;
  const awayPass = averageAttr(awayAttackers, 'passing') || 70;

  const homeEdge = Math.max(0, homeShot + homePass * 0.15 - awayDef * 0.85) / 100;
  const awayEdge = Math.max(0, awayShot + awayPass * 0.15 - homeDef * 0.85) / 100;
  const total = base * (1 + homeEdge * 3 + awayEdge * 3);

  return {
    chance: Math.min(0.01, total),
    homeWeight: 0.35 + homeEdge,
    awayWeight: 0.35 + awayEdge,
  };
}

/**
 * @returns {'home'|'away'|null}
 */
export function resolveGoal(p, rng = Math.random) {
  if (rng() >= p.chance) return null;
  const sum = p.homeWeight + p.awayWeight;
  if (sum <= 0) return rng() > 0.5 ? 'home' : 'away';
  return rng() < p.homeWeight / sum ? 'home' : 'away';
}

/**
 * Whether a goal attempt should stand given offside check on nearest attacker.
 */
export function validateGoalSide(side, nearPlayers, ball) {
  const attackers = nearPlayers.filter(
    (p) => p.team === side && !DEF_ROLES.has(p.position || p.role)
  );
  const defenders = nearPlayers.filter((p) => p.team !== side);
  if (!attackers.length) return true;
  const nearest = attackers.reduce((a, b) => {
    const da = Math.hypot(a.x - ball.x, a.z - ball.z);
    const db = Math.hypot(b.x - ball.x, b.z - ball.z);
    return da <= db ? a : b;
  });
  return !isOffside(nearest, defenders, ball);
}

export { averageAttr };
