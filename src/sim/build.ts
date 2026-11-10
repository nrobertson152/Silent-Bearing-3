// Build a battle from a mission definition and the player's deployed ships.

import { KN, clamp, fromBearing } from '../core/math';
import { hashString } from '../core/rng';
import { AIRCRAFT, ROLE_NAMES } from '../data/aircraft';
import { NAME_POOLS, MERCHANT_NAMES } from '../data/names';
import { NATIONS } from '../data/nations';
import { cls, isCarrierType, isMerchantType, isStructureType, steamTime } from '../data/ships';
import type { Behavior, GroupDef, MissionDef, ShipClass, ShipType, UnitDef } from '../data/types';
import { GUNS } from '../data/weapons';
import { newSquadron } from './air';
import { initObjectives } from './objectives';
import type { DeployedCore, GroupAI, Side, Unit } from './types';
import { DIFFICULTY, SPEED_FRAC, World } from './world';

export interface BuildOptions {
  seed?: number;
  core?: DeployedCore[];
  difficulty?: string;
  controllers?: ['human' | 'ai', 'ai'];
  autoEvade?: boolean;
}

export const VET_XP = [0, 30, 80, 160, 300];
export const VET_NAMES = ['Green', 'Trained', 'Veteran', 'Elite', 'Ace'];

export function vetLevel(xp: number): number {
  let v = 0;
  for (let i = 0; i < VET_XP.length; i++) if (xp >= VET_XP[i]) v = i;
  return v;
}

export function buildWorld(m: MissionDef, opts: BuildOptions = {}): World {
  const w = new World(m, opts.seed ?? hashString(m.id));
  w.diff = DIFFICULTY[opts.difficulty ?? 'normal'] ?? DIFFICULTY.normal;
  if (opts.controllers) w.controllers = opts.controllers;
  if (opts.autoEvade !== undefined) w.autoEvade = opts.autoEvade;
  for (const g of m.player.groups) spawnGroup(w, g, 0, false);
  if (opts.core?.length) spawnCore(w, m, opts.core);
  for (const g of m.allies ?? []) spawnGroup(w, { ...g, controllable: g.controllable ?? false }, 0, false);
  for (const g of m.enemy) spawnGroup(w, g, 1, false);
  if (m.env.squalls) {
    for (let i = 0; i < m.env.squalls; i++) {
      const r = w.rng.range(1800, 3800);
      w.smokes.push({
        id: w.newId(), x: w.rng.range(0.1, 0.9) * w.terrain.w, y: w.rng.range(0.1, 0.9) * w.terrain.h,
        r, r0: r, r1: r, t0: 0, life: 1e9, vx: w.rng.range(-0.8, 0.8), vy: w.rng.range(-0.8, 0.8), squall: true,
      });
    }
  }
  if (w.controllers[0] === 'ai') autopilot(w, m);
  initObjectives(w);
  w.init();
  return w;
}

/** Give the player's groups sensible behaviours when the computer plays them. */
function autopilot(w: World, m: MissionDef) {
  const convoy = (m.allies ?? []).find((g) => g.units.some((u) => cls(u.c).merchant));
  for (const g of w.groups.values()) {
    if (g.side !== 0 || g.behavior.kind !== 'player') continue;
    const us = g.members.map((id) => w.unit(id)!).filter(Boolean);
    if (m.player.auto) g.behavior = m.player.auto;
    else if (us.some((u) => isCarrierType(u.cls.type))) g.behavior = { kind: 'carrier' };
    else if (us.every((u) => u.cls.sub)) g.behavior = { kind: 'sub' };
    else if (convoy && us.some((u) => u.cls.dc)) g.behavior = { kind: 'escort', of: convoy.id };
    else g.behavior = { kind: 'hunt' };
  }
}

function spawnCore(w: World, m: MissionDef, core: DeployedCore[]) {
  const sp = m.player.spawn;
  const gdef: GroupDef = {
    id: 'core',
    units: core.map((c) => ({ c: c.cls, n: c.name })),
    x: sp.x, y: sp.y, h: sp.h,
    formation: sp.formation ?? 'column',
    spacing: sp.spacing ?? 0.7,
  };
  const ga = spawnGroup(w, gdef, 0, false);
  ga.members.forEach((id, i) => {
    const u = w.unit(id)!;
    u.coreUid = core[i].uid;
    u.hp = u.maxHp * clamp(core[i].hp, 0.15, 1);
    u.xp = core[i].xp;
    u.vet = vetLevel(core[i].xp);
    u.tags.push('core');
  });
}

function typeTags(t: ShipType): string[] {
  const out = [t.toLowerCase()];
  if (isMerchantType(t)) out.push('merchant');
  if (isCarrierType(t)) out.push('carrier');
  if (t === 'CA' || t === 'CL') out.push('cruiser');
  if (t === 'BB' || t === 'BC') out.push('battleship');
  if (t === 'BB' || t === 'BC' || t === 'CV') out.push('capital');
  if (t === 'DD' || t === 'DE' || t === 'TB') out.push('escort');
  if (!isMerchantType(t) && !isStructureType(t)) out.push('warship');
  return out;
}

const PREFIXES = ['USS ', 'HMS ', 'HMAS ', 'HMNZS ', 'HNLMS ', 'HMCS ', 'ORP ', 'SS ', 'MV ', 'RMS ', 'HNoMS ', 'HMIS ', 'FFL '];

export function displayName(c: ShipClass, name: string): string {
  if (PREFIXES.some((p) => name.startsWith(p))) return name;
  if (isStructureType(c.type)) return name;
  if (c.merchant) {
    if (/Maru$/.test(name)) return name;
    return NATIONS[c.nation].merchantPrefix + name;
  }
  return NATIONS[c.nation].prefix + name;
}

export function shortName(name: string): string {
  for (const p of PREFIXES) if (name.startsWith(p)) return name.slice(p.length);
  return name;
}

const usedNames = new WeakMap<World, Set<string>>();

function autoName(w: World, c: ShipClass): string {
  let used = usedNames.get(w);
  if (!used) {
    used = new Set(w.units.map((u) => shortName(u.name)));
    usedNames.set(w, used);
  }
  let pool = NAME_POOLS[c.id];
  if (c.merchant) pool = c.nation === 'jp' ? MERCHANT_NAMES.jp : c.nation === 'de' ? MERCHANT_NAMES.de : MERCHANT_NAMES.allied;
  if (pool) {
    const start = Math.floor(w.rng.next() * pool.length);
    for (let i = 0; i < pool.length; i++) {
      const n = pool[(start + i) % pool.length];
      if (!used.has(n)) {
        used.add(n);
        return n;
      }
    }
  }
  let i = 1;
  while (used.has(`${c.name} ${i}`)) i++;
  const n = `${c.name} ${i}`;
  used.add(n);
  return n;
}

function defaultSpacing(f: GroupDef['formation']): number {
  switch (f) {
    case 'line': return 0.8;
    case 'box':
    case 'convoy': return 0.8;
    case 'screen': return 2.5;
    case 'anchored': return 0.5;
    case 'scatter': return 2;
    case 'echelon': return 0.7;
    default: return 0.6;
  }
}

function offsets(w: World, f: NonNullable<GroupDef['formation']>, n: number, sp: number) {
  const out: { x: number; y: number }[] = [];
  if (f === 'column') for (let i = 0; i < n; i++) out.push({ x: -i * sp, y: 0 });
  else if (f === 'line') for (let i = 0; i < n; i++) out.push({ x: 0, y: (i - (n - 1) / 2) * sp });
  else if (f === 'echelon') for (let i = 0; i < n; i++) out.push({ x: -i * sp * 0.7, y: i * sp * 0.7 });
  else if (f === 'box' || f === 'convoy') {
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.5)));
    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      out.push({ x: -row * sp, y: (col - (cols - 1) / 2) * sp * 1.1 });
    }
  } else if (f === 'screen') {
    out.push({ x: 0, y: 0 });
    for (let i = 1; i < n; i++) {
      const a = ((i - 1) / Math.max(1, n - 1)) * Math.PI * 2;
      out.push({ x: Math.cos(a) * sp, y: Math.sin(a) * sp });
    }
  } else {
    const R = sp * Math.sqrt(n) * 0.9;
    for (let i = 0; i < n; i++) {
      let best = { x: 0, y: 0 };
      for (let k = 0; k < 30; k++) {
        const p = { x: w.rng.gauss() * R * 0.6, y: w.rng.gauss() * R * 0.6 };
        best = p;
        if (out.every((o) => Math.hypot(o.x - p.x, o.y - p.y) > sp * 0.8)) break;
      }
      out.push(best);
    }
  }
  return out;
}

export function spawnGroup(w: World, g: GroupDef, side: Side, late: boolean): GroupAI {
  const K = 1000;
  const n = g.units.length;
  const h = fromBearing(g.h);
  const form = g.formation ?? 'column';
  const sp = (g.spacing ?? defaultSpacing(form)) * K;
  const offs = offsets(w, form, n, sp);
  const controllable = side === 0 && (g.controllable ?? !g.behavior);
  const behavior: Behavior = controllable ? { kind: 'player' } : g.behavior ?? { kind: 'hunt' };
  const gid = w.groups.has(g.id) ? `${g.id}#${w.newId()}` : g.id;
  const ga: GroupAI = {
    id: gid, side, behavior, members: [], wp: 0, mode: 'cruise', nextThink: w.time + w.rng.range(0, 2),
    leader: -1, lastStrike: -1e9, lastScout: -1e9, data: { alertDelay: g.alertDelay ?? 45 },
  };
  w.groups.set(gid, ga);
  for (let i = 0; i < n; i++) {
    const ud = g.units[i];
    let x: number;
    let y: number;
    if (ud.x !== undefined && ud.y !== undefined) {
      x = ud.x * K;
      y = ud.y * K;
    } else {
      const o = offs[i];
      x = g.x * K + Math.cos(h) * o.x - Math.sin(h) * o.y;
      y = g.y * K + Math.sin(h) * o.x + Math.cos(h) * o.y;
    }
    x = clamp(x, 100, w.terrain.w - 100);
    y = clamp(y, 100, w.terrain.h - 100);
    const c = cls(ud.c);
    const clearance = isStructureType(c.type) ? 0 : clamp(c.beam * 3, 45, 200);
    if (!isStructureType(c.type) && w.terrain.isLand(x, y, clearance)) {
      const p = w.terrain.nearestWater(x, y, clearance);
      x = p.x;
      y = p.y;
    }
    // ships at anchor swing to the wind and tide, not to a common heading
    const uh = ud.h !== undefined ? fromBearing(ud.h) : form === 'anchored' ? h + w.rng.range(-1.2, 1.2) : h;
    const u = makeUnit(w, ud, c, side, gid, x, y, uh, g, controllable);
    w.addUnit(u);
    ga.members.push(u.id);
    addAir(w, u, g, i === 0);
  }
  if (late) {
    const L = w.unit(ga.members[0]);
    if (L) {
      ga.leader = L.id;
      const cc = Math.cos(-L.h);
      const ss = Math.sin(-L.h);
      for (const id of ga.members) {
        const u = w.unit(id)!;
        if (u === L) continue;
        const dx = u.x - L.x;
        const dy = u.y - L.y;
        u.formation = { x: dx * cc - dy * ss, y: dx * ss + dy * cc };
      }
    }
  }
  return ga;
}

function makeUnit(
  w: World, ud: UnitDef, c: ShipClass, side: Side, group: string, x: number, y: number, h: number,
  g: GroupDef, controllable: boolean,
): Unit {
  const special = [...(ud.special ?? [])];
  const anchored = g.formation === 'anchored' || g.speed === 0 || special.includes('disabled');
  const kn = ud.speed ?? g.speed;
  let speedSet = 3;
  if (anchored) speedSet = 0;
  else if (kn !== undefined && c.speed > 0) {
    const frac = kn / c.speed;
    let best = 3;
    for (let i = 1; i < SPEED_FRAC.length; i++) if (Math.abs(SPEED_FRAC[i] - frac) < Math.abs(SPEED_FRAC[best] - frac)) best = i;
    speedSet = best;
  }
  if (isStructureType(c.type)) speedSet = 0;
  const mounts = c.guns.map((def) => {
    const gun = GUNS[def.g];
    if (!gun) throw new Error(`Unknown gun ${def.g} on ${c.id}`);
    return { def, gun, reload: w.rng.range(0, gun.reload), dead: false, aim: def.p >= 0 ? 0 : Math.PI };
  });
  const maxHp = c.hp;
  const startV = anchored || isStructureType(c.type) ? 0 : Math.min(c.speed, kn ?? c.speed * 0.6) * KN;
  const sub = !!c.sub;
  const startDepth = sub && (side === 1 || !controllable) && !w.env.night ? 'periscope' : special.includes('submerged') ? 'periscope' : 'surface';
  // radar sets only count once they had been fitted
  const radarOn = !special.includes('noRadar') && w.year >= (c.radarYear ?? 0);
  const u: Unit = {
    id: w.newId(), side, cls: c, nation: c.nation,
    name: displayName(c, ud.n ?? autoName(w, c)),
    tags: [...(g.tags ?? []), ...(ud.t ?? []), ...typeTags(c.type), c.id],
    group, x, y, h, v: startV, speedSet, speedCap: Infinity, orderH: anchored ? null : h, path: [], follow: null, engage: null,
    hp: maxHp * clamp(ud.hp ?? 1, 0.05, 1), maxHp, fires: 0, flood: 0,
    crits: { engine: 0, rudder: 0, fc: 0, radar: 0, deck: 0 },
    rudderJam: false, disabled: special.includes('disabled'),
    mounts,
    torpLoaded: c.torps?.tubes ?? 0,
    torpReloads: special.includes('noReloads') ? 0 : c.torps?.reloads ?? 0,
    torpTimer: 0,
    dcLeft: c.dc ?? 0, dcCool: 0,
    depth: startDepth, depthOrder: startDepth, depthTimer: 0, battery: 1,
    smokeLeft: c.smoke ? 2 : 0, smokeOn: 0, smokeTick: 0,
    target: null, autoTarget: null, fc: { tid: -1, q: 0, th: 0, tv: 0, myH: 0 }, holdFire: false,
    alert: g.alert ?? true, alertAt: null, illuminated: !!g.illuminated || special.includes('illuminated'),
    controllable, sunk: false, sinkT: 0, escaped: false, lastFire: -1e9, lastHitBy: null,
    xp: 0, vet: 0, crew: NATIONS[c.nation].crew * (g.crew ?? 1), dmgDealt: 0, kills: [],
    special, hangar: [], deckTimer: 0, autoCap: true, evadeUntil: 0, evadeH: 0, airAlertUntil: 0, underFire: 0, lastOrder: -1e9,
    sonarBlind: 0, wake: [], trail: [], wakeTick: w.rng.range(0, 3), formation: null, stuck: 0, grounded: false, groundT: -1e9, pathAt: -1e9,
    radar: radarOn ? c.radar ?? 0 : 0, airRadar: radarOn ? c.airRadar ?? 0 : 0, fcRadar: radarOn && !!c.fcRadar,
    // ships at anchor must raise steam once the alarm goes
    steamAt: anchored && !isStructureType(c.type) && !special.includes('disabled') ? ((g.alert ?? true) ? steamTime(c) : Infinity) : 0,
  };
  if (u.disabled) u.crits.engine = 1e9;
  if (special.includes('rudderJam')) u.special.push('rudderJam');
  return u;
}

function addAir(w: World, u: Unit, g: GroupDef, first: boolean) {
  const c = u.cls;
  const label = shortName(u.name);
  const ready = (g.airReady ?? 0) * 60;
  const list: { a: string; n: number; ready: number; name?: string }[] = [];
  if (c.air && !u.special.includes('noAir')) for (const a of c.air) list.push({ a: a.a, n: a.n, ready });
  if (g.air && first) for (const a of g.air) list.push({ a: a.a, n: a.n, ready: (a.ready ?? 0) * 60, name: a.name });
  // Number squadrons that would otherwise share a name.
  const roles = new Map<string, number>();
  for (const a of list) roles.set(aircraftRole(a.a), (roles.get(aircraftRole(a.a)) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const a of list) {
    const role = aircraftRole(a.a);
    const i = (seen.get(role) ?? 0) + 1;
    seen.set(role, i);
    const generic = `${label} ${ROLE_NAMES[role].toLowerCase()}${(roles.get(role) ?? 0) > 1 ? ' ' + i : ''}`;
    const s = newSquadron(w, u.side, a.a, a.n, u, a.name ?? generic);
    s.ready = a.ready;
  }
  if (c.scouts && !u.special.includes('noAir')) {
    newSquadron(w, u.side, c.scouts.a, c.scouts.n, u, `${label} floatplanes`);
  }
}

function aircraftRole(id: string) {
  return AIRCRAFT[id].role;
}
