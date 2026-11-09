// Mission objectives, scripted triggers and the end of the battle.

import type { Action, Cond, ObjDef, TriggerDef } from '../data/types';
import { isStructureType } from '../data/ships';
import { spawnRaid } from './air';
import { assignBehavior } from './ai';
import { spawnGroup } from './build';
import type { ObjState, Side, Unit } from './types';
import type { World } from './world';

export interface TriggerState {
  def: TriggerDef;
  fired: boolean;
  pendingAt: number | null;
  lastFired: number;
}

const ACTIVE_KINDS = new Set(['destroy', 'reach', 'survive', 'tonnage', 'damage', 'shootdown', 'undetected']);

export function initObjectives(w: World) {
  w.objectives = w.mission.objectives.map((def) => ({ def, status: 'active', progress: 0, needed: neededFor(w, def) }));
  w.triggers = (w.mission.triggers ?? []).map((def) => ({ def, fired: false, pendingAt: null, lastFired: -1e9 }));
}

function neededFor(w: World, d: ObjDef): number {
  switch (d.kind) {
    case 'destroy':
    case 'damage':
      return d.count ?? Math.max(1, tagged(w, 1, d.tag).length);
    case 'reach':
      return d.count ?? Math.max(1, tagged(w, 0, d.tag).length);
    case 'tonnage':
      return d.tons ?? 10000;
    case 'shootdown':
      return d.count ?? 10;
    case 'survive':
      return (d.time ?? 30) * 60;
    default:
      return d.maxLoss ?? 0;
  }
}

function tagged(w: World, side: Side, tag?: string): Unit[] {
  return w.units.filter((u) => u.side === side && (!tag || u.tags.includes(tag)));
}

export function evaluateObjectives(w: World) {
  if (w.result) return;
  for (const o of w.objectives) {
    if (o.status !== 'active') continue;
    const d = o.def;
    switch (d.kind) {
      case 'destroy': {
        const ts = tagged(w, 1, d.tag);
        o.progress = ts.filter((u) => u.sunk).length;
        if (o.progress >= o.needed) complete(w, o);
        else if (ts.filter((u) => !u.escaped).length < o.needed) fail(w, o);
        break;
      }
      case 'damage': {
        const frac = d.frac ?? 0.5;
        const ts = tagged(w, 1, d.tag);
        o.progress = ts.filter((u) => u.sunk || u.hp / u.maxHp <= frac).length;
        if (o.progress >= o.needed) complete(w, o);
        else if (ts.filter((u) => !u.escaped || u.hp / u.maxHp <= frac).length < o.needed) fail(w, o);
        break;
      }
      case 'protect': {
        const lost = tagged(w, 0, d.tag).filter((u) => u.sunk).length;
        o.progress = lost;
        if (lost > (d.maxLoss ?? 0)) fail(w, o);
        break;
      }
      case 'reach': {
        const z = w.zone(d.zone);
        const us = tagged(w, 0, d.tag);
        o.progress = us.filter((u) => !u.sunk && (u.escaped || (z && z.kind !== 'exit' && w.inZone(u, z)))).length;
        const possible = us.filter((u) => !u.sunk).length;
        if (o.progress >= o.needed) complete(w, o);
        else if (possible < o.needed) fail(w, o);
        break;
      }
      case 'prevent': {
        const z = w.zone(d.zone);
        if (!z) break;
        const n = tagged(w, 1, d.tag).filter((u) => !u.sunk && (w.inZone(u, z) || (u.escaped && z.kind === 'exit'))).length;
        o.progress = n;
        if (n >= (d.count ?? 1)) fail(w, o);
        break;
      }
      case 'survive': {
        o.progress = w.time;
        if (w.time >= o.needed) complete(w, o);
        break;
      }
      case 'tonnage': {
        let tons = 0;
        for (const id of w.stats[0].sunk) {
          const u = w.unit(id);
          if (u && !isStructureType(u.cls.type)) tons += u.cls.tons;
        }
        o.progress = tons;
        if (tons >= o.needed) complete(w, o);
        break;
      }
      case 'shootdown': {
        o.progress = w.stats[0].planesKilled;
        if (o.progress >= o.needed) complete(w, o);
        break;
      }
      case 'airLosses': {
        o.progress = w.stats[0].planesLost;
        if (o.progress > (d.maxLoss ?? 0)) fail(w, o);
        break;
      }
      case 'hpAbove': {
        const frac = d.frac ?? 0.5;
        const us = tagged(w, 0, d.tag);
        if (us.some((u) => u.sunk || u.hp / u.maxHp < frac)) fail(w, o);
        break;
      }
      case 'undetected': {
        if (d.until && w.flags.has(d.until)) {
          complete(w, o);
          break;
        }
        for (const c of w.contacts[1].values()) {
          const u = w.unit(c.id);
          if (u && u.side === 0 && c.level >= 2) {
            fail(w, o);
            break;
          }
        }
        break;
      }
    }
  }
  checkEnd(w);
}

function complete(w: World, o: ObjState) {
  o.status = 'done';
  w.msg(`Objective complete: ${o.def.text}`, 'good');
}

function fail(w: World, o: ObjState) {
  o.status = 'failed';
  w.msg(`Objective failed: ${o.def.text}`, o.def.bonus ? 'warn' : 'bad');
}

function checkEnd(w: World) {
  const prim = w.objectives.filter((o) => !o.def.bonus);
  if (prim.some((o) => o.status === 'failed')) {
    w.finish('defeat', 'A primary objective has failed.');
    return;
  }
  const playerLeft = w.units.some((u) => u.side === 0 && u.controllable && !u.sunk && !u.escaped);
  const anyEscaped = w.units.some((u) => u.side === 0 && u.escaped);
  const active = prim.filter((o) => ACTIVE_KINDS.has(o.def.kind));
  const allActiveDone = active.length > 0 && active.every((o) => o.status === 'done');
  if (!playerLeft) {
    if (allActiveDone || (anyEscaped && active.every((o) => o.status === 'done'))) {
      finishWithRating(w);
    } else {
      w.finish('defeat', 'Our force has been destroyed or has withdrawn.');
    }
    return;
  }
  if (allActiveDone) {
    if (!w.victoryReady) {
      w.victoryReady = true;
      w.msg('All primary objectives achieved. You may end the mission or fight on for the bonus objectives.', 'good');
    }
    // the AI ends automatically; the player decides (or the remaining bonuses are already settled)
    const openBonus = w.objectives.some((o) => o.def.bonus && o.status === 'active' && ACTIVE_KINDS.has(o.def.kind));
    if (w.controllers[0] === 'ai' || !openBonus) finishWithRating(w);
    return;
  }
  if (w.time >= w.timeLimit) {
    w.finish('defeat', 'Time has run out before the objectives were achieved.');
  }
}

/** End the mission now (player choice, or time limit after victory). */
export function finishWithRating(w: World) {
  if (w.result) return;
  const prim = w.objectives.filter((o) => !o.def.bonus);
  const active = prim.filter((o) => ACTIVE_KINDS.has(o.def.kind));
  const won = prim.every((o) => o.status !== 'failed') && active.every((o) => o.status === 'done');
  if (!won) {
    w.finish('defeat', 'The mission was abandoned before its objectives were achieved.');
    return;
  }
  // settle passive objectives
  for (const o of w.objectives) {
    if (o.status === 'active' && !ACTIVE_KINDS.has(o.def.kind)) o.status = 'done';
  }
  const bonus = w.objectives.filter((o) => o.def.bonus);
  const bonusDone = bonus.filter((o) => o.status === 'done').length;
  let lostTons = 0;
  let ownTons = 0;
  for (const u of w.units) {
    if (u.side !== 0 || isStructureType(u.cls.type) || u.cls.merchant) continue;
    ownTons += u.cls.tons;
    if (u.sunk) lostTons += u.cls.tons;
  }
  let outcome: 'decisive' | 'victory' | 'marginal' = 'victory';
  if (bonus.length && bonusDone === bonus.length) outcome = 'decisive';
  if (ownTons > 0 && lostTons / ownTons > 0.45) outcome = 'marginal';
  const reason = outcome === 'decisive' ? 'Decisive victory!' : outcome === 'victory' ? 'Victory.' : 'A costly victory.';
  w.finish(outcome, reason);
}

// ------------------------------------------------------------------ triggers

function cond(w: World, c: Cond): boolean {
  if ('time' in c) return w.time >= c.time * 60;
  if ('lost' in c) {
    const side = c.side ?? 1;
    return tagged(w, side, c.lost).filter((u) => u.sunk).length >= c.count;
  }
  if ('enter' in c) {
    const z = w.zone(c.enter);
    if (!z) return false;
    const side = c.side ?? 0;
    return tagged(w, side, c.tag).some((u) => !u.sunk && (w.inZone(u, z) || (u.escaped && z.kind === 'exit')));
  }
  if ('detected' in c) {
    for (const u of tagged(w, 1, c.detected)) {
      const k = w.contacts[0].get(u.id);
      if (k && k.level >= 2) return true;
    }
    return false;
  }
  if ('spotted' in c) {
    const tag = c.spotted === 'any' ? undefined : c.spotted;
    for (const u of tagged(w, 0, tag)) {
      const k = w.contacts[1].get(u.id);
      if (k && k.level >= 2) return true;
    }
    return false;
  }
  if ('obj' in c) {
    const o = w.objectives.find((x) => x.def.id === c.obj);
    return !!o && o.status === c.state;
  }
  if ('hp' in c) {
    const side = c.side ?? 1;
    return tagged(w, side, c.hp).some((u) => u.sunk || u.hp / u.maxHp < c.below);
  }
  if ('flag' in c) return w.flags.has(c.flag);
  if ('torpHit' in c) return w.flags.has('torpHit:' + c.torpHit);
  if ('all' in c) return c.all.every((x) => cond(w, x));
  if ('any' in c) return c.any.some((x) => cond(w, x));
  return false;
}

export function evaluateTriggers(w: World) {
  for (const t of w.triggers) {
    if (t.pendingAt !== null) {
      if (w.time >= t.pendingAt) {
        t.pendingAt = null;
        for (const a of t.def.do) act(w, a);
      }
      continue;
    }
    if (t.fired && !(t.def.repeat && w.time - t.lastFired >= t.def.repeat * 60)) continue;
    if (!cond(w, t.def.when)) continue;
    t.fired = true;
    t.lastFired = w.time;
    if (t.def.delay) t.pendingAt = w.time + t.def.delay * 60;
    else for (const a of t.def.do) act(w, a);
  }
}

function act(w: World, a: Action) {
  if ('msg' in a) {
    w.msg(a.from ? `${a.from}: ${a.msg}` : a.msg, 'radio');
  } else if ('spawn' in a) {
    spawnGroup(w, a.spawn, a.side, true);
  } else if ('air' in a) {
    spawnRaid(w, a.side, a.air);
  } else if ('behavior' in a) {
    assignBehavior(w, a.behavior, a.set);
  } else if ('reveal' in a) {
    const side = a.side ?? 1;
    for (const u of tagged(w, side, a.reveal)) {
      if (u.sunk) continue;
      const viewer = side === 1 ? 0 : 1;
      const prev = w.contacts[viewer].get(u.id);
      w.contacts[viewer].set(u.id, {
        id: u.id, level: Math.max(prev?.level ?? 0, 2), fix: false, x: u.x, y: u.y, h: u.h, v: u.v,
        t: w.time, seen: w.time, type: u.cls.type, sonar: false,
      });
    }
  } else if ('flag' in a) {
    w.flags.add(a.flag);
  } else if ('alert' in a) {
    w.alertGroup(a.alert, 0);
  } else if ('end' in a) {
    if (a.end === 'victory') finishWithRating(w);
    else w.finish('defeat', 'The mission has been lost.');
  } else if ('special' in a) {
    for (const u of w.units) {
      if (!u.tags.includes(a.tag) || u.sunk) continue;
      if (a.special === 'illuminate') u.illuminated = true;
      if (a.special === 'unilluminate') u.illuminated = false;
      if (a.special === 'retreat') {
        const g = w.groups.get(u.group);
        if (g) g.mode = 'retreat';
      }
    }
  }
}
