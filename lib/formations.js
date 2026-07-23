/** Formation role lists and pitch slot layout (pure, testable). */

export const FORMATIONS = {
  '4-3-3': { positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'] },
  '4-4-2': { positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'] },
  '3-5-2': { positions: ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST', 'ST'] },
  '4-2-3-1': { positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'CAM', 'LW', 'ST', 'RW'] },
};

/** Base slot per role; duplicates are spread via ROLE_SPREAD. */
const ROLE_BASE = {
  GK: { x: 0, z: 18 },
  LB: { x: -6, z: 12 },
  CB: { x: 0, z: 14 },
  RB: { x: 6, z: 12 },
  CM: { x: 0, z: 6 },
  CDM: { x: 0, z: 8 },
  CAM: { x: 0, z: 4 },
  LM: { x: -5, z: 4 },
  RM: { x: 5, z: 4 },
  LW: { x: -6, z: 0 },
  RW: { x: 6, z: 0 },
  ST: { x: 0, z: 2 },
};

/** Lateral offsets for the n-th player sharing a role (index 0, 1, 2…). */
const ROLE_SPREAD = {
  CB: [-2.5, 2.5, 0],
  CM: [-4, 0, 4],
  CDM: [-2.5, 2.5],
  ST: [-2, 2],
};

/**
 * Map formation roles to pitch coordinates.
 * @param {string[]} positions role codes in lineup order
 * @param {number} offsetX home negative / away positive end
 * @param {'home'|'away'} side away mirrors along length (z) and flips offset
 */
export function getFormationPositions(positions, offsetX, side = 'home') {
  const roleIndex = {};
  const sign = side === 'away' ? -1 : 1;

  return positions.map((role) => {
    const i = roleIndex[role] || 0;
    roleIndex[role] = i + 1;

    const base = ROLE_BASE[role] || { x: 0, z: 0 };
    const spread = ROLE_SPREAD[role];
    const lateral = spread ? (spread[i] ?? 0) : 0;

    return {
      x: base.x + lateral + offsetX,
      z: base.z * sign,
    };
  });
}

/** Average of numeric attrs on a player list (empty → 0). */
export function averageAttr(players, key) {
  if (!players.length) return 0;
  return players.reduce((sum, p) => sum + (p[key] || 0), 0) / players.length;
}
