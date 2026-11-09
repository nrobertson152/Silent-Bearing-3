// Computer-controlled groups: convoys, patrols, hunting groups, escorts, raiders,
// submarines, carrier task forces and airfields. The AI only acts on its own
// side's contact picture.

import { KN, angleDiff, clamp, dist, headingTo, interceptTime, wrap, type Vec } from '../core/math';
import { SIZE, TYPE_VALUE, isCapitalType, isCarrierType, isMerchantType, isStructureType } from '../data/ships';
import { TORPS } from '../data/weapons';
import type { Behavior, TorpDef } from '../data/types';
import { fireTorpedoes } from './combat';
import { orderScout, orderStrike } from './air';
import { airborne } from './sensors';
import type { Contact, GroupAI, Squadron, Unit } from './types';
import type { World } from './world';

interface Known {
  u: Unit;
  c: Contact;
  d: number;
}

const assistClock = new WeakMap<World, number>();

export function initGroups(w: World) {
  for (const g of w.groups.values()) {
    const ms = members(w, g);
    if (!ms.length) continue;
    g.leader = ms[0].id;
    setFormation(g, ms);
  }
}

function members(w: World, g: GroupAI): Unit[] {
  const out: Unit[] = [];
  for (const id of g.members) {
    const u = w.unit(id);
    if (w.alive(u)) out.push(u);
  }
  return out;
}

function setFormation(g: GroupAI, ms: Unit[]) {
  const L = ms[0];
  const c = Math.cos(-L.h);
  const s = Math.sin(-L.h);
  for (const u of ms) {
    if (u === L) {
      u.formation = null;
      continue;
    }
    const dx = u.x - L.x;
    const dy = u.y - L.y;
    u.formation = { x: dx * c - dy * s, y: dx * s + dy * c };
  }
}

export function aiThink(w: World) {
  for (const g of w.groups.values()) {
    if (w.time < g.nextThink) continue;
    g.nextThink = w.time + 2 + w.rng.next() * 0.5;
    if (g.side === 0 && w.controllers[0] === 'human' && g.behavior.kind === 'player') continue;
    thinkGroup(w, g);
  }
  const next = assistClock.get(w) ?? 0;
  if (w.time >= next) {
    assistClock.set(w, w.time + 1);
    playerAssist(w);
  }
}

// ------------------------------------------------------------------ helpers

function known(w: World, side: 0 | 1, from: Vec, maxAge = 90): Known[] {
  const out: Known[] = [];
  for (const c of w.contacts[side].values()) {
    if (c.level >= 2) {
      // currently detected
    } else if (c.fix && w.time - c.t < 60) {
      // position from cross bearings
    } else if (w.time - c.seen > maxAge || isNaN(c.x)) {
      continue;
    }
    const u = w.unit(c.id);
    if (!w.alive(u)) continue;
    out.push({ u, c, d: dist(from.x, from.y, c.x, c.y) });
  }
  return out;
}

function surfaceOnly(k: Known): boolean {
  return !(k.u.cls.sub && k.u.depth !== 'surface');
}

function centroid(us: Unit[]): Vec {
  let x = 0;
  let y = 0;
  for (const u of us) {
    x += u.x;
    y += u.y;
  }
  return { x: x / us.length, y: y / us.length };
}

function isWarship(u: Unit): boolean {
  const t = u.cls.type;
  return !isMerchantType(t) && !u.cls.sub && !isCarrierType(t) && !isStructureType(t);
}

function zoneXY(w: World, id: string | undefined): Vec | null {
  const z = w.zone(id);
  return z ? { x: z.x, y: z.y } : null;
}

function km(p: [number, number]): Vec {
  return { x: p[0] * 1000, y: p[1] * 1000 };
}

function cruiseTo(w: World, g: GroupAI, ms: Unit[], L: Unit, x: number, y: number, knots?: number) {
  const lastX = g.data.destX;
  const lastY = g.data.destY;
  if (!L.path.length || lastX === undefined || dist(lastX, lastY, x, y) > 400 || L.engage !== null || L.follow) {
    w.pathTo(L, x, y);
    g.data.destX = x;
    g.data.destY = y;
  }
  L.engage = null;
  L.follow = null;
  L.evadeUntil = Math.min(L.evadeUntil, w.time + 30);
  let cap = Infinity;
  for (const u of ms) cap = Math.min(cap, w.maxSpeed(u));
  L.speedSet = 4;
  L.speedCap = Math.min(knots ? knots * KN : Infinity, ms.length > 1 ? cap * 0.9 : Infinity);
  let k = 0;
  for (const u of ms) {
    if (u === L || isStructureType(u.cls.type)) continue;
    if (u.cls.sub) continue;
    const f = u.formation ?? defaultOffset(k++);
    if (!u.follow || u.follow.id !== L.id) u.follow = { id: L.id, dx: f.x, dy: f.y };
    u.engage = null;
    u.path = [];
    u.orderH = null;
    u.speedSet = 4;
    u.speedCap = Infinity;
  }
}

function defaultOffset(k: number): Vec {
  return { x: -(k + 1) * 600, y: 0 };
}

function pickFor(w: World, u: Unit, enemies: Known[], prefer?: string[]): Known | null {
  let best: Known | null = null;
  let bs = -Infinity;
  for (const k of enemies) {
    if (!surfaceOnly(k)) continue;
    if (isNaN(k.c.x)) continue;
    const d = dist(u.x, u.y, k.c.x, k.c.y);
    let s = TYPE_VALUE[k.u.cls.type] * 4 - d / 1000;
    if (prefer && prefer.some((t) => k.u.tags.includes(t))) s += 12;
    if (k.u.id === u.autoTarget) s += 3;
    if (k.c.level < 2) s -= 15;
    if (s > bs) {
      bs = s;
      best = k;
    }
  }
  return best;
}

function retreatHp(u: Unit): number {
  const t = u.cls.type;
  if (t === 'BB' || t === 'BC') return 0.12;
  if (t === 'CA' || t === 'CL') return 0.2;
  return 0.25;
}

function prefRange(w: World, u: Unit, tgt?: Unit, seen = true): { pref: number; run: boolean } {
  const t = u.cls.type;
  const mr = w.mainGunRange(u) || 5000;
  const torps = u.cls.torps && u.torpLoaded > 0 ? TORPS[u.cls.torps.t] : null;
  let pref: number;
  let run = false;
  const tt = tgt?.cls.type;
  const slow = !!tgt && tgt.v < 8 * KN;
  const big = tt === 'BB' || tt === 'BC' || tt === 'CA' || tt === 'CL' || tt === 'CV' || tt === 'CVL' || tt === 'CVE';
  if (t === 'PT') {
    pref = 1500;
    run = true;
  } else if ((t === 'DD' || t === 'TB') && torps && (slow || big || !tgt)) {
    // close in for a torpedo attack: ships at anchor from short range,
    // heavy ships from as far as the torpedoes allow a fair chance
    pref = slow ? 2500 : torps.range > 15000 ? 4500 : Math.min(torps.range * 0.5, 3500);
    run = true;
  } else if (t === 'BB' || t === 'BC') pref = mr * 0.6;
  else if (t === 'CA' || t === 'CL') pref = mr * 0.5;
  else pref = mr * 0.45;
  if (w.env.night && !u.radar) pref = Math.min(pref, Math.max(2500, w.env.vis * 1.3));
  // a target we cannot currently see has to be closed until it can be
  if (tgt && !seen) {
    const sees = Math.max(w.env.vis * SIZE[tgt.cls.type], u.radar * Math.sqrt(SIZE[tgt.cls.type]));
    pref = Math.min(pref, Math.max(2500, sees * 0.8));
    run = true;
  }
  return { pref, run };
}

function manoeuvre(w: World, u: Unit, c: { x: number; y: number }, pref: number, run: boolean) {
  const d = dist(u.x, u.y, c.x, c.y);
  const brg = headingTo(u.x, u.y, c.x, c.y);
  const sideSign = u.id % 2 ? 1 : -1;
  let desired: number;
  if (d > pref * 1.25) desired = brg + (run ? 0 : 0.3 * sideSign);
  else if (d < pref * 0.7) desired = brg + Math.PI + 0.5 * sideSign;
  else {
    const a1 = brg + Math.PI / 2;
    const a2 = brg - Math.PI / 2;
    desired = Math.abs(angleDiff(u.h, a1)) < Math.abs(angleDiff(u.h, a2)) ? a1 : a2;
  }
  u.follow = null;
  u.speedSet = run || u.cls.type === 'PT' ? 4 : 3;
  u.speedCap = Infinity;
  // In fjords and among islands, steer round the land rather than into it.
  if (w.terrain.hasLand) {
    const look = Math.min(d, 4000);
    const ex = u.x + Math.cos(desired) * look;
    const ey = u.y + Math.sin(desired) * look;
    if (!w.terrain.segClear(u.x, u.y, ex, ey, w.clearance(u))) {
      if (!u.path.length || w.time - u.pathAt > 15) {
        const p = d > pref * 1.25 ? c : { x: u.x + Math.cos(desired) * 2500, y: u.y + Math.sin(desired) * 2500 };
        w.pathTo(u, p.x, p.y);
        u.pathAt = w.time;
      }
      if (u.path.length) return;
    }
  }
  u.orderH = wrap(desired);
  u.path = [];
}

function tryTorpedo(w: World, u: Unit, enemies: Known[], def: TorpDef, prefer?: string[]) {
  if (u.torpLoaded <= 0) return;
  // even a Long Lance rarely hits a fast ship from beyond about six kilometres
  const maxR = Math.min(def.range * 0.8, 9000);
  let best: Known | null = null;
  let bs = 0;
  const full = u.cls.torps?.tubes ?? 0;
  // torpedoes of ours already running at each ship
  const running = new Map<number, number>();
  for (const tp of w.torps) if (tp.side === u.side && tp.aimAt !== undefined) running.set(tp.aimAt, (running.get(tp.aimAt) ?? 0) + 1);
  for (const k of enemies) {
    // a submarine is far too small and nimble a target for a torpedo
    if (!surfaceOnly(k) || k.c.level < 2 || k.u.cls.sub) continue;
    const d = dist(u.x, u.y, k.u.x, k.u.y);
    if (d > maxR || d < 500) continue;
    const ty = k.u.cls.type;
    // enough is already on its way to this one
    const enough = k.u.cls.merchant || ty === 'DD' || ty === 'DE' || ty === 'TB' ? 3 : ty === 'CA' || ty === 'CL' ? 6 : 10;
    if ((running.get(k.u.id) ?? 0) >= enough) continue;
    let v = TYPE_VALUE[ty];
    if (ty === 'PT') v = 0;
    if (prefer && prefer.some((t) => k.u.tags.includes(t))) v += 3;
    if (v < 3) continue;
    // fast, nimble ships are poor torpedo targets: close in, and keep a
    // reserve for something bigger
    const kn = k.c.v / KN;
    // at anchor or crawling: close to a range where the salvo can hardly miss
    if (kn < 6 && d > (u.cls.sub ? 3000 : 3500)) continue;
    if (kn > 15 && d > 6000) continue;
    const small = ty === 'DD' || ty === 'DE' || ty === 'TB';
    if (small && ((kn > 20 && d > 3000) || (u.torpReloads <= 0 && u.torpLoaded <= full / 2))) continue;
    if (!w.terrain.los(u.x, u.y, k.u.x, k.u.y)) continue;
    // the run to where the target will be must be clear of land too
    if (w.terrain.hasLand) {
      const tt = interceptTime(u.x, u.y, k.c.x, k.c.y, Math.cos(k.c.h) * k.c.v, Math.sin(k.c.h) * k.c.v, def.speed * KN);
      if (tt !== null && !w.terrain.segClear(u.x, u.y, k.c.x + Math.cos(k.c.h) * k.c.v * tt, k.c.y + Math.sin(k.c.h) * k.c.v * tt, 20)) continue;
    }
    // a target end-on presents almost nothing to hit
    const aspect = Math.abs(Math.sin(headingTo(u.x, u.y, k.c.x, k.c.y) - k.c.h));
    if (kn < 6 && aspect < 0.35) continue;
    const s = (v * clamp(1.3 - kn / 32, 0.25, 1) * (0.4 + 0.6 * aspect)) / (1 + d / 4000);
    if (s > bs) {
      bs = s;
      best = k;
    }
  }
  if (!best || !w.rng.chance(0.45)) return;
  const count = u.cls.sub
    ? Math.min(4, u.torpLoaded)
    : def.range > 15000 || u.cls.type === 'PT'
      ? u.torpLoaded
      : Math.max(2, Math.ceil(u.torpLoaded / 2));
  fireTorpedoes(w, u, { unit: best.u, x: best.u.x, y: best.u.y }, count);
}

function fight(w: World, u: Unit, enemies: Known[], prefer?: string[]): boolean {
  if (u.disabled || isStructureType(u.cls.type)) return false;
  const near = enemies.filter(surfaceOnly);
  if (u.hp / u.maxHp < retreatHp(u) && near.length) {
    const n = nearest(u, near);
    if (n) {
      u.orderH = wrap(headingTo(n.c.x, n.c.y, u.x, u.y));
      u.path = [];
      u.follow = null;
      u.speedSet = 4;
      u.engage = null;
      if (u.cls.smoke && u.smokeOn <= 0 && u.smokeLeft > 0) w.orderSmoke([u.id]);
      return true;
    }
  }
  const t = pickFor(w, u, enemies, prefer);
  if (!t) return false;
  u.autoTarget = t.u.id;
  const { pref, run } = prefRange(w, u, t.u, t.c.level >= 2);
  const torps = u.cls.torps && u.torpLoaded > 0 ? TORPS[u.cls.torps.t] : null;
  if (torps) tryTorpedo(w, u, enemies, torps, prefer);
  manoeuvre(w, u, t.c, pref, run);
  return true;
}

function nearest(u: Vec, ks: Known[]): Known | null {
  let best: Known | null = null;
  let bd = Infinity;
  for (const k of ks) {
    if (isNaN(k.c.x)) continue;
    const d = dist(u.x, u.y, k.c.x, k.c.y);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best;
}

// ------------------------------------------------------------------ group logic

function thinkGroup(w: World, g: GroupAI) {
  const ms = members(w, g);
  if (!ms.length) return;
  if (!ms.some((u) => u.alert)) return;
  let L = w.unit(g.leader);
  if (!w.alive(L)) {
    L = ms[0];
    g.leader = L.id;
    setFormation(g, ms);
  }
  const b = g.behavior;
  switch (b.kind) {
    case 'player':
      return;
    case 'hold':
      return holdLogic(w, g, ms);
    case 'route':
      return routeLogic(w, g, ms, L, b);
    case 'patrol':
      return patrolLogic(w, g, ms, L, b);
    case 'hunt':
      return huntLogic(w, g, ms, L, b);
    case 'escort':
      return escortLogic(w, g, ms, b);
    case 'carrier':
      return carrierLogic(w, g, ms, L, b);
    case 'sub':
      for (const u of ms) subLogic(w, g, u, b);
      return;
    case 'raider':
      return raiderLogic(w, g, ms, L, b);
    case 'shadow':
      return shadowLogic(w, g, ms, L, b);
    case 'flee':
      return fleeLogic(w, g, ms, L, b);
    case 'bombard':
      return bombardLogic(w, g, ms, L, b);
    case 'airfield':
      for (const u of ms) airOps(w, g, u, known(w, g.side, u, 900));
      return;
  }
}

function holdLogic(w: World, g: GroupAI, ms: Unit[]) {
  for (const u of ms) {
    if (!isStructureType(u.cls.type)) u.speedSet = 0;
    if (u.hangar.length) airOps(w, g, u, known(w, g.side, u, 900));
  }
}

function threatsNear(w: World, side: 0 | 1, p: Vec, r: number): Known[] {
  return known(w, side, p, 60).filter((k) => surfaceOnly(k) && k.d < r);
}

function routeLogic(w: World, g: GroupAI, ms: Unit[], L: Unit, b: Extract<Behavior, { kind: 'route' }>) {
  const warships = ms.filter(isWarship);
  const merchants = ms.filter((u) => isMerchantType(u.cls.type));
  const engageR = w.env.night ? 9000 : 22000;
  const threats = threatsNear(w, g.side, L, engageR);
  const allWar = warships.length === ms.length;
  if (b.engage !== false && threats.length && (b.engage || allWar)) {
    g.mode = 'engage';
    for (const u of warships) fight(w, u, threats);
    g.data.lastEngage = w.time;
    return;
  }
  if (g.mode === 'engage' && w.time - (g.data.lastEngage ?? 0) < 90) return;
  g.mode = 'cruise';
  // merchants under attack turn away
  if (merchants.length && threats.length) {
    const t = nearest(L, threats);
    if (t && t.d < 10000 && !t.u.cls.sub) {
      const away = headingTo(t.c.x, t.c.y, L.x, L.y);
      g.data.evadeUntil = w.time + 180;
      g.data.evadeH = away;
    }
  }
  for (const u of ms) if (u.alert && u.hangar.length) airOps(w, g, u, known(w, g.side, u, 900));
  const pts = b.pts;
  let target: Vec | null = null;
  while (g.wp < pts.length) {
    const p = km(pts[g.wp]);
    if (dist(L.x, L.y, p.x, p.y) < 1500) g.wp++;
    else {
      target = p;
      break;
    }
  }
  if (!target) {
    if (b.loop && pts.length) {
      g.wp = 0;
      target = km(pts[0]);
    } else if (b.exit) target = zoneXY(w, b.exit);
  }
  if ((g.data.evadeUntil ?? 0) > w.time && merchants.length) {
    const h = g.data.evadeH;
    target = { x: L.x + Math.cos(h) * 4000, y: L.y + Math.sin(h) * 4000 };
  }
  if (!target) {
    L.speedSet = Math.min(L.speedSet, 1);
    return;
  }
  if (b.zigzag && !((g.data.evadeUntil ?? 0) > w.time)) {
    const h = headingTo(L.x, L.y, target.x, target.y);
    const off = Math.sin(w.time / 280) * 1800;
    target = { x: target.x - Math.sin(h) * off, y: target.y + Math.cos(h) * off };
  }
  cruiseTo(w, g, ms, L, target.x, target.y, b.speed);
}

function patrolLogic(w: World, g: GroupAI, ms: Unit[], L: Unit, b: Extract<Behavior, { kind: 'patrol' }>) {
  const r = (b.engage ?? (w.env.night ? 10 : 22)) * 1000;
  const threats = threatsNear(w, g.side, L, r);
  if (threats.length) {
    g.mode = 'engage';
    for (const u of ms) if (isWarship(u)) fight(w, u, threats);
    g.data.lastEngage = w.time;
    return;
  }
  if (g.mode === 'engage' && w.time - (g.data.lastEngage ?? 0) < 120) return;
  g.mode = 'cruise';
  const pts = b.pts;
  if (!pts.length) return;
  let p = km(pts[g.wp % pts.length]);
  if (dist(L.x, L.y, p.x, p.y) < 1500) {
    g.wp = (g.wp + 1) % pts.length;
    p = km(pts[g.wp]);
  }
  cruiseTo(w, g, ms, L, p.x, p.y, b.speed ?? 18);
}

function huntLogic(w: World, g: GroupAI, ms: Unit[], L: Unit, b: Extract<Behavior, { kind: 'hunt' }>) {
  const radius = (b.radius ?? 90) * 1000;
  const enemies = known(w, g.side, L, 240);
  const surf = enemies.filter((k) => surfaceOnly(k) && k.d < radius);
  for (const u of ms) if (u.hangar.length) airOps(w, g, u, enemies);
  if (surf.length) {
    g.mode = 'engage';
    const close = surf.filter((k) => k.c.level >= 2 || k.c.fix);
    const list = close.length ? close : surf;
    let engaged = false;
    for (const u of ms) {
      if (isWarship(u)) engaged = fight(w, u, list, b.prefer) || engaged;
    }
    if (!engaged) {
      const t = nearest(L, list);
      if (t) cruiseTo(w, g, ms, L, t.c.x, t.c.y, b.speed);
    }
    g.data.lastEngage = w.time;
    return;
  }
  if (g.mode === 'engage' && w.time - (g.data.lastEngage ?? 0) < 60) return;
  g.mode = 'cruise';
  // follow the freshest bearing line
  const br = w.bearings[g.side].filter((x) => w.time - x.t < 40);
  if (br.length) {
    const last = br[br.length - 1];
    cruiseTo(w, g, ms, L, last.ox + Math.cos(last.ang) * 12000, last.oy + Math.sin(last.ang) * 12000, b.speed);
    return;
  }
  const lost = [...w.contacts[g.side].values()].filter((c) => !isNaN(c.x) && w.time - c.seen < 900);
  if (lost.length) {
    lost.sort((a, b2) => dist(L.x, L.y, a.x, a.y) - dist(L.x, L.y, b2.x, b2.y));
    const c = lost[0];
    cruiseTo(w, g, ms, L, c.x + Math.cos(c.h) * c.v * (w.time - c.seen), c.y + Math.sin(c.h) * c.v * (w.time - c.seen), b.speed);
    return;
  }
  // nothing known: search the given route, or sweep toward the middle of the map
  if (b.pts && b.pts.length) {
    let p = km(b.pts[Math.min(g.wp, b.pts.length - 1)]);
    if (dist(L.x, L.y, p.x, p.y) < 1500 && g.wp < b.pts.length - 1) {
      g.wp++;
      p = km(b.pts[g.wp]);
    }
    cruiseTo(w, g, ms, L, p.x, p.y, b.speed ?? 15);
    return;
  }
  const cx = w.terrain.w / 2;
  const cy = w.terrain.h / 2;
  if (dist(L.x, L.y, cx, cy) > 6000) cruiseTo(w, g, ms, L, cx, cy, b.speed ?? 18);
  else cruiseTo(w, g, ms, L, cx + Math.cos(w.time / 600) * 8000, cy + Math.sin(w.time / 600) * 8000, b.speed ?? 15);
}

function escortLogic(w: World, g: GroupAI, ms: Unit[], b: Extract<Behavior, { kind: 'escort' }>) {
  const tg = w.groups.get(b.of);
  const prot = tg ? members(w, tg) : [];
  if (!prot.length) {
    huntLogic(w, g, ms, ms[0], { kind: 'hunt', radius: 30 });
    return;
  }
  const PL = w.unit(tg!.leader) && w.alive(w.unit(tg!.leader)) ? w.unit(tg!.leader)! : prot[0];
  const center = centroid(prot);
  const R = (b.radius ?? 12) * 1000;
  const enemies = known(w, g.side, center, 120);
  const surf = enemies.filter((k) => surfaceOnly(k) && k.d < R * 1.6);
  const subs = enemies.filter((k) => k.u.cls.sub && k.d < R * 1.4);
  const busy = new Set<number>();
  // hunt submarines
  for (const k of subs) {
    let best: Unit | null = null;
    let bd = Infinity;
    for (const u of ms) {
      if (busy.has(u.id) || !u.cls.dc || u.dcLeft <= 0) continue;
      const d = dist(u.x, u.y, k.c.x, k.c.y);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    if (!best) break;
    busy.add(best.id);
    huntSub(w, best, k.c);
  }
  // follow up sound bearings near the convoy
  const lines = w.bearings[g.side].filter((x) => w.time - x.t < 30 && dist(x.ox, x.oy, center.x, center.y) < R);
  for (const ln of lines.slice(-2)) {
    const free = ms.find((u) => !busy.has(u.id) && u.cls.dc && u.dcLeft > 0);
    if (!free) break;
    busy.add(free.id);
    const p = { x: ln.ox + Math.cos(ln.ang) * 3500, y: ln.oy + Math.sin(ln.ang) * 3500 };
    huntSub(w, free, p);
  }
  // surface threats
  if (surf.length) {
    for (const u of ms) {
      if (busy.has(u.id) || !isWarship(u)) continue;
      busy.add(u.id);
      fight(w, u, surf);
      const heavy = surf.some((k) => ['BB', 'BC', 'CA'].includes(k.u.cls.type) && k.d < 18000);
      if (heavy && u.cls.smoke && u.smokeOn <= 0 && u.smokeLeft > 0 && w.rng.chance(0.3)) w.orderSmoke([u.id]);
    }
  }
  // screen stations
  const stations = [0, 60, -60, 120, -120, 180, 30, -30, 90, -90];
  let k = 0;
  const r = Math.min(R * 0.3, 4000);
  for (const u of ms) {
    if (busy.has(u.id)) continue;
    const a = (stations[k++ % stations.length] * Math.PI) / 180;
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r;
    if (!u.follow || u.follow.id !== PL.id) u.follow = { id: PL.id, dx, dy };
    u.engage = null;
    u.path = [];
    u.orderH = null;
    u.speedSet = 4;
    u.speedCap = Infinity;
  }
}

function huntSub(w: World, u: Unit, p: Vec) {
  const d = dist(u.x, u.y, p.x, p.y);
  u.follow = null;
  u.engage = null;
  u.orderH = headingTo(u.x, u.y, p.x, p.y);
  u.path = [];
  u.speedSet = 4;
  u.speedCap = d > 2500 ? Infinity : 15 * KN;
}

function carrierLogic(w: World, g: GroupAI, ms: Unit[], L: Unit, b: Extract<Behavior, { kind: 'carrier' }>) {
  const cvs = ms.filter((u) => isCarrierType(u.cls.type));
  const enemies = known(w, g.side, L, 1200);
  for (const u of ms) if (u.hangar.length) airOps(w, g, u, enemies);
  const keep = (b.keepAway ?? 30) * 1000;
  const danger = enemies.filter((k) => surfaceOnly(k) && isWarship(k.u) && k.d < keep && k.c.level >= 2);
  const escorts = ms.filter((u) => !isCarrierType(u.cls.type));
  if (danger.length) {
    // carriers run, escorts fight
    const t = nearest(L, danger)!;
    const away = headingTo(t.c.x, t.c.y, L.x, L.y);
    for (const cv of cvs) {
      cv.follow = null;
      cv.path = [];
      cv.orderH = away + (cv.id % 2 ? 0.2 : -0.2);
      cv.speedSet = 4;
      cv.speedCap = Infinity;
      if (cv.cls.smoke && cv.smokeOn <= 0 && cv.smokeLeft > 0 && t.d < 18000) w.orderSmoke([cv.id]);
    }
    for (const e of escorts) fight(w, e, danger);
    g.mode = 'engage';
    return;
  }
  g.mode = 'cruise';
  const lead = cvs[0] ?? L;
  if (b.pts && b.pts.length) {
    let p = km(b.pts[g.wp % b.pts.length]);
    if (dist(lead.x, lead.y, p.x, p.y) < 2000) {
      g.wp = (g.wp + 1) % b.pts.length;
      p = km(b.pts[g.wp]);
    }
    if (g.leader !== lead.id) {
      g.leader = lead.id;
      setFormation(g, [lead, ...ms.filter((u) => u !== lead)]);
    }
    cruiseTo(w, g, ms, lead, p.x, p.y, 20);
  } else {
    if (g.leader !== lead.id) {
      g.leader = lead.id;
      setFormation(g, [lead, ...ms.filter((u) => u !== lead)]);
    }
    // steam slowly in a box around the start point
    if (g.data.homeX === undefined) {
      g.data.homeX = lead.x;
      g.data.homeY = lead.y;
    }
    const a = w.time / 900;
    cruiseTo(w, g, ms, lead, g.data.homeX + Math.cos(a) * 6000, g.data.homeY + Math.sin(a) * 6000, 18);
  }
}

/** Launch strikes and scouts from a carrier or airfield. */
function airOps(w: World, g: GroupAI, base: Unit, enemies: Known[]) {
  base.autoCap = true;
  const sqs = base.hangar.map((id) => w.sq(id)).filter((s): s is Squadron => !!s && s.state !== 'gone' && s.n > 0);
  if (!sqs.length) return;
  const keyS = 'strike' + base.id;
  if (w.time - (g.data[keyS] ?? -1e9) > 420) {
    const ready = sqs.filter((s) => s.state === 'deck' && s.ready <= w.time && s.ordnance && (s.def.role === 'dive' || s.def.role === 'torpedo' || s.def.role === 'level'));
    if (ready.length) {
      // Planes already heading for each target, so a big raid spreads over
      // several equally good targets instead of piling onto one.
      const load = new Map<number, number>();
      for (const s of w.squadrons) {
        if (s.side !== base.side || s.n <= 0 || !s.target?.unit) continue;
        if (s.state === 'outbound' || s.state === 'attack' || (s.state === 'queued' && s.next === 'outbound')) {
          load.set(s.target.unit, (load.get(s.target.unit) ?? 0) + s.n);
        }
      }
      const value = (k: Known, s: Squadron): number => {
        if (k.u.cls.sub || isNaN(k.c.x) || w.time - k.c.seen > 1200) return 0;
        const d = dist(base.x, base.y, k.c.x, k.c.y);
        if (d > s.def.radius * 1000 * 0.92) return 0;
        const hp = clamp(k.u.hp / k.u.maxHp, 0.1, 1);
        const v = (isCarrierType(k.u.cls.type) ? 25 : TYPE_VALUE[k.u.cls.type]) * (k.c.level >= 3 ? 1.2 : 1) * (0.35 + 0.65 * hp);
        return v / (1 + d / 100000) / (1 + (load.get(k.u.id) ?? 0) / 14);
      };
      const plan = new Map<number, { k: Known; ids: number[] }>();
      // torpedo bombers first: they need the undamaged, high-value targets
      const order = [...ready].sort((a, b) => (b.def.role === 'torpedo' ? 1 : 0) - (a.def.role === 'torpedo' ? 1 : 0));
      for (const s of order) {
        let best: Known | null = null;
        let bs = 0;
        for (const k of enemies) {
          const v = value(k, s);
          if (v > bs) {
            bs = v;
            best = k;
          }
        }
        if (!best) continue;
        const p = plan.get(best.u.id) ?? { k: best, ids: [] };
        p.ids.push(s.id);
        plan.set(best.u.id, p);
        load.set(best.u.id, (load.get(best.u.id) ?? 0) + s.n);
      }
      if (plan.size) {
        const fighters = sqs.filter((s) => s.def.role === 'fighter' && s.state === 'deck' && s.ready <= w.time);
        const capUp = sqs.some((s) => s.def.role === 'fighter' && (s.state === 'cap' || s.state === 'intercept'));
        const main = [...plan.values()].sort((a, b) => b.ids.length - a.ids.length)[0];
        if (fighters.length > 1 || (fighters.length === 1 && capUp)) main.ids.push(fighters[0].id);
        for (const p of plan.values()) orderStrike(w, p.ids, { unit: p.k.u.id, x: p.k.c.x, y: p.k.c.y });
        g.data[keyS] = w.time;
        if (base.side === 0) w.msg(`${base.name} is launching a strike.`, 'info', base);
      }
    }
  }
  // Keep searching. Floatplanes and scouts fly regularly; a dive bomber
  // squadron is only spent on scouting while no carrier or base is in sight.
  const keyC = 'scout' + base.id;
  const knowsBig = enemies.some((k) => (isCarrierType(k.u.cls.type) || k.u.cls.type === 'BASE') && w.time - k.c.seen < 1200);
  if (w.time - (g.data[keyC] ?? -1e9) > (knowsBig ? 1500 : 900)) {
    let scout = sqs.find((s) => (s.def.role === 'scout' || s.def.role === 'patrol') && s.state === 'deck' && s.ready <= w.time);
    if (!scout && !knowsBig) {
      const dives = sqs.filter((s) => s.def.role === 'dive' && s.state === 'deck' && s.ready <= w.time);
      if (dives.length >= 2) scout = dives[dives.length - 1];
    }
    // floatplanes on other ships in the group
    if (!scout) {
      for (const id of g.members) {
        const m = w.unit(id);
        if (!w.alive(m)) continue;
        for (const sid of m.hangar) {
          const s = w.sq(sid);
          if (s && s.def.role === 'scout' && s.state === 'deck' && s.ready <= w.time) {
            scout = s;
            break;
          }
        }
        if (scout) break;
      }
    }
    if (scout) {
      const cx = w.terrain.w / 2;
      const cy = w.terrain.h / 2;
      // step through search sectors either side of the line to mid-ocean
      const sector = (g.data.sector = ((g.data.sector ?? -1) + 1) % 6);
      const a = headingTo(base.x, base.y, cx, cy) + [-0.45, 0.45, -1.1, 1.1, 0, -1.6][sector] + w.rng.range(-0.15, 0.15);
      const r = scout.def.radius * 1000 * 0.85;
      orderScout(w, scout.id, base.x + Math.cos(a) * r, base.y + Math.sin(a) * r);
      g.data[keyC] = w.time;
    }
  }
}

function subLogic(w: World, g: GroupAI, u: Unit, b: Extract<Behavior, { kind: 'sub' }>) {
  if (!u.alert) return;
  const t = w.time;
  const enemies = known(w, g.side, u, 120);
  const myContact = w.contacts[u.side === 0 ? 1 : 0].get(u.id);
  const spotted = !!myContact && myContact.level >= 2 && t - myContact.seen < 10;
  const escorts = enemies.filter((k) => k.u.cls.dc && !isNaN(k.c.x) && k.d < 3500).sort((a, c) => a.d - c.d);
  // an escort coming straight at us at close range has probably got us
  const charging = escorts.some((k) => k.d < 1200 && k.c.v > 4 && Math.abs(angleDiff(k.c.h, headingTo(k.c.x, k.c.y, u.x, u.y))) < 0.5);
  let aircraft = false;
  for (const s of w.squadrons) {
    if (s.side === u.side || !airborne(s) || s.n <= 0) continue;
    if (w.airSeen[u.side].has(s.id) && dist(u.x, u.y, s.x, s.y) < 9000) aircraft = true;
  }
  const evadeKey = 'ev' + u.id;
  const firedKey = 'fired' + u.id;

  // the best target in sight, skipping ships that already have our torpedoes running at them
  const running = new Map<number, number>();
  for (const tp of w.torps) if (tp.side === u.side && tp.aimAt !== undefined) running.set(tp.aimAt, (running.get(tp.aimAt) ?? 0) + 1);
  // escorts are not worth a torpedo, except one charging straight at us ("down the throat")
  const small = (k: Known) => ['DD', 'DE', 'TB', 'PT'].includes(k.u.cls.type);
  const throat = (k: Known) => k.d < 1500 && k.c.v > 4 && Math.abs(angleDiff(k.c.h, headingTo(k.c.x, k.c.y, u.x, u.y))) < 0.25;
  const prey = enemies.filter((k) => surfaceOnly(k) && !k.u.cls.sub && !isNaN(k.c.x) && (running.get(k.u.id) ?? 0) < (isCapitalType(k.u.cls.type) ? 6 : 3) && (!small(k) || throat(k) || (b.prefer ?? []).some((tg) => k.u.tags.includes(tg))));
  let best: Known | null = null;
  let bs = 0;
  for (const k of prey) {
    let v = TYPE_VALUE[k.u.cls.type];
    if (isMerchantType(k.u.cls.type)) v += 3;
    if (b.prefer && b.prefer.some((tg) => k.u.tags.includes(tg))) v += 8;
    if (k.u.cls.dc) v -= 2;
    const s = v / (1 + k.d / 5000);
    if (s > bs) {
      bs = s;
      best = k;
    }
  }
  const def = u.cls.torps ? TORPS[u.cls.torps.t] : null;
  const d = best ? dist(u.x, u.y, best.c.x, best.c.y) : Infinity;
  // ships at anchor or crawling can be approached to point-blank range
  const fireR = !best || !def ? 2000 : best.c.v < 6 * KN ? 1800 : Math.min(def.range * 0.75, def.speed < 35 ? 1800 : 2200);
  const escortNear = enemies.some((k) => k.u.cls.dc && !isNaN(k.c.x) && k.d < 2600);

  // 1. a good target in range: shoot first, even if the escorts are coming.
  // A position from crossed sound bearings is not good enough to aim with.
  const seen = !!best && best.c.level >= 2;
  if (best && def && seen && u.torpLoaded > 0 && u.depth !== 'deep' && d <= fireR && t - (g.data[firedKey] ?? -1e9) > 25) {
    const tgt = best.u;
    u.autoTarget = tgt.id;
    const salvo = isMerchantType(tgt.cls.type) ? ((u.cls.torps?.tubes ?? 4) >= 8 ? 3 : 2) : 4;
    fireTorpedoes(w, u, { unit: tgt, x: tgt.x, y: tgt.y }, Math.min(u.torpLoaded, salvo));
    g.data[firedKey] = t;
    g.data[evadeKey] = t + 100;
    // stay up only among merchantmen at night; any warship will shoot back
    const warships = enemies.some((k) => !k.u.cls.merchant && !isStructureType(k.u.cls.type) && k.d < 6000);
    w.setDepth(u, w.env.night && !warships && !aircraft ? 'surface' : w.env.shallow ? 'periscope' : 'deep');
    u.orderH = wrap(headingTo(tgt.x, tgt.y, u.x, u.y) + 0.8);
    u.path = [];
    u.follow = null;
    u.speedSet = 3;
    return;
  }

  // 2. hunted: go deep and creep away
  if ((spotted && escorts.length) || charging) {
    const n = escorts[0] ?? nearest(u, enemies);
    w.setDepth(u, w.env.shallow ? 'periscope' : 'deep');
    if (n) u.orderH = wrap(headingTo(n.c.x, n.c.y, u.x, u.y) + (u.id % 2 ? 1 : -1) * 0.9);
    u.path = [];
    u.follow = null;
    u.speedSet = spotted ? 2 : 1;
    g.data[evadeKey] = t + 150;
    return;
  }
  if (aircraft && u.depth === 'surface') w.setDepth(u, spotted ? 'deep' : 'periscope');
  if ((g.data[evadeKey] ?? 0) > t) return;

  // 3. job done, or nothing left to shoot with: make for the exit
  const exit = zoneXY(w, b.exit);
  if (exit) {
    const preyLeft = !b.prefer || w.units.some((e) => e.side !== u.side && w.alive(e) && b.prefer!.some((tg) => e.tags.includes(tg)));
    const empty = u.torpLoaded <= 0 && u.torpReloads <= 0;
    if (g.mode === 'retreat' || empty || !preyLeft) {
      g.mode = 'retreat';
      if (!u.path.length || t - u.pathAt > 30) {
        w.pathTo(u, exit.x, exit.y);
        u.pathAt = t;
      }
      u.follow = null;
      const hunted = enemies.some((k) => k.u.cls.dc && !isNaN(k.c.x) && k.d < 4000);
      w.setDepth(u, (w.env.night || !hunted) && !aircraft && !spotted ? 'surface' : 'periscope');
      u.speedSet = 4;
      return;
    }
  }

  // 4. nothing in sight: search
  if (!best) {
    // follow sound bearings first
    const lines = w.bearings[g.side].filter((x) => t - x.t < 40 && dist(x.ox, x.oy, u.x, u.y) < 20000);
    if (lines.length) {
      const ln = lines[lines.length - 1];
      u.orderH = ln.ang;
      u.path = [];
      u.follow = null;
      const safe = w.env.night && !aircraft;
      w.setDepth(u, safe ? 'surface' : 'periscope');
      u.speedSet = safe ? 4 : 2;
      return;
    }
    // run on the surface unless aircraft or escorts are about, or we have
    // just given ourselves away
    const recent = [...w.contacts[g.side].values()].some((c) => {
      const e = w.unit(c.id);
      return !!e && !e.cls.merchant && t - c.seen < 600 && dist(u.x, u.y, c.x, c.y) < 12000;
    });
    const quiet = !aircraft && !recent && t - (g.data[firedKey] ?? -1e9) > 600;
    if (quiet || u.battery < 0.45) w.setDepth(u, aircraft ? 'periscope' : 'surface');
    const area = b.area;
    let goal: Vec | null = null;
    if (b.pts && b.pts.length) {
      let p = km(b.pts[Math.min(g.wp, b.pts.length - 1)]);
      if (dist(u.x, u.y, p.x, p.y) < 1200 && g.wp < b.pts.length - 1) {
        g.wp++;
        p = km(b.pts[g.wp]);
      }
      goal = dist(u.x, u.y, p.x, p.y) > 1200 ? p : null;
    } else if (area) {
      const p = { x: area[0] * 1000, y: area[1] * 1000 };
      goal = dist(u.x, u.y, p.x, p.y) > area[2] * 1000 ? p : null;
    } else {
      // last known enemy, dead-reckoned, else the middle of the map
      const old = [...w.contacts[g.side].values()].filter((c) => !isNaN(c.x) && t - c.seen < 1800);
      if (old.length) {
        old.sort((a, c) => dist(u.x, u.y, a.x, a.y) - dist(u.x, u.y, c.x, c.y));
        const c = old[0];
        goal = { x: c.x + Math.cos(c.h) * c.v * (t - c.seen), y: c.y + Math.sin(c.h) * c.v * (t - c.seen) };
      } else {
        goal = { x: w.terrain.w / 2, y: w.terrain.h / 2 };
        if (dist(u.x, u.y, goal.x, goal.y) < 3000) goal = null;
      }
    }
    u.follow = null;
    if (goal) {
      if (w.terrain.hasLand) {
        if (!u.path.length || t - u.pathAt > 30) {
          w.pathTo(u, goal.x, goal.y);
          u.pathAt = t;
        }
      } else {
        u.orderH = headingTo(u.x, u.y, goal.x, goal.y);
        u.path = [];
      }
      u.speedSet = u.depth === 'surface' ? 3 : 2;
    } else {
      u.orderH = wrap(u.h + 0.3);
      u.path = [];
      u.speedSet = 1;
    }
    return;
  }

  // 5. close in on the target
  u.autoTarget = best.u.id;
  u.follow = null;
  if (d > fireR) {
    u.path = [];
    const carriers = enemies.some((k) => isCarrierType(k.u.cls.type) && k.d < 45000);
    // an alerted warship close by would see a surfaced boat and open fire
    const guns = enemies.some((k) => !k.u.cls.merchant && !isStructureType(k.u.cls.type) && k.u.alert && k.d < (w.env.night ? 3000 : 6000));
    // By day a surfaced boat near a carrier group will be seen from the air.
    const surfaceOk = !spotted && !aircraft && !guns && (w.env.night || (d > 18000 && !carriers));
    const tv = best.c.v;
    if (tv < 1.5) {
      // at anchor or stopped: straight in
      w.setDepth(u, surfaceOk ? 'surface' : 'periscope');
      u.orderH = headingTo(u.x, u.y, best.c.x, best.c.y);
      u.speedSet = surfaceOk ? 3 : 2;
      return;
    }
    const th = best.c.h;
    // where we are relative to her: distance ahead along her course, and off to one side
    const rx = u.x - best.c.x;
    const ry = u.y - best.c.y;
    const along = rx * Math.cos(th) + ry * Math.sin(th);
    const cross = -rx * Math.sin(th) + ry * Math.cos(th);
    const side = cross >= 0 ? 1 : -1;
    let px: number;
    let py: number;
    if (along < 2000) {
      // the end-around: stay well out on her beam and race ahead
      const out = Math.max(Math.abs(cross), 5000);
      const ahead = Math.max(along, 0) + 6000;
      px = best.c.x + Math.cos(th) * ahead - Math.sin(th) * side * out;
      py = best.c.y + Math.sin(th) * ahead + Math.cos(th) * side * out;
    } else {
      // ahead of her: turn in toward her track and let her come on
      const meet = along * 0.7;
      px = best.c.x + Math.cos(th) * meet;
      py = best.c.y + Math.sin(th) * meet;
    }
    const inPosition = along >= 2000 && Math.abs(cross) < 4000;
    w.setDepth(u, surfaceOk && !(inPosition && !w.env.night) ? 'surface' : 'periscope');
    u.orderH = headingTo(u.x, u.y, px, py);
    if (inPosition && u.depth !== 'surface') u.speedSet = 1;
    else u.speedSet = surfaceOk ? 4 : d > 5000 && u.battery > 0.5 ? 3 : 2;
    return;
  }
  if (!seen) {
    // in range of a sound fix but not in sight: creep closer for a look
    u.orderH = headingTo(u.x, u.y, best.c.x, best.c.y);
    u.path = [];
    u.speedSet = 2;
    if (u.depth === 'deep') w.setDepth(u, 'periscope');
    return;
  }
  // in range but reloading: keep station off the target's beam, out of sight
  const side = best.c.h + Math.PI / 2;
  u.orderH = headingTo(u.x, u.y, best.c.x + Math.cos(side) * 3500, best.c.y + Math.sin(side) * 3500);
  u.path = [];
  u.speedSet = 2;
  const armed = enemies.some((k) => !k.u.cls.merchant && !isStructureType(k.u.cls.type) && k.d < 6000);
  if (armed && u.depth === 'surface') w.setDepth(u, 'periscope');
  else if (!armed && !aircraft && u.battery < 0.3) w.setDepth(u, 'surface');
}

function raiderLogic(w: World, g: GroupAI, ms: Unit[], L: Unit, b: Extract<Behavior, { kind: 'raider' }>) {
  const enemies = known(w, g.side, L, 300);
  const big = ms.filter((u) => ['BB', 'BC', 'CA'].includes(u.cls.type));
  const worst = big.length ? Math.min(...big.map((u) => u.hp / u.maxHp)) : 1;
  const exit = zoneXY(w, b.exit);
  // the job is done once every preferred target is gone
  const preyGone = (alive: boolean) => w.units.filter((e) => e.side !== g.side && (alive ? w.alive(e) : e.sunk) && b.prefer!.some((t) => e.tags.includes(t))).length;
  const done = !!b.prefer && (preyGone(true) === 0 || (b.quota !== undefined && preyGone(false) >= b.quota));
  if ((g.mode === 'retreat' || done || (b.retreatHp && worst < b.retreatHp)) && exit) {
    if (g.mode !== 'retreat') {
      g.mode = 'retreat';
      if (g.side === 1) w.msg('The enemy raider is breaking off!', 'good', L);
    }
    for (const u of ms) {
      w.pathTo(u, exit.x, exit.y);
      u.follow = null;
      u.engage = null;
      u.speedSet = 4;
      u.speedCap = Infinity;
    }
    return;
  }
  const surf = enemies.filter(surfaceOnly);
  if (surf.length) {
    g.mode = 'engage';
    for (const u of ms) if (isWarship(u)) fight(w, u, surf, b.prefer);
    return;
  }
  g.mode = 'cruise';
  huntLogic(w, g, ms, L, { kind: 'hunt', prefer: b.prefer });
}

function shadowLogic(w: World, g: GroupAI, ms: Unit[], L: Unit, b: Extract<Behavior, { kind: 'shadow' }>) {
  const enemies = known(w, g.side, L, 600).filter((k) => k.u.tags.includes(b.of) && !isNaN(k.c.x));
  const t = nearest(L, enemies);
  if (!t) {
    huntLogic(w, g, ms, L, { kind: 'hunt', prefer: [b.of] });
    return;
  }
  const R = (b.range ?? 18) * 1000;
  const a = headingTo(t.c.x, t.c.y, L.x, L.y);
  cruiseTo(w, g, ms, L, t.c.x + Math.cos(a) * R + Math.cos(t.c.h) * 3000, t.c.y + Math.sin(a) * R + Math.sin(t.c.h) * 3000);
}

function fleeLogic(w: World, g: GroupAI, ms: Unit[], L: Unit, b: Extract<Behavior, { kind: 'flee' }>) {
  const p = zoneXY(w, b.exit);
  if (!p) return;
  for (const u of ms) {
    if (!u.path.length || dist(u.path[u.path.length - 1].x, u.path[u.path.length - 1].y, p.x, p.y) > 500) w.pathTo(u, p.x, p.y);
    u.follow = null;
    u.speedSet = 4;
    u.speedCap = Infinity;
    const threats = threatsNear(w, g.side, u, 15000);
    if (threats.length && u.cls.smoke && u.smokeOn <= 0 && u.smokeLeft > 0) w.orderSmoke([u.id]);
  }
}

function bombardLogic(w: World, g: GroupAI, ms: Unit[], L: Unit, b: Extract<Behavior, { kind: 'bombard' }>) {
  const z = w.zone(b.zone);
  if (!z) return;
  const threats = threatsNear(w, g.side, L, w.env.night ? 9000 : 16000);
  const heavy = ms.filter((u) => ['BB', 'BC', 'CA'].includes(u.cls.type));
  const light = ms.filter((u) => isWarship(u) && !heavy.includes(u));
  if (threats.length) for (const u of light) fight(w, u, threats);
  const inZone = heavy.some((u) => w.inZone(u, z));
  if (inZone) {
    if (!w.flags.has('bombard:' + g.id)) {
      w.flags.add('bombard:' + g.id);
      g.data.bombardAt = w.time;
      w.msg(g.side === 1 ? `The enemy has reached ${z.name}!` : `Bombardment force in position at ${z.name}.`, g.side === 1 ? 'bad' : 'good');
    }
  }
  const done = g.data.bombardAt !== undefined && w.time - g.data.bombardAt > 900;
  const exit = zoneXY(w, b.exit);
  const dest = done && exit ? exit : { x: z.x, y: z.y };
  const lead = heavy[0] ?? L;
  if (threats.length && heavy.length) {
    // heavy ships keep going but fight what they meet
    for (const u of heavy) {
      const t = pickFor(w, u, threats);
      if (t) u.autoTarget = t.u.id;
    }
  }
  if (g.leader !== lead.id) {
    g.leader = lead.id;
    setFormation(g, [lead, ...ms.filter((u) => u !== lead)]);
  }
  const followers = threats.length ? heavy : ms;
  cruiseTo(w, g, followers.includes(lead) ? followers : [lead, ...followers], lead, dest.x, dest.y);
}

// ------------------------------------------------------------------ assistance for the human player's ships

function playerAssist(w: World) {
  if (w.controllers[0] !== 'human') return;
  for (const u of w.units) {
    if (u.side !== 0 || !u.controllable || !w.alive(u)) continue;
    if (u.engage === null || u.path.length || u.follow) continue;
    const c = w.contacts[0].get(u.engage);
    const t = w.unit(u.engage);
    if (!w.alive(t) || !c || w.time - c.seen > 90 || isNaN(c.x)) {
      u.engage = null;
      continue;
    }
    const { pref, run } = prefRange(w, u, t, c.level >= 2);
    manoeuvre(w, u, c, pref, run);
  }
}

export function assignBehavior(w: World, groupId: string, b: Behavior) {
  const g = w.groups.get(groupId);
  if (!g) return;
  g.behavior = b;
  g.wp = 0;
  g.mode = 'cruise';
  g.nextThink = w.time;
  delete g.data.destX;
  delete g.data.destY;
}
