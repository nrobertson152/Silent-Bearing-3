// Gunnery, torpedoes, depth charges and damage.

import {
  DEG, KN, angleDiff, clamp, dist, headingTo, inEllipse, interceptTime, segHitsEllipse,
} from '../core/math';
import { TORPS, dudChance } from '../data/weapons';
import { NATIONS, aswSkill } from '../data/nations';
import { SIZE, TYPE_NAMES, isCarrierType, isStructureType } from '../data/ships';
import type { DepthCharge, MountState, Shell, Side, Torpedo, Unit } from './types';
import type { World } from './world';

export interface DamageSrc {
  kind: 'shell' | 'torp' | 'bomb' | 'dc' | 'mine' | 'ground' | 'kamikaze' | 'fire';
  side: Side;
  from: number;
  cal?: number;
  pen?: boolean;
  /** a plunging shell that came through the deck */
  plunge?: boolean;
  fire?: number;
}

export function updateCombat(w: World, dt: number) {
  for (const u of w.units) {
    if (u.sunk || u.escaped) continue;
    if (u.cls.torps && u.torpTimer > 0) {
      u.torpTimer -= dt;
      if (u.torpTimer <= 0) reloadTorps(w, u);
    }
    if (u.dcCool > 0) u.dcCool -= dt;
    updateSolution(w, u);
    if (!u.alert) {
      for (const m of u.mounts) if (m.reload > 0) m.reload -= dt;
      continue;
    }
    gunnery(w, u, dt);
    asw(w, u);
  }
}

function reloadTorps(w: World, u: Unit) {
  const T = u.cls.torps!;
  if (u.torpReloads <= 0) return;
  if (u.cls.sub) {
    u.torpLoaded++;
    u.torpReloads--;
    if (u.torpLoaded < T.tubes && u.torpReloads > 0) u.torpTimer = T.reloadTime;
  } else {
    const n = Math.min(T.tubes - u.torpLoaded, u.torpReloads);
    u.torpLoaded += n;
    u.torpReloads -= n;
    if (u.side === 0) w.msg(`${u.name} has reloaded her torpedo tubes.`, 'info', u);
  }
}

function updateSolution(w: World, u: Unit) {
  const t = w.unit(u.fc.tid);
  if (!t) return;
  if (Math.abs(angleDiff(u.fc.th, t.h)) > 0.26) {
    u.fc.q = Math.max(0, u.fc.q - 0.3);
    u.fc.th = t.h;
  }
  if (Math.abs(t.v - u.fc.tv) > 2.6) {
    u.fc.q = Math.max(0, u.fc.q - 0.22);
    u.fc.tv = t.v;
  }
  if (Math.abs(angleDiff(u.fc.myH, u.h)) > 0.44) {
    u.fc.q = Math.max(0, u.fc.q - 0.15);
    u.fc.myH = u.h;
  }
}

export function inArc(u: Unit, m: MountState, brg: number): boolean {
  if (isStructureType(u.cls.type)) return true;
  const rel = angleDiff(u.h, brg);
  const a = Math.abs(rel);
  const s = m.def.s ?? 0;
  const p = m.def.p;
  if (s !== 0) return Math.sign(rel) === s && a > 0.26 && a < 2.88;
  if (p > 0.05) return a < Math.PI - 0.61;
  if (p < -0.05) return a > 0.61;
  return a > 0.44 && a < Math.PI - 0.44;
}

export function canTarget(w: World, u: Unit, t: Unit | undefined, range: number): t is Unit {
  if (!t || t.sunk || t.escaped || t.side === u.side) return false;
  if (t.cls.sub && t.depth !== 'surface') return false;
  const c = w.contacts[u.side].get(t.id);
  if (!c || c.level < 2 || w.time - c.seen > 2.5) return false;
  const dx = t.x - u.x;
  const dy = t.y - u.y;
  return dx * dx + dy * dy <= range * range;
}

/**
 * A submarine's deck gun gives her away: use it only on merchant ships with
 * no warship anywhere near, or when the player has picked the target.
 */
function subGunOk(w: World, u: Unit, t: Unit): boolean {
  if (u.target === t.id && u.side === 0 && w.controllers[0] === 'human') return true;
  if (!t.cls.merchant) return false;
  for (const e of w.units) {
    if (e.side === u.side || !w.alive(e) || e.cls.merchant || isStructureType(e.cls.type)) continue;
    if (Math.abs(e.x - u.x) < 12000 && Math.abs(e.y - u.y) < 12000) return false;
  }
  return true;
}

/**
 * Computer-controlled ships at night do not give themselves away with gun
 * flashes before they must: torpedoes go first, and nobody fires blind at a
 * radar blip they cannot see unless they are already under fire.
 */
function nightDiscipline(w: World, u: Unit, t: Unit): boolean {
  if (!w.env.night || w.time < u.underFire) return false;
  if (u.side === 0 && u.controllable && w.controllers[0] === 'human') return false;
  if (t.illuminated || t.fires > 0 || w.time - t.lastFire < 10) return false;
  const d = dist(u.x, u.y, t.x, t.y);
  const visual = w.env.vis * SIZE[t.cls.type] * (NATIONS[u.nation].nightBonus ?? 1);
  if (!u.fcRadar && d > visual) return true;
  const torpsReady = u.torpLoaded > 0 && !u.cls.sub;
  return torpsReady && d > 2500;
}

function gunnery(w: World, u: Unit, dt: number) {
  const submerged = !!u.cls.sub && u.depth !== 'surface';
  for (const m of u.mounts) {
    if (m.reload > 0) {
      m.reload -= dt;
      continue;
    }
    if (m.dead || u.holdFire || submerged) continue;
    const tgt = pickTarget(w, u, m);
    if (tgt && u.cls.sub && !subGunOk(w, u, tgt)) {
      m.reload = 2;
      continue;
    }
    if (tgt && nightDiscipline(w, u, tgt)) {
      m.reload = 2;
      continue;
    }
    if (!tgt) {
      m.reload = 0.6 + w.rng.next() * 0.6;
      continue;
    }
    fireMount(w, u, m, tgt);
  }
}

function pickTarget(w: World, u: Unit, m: MountState): Unit | null {
  const range = m.gun.range;
  const ok = (t: Unit | undefined): t is Unit => canTarget(w, u, t, range) && inArc(u, m, headingTo(u.x, u.y, t.x, t.y));
  if (!m.def.sec) {
    const d = w.unit(u.target);
    if (ok(d)) return d;
    const a = w.unit(u.autoTarget);
    if (ok(a)) return a;
  }
  // nearest valid target; secondaries prefer small, fast ships
  let best: Unit | null = null;
  let bestScore = Infinity;
  for (const t of w.units) {
    if (t.side === u.side || t.sunk || t.escaped) continue;
    if (!ok(t)) continue;
    let s = dist(u.x, u.y, t.x, t.y);
    if (m.def.sec && (t.cls.type === 'DD' || t.cls.type === 'PT' || t.cls.type === 'TB' || t.cls.type === 'DE')) s *= 0.6;
    if (s < bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return best;
}

function fireMount(w: World, u: Unit, m: MountState, t: Unit) {
  const g = m.gun;
  const d = dist(u.x, u.y, t.x, t.y);
  const main = !m.def.sec;
  let q: number;
  if (main) {
    if (u.fc.tid !== t.id) u.fc = { tid: t.id, q: u.fcRadar ? (w.year >= 1943.5 ? 0.22 : 0.14) : 0.05, th: t.h, tv: t.v, myH: u.h };
    q = u.fc.q;
  } else {
    q = 0.3;
  }
  const vel = g.vel * (1 - (0.25 * d) / g.range);
  const T = d / Math.max(150, vel);
  const ax = t.x + Math.cos(t.h) * t.v * T;
  const ay = t.y + Math.sin(t.h) * t.v * T;
  let skill = w.crewSkill(u);
  if (u.side === 1) skill *= w.diff.enemyAcc;
  if (u.special.includes('unworked')) skill *= 0.75;
  let envMul = 1 + 0.12 * (w.env.sea ?? 1);
  if (w.env.night && !u.fcRadar && !t.illuminated && t.fires === 0) {
    // a search-radar or sound bearing is no substitute for seeing the target
    const seenBy = (w.env.vis * SIZE[t.cls.type] * (w.time - t.lastFire < 8 ? 4.5 : 1)) * (NATIONS[u.nation].nightBonus ?? 1);
    envMul *= d < seenBy ? 1.35 : 2.6;
  }
  if (u.crits.fc > 0) envMul *= 1.6;
  if (w.inSquall(t.x, t.y) || w.smokeBlocks(u.x, u.y, t.x, t.y)) envMul *= u.fcRadar ? 1.15 : 1.5;
  const sol = (d * 0.028 * (1 - 0.8 * q) * envMul) / skill;
  const disp = (d * g.disp * envMul) / Math.sqrt(skill);
  const ang = headingTo(u.x, u.y, ax, ay);
  const er = w.rng.gauss() * sol * 1.3;
  const ed = w.rng.gauss() * sol * 0.55;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const mp = m.def.p * u.cls.length;
  const ms = (m.def.s ?? 0) * u.cls.beam * 0.3;
  const ox = u.x + Math.cos(u.h) * mp - Math.sin(u.h) * ms;
  const oy = u.y + Math.sin(u.h) * mp + Math.cos(u.h) * ms;
  for (let i = 0; i < m.def.n; i++) {
    const sr = w.rng.gauss() * disp * 1.25;
    const sd = w.rng.gauss() * disp * 0.6;
    w.shells.push({
      x0: ox, y0: oy,
      x1: ax + ca * (er + sr) - sa * (ed + sd),
      y1: ay + sa * (er + sr) + ca * (ed + sd),
      t0: w.time,
      t1: w.time + T * (1 + w.rng.range(-0.02, 0.02)),
      cal: g.cal, dmg: g.dmg, pen: g.pen, fire: g.fire,
      side: u.side, from: u.id, range: d, maxRange: g.range,
    });
  }
  w.stats[u.side].shots += m.def.n;
  m.aim = angleDiff(u.h, ang);
  m.reload = g.reload * (1 - 0.04 * u.vet) * w.rng.range(0.95, 1.08);
  if (u.special.includes('unworked') && main && w.rng.chance(0.03)) {
    m.reload += 60;
    if (u.side === 0) w.msg(`${u.name}: a turret has jammed.`, 'warn', u);
  }
  u.lastFire = w.time;
  // early fire-control radar helped less than the later sets
  const radarGain = u.fcRadar ? (w.year >= 1943.5 ? 0.12 : 0.095) : 0.08;
  if (main) u.fc.q = Math.min(1, q + radarGain * (0.7 + 0.3 * skill));
  if (main) t.underFire = w.time + T + 40;
  w.events.push({ k: 'fire', x: ox, y: oy, cal: g.cal, side: u.side, unit: u.id, ang });
  if (!t.alert) w.alarm(t, T + 8);
}

export function landShell(w: World, s: Shell) {
  let hit: Unit | null = null;
  for (const t of w.units) {
    if (t.side === s.side || t.sunk || t.escaped) continue;
    if (t.cls.sub && t.depth !== 'surface') continue;
    const L = t.cls.length;
    const dx = t.x - s.x1;
    const dy = t.y - s.y1;
    if (Math.abs(dx) > L || Math.abs(dy) > L) continue;
    const st = isStructureType(t.cls.type);
    const a = st ? L / 2 : L / 2 + 5;
    const b = st ? t.cls.beam / 2 : t.cls.beam / 2 + 7;
    if (inEllipse(s.x1, s.y1, t.x, t.y, t.h, a, b)) {
      hit = t;
      break;
    }
  }
  if (hit) {
    shellHit(w, hit, s);
    w.events.push({ k: 'hit', x: s.x1, y: s.y1, cal: s.cal, unit: hit.id });
    return;
  }
  if (w.terrain.hasLand && w.terrain.sample(s.x1, s.y1) > 0) {
    w.events.push({ k: 'boom', x: s.x1, y: s.y1, size: 0.25 + s.cal / 700 });
  } else {
    w.events.push({ k: 'splash', x: s.x1, y: s.y1, cal: s.cal });
  }
  // near misses wake up sleeping ships
  for (const t of w.units) {
    if (t.alert || t.sunk || t.side === s.side) continue;
    if (Math.abs(t.x - s.x1) < 1500 && Math.abs(t.y - s.y1) < 1500) w.alarm(t, 10);
  }
}

function shellHit(w: World, t: Unit, s: Shell) {
  const st = isStructureType(t.cls.type);
  const plunging = s.range > s.maxRange * 0.55;
  const armor = st ? t.cls.belt : plunging ? t.cls.deck : t.cls.belt;
  let mult: number;
  let pen: boolean;
  if (armor <= 0) {
    mult = s.cal >= 280 && t.cls.tons < 5000 ? 0.45 : 1;
    pen = true;
  } else if (s.pen >= armor) {
    mult = 1;
    pen = true;
  } else {
    mult = 0.22 + (0.5 * s.pen) / armor;
    pen = false;
  }
  if (st) mult *= 0.6;
  w.stats[s.side].hits++;
  applyDamage(w, t, s.dmg * mult * w.rng.range(0.7, 1.3), {
    kind: 'shell', side: s.side, from: s.from, cal: s.cal, pen, plunge: plunging && pen && !st, fire: s.fire * (pen ? 1 : 0.6),
  });
}

export function applyDamage(w: World, t: Unit, dmg: number, src: DamageSrc) {
  if (t.sunk || t.escaped) return;
  if (t.side === 0 && w.controllers[0] === 'human' && src.kind !== 'fire' && src.kind !== 'ground') dmg *= w.diff.taken;
  t.hp -= dmg;
  const att = w.unit(src.from);
  if (att && att.side !== t.side) {
    att.dmgDealt += dmg;
    t.lastHitBy = att.id;
  }
  if (src.fire && w.rng.chance(src.fire)) addFire(w, t);
  if (src.kind === 'torp' || src.kind === 'mine') t.flood = Math.min(4, t.flood + 1);
  if (src.kind === 'bomb' && w.rng.chance(0.35)) addFire(w, t);
  if (src.kind === 'kamikaze') {
    addFire(w, t);
    if (w.rng.chance(0.5)) addFire(w, t);
  }
  const p = clamp((dmg / t.maxHp) * 3, 0, 0.6);
  if (src.kind !== 'fire' && src.kind !== 'ground' && w.rng.chance(p)) crit(w, t, src);
  const ty = t.cls.type;
  if (!isStructureType(ty) && (ty === 'BB' || ty === 'BC' || ty === 'CA' || ty === 'CL' || isCarrierType(ty))) {
    const big =
      (src.kind === 'shell' && (src.cal ?? 0) >= 200 && src.pen) ||
      (src.kind === 'bomb' && dmg > 250 && !t.cls.armoredDeck) ||
      src.kind === 'torp';
    if (big) {
      // magazines lie below the armour deck: plunging fire that pierces it is the great danger
      const mv = (t.cls.magVuln ?? 1) * (src.plunge ? 2 : 1);
      const pm = 0.0035 * mv * Math.min(2.5, dmg / 300) * (src.kind === 'torp' ? 0.4 : 1);
      if (w.rng.chance(pm)) {
        magazine(w, t, src);
        return;
      }
    }
  }
  if (!t.alert) w.alarm(t, 8);
  if (t.hp <= 0) sink(w, t, src);
}

function addFire(w: World, t: Unit) {
  if (t.fires >= 4) return;
  t.fires++;
  if (t.fires === 1 && t.side === 0) w.msg(`Fire aboard ${t.name}!`, 'warn', t);
}

function crit(w: World, t: Unit, src: DamageSrc) {
  if (isStructureType(t.cls.type)) {
    if (t.cls.type === 'BASE') {
      t.crits.deck = Math.max(t.crits.deck, 420 + w.rng.range(0, 600));
      if (w.once('crater' + t.id, 120)) {
        if (t.side === 0) w.msg(`${t.name}: runways cratered, flight operations suspended.`, 'bad', t);
        else w.msg(`Enemy airfield hit: runways cratered.`, 'good', t);
      }
    }
    return;
  }
  const opts: string[] = ['engine', 'rudder', 'fc', 'turret', 'fire'];
  if (t.radar) opts.push('radar');
  if (isCarrierType(t.cls.type)) opts.push('deck', 'deck', 'deck');
  if (src.kind === 'torp') opts.push('engine', 'flood');
  const k = w.rng.pick(opts);
  const own = t.side === 0;
  switch (k) {
    case 'engine':
      t.crits.engine = Math.max(t.crits.engine, 300 + w.rng.range(0, 600));
      if (own) w.msg(`${t.name}: engine room hit, speed reduced.`, 'bad', t);
      break;
    case 'rudder':
      t.crits.rudder = Math.max(t.crits.rudder, 200 + w.rng.range(0, 400));
      if (own) w.msg(`${t.name}: steering gear damaged.`, 'bad', t);
      break;
    case 'fc':
      t.crits.fc = Math.max(t.crits.fc, 180 + w.rng.range(0, 300));
      if (own) w.msg(`${t.name}: fire control knocked out.`, 'bad', t);
      break;
    case 'radar':
      t.crits.radar = Math.max(t.crits.radar, 600 + w.rng.range(0, 900));
      if (own) w.msg(`${t.name}: radar destroyed.`, 'bad', t);
      break;
    case 'turret': {
      const alive = t.mounts.filter((m) => !m.dead);
      if (alive.length > 1) {
        const m = w.rng.pick(alive);
        m.dead = true;
        if (own) w.msg(`${t.name}: a ${m.def.sec ? 'secondary mount' : 'main turret'} has been knocked out.`, 'bad', t);
      }
      break;
    }
    case 'deck':
      t.crits.deck = Math.max(t.crits.deck, 600 + w.rng.range(0, 900));
      if (own) w.msg(`${t.name}: flight deck holed, flight operations suspended.`, 'bad', t);
      break;
    case 'fire':
      addFire(w, t);
      break;
    case 'flood':
      t.flood = Math.min(4, t.flood + 1);
      break;
  }
}

function magazine(w: World, t: Unit, src: DamageSrc) {
  t.hp = 0;
  w.events.push({ k: 'boom', x: t.x, y: t.y, size: 7 });
  if (t.side === 0) w.msg(`${t.name} has blown up!`, 'bad', t);
  else w.msg(`${w.contacts[0].get(t.id)?.level === 3 ? t.name : 'An enemy ship'} has blown up!`, 'good', t);
  sink(w, t, src, true);
}

export function sink(w: World, t: Unit, src: DamageSrc, silent = false) {
  if (t.sunk) return;
  t.sunk = true;
  t.sinkT = w.time;
  t.hp = 0;
  t.fires = Math.max(t.fires, 2);
  t.path = [];
  const other: Side = t.side === 0 ? 1 : 0;
  w.stats[t.side].lost.push(t.id);
  w.stats[other].sunk.push(t.id);
  w.stats[other].tonsSunk += t.cls.tons;
  const k = w.unit(t.lastHitBy ?? src.from);
  if (k && k.side !== t.side) k.kills.push(t.name);
  for (const id of t.hangar) {
    const s = w.sq(id);
    if (!s) continue;
    if (s.state === 'deck' || s.state === 'queued') {
      w.stats[t.side].planesLost += s.n;
      s.n = 0;
      s.state = 'gone';
    } else {
      s.home = null;
    }
  }
  if (!silent) {
    const st = isStructureType(t.cls.type);
    if (t.side === 0) w.msg(st ? `${t.name} has been destroyed!` : `${t.name} has been sunk!`, 'bad', t);
    else {
      const known = w.contacts[0].get(t.id)?.level === 3;
      w.msg(
        st ? `${known ? t.name : 'Enemy installation'} destroyed!` : `${known ? t.name : 'Enemy ' + TYPE_NAMES[t.cls.type].toLowerCase()} is sinking!`,
        'good', t,
      );
    }
  }
  w.events.push({ k: 'sunk', unit: t.id, x: t.x, y: t.y });
}

export function damageControl(w: World, u: Unit, dt: number) {
  const cv = isCarrierType(u.cls.type);
  let dcm = 1 + 0.12 * u.vet;
  if (u.nation === 'jp' && cv) dcm *= 0.75;
  if (u.nation === 'us' && w.year >= 1942.5) dcm *= 1.15;
  if (u.fires > 0) {
    u.hp -= u.fires * u.maxHp * 0.0007 * (cv ? 1.6 : 1) * dt;
    if (w.rng.chance(0.016 * dt * dcm)) u.fires--;
  }
  if (u.flood > 0) {
    u.hp -= u.flood * u.maxHp * 0.001 * dt;
    if (w.rng.chance(0.012 * dt * dcm)) u.flood--;
  }
  const c = u.crits;
  if (c.engine > 0) c.engine -= dt * dcm;
  if (c.rudder > 0) c.rudder -= dt * dcm;
  if (c.fc > 0) c.fc -= dt * dcm;
  if (c.radar > 0) c.radar -= dt * dcm;
  if (c.deck > 0) c.deck -= dt * dcm;
  if (u.hp <= 0 && !u.sunk) sink(w, u, { kind: 'fire', side: u.side === 0 ? 1 : 0, from: u.lastHitBy ?? -1 });
}

// ------------------------------------------------------------------ torpedoes

export function fireTorpedoes(
  w: World, u: Unit, aim: { unit?: Unit; x: number; y: number }, count: number,
): boolean {
  const T = u.cls.torps;
  if (!T || u.torpLoaded <= 0 || u.sunk || u.escaped) return false;
  if (u.cls.sub && u.depth === 'deep') return false;
  const def = TORPS[T.t];
  const spd = def.speed * KN;
  count = Math.max(1, Math.min(count, u.torpLoaded));
  let h: number;
  // spread the salvo to cover the target's length at the range it will be met
  let spread = (u.cls.sub ? 1.6 : 2.4) * DEG;
  if (aim.unit) {
    const t = aim.unit;
    const c = w.contacts[u.side].get(t.id);
    const exact = !!c && c.level >= 3;
    // The fire-control problem: the target's speed and course must be
    // estimated, and that is where most misses come from. Against a ship at
    // anchor only the small aiming error remains.
    const skill = w.crewSkill(u);
    // submarines had proper torpedo directors and time to watch their target
    const sub = !!u.cls.sub;
    const vErr = 1 + (w.rng.gauss() * (exact ? (sub ? 0.05 : 0.08) : sub ? 0.15 : 0.25)) / skill;
    const hErr = (w.rng.gauss() * (exact ? (sub ? 3 : 4) : sub ? 7 : 12) * DEG) / skill;
    const vx = Math.cos(t.h + hErr) * t.v * vErr;
    const vy = Math.sin(t.h + hErr) * t.v * vErr;
    const tt = interceptTime(u.x, u.y, t.x, t.y, vx, vy, spd);
    if (tt !== null && tt * spd < def.range * 1.15) h = headingTo(u.x, u.y, t.x + vx * tt, t.y + vy * tt);
    else h = headingTo(u.x, u.y, t.x, t.y);
    const err = ((u.cls.sub ? 0.6 : 0.8) * (w.env.night ? 1.3 : 1)) / skill;
    h += w.rng.gauss() * err * DEG;
    const run = Math.max(500, (tt ?? dist(u.x, u.y, t.x, t.y) / spd) * spd);
    const presented = t.cls.length * Math.max(0.3, Math.abs(Math.sin(h - t.h)));
    spread = clamp(((presented * 0.75) / run) * (exact ? 1 : 1.4) + (t.v > 3 ? 0.6 * DEG : 0), 0.5 * DEG, 3 * DEG);
  } else {
    h = headingTo(u.x, u.y, aim.x, aim.y);
  }
  if (count <= 1) spread = 0;
  const dud = dudChance(def, w.year);
  for (let i = 0; i < count; i++) {
    const hi = h + (i - (count - 1) / 2) * spread;
    const off = (i % 2 ? 1 : -1) * u.cls.beam * 0.4;
    w.torps.push({
      id: w.newId(),
      x: u.x - Math.sin(u.h) * off,
      y: u.y + Math.cos(u.h) * off,
      h: hi, speed: spd, left: def.range, run: 0, dmg: def.dmg,
      side: u.side, from: u.id, wake: def.wake, dud: w.rng.chance(dud), air: false, def, aimAt: aim.unit?.id,
    });
  }
  u.torpLoaded -= count;
  w.stats[u.side].torpsFired += count;
  if (u.torpReloads > 0 && u.torpTimer <= 0) u.torpTimer = T.reloadTime;
  w.events.push({ k: 'torpLaunch', x: u.x, y: u.y, side: u.side });
  if (u.side === 0) w.msg(`${u.name}: ${count} torpedo${count > 1 ? 'es' : ''} away.`, 'info', u);
  return true;
}

export function dropAirTorpedo(w: World, side: Side, from: number, x: number, y: number, h: number, torpId: string) {
  const def = TORPS[torpId];
  w.torps.push({
    id: w.newId(), x, y, h, speed: def.speed * KN, left: def.range, run: 150, dmg: def.dmg,
    side, from, wake: def.wake, dud: w.rng.chance(dudChance(def, w.year)), air: true, def,
  });
  w.stats[side].torpsFired++;
}

/** Returns false when the torpedo is finished. */
export function stepTorpedo(w: World, tp: Torpedo, dt: number): boolean {
  const step = tp.speed * dt;
  const x0 = tp.x;
  const y0 = tp.y;
  tp.x += Math.cos(tp.h) * step;
  tp.y += Math.sin(tp.h) * step;
  tp.run += step;
  tp.left -= step;
  if (tp.left <= 0) return false;
  if (tp.x < 0 || tp.y < 0 || tp.x > w.terrain.w || tp.y > w.terrain.h) return false;
  if (w.terrain.hasLand && w.terrain.sample(tp.x, tp.y) > 0) {
    w.events.push({ k: 'boom', x: tp.x, y: tp.y, size: 0.8 });
    return false;
  }
  if (tp.run < 250) return true;
  for (const t of w.units) {
    if (t.side === tp.side || t.sunk || t.escaped || isStructureType(t.cls.type)) continue;
    if (t.cls.sub && t.depth !== 'surface') continue;
    const L = t.cls.length;
    if (Math.abs(t.x - tp.x) > L || Math.abs(t.y - tp.y) > L) continue;
    if (segHitsEllipse(x0, y0, tp.x, tp.y, t.x, t.y, t.h, L / 2, t.cls.beam / 2 + 2)) {
      torpHit(w, tp, t);
      return false;
    }
  }
  return true;
}

function torpHit(w: World, tp: Torpedo, t: Unit) {
  const known = w.contacts[0].get(t.id)?.level === 3;
  if (tp.dud) {
    w.events.push({ k: 'splash', x: tp.x, y: tp.y, cal: 120 });
    if (t.side === 0) w.msg(`A torpedo struck ${t.name} but failed to explode!`, 'good', t);
    else if (tp.side === 0) w.msg(`Dud! A torpedo hit ${known ? t.name : 'the target'} and failed to explode.`, 'bad', t);
    return;
  }
  w.stats[tp.side].torpHits++;
  w.events.push({ k: 'boom', x: tp.x, y: tp.y, size: 2.2 });
  if (t.side === 0) w.msg(`${t.name} has been torpedoed!`, 'bad', t);
  else if (tp.side === 0) w.msg(`Torpedo hit on ${known ? t.name : 'an enemy ship'}!`, 'good', t);
  if (tp.air) {
    for (const tag of t.tags) w.flags.add('torpHit:' + tag);
    if (t.special.includes('rudderJam') && !t.rudderJam) {
      t.rudderJam = true;
      w.msg(`${known ? t.name : 'The enemy'} is steaming in circles: her rudder is jammed!`, t.side === 0 ? 'bad' : 'good', t);
    }
  }
  applyDamage(w, t, tp.dmg * w.rng.range(0.85, 1.15), { kind: 'torp', side: tp.side, from: tp.from, fire: 0.15 });
  if (!t.sunk && w.rng.chance(0.25)) t.crits.engine = Math.max(t.crits.engine, 400);
}

// ------------------------------------------------------------------ anti-submarine warfare

function asw(w: World, u: Unit) {
  if (!u.cls.dc || u.dcLeft <= 0 || u.dcCool > 0 || u.cls.sub) return;
  const C = w.contacts[u.side];
  for (const [id, c] of C) {
    if (c.level < 2 || w.time - c.seen > 20) continue;
    const t = w.unit(id);
    if (!w.alive(t) || !t.cls.sub || t.depth === 'surface') continue;
    const d = dist(u.x, u.y, c.x, c.y);
    if (u.cls.hedgehog && d > 150 && d < 420 && Math.abs(angleDiff(u.h, headingTo(u.x, u.y, c.x, c.y))) < 0.5) {
      w.dcs.push({ x: c.x + w.rng.gauss() * 40, y: c.y + w.rng.gauss() * 40, t: w.time + 9, side: u.side, from: u.id, power: 340, radius: 40, hedgehog: true });
      u.dcCool = 40;
      u.dcLeft -= 0.5;
      if (u.side === 0) w.msg(`${u.name} fires Hedgehog.`, 'info', u);
      return;
    }
    if (d < 260) {
      dropPattern(w, u, t);
      return;
    }
  }
}

function dropPattern(w: World, u: Unit, t: Unit) {
  const stern = w.sternPos(u);
  const deep = t.depth === 'deep';
  const fuse = deep ? 20 : 12;
  const ch = Math.cos(u.h);
  const sh = Math.sin(u.h);
  // timing the drop and guessing the depth: a green or poorly drilled crew scatters the pattern
  const skill = w.crewSkill(u) * aswSkill(u.nation, w.year);
  const ox = (w.rng.gauss() * 45) / skill;
  const oy = (w.rng.gauss() * 45) / skill;
  const pattern: [number, number][] = [[0, 0], [-40, 0], [-80, 0], [-30, 75], [-30, -75], [-120, 0]];
  for (let i = 0; i < pattern.length; i++) {
    const [b, l] = pattern[i];
    w.dcs.push({
      x: stern.x + ch * b - sh * l + ox,
      y: stern.y + sh * b + ch * l + oy,
      t: w.time + fuse + i * 1.2,
      side: u.side, from: u.id, power: 240, radius: deep ? 65 : 80, hedgehog: false,
    });
  }
  u.dcLeft -= 1;
  u.dcCool = 50;
  u.sonarBlind = w.time + fuse + 25;
  if (u.side === 0) w.msg(`${u.name} is dropping depth charges.`, 'info', u);
}

export function detonateDC(w: World, d: DepthCharge) {
  if (!d.hedgehog) w.events.push({ k: 'dc', x: d.x, y: d.y });
  for (const t of w.units) {
    if (t.side === d.side || t.sunk || t.escaped || !t.cls.sub) continue;
    const dd = dist(d.x, d.y, t.x, t.y);
    let r = d.radius;
    if (t.depth === 'surface') r *= 0.6;
    if (dd > r) continue;
    if (d.hedgehog && t.depth === 'surface') continue;
    if (d.hedgehog) w.events.push({ k: 'dc', x: d.x, y: d.y });
    const dmg = d.power * Math.pow(1 - dd / r, 1.3) * w.rng.range(0.7, 1.3);
    applyDamage(w, t, dmg, { kind: 'dc', side: d.side, from: d.from });
    if (!t.sunk) {
      if (t.side === 0) w.msg(`${t.name} is shaken by depth charges!`, 'bad', t);
      if (t.hp / t.maxHp < 0.3 && t.depth !== 'surface' && w.rng.chance(0.5)) {
        t.depthOrder = 'surface';
        t.depthTimer = 6;
        t.depth = 'periscope';
        w.msg(`${t.side === 0 ? t.name : 'An enemy submarine'} has been forced to the surface!`, t.side === 0 ? 'bad' : 'good', t);
      }
    }
  }
}
