// Campaign state: the player's fleet, prestige and progress, saved to localStorage.

import { decimalYear } from '../core/math';
import { CAMPAIGNS } from '../data/campaigns';
import { NAME_POOLS } from '../data/names';
import { CLASSES, TYPE_VALUE, cls } from '../data/ships';
import type { MissionDef, PlayableNation, ShipType } from '../data/types';
import { vetLevel } from '../sim/build';
import type { DeployedCore } from '../sim/types';
import type { World } from '../sim/world';
import type { DifficultyId } from './settings';

export const SAVE_VERSION = 1;

export interface CoreShip {
  uid: string;
  cls: string;
  name: string;
  hp: number; // 0..1
  xp: number;
  missions: number;
  kills: string[];
  lost?: string; // mission id where she was lost
}

export interface MissionRecord {
  id: string;
  outcome: 'decisive' | 'victory' | 'marginal' | 'defeat';
  prestige: number;
  tonsSunk: number;
  shipsSunk: number;
  shipsLost: number;
  attempts: number;
}

export interface CampaignState {
  version: number;
  nation: PlayableNation;
  difficulty: DifficultyId;
  index: number; // next mission
  prestige: number;
  fleet: CoreShip[];
  records: MissionRecord[];
  attempts: number;
  started: string;
  updated: string;
  finished?: boolean;
  nextUid: number;
}

const KEY = (n: PlayableNation) => `sb3:campaign:${n}`;
const LAST = 'sb3:last';

export function newCampaign(nation: PlayableNation, difficulty: DifficultyId): CampaignState {
  const c = CAMPAIGNS[nation];
  const now = new Date().toISOString();
  const st: CampaignState = {
    version: SAVE_VERSION, nation, difficulty, index: 0, prestige: c.startPrestige, fleet: [], records: [],
    attempts: 0, started: now, updated: now, nextUid: 1,
  };
  for (const s of c.startFleet) addShip(st, s.c, s.n);
  return st;
}

export function addShip(st: CampaignState, classId: string, name?: string): CoreShip {
  const ship: CoreShip = {
    uid: `${st.nation}-${st.nextUid++}`,
    cls: classId,
    name: name ?? pickName(st, classId),
    hp: 1, xp: 0, missions: 0, kills: [],
  };
  st.fleet.push(ship);
  return ship;
}

function pickName(st: CampaignState, classId: string): string {
  const used = new Set(st.fleet.map((s) => s.name));
  const pool = NAME_POOLS[classId] ?? [];
  for (const n of pool) if (!used.has(n)) return n;
  const c = CLASSES[classId];
  let i = 2;
  while (used.has(`${c.name} ${i}`)) i++;
  return `${c.name} ${i}`;
}

export function saveCampaign(st: CampaignState) {
  st.updated = new Date().toISOString();
  try {
    localStorage.setItem(KEY(st.nation), JSON.stringify(st));
    localStorage.setItem(LAST, st.nation);
  } catch {
    /* storage unavailable */
  }
}

export function loadCampaign(n: PlayableNation): CampaignState | null {
  try {
    const raw = localStorage.getItem(KEY(n));
    if (!raw) return null;
    const st = JSON.parse(raw) as CampaignState;
    if (!st || st.version !== SAVE_VERSION || !Array.isArray(st.fleet)) return null;
    // drop ships whose class no longer exists
    st.fleet = st.fleet.filter((s) => !!CLASSES[s.cls]);
    return st;
  } catch {
    return null;
  }
}

export function deleteCampaign(n: PlayableNation) {
  try {
    localStorage.removeItem(KEY(n));
  } catch {
    /* ignore */
  }
}

export function lastNation(): PlayableNation | null {
  try {
    const n = localStorage.getItem(LAST) as PlayableNation | null;
    return n && CAMPAIGNS[n] && loadCampaign(n) ? n : null;
  } catch {
    return null;
  }
}

export function currentMission(st: CampaignState): MissionDef | undefined {
  return CAMPAIGNS[st.nation].missions[st.index];
}

export function activeFleet(st: CampaignState): CoreShip[] {
  return st.fleet.filter((s) => !s.lost);
}

/** Ships that may take a slot in this mission. */
export function eligible(st: CampaignState, m: MissionDef): CoreShip[] {
  const allowed = m.player.allowed;
  return activeFleet(st).filter((s) => {
    const c = CLASSES[s.cls];
    if (!c) return false;
    if (allowed && !allowed.includes(c.type as ShipType)) return false;
    // carriers and battleships only where the mission allows them explicitly
    return true;
  });
}

/** The default selection for a mission's free slots: strongest eligible ships first. */
export function defaultDeployment(st: CampaignState, m: MissionDef): CoreShip[] {
  const list = eligible(st, m)
    .slice()
    .sort((a, b) => TYPE_VALUE[cls(b.cls).type] - TYPE_VALUE[cls(a.cls).type] || b.xp - a.xp || b.hp - a.hp);
  return list.slice(0, m.player.slots);
}

export function toDeployed(ships: CoreShip[]): DeployedCore[] {
  return ships.map((s) => ({ uid: s.uid, cls: s.cls, name: s.name, hp: s.hp, xp: s.xp }));
}

/**
 * The ships of a historical battle, fought outside a campaign: the ones that really filled the
 * free places, or the loaner when the battle has no other player ships.
 */
export function historicalCore(m: MissionDef): DeployedCore[] {
  const h = (m.player.history ?? []).map((u, i) => ({ uid: `hist-${i}`, cls: u.c, name: u.n ?? cls(u.c).name, hp: u.hp ?? 1, xp: 0 }));
  return h.length || m.player.groups.length ? h : loanerFor(m);
}

/** Core ships for a mission where nothing in the fleet can fill the only slot. */
export function loanerFor(m: MissionDef): DeployedCore[] {
  const l = m.player.loaner;
  if (!l) return [];
  return [{ uid: 'loan', cls: l.c, name: l.n ?? cls(l.c).name, hp: 1, xp: 0 }];
}

// ------------------------------------------------------------------ economy

export function repairCost(s: CoreShip): number {
  const c = CLASSES[s.cls];
  return Math.round((1 - s.hp) * Math.max(120, c.cost || c.tons / 30) * 0.45);
}

export interface MissionReport {
  outcome: MissionRecord['outcome'];
  base: number;
  objectives: number;
  sinkings: number;
  total: number;
  lines: { text: string; value: number }[];
  promotions: { name: string; level: number }[];
  losses: string[];
  sunk: { name: string; type: ShipType; tons: number }[];
  tonsSunk: number;
  planesKilled: number;
  planesLost: number;
}

const DIFF_MULT: Record<DifficultyId, number> = { easy: 1.2, normal: 1, hard: 0.9 };

/** Apply a finished battle to the campaign and work out the prestige earned. */
export function applyResult(st: CampaignState, m: MissionDef, w: World): MissionReport {
  const r = w.result!;
  const won = r.outcome !== 'defeat';
  const lines: { text: string; value: number }[] = [];
  const base = won ? m.reward ?? 250 : Math.round((m.reward ?? 250) * 0.25);
  lines.push({ text: won ? 'Mission accomplished' : 'Mission failed', value: base });
  let objectives = 0;
  for (const o of w.objectives) {
    if (o.def.bonus && o.status === 'done') {
      objectives += 75;
      lines.push({ text: `Bonus: ${o.def.text}`, value: 75 });
    }
  }
  if (r.outcome === 'decisive') {
    objectives += 100;
    lines.push({ text: 'Decisive victory', value: 100 });
  }
  let sinkings = 0;
  const sunk: MissionReport['sunk'] = [];
  for (const id of w.stats[0].sunk) {
    const u = w.unit(id);
    if (!u) continue;
    const v = u.cls.merchant ? u.cls.tons / 120 : u.cls.type === 'BASE' ? 150 : u.cls.type === 'BTY' ? 40 : u.cls.tons / 70;
    sinkings += v;
    sunk.push({ name: u.name, type: u.cls.type, tons: u.cls.tons });
  }
  sinkings = Math.round(sinkings);
  if (sinkings) lines.push({ text: `Enemy ships sunk (${sunk.length})`, value: sinkings });
  const planes = w.stats[0].planesKilled;
  if (planes) {
    lines.push({ text: `Aircraft shot down (${planes})`, value: planes * 3 });
    sinkings += planes * 3;
  }
  const mult = DIFF_MULT[st.difficulty];
  const total = Math.round((base + objectives + sinkings) * mult);
  if (mult !== 1) lines.push({ text: `Difficulty (${st.difficulty})`, value: total - (base + objectives + sinkings) });
  st.prestige += total;

  // update the fleet
  const promotions: MissionReport['promotions'] = [];
  const losses: string[] = [];
  for (const u of w.units) {
    if (!u.coreUid) continue;
    const s = st.fleet.find((x) => x.uid === u.coreUid);
    if (!s) continue;
    s.missions++;
    if (u.sunk) {
      s.lost = m.id;
      s.hp = 0;
      losses.push(u.name);
      continue;
    }
    s.hp = Math.max(0.05, u.hp / u.maxHp);
    const before = vetLevel(s.xp);
    let xp = 10 + u.dmgDealt / 60 + u.kills.length * 12;
    if (won) xp += 6;
    s.xp = Math.round(s.xp + xp);
    s.kills.push(...u.kills);
    const after = vetLevel(s.xp);
    if (after > before) promotions.push({ name: u.name, level: after });
  }
  // free dockyard time between missions
  for (const s of activeFleet(st)) s.hp = Math.min(1, s.hp + 0.25);

  const prev = st.records.find((x) => x.id === m.id);
  const rec: MissionRecord = {
    id: m.id, outcome: r.outcome, prestige: total, tonsSunk: w.stats[0].tonsSunk,
    shipsSunk: w.stats[0].sunk.length, shipsLost: w.stats[0].lost.length, attempts: (prev?.attempts ?? 0) + 1,
  };
  st.records = st.records.filter((x) => x.id !== m.id);
  st.records.push(rec);
  return {
    outcome: r.outcome, base, objectives, sinkings, total, lines, promotions, losses, sunk,
    tonsSunk: w.stats[0].tonsSunk, planesKilled: w.stats[0].planesKilled, planesLost: w.stats[0].planesLost,
  };
}

/** Move on to the next mission (after a victory, or when the player accepts a defeat). */
export function advance(st: CampaignState) {
  st.index++;
  st.attempts = 0;
  if (st.index >= CAMPAIGNS[st.nation].missions.length) st.finished = true;
}

export function campaignYear(st: CampaignState): number {
  const m = currentMission(st) ?? CAMPAIGNS[st.nation].missions[CAMPAIGNS[st.nation].missions.length - 1];
  return decimalYear(m.date);
}
