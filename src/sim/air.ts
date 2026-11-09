// Carrier and land-based aviation: launches, strikes, combat air patrols,
// dogfights, anti-aircraft fire and landing.

import { DEG, KN, angleDiff, clamp, dist, fmtKm, headingTo, interceptTime, type Vec } from '../core/math';
import { AIRCRAFT, ROLE_NAMES } from '../data/aircraft';
import { pilotQuality } from '../data/nations';
import { SIZE, TYPE_VALUE, isCarrierType, isStructureType } from '../data/ships';
import type { AirRaidDef } from '../data/types';
import { TORPS } from '../data/weapons';
import { applyDamage, dropAirTorpedo } from './combat';
import { airborne } from './sensors';
import type { Side, SqState, Squadron, Unit } from './types';
import type { World } from './world';

export function sqSpeed(s: Squadron): number {
  return s.def.speed / 3.6;
}

export function endurance(s: Squadron): number {
  return ((s.def.radius * 2) / s.def.speed) * 3600 * 1.25 + 1800;
}

/** Reasons nothing at all can leave this deck or airfield. */
export function deckBlocked(w: World, home: Unit): string | null {
  if (!w.alive(home)) return 'base lost';
  if (home.crits.deck > 0) return isStructureType(home.cls.type) ? 'runways cratered' : 'flight deck damaged';
  if (isCarrierType(home.cls.type) && home.hp / home.maxHp < 0.25) return 'carrier too badly damaged';
  if (w.env.wx === 'storm') return 'storm';
  return null;
}

/** Reasons this particular aircraft type cannot fly right now. */
export function typeBlocked(w: World, s: Squadron): string | null {
  if (w.env.night && !s.def.night) return 'darkness';
  if (!w.env.airOps && !s.def.night) return 'weather';
  return null;
}

export function canLaunch(w: World, home: Unit, s: Squadron): string | null {
  return deckBlocked(w, home) ?? typeBlocked(w, s);
}

export function newSquadron(w: World, side: Side, aircraft: string, n: number, home: Unit | null, name?: string): Squadron {
  const def = AIRCRAFT[aircraft];
  if (!def) throw new Error(`Unknown aircraft ${aircraft}`);
  const s: Squadron = {
    id: w.newId(), side, def, n, max: n, home: home?.id ?? null,
    state: 'deck', next: 'deck', x: home?.x ?? 0, y: home?.y ?? 0, h: home?.h ?? 0,
    ready: 0, target: null, capOver: null, escortOf: null, engaged: null,
    fuel: 0, attackT: 0, searchT: 0, disrupted: 0, orbit: w.rng.range(0, 6.28), offmap: null,
    ordnance: true, ammo: 1, name: name ?? `${def.name}`, capUntil: 0, launchedAt: 0,
  };
  s.fuel = endurance(s);
  w.addSquadron(s);
  if (home) home.hangar.push(s.id);
  return s;
}

function queue(s: Squadron, next: SqState) {
  s.state = 'queued';
  s.next = next;
}

// ------------------------------------------------------------------ per step

export function airStep(w: World, dt: number) {
  const t = w.time;
  for (const u of w.units) {
    if (!u.hangar.length || u.sunk || u.escaped) continue;
    if (u.deckTimer > 0) {
      u.deckTimer -= dt;
      continue;
    }
    let waiting: string | null = null;
    const deck = deckBlocked(w, u);
    for (const id of u.hangar) {
      const s = w.sq(id);
      if (!s || s.state !== 'queued' || s.ready > t) continue;
      // A grounded type (no night capability, say) must not block the
      // squadrons queued behind it.
      const why = deck ?? typeBlocked(w, s);
      if (why) {
        waiting = why;
        if (deck) break;
        continue;
      }
      waiting = null;
      s.state = s.next;
      s.x = u.x;
      s.y = u.y;
      s.h = u.h;
      s.fuel = endurance(s);
      s.launchedAt = t;
      s.searchT = 0;
      s.disrupted = 0;
      u.deckTimer = (isStructureType(u.cls.type) ? 15 : 35) + s.n * (isStructureType(u.cls.type) ? 1 : 2);
      break;
    }
    if (waiting && u.side === 0 && reportOnce(w, 'nolaunch' + u.id, 300)) {
      w.msg(`${u.name} cannot launch aircraft: ${waiting}.`, 'warn', u);
    }
  }

  for (const s of w.squadrons) {
    if (s.state === 'gone') continue;
    if (s.state === 'deck' || s.state === 'queued') {
      const h = w.unit(s.home);
      if (h) {
        s.x = h.x;
        s.y = h.y;
      }
      continue;
    }
    if (s.n <= 0) {
      s.state = 'gone';
      continue;
    }
    s.fuel -= dt;
    switch (s.state) {
      case 'outbound':
        outbound(w, s, dt);
        break;
      case 'attack': {
        const tg = w.unit(s.target?.unit);
        if (!w.alive(tg) || (tg.cls.sub && tg.depth === 'deep')) {
          const nt = findTarget(w, s, 7000);
          if (nt && s.target) s.target.unit = nt.id;
          else s.state = 'return';
          break;
        }
        fly(s, tg.x, tg.y, 1.1, dt);
        s.attackT -= dt;
        if (s.attackT <= 0) resolveAttack(w, s, tg);
        break;
      }
      case 'return':
        returning(w, s, dt);
        break;
      case 'cap': {
        if (s.capUntil && t > s.capUntil) {
          s.state = 'return';
          break;
        }
        const c = capCenter(w, s);
        s.orbit += (dt * sqSpeed(s)) / 3500;
        fly(s, c.x + Math.cos(s.orbit) * 3500, c.y + Math.sin(s.orbit) * 3500, 1, dt);
        if (s.fuel < 900) s.state = 'return';
        break;
      }
      case 'intercept': {
        const e = w.sq(s.engaged);
        const c = capCenter(w, s);
        // Chase raiders on their way in; let them go once they head home.
        const leash = e && (e.state === 'return' || !e.ordnance) ? 15000 : 32000;
        if (!e || e.state === 'gone' || e.n <= 0 || !airborne(e) || dist(c.x, c.y, e.x, e.y) > leash) {
          s.engaged = null;
          s.state = s.capOver !== null || s.home !== null ? 'cap' : 'return';
          break;
        }
        fly(s, e.x, e.y, 1.3, dt);
        if (s.fuel < 600) s.state = 'return';
        break;
      }
      case 'escort': {
        const e = w.sq(s.escortOf);
        if (!e || e.state === 'gone' || e.n <= 0 || e.state === 'return') {
          s.state = 'return';
          s.engaged = null;
          break;
        }
        const foe = w.sq(s.engaged);
        if (foe && foe.state !== 'gone' && foe.n > 0 && dist(foe.x, foe.y, e.x, e.y) < 6000) fly(s, foe.x, foe.y, 1.3, dt);
        else {
          s.engaged = null;
          fly(s, e.x + 600, e.y - 400, 1.15, dt);
        }
        break;
      }
      case 'scout': {
        if (!s.target) {
          s.state = 'return';
          break;
        }
        if (fly(s, s.target.x, s.target.y, 1, dt) < 1500) s.state = 'return';
        break;
      }
    }
    if (s.fuel <= 0 && (s.state as SqState) !== 'gone') ditch(w, s);
  }
}

function fly(s: Squadron, tx: number, ty: number, mul: number, dt: number): number {
  const d = dist(s.x, s.y, tx, ty);
  if (d < 1) return 0;
  s.h = headingTo(s.x, s.y, tx, ty);
  const step = Math.min(d, sqSpeed(s) * mul * dt);
  s.x += Math.cos(s.h) * step;
  s.y += Math.sin(s.h) * step;
  return d - step;
}

function spotRange(w: World, s: Squadron, e: Unit): number {
  let size = SIZE[e.cls.type];
  if (e.cls.sub) {
    if (e.depth === 'deep') return 0;
    size = e.depth === 'periscope' ? 0.07 * (e.v > 2.5 ? 2.2 : 1) : size * 1.6;
  }
  let vr = (w.env.night ? (s.def.night ? 4000 : 1800) : Math.min(28000, w.env.vis * 1.15)) * size;
  if (s.def.asv) vr = Math.max(vr, e.cls.sub ? (e.depth === 'surface' ? 15000 : 0) : 30000);
  if (w.inSquall(e.x, e.y)) vr *= 0.3;
  return vr;
}

function findTarget(w: World, s: Squadron, radius: number): Unit | null {
  let best: Unit | null = null;
  let bs = 0;
  const asw = s.def.role === 'patrol' && !!s.def.dc;
  for (const e of w.units) {
    if (e.side === s.side || !w.alive(e)) continue;
    if (e.cls.sub && (!asw || e.depth === 'deep')) continue;
    if (asw && !e.cls.sub && !s.def.dmg) continue;
    const d = dist(s.x, s.y, e.x, e.y);
    if (d > radius || d > spotRange(w, s, e)) continue;
    const v = (asw && e.cls.sub ? 12 : TYPE_VALUE[e.cls.type]) / (1 + d / 6000);
    if (v > bs) {
      bs = v;
      best = e;
    }
  }
  return best;
}

function outbound(w: World, s: Squadron, dt: number) {
  if (!s.target) {
    s.state = 'return';
    return;
  }
  const T = s.target;
  const tg = w.unit(T.unit);
  if (w.alive(tg)) {
    const c = w.contacts[s.side].get(tg.id);
    const seeOwn = dist(s.x, s.y, tg.x, tg.y) < spotRange(w, s, tg);
    if (seeOwn || s.offmap) Object.assign(T, { x: tg.x, y: tg.y, h: tg.h, v: tg.v, t: w.time });
    else if (c && c.level >= 2 && c.seen > (T.t ?? -1e9)) Object.assign(T, { x: c.x, y: c.y, h: c.h, v: c.v, t: c.seen });
  }
  // dead-reckon from the last fix
  const age = T.t !== undefined ? Math.min(3600, w.time - T.t) : 0;
  let ax = T.x + Math.cos(T.h ?? 0) * (T.v ?? 0) * age;
  let ay = T.y + Math.sin(T.h ?? 0) * (T.v ?? 0) * age;
  if (s.searchT > 0) {
    // fly an outward spiral around the expected position
    const r = 1500 + s.searchT * 25;
    s.orbit += ((sqSpeed(s) * 0.8) / r) * dt;
    ax += Math.cos(s.orbit) * r;
    ay += Math.sin(s.orbit) * r;
  }
  const d = fly(s, ax, ay, 1, dt);
  if (d > 2500 && s.searchT === 0) return;
  let t: Unit | null = w.alive(tg) && dist(s.x, s.y, tg.x, tg.y) < Math.max(5000, spotRange(w, s, tg)) ? tg : null;
  if (t && t.cls.sub && t.depth === 'deep') t = null;
  if (!t) t = findTarget(w, s, 12000);
  if (t) {
    s.target.unit = t.id;
    s.state = 'attack';
    s.attackT = s.def.role === 'torpedo' ? 30 : s.def.role === 'kamikaze' ? 18 : 24;
    s.searchT = 0;
    return;
  }
  s.searchT += dt;
  if (s.searchT > 420) {
    s.state = 'return';
    if (s.side === 0) w.msg(`${s.name} could not find the target and is returning.`, 'warn', s);
  }
}

function returning(w: World, s: Squadron, dt: number) {
  if (s.offmap) {
    if (fly(s, s.offmap.x, s.offmap.y, 1, dt) < 1500) s.state = 'gone';
    return;
  }
  let home = w.unit(s.home);
  if (!w.alive(home)) {
    home = newHome(w, s);
    s.home = home?.id ?? null;
    if (home && !home.hangar.includes(s.id)) home.hangar.push(s.id);
    if (!home) {
      // circle until the fuel runs out
      s.orbit += dt / 200;
      fly(s, s.x + Math.cos(s.orbit) * 2000, s.y + Math.sin(s.orbit) * 2000, 0.6, dt);
      return;
    }
  }
  const d = fly(s, home.x, home.y, 1, dt);
  if (d < 1500) {
    if (home.deckTimer <= 0 && home.crits.deck <= 0) {
      s.state = 'deck';
      s.ready = w.time + 480;
      s.ordnance = true;
      s.ammo = 1;
      s.engaged = null;
      s.escortOf = null;
      s.capOver = null;
      s.capUntil = 0;
      home.deckTimer = 25;
    } else {
      s.orbit += dt / 120;
      s.x = home.x + Math.cos(s.orbit) * 2500;
      s.y = home.y + Math.sin(s.orbit) * 2500;
    }
  }
}

function newHome(w: World, s: Squadron): Unit | undefined {
  let best: Unit | undefined;
  let bd = Infinity;
  for (const u of w.units) {
    if (u.side !== s.side || !w.alive(u)) continue;
    if (!(isCarrierType(u.cls.type) || u.cls.type === 'BASE')) continue;
    if (u.crits.deck > 0 && u.hp / u.maxHp < 0.3) continue;
    const d = dist(s.x, s.y, u.x, u.y);
    if (d < bd && d < sqSpeed(s) * Math.max(0, s.fuel)) {
      bd = d;
      best = u;
    }
  }
  return best;
}

function ditch(w: World, s: Squadron) {
  w.stats[s.side].planesLost += s.n;
  if (s.side === 0) w.msg(`${s.name}: out of fuel, ${s.n} aircraft ditched.`, 'bad', s);
  s.n = 0;
  s.state = 'gone';
}

function capCenter(w: World, s: Squadron): Vec {
  const o = w.unit(s.capOver) ?? w.unit(s.home);
  return o && !o.sunk ? { x: o.x, y: o.y } : { x: s.x, y: s.y };
}

// ------------------------------------------------------------------ attacks

function resolveAttack(w: World, s: Squadron, t: Unit) {
  // Flak and fighters shake the attack; the effect saturates.
  const q = pilotQuality(s.def.nation, w.year) * (1 - 0.45 * (1 - Math.exp(-s.disrupted)));
  const role = s.def.role;
  const n = s.n;
  const credit = s.home ?? -1;
  let hits = 0;
  const known = s.side === 0 || w.contacts[0].get(t.id)?.level === 3;
  const label = t.side === 0 ? t.name : known ? t.name : 'the enemy';
  if (role === 'torpedo' && s.def.torp && !isStructureType(t.cls.type)) {
    const td = TORPS[s.def.torp];
    const spd = td.speed * KN;
    const appr = headingTo(t.x, t.y, s.x, s.y);
    const b1 = t.h + Math.PI / 2;
    const b2 = t.h - Math.PI / 2;
    const beam = Math.abs(angleDiff(appr, b1)) < Math.abs(angleDiff(appr, b2)) ? b1 : b2;
    const dropAng = appr + angleDiff(appr, beam) * 0.5 * clamp(q, 0.3, 1.2);
    // heavy flak makes pilots release early
    const shaken = 1 - Math.exp(-s.disrupted);
    const dropR = Math.min(1100, td.range * 0.55) * (1 + 0.5 * shaken);
    for (let i = 0; i < n; i++) {
      const a = dropAng + (i - (n - 1) / 2) * 0.09;
      const r = dropR * w.rng.range(0.85, 1.15);
      const px = t.x + Math.cos(a) * r;
      const py = t.y + Math.sin(a) * r;
      const vx = Math.cos(t.h) * t.v;
      const vy = Math.sin(t.h) * t.v;
      const tt = interceptTime(px, py, t.x, t.y, vx, vy, spd);
      let h = tt !== null ? headingTo(px, py, t.x + vx * tt, t.y + vy * tt) : headingTo(px, py, t.x, t.y);
      h += (w.rng.gauss() * 6 * DEG) / Math.max(0.4, q);
      // Aerial torpedoes often broached, dived into the bottom or ran wild.
      if (w.rng.chance(td.id === 'mk13' && w.year < 1943.5 ? 0.2 : 0.08)) h += w.rng.range(-0.6, 0.6);
      if (!w.terrain.isLand(px, py)) dropAirTorpedo(w, s.side, credit, px, py, h, s.def.torp);
    }
    if (t.side === 0) w.msg(`Torpedo bombers attacking ${t.name}!`, 'warn', t);
    else if (s.side === 0) w.msg(`${s.name} has dropped torpedoes at ${label}.`, 'info', t);
  } else if (role === 'fighter') {
    for (let i = 0; i < n; i++) {
      if (w.rng.chance(0.45)) {
        hits++;
        applyDamage(w, t, 10, { kind: 'shell', cal: 13, side: s.side, from: credit, fire: 0.03 });
      }
    }
  } else {
    const acc = s.def.acc ?? 0.1;
    const speedFrac = clamp(t.v / (30 * KN), 0, 1);
    const evade = 1 - 0.45 * speedFrac;
    const sz = clamp(SIZE[t.cls.type] * (t.cls.length / 200), 0.45, 1);
    const sub = !!t.cls.sub;
    const st = isStructureType(t.cls.type);
    // fuelled and armed aircraft on deck or in the hangar turn a hit into an inferno
    const loaded = isCarrierType(t.cls.type) && t.hangar.some((id) => {
      const h = w.sq(id);
      return !!h && h.n > 0 && (h.state === 'queued' || (h.state === 'deck' && h.ready > w.time));
    });
    for (let i = 0; i < n; i++) {
      let p = (role === 'torpedo' ? 0.05 : acc) * q * evade * sz;
      if (role === 'kamikaze') p = 0.36 * q * (0.6 + 0.4 * sz);
      if (role === 'patrol') p = sub ? (t.depth === 'surface' ? 0.3 : t.depth === 'periscope' ? 0.15 : 0) : 0.06;
      if (st) p = Math.max(p, 0.55);
      if (w.rng.chance(p)) {
        hits++;
        let dmg = (s.def.dmg ?? (role === 'patrol' ? 180 : role === 'torpedo' ? 300 : 200)) * w.rng.range(0.75, 1.25);
        if (t.cls.armoredDeck) dmg *= 0.45;
        if (st) dmg *= 0.35; // bombs spread over runways, hangars and fuel dumps
        if (loaded) {
          dmg *= 1.5;
          applyDamage(w, t, 0, { kind: 'fire', side: s.side, from: credit, fire: 1 });
          if (t.side === 0 && reportOnce(w, 'loaded' + t.id, 120)) w.msg(`${t.name} was caught with aircraft refuelling on deck!`, 'bad', t);
        }
        applyDamage(w, t, dmg, {
          kind: role === 'kamikaze' ? 'kamikaze' : role === 'patrol' && sub ? 'dc' : 'bomb',
          side: s.side, from: credit, pen: (s.def.pen ?? 100) >= t.cls.deck, fire: loaded ? 0.6 : 0.3,
        });
        w.events.push({ k: 'bomb', x: t.x + w.rng.gauss() * 20, y: t.y + w.rng.gauss() * 10, hit: true });
      } else {
        const a = w.rng.range(0, 6.28);
        const r = w.rng.range(40, 250);
        w.events.push({ k: 'bomb', x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r, hit: false });
      }
      if (t.sunk) break;
    }
    if (role === 'kamikaze') {
      w.stats[s.side].planesLost += s.n;
      s.n = 0;
      s.state = 'gone';
    }
    const what = role === 'kamikaze' ? 'Kamikaze attack on' : role === 'patrol' && sub ? 'Aircraft attacking' : 'Air attack on';
    if (t.side === 0) w.msg(`${what} ${t.name}: ${hits ? `${hits} hit${hits > 1 ? 's' : ''}` : 'no hits'}.`, hits ? 'bad' : 'info', t);
    else if (s.side === 0) w.msg(`${s.name} attacked ${label}: ${hits ? `${hits} hit${hits > 1 ? 's' : ''}` : 'no hits'}.`, hits ? 'good' : 'info', t);
  }
  // depth charges and bombs are gone; a patrol plane goes back to watching
  s.ordnance = false;
  if (s.state !== 'gone') s.state = s.def.role === 'patrol' && s.capOver !== null && s.capUntil > w.time ? 'cap' : 'return';
}

// ------------------------------------------------------------------ once per second

export function airSecond(w: World) {
  autoCap(w);
  capScan(w);
  dogfights(w);
  antiAircraft(w);
  subDive(w);
  raidAlert(w);
}

/** Ships with enemy bombers bearing down on them go to full speed. */
function raidAlert(w: World) {
  for (const s of w.squadrons) {
    if (s.n <= 0 || !s.ordnance || (s.state !== 'outbound' && s.state !== 'attack')) continue;
    const r = s.def.role;
    if (r !== 'dive' && r !== 'torpedo' && r !== 'level' && r !== 'kamikaze') continue;
    for (const u of w.units) {
      if (u.side === s.side || !w.alive(u) || isStructureType(u.cls.type) || (u.cls.sub && u.depth !== 'surface')) continue;
      if (Math.abs(u.x - s.x) > 16000 || Math.abs(u.y - s.y) > 16000) continue;
      if (!w.airSeen[u.side].has(s.id) || dist(u.x, u.y, s.x, s.y) > 16000) continue;
      u.airAlertUntil = w.time + 90;
    }
  }
}

function autoCap(w: World) {
  for (const u of w.units) {
    if (!u.hangar.length || !w.alive(u) || !u.autoCap) continue;
    let up = 0;
    let candidate: Squadron | null = null;
    for (const id of u.hangar) {
      const s = w.sq(id);
      if (!s || s.def.role !== 'fighter' || s.n <= 0) continue;
      if (s.state === 'cap' || s.state === 'intercept' || (s.state === 'queued' && s.next === 'cap')) up++;
      else if (s.state === 'deck' && s.ready <= w.time && !candidate) candidate = s;
    }
    if (up < 1 && candidate) {
      candidate.capOver = u.id;
      queue(candidate, 'cap');
    }
  }
}

function capScan(w: World) {
  for (const s of w.squadrons) {
    if (s.state === 'cap' && s.n > 0 && s.def.role === 'patrol' && s.def.dc && s.ordnance) {
      const t = findTarget(w, s, 15000);
      if (t && t.cls.sub) {
        s.state = 'outbound';
        s.target = { unit: t.id, x: t.x, y: t.y };
        if (t.side === 0) w.msg(`Aircraft diving on ${t.name}!`, 'warn', t);
        if (t.side === 1 || !t.controllable || w.controllers[0] !== 'human' || w.autoEvade) w.setDepth(t, 'deep');
      }
      continue;
    }
    if (s.state !== 'cap' || s.n <= 0 || s.def.role !== 'fighter') continue;
    const c = capCenter(w, s);
    let best: Squadron | null = null;
    let bd = Infinity;
    for (const e of w.squadrons) {
      if (e.side === s.side || !airborne(e) || e.n <= 0) continue;
      if (!w.airSeen[s.side].has(e.id) && dist(s.x, s.y, e.x, e.y) > 8000) continue;
      const d = dist(c.x, c.y, e.x, e.y);
      if (d > 32000) continue;
      const score = d * (e.def.role === 'fighter' ? 1.5 : e.def.role === 'scout' ? 1.2 : 1);
      if (score < bd) {
        bd = score;
        best = e;
      }
    }
    if (best) {
      s.state = 'intercept';
      s.engaged = best.id;
    }
  }
}

function dogfights(w: World) {
  for (const F of w.squadrons) {
    if (F.state === 'gone' || F.n <= 0 || F.def.role !== 'fighter' || !airborne(F)) continue;
    if (F.ammo <= 0.05) {
      if (F.state === 'intercept' || F.state === 'cap') {
        F.state = 'return';
        F.engaged = null;
        if (F.side === 0 && w.once('ammo' + F.id, 600)) w.msg(`${F.name} is out of ammunition and returning to rearm.`, 'info', F);
      }
      continue;
    }
    const E = w.sq(F.engaged);
    if (!E || E.state === 'gone' || E.n <= 0) {
      F.engaged = null;
      continue;
    }
    if (dist(F.x, F.y, E.x, E.y) > 2000) continue;
    let foe = E;
    for (const x of w.squadrons) {
      if (x.escortOf === E.id && x.state === 'escort' && x.n > 0 && dist(x.x, x.y, E.x, E.y) < 4000) {
        if (x.engaged === null) x.engaged = F.id;
        if (w.rng.chance(0.55)) foe = x;
        break;
      }
    }
    if (foe.def.role === 'fighter' && foe.engaged === null && airborne(foe)) foe.engaged = F.id;
    shoot(w, F, foe);
  }
}

function shoot(w: World, A: Squadron, B: Squadron) {
  const qa = A.def.air * pilotQuality(A.def.nation, w.year);
  const qb = B.def.air * pilotQuality(B.def.nation, w.year);
  // Rates are per second of close engagement, which typically lasts minutes.
  const kA = Math.min(B.n, w.rng.events((A.n * 0.0013 * qa) / (qa + qb * 0.5 + 1)));
  A.ammo -= 1 / (A.def.ammo ?? 150);
  if (kA > 0) loseAircraft(w, B, kA);
  if (B.def.role !== 'fighter' && B.n > 0) {
    const kB = Math.min(A.n, w.rng.events(B.n * 0.00012 * (1 + B.def.air * 0.2)));
    if (kB > 0) loseAircraft(w, A, kB);
    B.disrupted += 0.025;
  }
}

export function loseAircraft(w: World, s: Squadron, k: number) {
  s.n -= k;
  w.stats[s.side].planesLost += k;
  w.stats[s.side === 0 ? 1 : 0].planesKilled += k;
  for (let i = 0; i < Math.min(k, 3); i++) {
    w.events.push({ k: 'planeDown', x: s.x + w.rng.gauss() * 300, y: s.y + w.rng.gauss() * 300, side: s.side });
  }
  if (s.n <= 0) {
    s.n = 0;
    s.state = 'gone';
    if (s.side === 0) w.msg(`${s.name} has been wiped out.`, 'bad', s);
  }
}

function antiAircraft(w: World) {
  const near: Squadron[] = [];
  for (const u of w.units) {
    if (!w.alive(u) || u.cls.aa <= 0) continue;
    if (u.cls.sub && u.depth !== 'surface') continue;
    near.length = 0;
    for (const s of w.squadrons) {
      if (s.side === u.side || !airborne(s) || s.n <= 0) continue;
      if (Math.abs(s.x - u.x) > 4500 || Math.abs(s.y - u.y) > 4500) continue;
      if (dist(s.x, s.y, u.x, u.y) < 4500) near.push(s);
    }
    if (!near.length) continue;
    near.sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y));
    let aa = u.cls.aa * (u.nation === 'us' && w.year >= 1943 ? 1.35 : 1) * (1 + 0.05 * u.vet);
    if (w.env.wx === 'overcast' || w.env.wx === 'rain') aa *= 0.85;
    // At night the guns can only put up a blind barrage.
    if (w.env.night) aa *= 0.3;
    if (u.crits.fc > 0) aa *= 0.7;
    aa *= 0.4 + 0.6 * clamp(u.hp / u.maxHp, 0, 1);
    for (let i = 0; i < Math.min(2, near.length); i++) {
      const s = near[i];
      const attacking = s.state === 'attack';
      // Most kills come while the aircraft are committed to their run.
      const f = attacking ? 1 : dist(s.x, s.y, u.x, u.y) < 2500 ? 0.35 : 0.15;
      const lam = (aa * 0.0004 * f) / s.def.tough;
      const k = Math.min(s.n, w.rng.events(lam));
      if (attacking) s.disrupted += 0.001 * aa;
      if (w.rng.chance(0.5)) w.events.push({ k: 'flak', x: s.x + w.rng.gauss() * 350, y: s.y + w.rng.gauss() * 350 });
      if (k > 0) loseAircraft(w, s, k);
    }
  }
}

function subDive(w: World) {
  for (const u of w.units) {
    if (!w.alive(u) || !u.cls.sub || u.depth !== 'surface' || u.depthOrder !== 'surface') continue;
    if (u.side === 0 && u.controllable && w.controllers[0] === 'human' && !w.autoEvade) continue;
    for (const s of w.squadrons) {
      if (s.side === u.side || !airborne(s) || s.n <= 0) continue;
      if (!w.airSeen[u.side].has(s.id)) continue;
      if (dist(u.x, u.y, s.x, s.y) < 7000) {
        w.setDepth(u, 'periscope');
        if (u.side === 0) w.msg(`${u.name}: aircraft! Diving!`, 'warn', u);
        break;
      }
    }
  }
}

// ------------------------------------------------------------------ orders

export function orderStrike(w: World, ids: number[], tgt: { unit: number | null; x: number; y: number }): number {
  const sqs = ids.map((id) => w.sq(id)).filter((s): s is Squadron => !!s && s.state !== 'gone' && s.n > 0);
  const lead = sqs.find((s) => s.def.role !== 'fighter') ?? sqs[0];
  let sent = 0;
  for (const s of sqs) {
    const home = w.unit(s.home);
    const from = (s.state === 'deck' || s.state === 'queued') && home ? home : s;
    const d = dist(from.x, from.y, tgt.x, tgt.y);
    if (d > s.def.radius * 1000) {
      if (s.side === 0) w.msg(`${s.name}: target is beyond strike range (${fmtKm(d)}, radius ${s.def.radius} km).`, 'warn');
      continue;
    }
    const next: SqState = s.def.role === 'fighter' && lead !== s && lead.def.role !== 'fighter' ? 'escort' : 'outbound';
    s.escortOf = next === 'escort' ? lead.id : null;
    s.target = { unit: tgt.unit, x: tgt.x, y: tgt.y };
    const c = tgt.unit !== null ? w.contacts[s.side].get(tgt.unit) : undefined;
    if (c && !isNaN(c.x)) Object.assign(s.target, { x: c.x, y: c.y, h: c.h, v: c.v, t: c.seen });
    s.capOver = null;
    s.engaged = null;
    s.searchT = 0;
    if (s.state === 'deck') queue(s, next);
    else if (s.state === 'queued') s.next = next;
    else s.state = next;
    sent++;
  }
  return sent;
}

export function orderCap(w: World, ids: number[], over: number) {
  for (const id of ids) {
    const s = w.sq(id);
    if (!s || s.state === 'gone' || s.n <= 0) continue;
    s.capOver = over;
    s.target = null;
    s.escortOf = null;
    if (s.state === 'deck') queue(s, 'cap');
    else if (s.state === 'queued') s.next = 'cap';
    else s.state = 'cap';
  }
}

export function orderScout(w: World, id: number, x: number, y: number) {
  const s = w.sq(id);
  if (!s || s.state === 'gone' || s.n <= 0) return;
  const home = w.unit(s.home);
  const from = home && (s.state === 'deck' || s.state === 'queued') ? home : s;
  const d = dist(from.x, from.y, x, y);
  const r = s.def.radius * 1000;
  if (d > r) {
    const a = headingTo(from.x, from.y, x, y);
    x = from.x + Math.cos(a) * r;
    y = from.y + Math.sin(a) * r;
  }
  s.target = { unit: null, x, y };
  if (s.state === 'deck') queue(s, 'scout');
  else if (s.state === 'queued') s.next = 'scout';
  else s.state = 'scout';
}

export function orderRecall(w: World, ids: number[]) {
  for (const id of ids) {
    const s = w.sq(id);
    if (!s || s.state === 'gone') continue;
    if (s.state === 'queued') s.state = 'deck';
    else if (s.state !== 'deck') {
      s.state = 'return';
      s.engaged = null;
    }
  }
}

// ------------------------------------------------------------------ raids from off the map

export function spawnRaid(w: World, side: Side, raid: AirRaidDef) {
  let ex: number;
  let ey: number;
  const W = w.terrain.w;
  const H = w.terrain.h;
  if (Array.isArray(raid.from)) {
    ex = raid.from[0] * 1000;
    ey = raid.from[1] * 1000;
  } else {
    const r = w.rng.range(0.25, 0.75);
    if (raid.from === 'n') { ex = W * r; ey = 0; }
    else if (raid.from === 's') { ex = W * r; ey = H; }
    else if (raid.from === 'w') { ex = 0; ey = H * r; }
    else { ex = W; ey = H * r; }
  }
  const pickUnit = (tag?: string) => {
    let best: Unit | null = null;
    let bs = -1;
    for (const u of w.units) {
      if (u.side === side || !w.alive(u)) continue;
      if (tag && !u.tags.includes(tag)) continue;
      if (u.cls.sub && u.depth !== 'surface') continue;
      const d = dist(ex, ey, u.x, u.y);
      const s = (TYPE_VALUE[u.cls.type] + w.rng.range(0, 3)) / (1 + d / 60000);
      if (s > bs) {
        bs = s;
        best = u;
      }
    }
    return best;
  };
  if (raid.cap) {
    const own = w.units.filter((u) => u.side === side && w.alive(u) && (!raid.cap || raid.cap === 'any' || u.tags.includes(raid.cap)));
    const over = own.length ? own[Math.floor(w.rng.next() * own.length)] : w.units.find((u) => u.side === side && w.alive(u)) ?? null;
    for (const g of raid.sq) {
      const s = newSquadron(w, side, g.a, g.n, null, `${AIRCRAFT[g.a].name}`);
      s.x = ex;
      s.y = ey;
      s.offmap = { x: ex, y: ey };
      s.capOver = over?.id ?? null;
      s.capUntil = w.time + (raid.minutes ?? 30) * 60;
      s.state = 'cap';
    }
    return;
  }
  const target = pickUnit(raid.target) ?? pickUnit();
  if (!target) return;
  let lead: Squadron | null = null;
  const made: Squadron[] = [];
  for (const g of raid.sq) {
    const def = AIRCRAFT[g.a];
    const s = newSquadron(w, side, g.a, g.n, null, `${def.name} (${ROLE_NAMES[def.role].toLowerCase()})`);
    s.x = ex;
    s.y = ey;
    s.offmap = { x: ex, y: ey };
    s.target = { unit: target.id, x: target.x, y: target.y };
    s.state = 'outbound';
    if (def.role !== 'fighter' && !lead) lead = s;
    made.push(s);
  }
  for (const s of made) {
    if (s.def.role === 'fighter' && lead) {
      s.state = 'escort';
      s.escortOf = lead.id;
    }
  }
}

function reportOnce(w: World, key: string, every: number) {
  return w.once(key, every);
}
