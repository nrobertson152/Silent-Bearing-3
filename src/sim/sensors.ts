// Detection and the fog of war. Each side builds its own contact picture from
// lookouts, radar, sonar, hydrophones (bearing lines only), HF/DF and aircraft.

import { DEG, KN, angleDiff, clamp, dist, fmtBearing, fmtKm, headingTo, rayIntersect } from '../core/math';
import { NATIONS, aswSkill } from '../data/nations';
import { SIZE, TYPE_NAMES, isStructureType } from '../data/ships';
import type { Contact, Side, Squadron, Unit } from './types';
import type { World } from './world';

export function airborne(s: Squadron): boolean {
  return s.state !== 'deck' && s.state !== 'queued' && s.state !== 'gone';
}

function report(w: World, key: string, every: number): boolean {
  return w.once(key, every);
}

export function sense(w: World) {
  const t = w.time;
  for (const side of [0, 1] as Side[]) {
    const C = w.contacts[side];
    const obs = w.units.filter((u) => u.side === side && w.alive(u));
    const air = w.squadrons.filter((s) => s.side === side && airborne(s) && s.n > 0);
    const B = w.bearings[side];
    // prune old bearing lines
    let k = 0;
    for (const b of B) if (t - b.t < (b.kind === 'hfdf' ? 70 : 25)) B[k++] = b;
    B.length = k;

    const sightings: Sighting[] = [];
    for (const e of w.units) {
      if (e.side === side) continue;
      if (e.sunk || e.escaped) {
        C.delete(e.id);
        continue;
      }
      let level = e.illuminated ? 3 : 0;
      let sonar = false;
      const heard: Unit[] = [];
      const baseSize = SIZE[e.cls.type];
      const submerged = !!e.cls.sub && e.depth !== 'surface';
      const deep = !!e.cls.sub && e.depth === 'deep';
      let size = baseSize;
      if (e.cls.sub && e.depth === 'periscope') size = 0.07 * (e.v > 2.5 ? 2.2 : 1);
      const night = w.env.night;
      // a surfaced boat trimmed down shows almost nothing against a dark sea
      if (e.cls.sub && e.depth === 'surface' && night) size *= 0.65;
      let visMul = 1;
      if (t - e.lastFire < 8) visMul *= night ? 4.5 : 1.3;
      if (e.fires > 0 && night) visMul *= 2.4;
      if (w.inSquall(e.x, e.y)) visMul *= 0.3;
      const structure = isStructureType(e.cls.type);

      for (const o of obs) {
        if (level >= 3) break;
        const d = dist(o.x, o.y, e.x, e.y);
        if (d > 160000) continue;
        // lookouts
        if (!deep) {
          let vr = w.env.vis * size * visMul;
          if (structure) vr = Math.max(vr, w.env.vis);
          if (o.cls.sub) vr *= o.depth === 'surface' ? 0.75 : o.depth === 'periscope' ? 0.55 : 0;
          if (night) vr *= NATIONS[o.nation].nightBonus ?? 1;
          if (!o.alert) vr *= 0.6;
          if (w.inSquall(o.x, o.y)) vr *= 0.3;
          if (d < vr && w.terrain.los(o.x, o.y, e.x, e.y) && !w.smokeBlocks(o.x, o.y, e.x, e.y)) {
            level = Math.max(level, d < vr * 0.65 ? 3 : 2);
            if (level >= 3) break;
          }
        }
        // radar
        // a ship at harbour stations keeps no proper radar watch
        const rr0 = o.radar && o.crits.radar <= 0 && !(o.cls.sub && o.depth !== 'surface') ? o.radar * (o.alert ? 1 : 0.5) : 0;
        if (rr0 && !submerged) {
          // ships close under a coastline are lost in the land echoes
          const clutter = w.terrain.hasLand && w.terrain.sample(e.x, e.y) > -1500 ? 0.5 : 1;
          const rr = rr0 * Math.sqrt(size) * (e.cls.sub ? 0.55 : 1) * clutter;
          if (d < rr && w.terrain.los(o.x, o.y, e.x, e.y)) level = Math.max(level, 2);
        }
        // active sonar
        // active sonar loses a contact in the last couple of hundred metres
        // before passing over it, so the final run-in is made blind
        if (submerged && o.cls.sonar && o.v < 9.5 && t > o.sonarBlind && d > 200) {
          const sr = o.cls.sonar * (deep ? 0.65 : 1) * ((w.env.sea ?? 1) >= 3 ? 0.8 : 1) * (o.alert ? 1 : 0.5) * Math.min(1.15, aswSkill(o.nation, w.year));
          if (d < sr) {
            if (level < 2) sonar = true;
            level = Math.max(level, 2);
          }
        }
        // passive hydrophones: bearing only
        if (level < 2 && o.cls.hydro && heard.length < 3) {
          const maxv = (submerged && e.cls.sub ? e.cls.sub.sspeed : e.cls.speed) * KN;
          const speedFrac = clamp(e.v / Math.max(1, maxv), 0, 1);
          let noise = (0.3 + 0.7 * speedFrac) * (e.cls.noise ?? 1) * (submerged ? 0.45 : 1) * (e.cls.merchant ? 1.25 : 1) * Math.sqrt(baseSize + 0.2);
          if (e.v < 0.3) noise *= 0.15;
          const selfNoise = o.cls.sub ? (o.depth === 'surface' ? 0.5 : 1) : o.v > 7.7 ? 0.35 : 1;
          const hr = o.cls.hydro * noise * selfNoise;
          if (d < hr) heard.push(o);
        }
      }
      // aircraft overhead
      const fromShips = level;
      if (level < 3 && !deep) {
        for (const s of air) {
          const d = dist(s.x, s.y, e.x, e.y);
          let vr = (night ? (s.def.night ? 4000 : 1800) : Math.min(28000, w.env.vis * 1.15)) * size;
          if (e.cls.sub && e.depth === 'surface') vr *= 1.6;
          if (s.def.asv) vr = Math.max(vr, e.cls.sub ? (e.depth === 'surface' ? 15000 : 0) : 30000);
          if (w.inSquall(e.x, e.y)) vr *= 0.3;
          if (d < vr) {
            level = Math.max(level, d < vr * 0.7 ? 3 : 2);
            if (level >= 3) break;
          }
        }
      }

      const prev = C.get(e.id);
      if (level >= 2) {
        let x = e.x;
        let y = e.y;
        if (sonar) {
          x += w.rng.gauss() * 55;
          y += w.rng.gauss() * 55;
        }
        const firstSight = !prev || t - prev.seen > 180;
        const c: Contact = prev ?? { id: e.id, level, fix: false, x, y, h: e.h, v: e.v, t, seen: t, type: null, sonar };
        const wasIdentified = !!prev && prev.level >= 3 && t - prev.seen < 60;
        c.level = wasIdentified ? 3 : level;
        c.x = x;
        c.y = y;
        c.h = e.h;
        c.v = e.v;
        c.t = t;
        c.seen = t;
        c.fix = false;
        c.sonar = sonar;
        if (c.level >= 3) c.type = e.cls.type;
        C.set(e.id, c);
        if (firstSight && side === 0) sightings.push({ e, c, air: fromShips < 2 });
        // wake up sleeping ships nearby
        for (const o of obs) {
          if (o.alert) continue;
          if (dist(o.x, o.y, e.x, e.y) < Math.max(w.env.vis * 0.9, 6000)) {
            const g = w.groups.get(o.group);
            w.alertUnit(o, g?.data.alertDelay ?? 30);
          }
        }
      } else {
        if (prev) {
          prev.level = 0;
          prev.sonar = false;
          if (t - prev.seen > 3600 && t - prev.t > 300) C.delete(e.id);
        }
      }
      if (level < 2 && heard.length) {
        for (const o of heard) {
          const ang = headingTo(o.x, o.y, e.x, e.y) + w.rng.gauss() * 2.5 * DEG;
          B.push({ from: o.id, ox: o.x, oy: o.y, ang, t, tid: e.id, kind: 'sonar' });
        }
        let c = C.get(e.id);
        if (!c) {
          c = { id: e.id, level: 1, fix: false, x: NaN, y: NaN, h: 0, v: 0, t, seen: -1e9, type: null, sonar: false };
          C.set(e.id, c);
          if (side === 0 && report(w, 'snd' + e.id, 240)) {
            w.msg(`Sound contact bearing ${fmtBearing(headingTo(heard[0].x, heard[0].y, e.x, e.y))} from ${heard[0].name}.`, 'radio', heard[0]);
          }
        }
        c.level = Math.max(c.level, 1);
        c.t = t;
        // cross bearings give a position fix
        const fix = crossFix(w, side, e.id);
        if (fix) {
          c.fix = true;
          c.x = fix.x;
          c.y = fix.y;
        }
      }
    }

    if (sightings.length) queueSightings(w, sightings);
    if (side === 0) flushSightings(w, obs);
    hfdf(w, side, obs);
    airPicture(w, side, obs, air);
    torpedoWatch(w, side, obs, air);
  }
}

interface Sighting {
  e: Unit;
  c: Contact;
  air: boolean;
}

function describe(e: Unit, c: Contact): string {
  if (c.level >= 3) return e.cls.sub ? 'enemy submarine' : `${TYPE_NAMES[e.cls.type].toLowerCase()} ${e.name}`;
  if (e.cls.sub) return c.sonar ? 'sonar contact' : 'submarine';
  return 'unidentified ship';
}

const pendingSight = new WeakMap<World, Map<string, { t: number; list: Sighting[] }>>();

/**
 * Sightings are held for a few seconds and reported once per enemy group,
 * so a scout sweeping past a task force sends one report, not ten.
 */
function queueSightings(w: World, list: Sighting[]) {
  let m = pendingSight.get(w);
  if (!m) {
    m = new Map();
    pendingSight.set(w, m);
  }
  for (const s of list) {
    const p = m.get(s.e.group) ?? { t: w.time, list: [] };
    if (!p.list.some((x) => x.e === s.e)) p.list.push(s);
    m.set(s.e.group, p);
  }
}

function flushSightings(w: World, obs: Unit[]) {
  const m = pendingSight.get(w);
  if (!m) return;
  for (const [gid, p] of m) {
    if (w.time - p.t < 12) continue;
    m.delete(gid);
    const live = p.list.filter((s) => w.alive(s.e));
    if (!live.length) continue;
    const big = live.some((s) => s.c.level >= 3 && (s.e.cls.type === 'CV' || s.e.cls.type === 'BB' || s.e.cls.type === 'BC'));
    // one report per group every ten minutes, unless a capital ship is newly identified
    if (!report(w, 'grp' + gid, 600) && !(big && report(w, 'grpbig' + gid, 600))) continue;
    const a = live[0];
    let nearest: Unit | null = null;
    let nd = Infinity;
    for (const o of obs) {
      const d = dist(o.x, o.y, a.e.x, a.e.y);
      if (d < nd) {
        nd = d;
        nearest = o;
      }
    }
    if (!nearest) continue;
    const where = `bearing ${fmtBearing(headingTo(nearest.x, nearest.y, a.e.x, a.e.y))}, ${fmtKm(nd)} from ${nearest.name}`;
    const byAir = live.every((g) => g.air);
    if (live.length === 1) {
      const d = describe(a.e, a.c);
      const what = d.charAt(0).toUpperCase() + d.slice(1);
      w.msg(`${byAir ? 'Aircraft report: ' : ''}${what} sighted, ${where}.`, 'radio', a.e);
      continue;
    }
    const known = live
      .filter((g) => g.c.level >= 3 && !g.e.cls.sub)
      .sort((x, y) => y.e.cls.tons - x.e.cls.tons)
      .slice(0, 2)
      .map((g) => describe(g.e, g.c));
    const incl = known.length ? `, including the ${known.join(' and the ')}` : '';
    w.msg(byAir ? `Aircraft report ${live.length} ships${incl}, ${where}.` : `${live.length} ships sighted${incl}, ${where}.`, 'radio', a.e);
  }
}

function crossFix(w: World, side: Side, tid: number) {
  const lines = w.bearings[side].filter((b) => b.tid === tid && w.time - b.t < 15);
  if (lines.length < 2) return null;
  let best: { x: number; y: number } | null = null;
  let bestAng = 0;
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      if (a.from === b.from) continue;
      if (dist(a.ox, a.oy, b.ox, b.oy) < 1200) continue;
      const da = Math.abs(angleDiff(a.ang, b.ang));
      const sep = Math.min(da, Math.PI - da);
      if (sep < 20 * DEG) continue;
      const p = rayIntersect(a.ox, a.oy, a.ang, b.ox, b.oy, b.ang);
      if (p && sep > bestAng) {
        bestAng = sep;
        best = p;
      }
    }
  }
  return best;
}

/** High-frequency direction finding: U-boats on the surface give away their bearing when they transmit. */
function hfdf(w: World, side: Side, obs: Unit[]) {
  const finders = obs.filter((o) => o.cls.hfdf);
  if (!finders.length) return;
  const key = 'hfdf' + side;
  if (!report(w, key, 90)) return;
  for (const e of w.units) {
    if (e.side === side || !w.alive(e) || !e.cls.sub || e.depth !== 'surface') continue;
    if (!w.rng.chance(0.4)) continue;
    let any = false;
    for (const o of finders) {
      if (dist(o.x, o.y, e.x, e.y) > 45000) continue;
      w.bearings[side].push({ from: o.id, ox: o.x, oy: o.y, ang: headingTo(o.x, o.y, e.x, e.y) + w.rng.gauss() * 3 * DEG, t: w.time, tid: e.id, kind: 'hfdf' });
      any = true;
    }
    if (any && side === 0) w.msg('HF/DF: U-boat transmission intercepted.', 'radio');
  }
}

function airPicture(w: World, side: Side, obs: Unit[], air: Squadron[]) {
  const seen = w.airSeen[side];
  const night = w.env.night;
  for (const s of w.squadrons) {
    if (s.side === side) continue;
    if (!airborne(s) || s.n <= 0) {
      seen.delete(s.id);
      continue;
    }
    let found = false;
    for (const o of obs) {
      const d = dist(o.x, o.y, s.x, s.y);
      const vr = (night ? 2000 : Math.min(15000, w.env.vis * 0.7)) * (o.cls.sub && o.depth !== 'surface' ? 0.4 : 1);
      if (d < vr || (o.airRadar && o.crits.radar <= 0 && d < o.airRadar)) {
        found = true;
        break;
      }
    }
    if (!found) {
      for (const a of air) {
        if (dist(a.x, a.y, s.x, s.y) < (night ? 1500 : 10000)) {
          found = true;
          break;
        }
      }
    }
    if (found) {
      if (!seen.has(s.id) && side === 0 && s.def.role !== 'scout' && report(w, 'air' + s.id, 600)) {
        let near: Unit | null = null;
        let nd = Infinity;
        for (const o of obs) {
          const d = dist(o.x, o.y, s.x, s.y);
          if (d < nd) {
            nd = d;
            near = o;
          }
        }
        if (near) w.msg(`Enemy aircraft: ${s.n} ${s.def.name}, bearing ${fmtBearing(headingTo(near.x, near.y, s.x, s.y))}, ${fmtKm(nd)}.`, 'warn', s);
      }
      seen.add(s.id);
    } else {
      seen.delete(s.id);
    }
  }
}

function torpedoWatch(w: World, side: Side, obs: Unit[], air: Squadron[]) {
  const K = w.knownTorps[side];
  const night = w.env.night;
  for (const tp of w.torps) {
    if (tp.side === side) continue;
    if (!K.has(tp.id)) {
      const spot = tp.wake ? (night ? 600 : 2600) : night ? 120 : 650;
      let seen = false;
      // a wake in range is not necessarily seen: each lookout has a chance each second
      for (const o of obs) {
        if (o.cls.sub && o.depth === 'deep') continue;
        if (Math.abs(o.x - tp.x) > spot || Math.abs(o.y - tp.y) > spot) continue;
        if (dist(o.x, o.y, tp.x, tp.y) < spot) {
          const p = (night ? 0.06 : 0.3) * (o.alert ? 1 : 0.4) * (o.cls.merchant ? 0.6 : 1);
          if (w.rng.chance(p)) {
            seen = true;
            break;
          }
        }
      }
      if (!seen && !night && tp.wake) for (const a of air) if (dist(a.x, a.y, tp.x, tp.y) < 3000 && w.rng.chance(0.3)) seen = true;
      if (seen) {
        K.add(tp.id);
        if (side === 0 && report(w, 'torpwarn', 20)) w.msg('Torpedo tracks spotted!', 'warn', tp);
      }
    }
    if (!K.has(tp.id)) continue;
    // evasive action
    for (const u of obs) {
      if (u.evadeUntil > w.time || isStructureType(u.cls.type) || u.disabled || u.rudderJam || u.speedSet === 0) continue;
      if (u.cls.sub && u.depth !== 'surface') continue;
      const player = u.side === 0 && u.controllable && w.controllers[0] === 'human';
      if (player && !w.autoEvade) continue;
      const tvx = Math.cos(tp.h) * tp.speed;
      const tvy = Math.sin(tp.h) * tp.speed;
      const uvx = Math.cos(u.h) * u.v;
      const uvy = Math.sin(u.h) * u.v;
      const dx = tp.x - u.x;
      const dy = tp.y - u.y;
      const rvx = tvx - uvx;
      const rvy = tvy - uvy;
      const rv2 = rvx * rvx + rvy * rvy;
      if (rv2 < 1) continue;
      const tau = -(dx * rvx + dy * rvy) / rv2;
      if (tau < 0 || tau > 110) continue;
      const cx = dx + rvx * tau;
      const cy = dy + rvy * tau;
      if (cx * cx + cy * cy > Math.pow(u.cls.length / 2 + 90, 2)) continue;
      // comb the track: turn parallel to it
      const a1 = tp.h;
      const a2 = tp.h + Math.PI;
      u.evadeH = Math.abs(angleDiff(u.h, a1)) < Math.abs(angleDiff(u.h, a2)) ? a1 : a2;
      u.evadeUntil = w.time + 45;
      if (u.side === 0) w.msg(`${u.name} is turning to avoid torpedoes.`, 'info', u);
    }
  }
}
