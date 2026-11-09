// The battle simulation. No rendering, no DOM: deterministic for a given seed so
// it can run headless in tests.

import { Rng } from '../core/rng';
import {
  KN, DEG, TAU, angleDiff, clamp, dist, dist2, headingTo, wrap, type Vec,
} from '../core/math';
import type { EnvDef, MissionDef, NationId, ShipClass } from '../data/types';
import { GUNS, TORPS } from '../data/weapons';
import { NATIONS } from '../data/nations';
import { isCarrierType, isMerchantType, isStructureType, steamTime } from '../data/ships';
import { Terrain } from './terrain';
import type {
  BattleResult, Bearing, Contact, DepthCharge, GroupAI, LogMsg, MsgKind, ObjState, Shell, Side,
  SideStats, SimEvent, Smoke, Squadron, Torpedo, Unit, Zone,
} from './types';
import { updateCombat, landShell, stepTorpedo, detonateDC, applyDamage, damageControl } from './combat';
import { sense } from './sensors';
import { airStep, airSecond } from './air';
import { aiThink, initGroups } from './ai';
import { evaluateObjectives, evaluateTriggers, type TriggerState } from './objectives';

export const DT = 0.25;
export const SPEED_FRAC = [0, 0.33, 0.66, 0.9, 1.0];
export const SPEED_NAMES = ['Stop', '1/3', '2/3', 'Full', 'Flank'];

export interface EnvState extends EnvDef {
  vis: number; // visual range against a battleship, metres
  night: boolean;
  windX: number;
  windY: number;
  airOps: boolean; // aircraft can fly at all
}

export interface Difficulty {
  enemyAcc: number;
  taken: number;
}

export const DIFFICULTY: Record<string, Difficulty> = {
  easy: { enemyAcc: 0.75, taken: 0.75 },
  normal: { enemyAcc: 1, taken: 1 },
  hard: { enemyAcc: 1.15, taken: 1.15 },
};

export function envState(e: EnvDef): EnvState {
  const wxVis: Record<string, number> = { clear: 24000, overcast: 17000, rain: 11000, fog: 3200, snow: 6500, storm: 9000 };
  let vis = wxVis[e.wx] ?? 20000;
  const night = e.tod === 'night';
  if (e.tod === 'dawn' || e.tod === 'dusk') vis *= 0.55;
  if (night) vis = Math.min(vis, (e.wx === 'clear' ? 4200 : 2800) + (e.aurora ? 1500 : 0));
  const wa = ((e.wind ?? 60) - 90) * DEG;
  const ws = e.wx === 'storm' ? 6 : e.wx === 'clear' ? 2 : 3.5;
  return {
    ...e,
    vis,
    night,
    windX: Math.cos(wa) * ws,
    windY: Math.sin(wa) * ws,
    airOps: e.wx !== 'storm' && e.wx !== 'fog',
  };
}

/** The point on a ship's recent track a given distance astern of her. */
function trailPoint(L: Unit, behind: number): Vec {
  let px = L.x;
  let py = L.y;
  let left = behind;
  for (let i = L.trail.length - 2; i >= 0; i -= 2) {
    const qx = L.trail[i];
    const qy = L.trail[i + 1];
    const d = Math.hypot(px - qx, py - qy);
    if (d >= left) {
      const f = left / Math.max(1e-6, d);
      return { x: px + (qx - px) * f, y: py + (qy - py) * f };
    }
    left -= d;
    px = qx;
    py = qy;
  }
  return { x: px, y: py };
}

export class World {
  readonly mission: MissionDef;
  readonly terrain: Terrain;
  readonly rng: Rng;
  readonly year: number;
  readonly env: EnvState;
  time = 0;
  units: Unit[] = [];
  squadrons: Squadron[] = [];
  shells: Shell[] = [];
  torps: Torpedo[] = [];
  dcs: DepthCharge[] = [];
  smokes: Smoke[] = [];
  zones: Zone[] = [];
  groups = new Map<string, GroupAI>();
  contacts: [Map<number, Contact>, Map<number, Contact>] = [new Map(), new Map()];
  airSeen: [Set<number>, Set<number>] = [new Set(), new Set()];
  bearings: [Bearing[], Bearing[]] = [[], []];
  knownTorps: [Set<number>, Set<number>] = [new Set(), new Set()];
  objectives: ObjState[] = [];
  triggers: TriggerState[] = [];
  flags = new Set<string>();
  log: LogMsg[] = [];
  events: SimEvent[] = [];
  stats: [SideStats, SideStats] = [newStats(), newStats()];
  result: BattleResult = null;
  victoryReady = false;
  controllers: ['human' | 'ai', 'ai'] = ['human', 'ai'];
  diff: Difficulty = DIFFICULTY.normal;
  autoEvade = true;
  timeLimit: number;
  private nextId = 1;
  private acc = 0;
  private secTimer = 0;
  private unitById = new Map<number, Unit>();
  private sqById = new Map<number, Squadron>();

  constructor(mission: MissionDef, seed: number) {
    this.mission = mission;
    this.rng = new Rng(seed);
    this.terrain = new Terrain(mission.map);
    this.year = Number(mission.date.slice(0, 4)) + (Number(mission.date.slice(5, 7)) - 1) / 12;
    this.env = envState(mission.env);
    this.timeLimit = (mission.timeLimit ?? 90) * 60;
    this.zones = (mission.zones ?? []).map((z) => ({ ...z, x: z.x * 1000, y: z.y * 1000, r: z.r * 1000 }));
  }

  // ------------------------------------------------------------------ ids and lookup
  newId(): number {
    return this.nextId++;
  }

  unit(id: number | null | undefined): Unit | undefined {
    return id == null ? undefined : this.unitById.get(id);
  }

  sq(id: number | null | undefined): Squadron | undefined {
    return id == null ? undefined : this.sqById.get(id);
  }

  addUnit(u: Unit) {
    this.units.push(u);
    this.unitById.set(u.id, u);
  }

  addSquadron(s: Squadron) {
    this.squadrons.push(s);
    this.sqById.set(s.id, s);
  }

  zone(id: string | undefined): Zone | undefined {
    return id ? this.zones.find((z) => z.id === id) : undefined;
  }

  alive(u: Unit | undefined): u is Unit {
    return !!u && !u.sunk && !u.escaped;
  }

  // ------------------------------------------------------------------ messages
  private throttle = new Map<string, number>();

  /** True at most once every `every` seconds for a given key: rate-limits reports. */
  once(key: string, every: number): boolean {
    const t = this.throttle.get(key);
    if (t !== undefined && this.time - t < every) return false;
    this.throttle.set(key, this.time);
    return true;
  }

  msg(text: string, kind: MsgKind = 'info', pos?: Vec) {
    this.log.push({ t: this.time, text, kind, x: pos?.x, y: pos?.y });
    if (this.log.length > 300) this.log.splice(0, this.log.length - 300);
    this.events.push({ k: 'msg', text, kind });
  }

  /** Messages the human player should hear about: own side events or what they can see. */
  sideMsg(side: Side, text: string, kind: MsgKind, pos?: Vec) {
    if (side === 0) this.msg(text, kind, pos);
  }

  // ------------------------------------------------------------------ main loop
  init() {
    initGroups(this);
    sense(this);
  }

  /** Advance the simulation by `seconds` of game time. */
  advance(seconds: number, maxSteps = 4000) {
    if (this.result) return;
    this.acc += seconds;
    let n = 0;
    while (this.acc >= DT && n < maxSteps) {
      this.step(DT);
      this.acc -= DT;
      n++;
      if (this.result) {
        this.acc = 0;
        break;
      }
    }
    if (n >= maxSteps) this.acc = 0;
  }

  step(dt: number) {
    this.time += dt;
    const t = this.time;
    for (const u of this.units) {
      if (u.sunk || u.escaped) continue;
      damageControl(this, u, dt);
      if (u.sunk) continue;
      this.updateSub(u, dt);
      this.move(u, dt);
      this.updateSmoke(u, dt);
      this.updateMines(u, dt);
    }
    updateCombat(this, dt);
    // shells
    if (this.shells.length) {
      let w = 0;
      for (let i = 0; i < this.shells.length; i++) {
        const s = this.shells[i];
        if (s.t1 <= t) landShell(this, s);
        else this.shells[w++] = s;
      }
      this.shells.length = w;
    }
    // torpedoes
    if (this.torps.length) {
      let w = 0;
      for (let i = 0; i < this.torps.length; i++) {
        const tp = this.torps[i];
        if (stepTorpedo(this, tp, dt)) this.torps[w++] = tp;
        else {
          this.knownTorps[0].delete(tp.id);
          this.knownTorps[1].delete(tp.id);
        }
      }
      this.torps.length = w;
    }
    // depth charges
    if (this.dcs.length) {
      let w = 0;
      for (let i = 0; i < this.dcs.length; i++) {
        const d = this.dcs[i];
        if (d.t <= t) detonateDC(this, d);
        else this.dcs[w++] = d;
      }
      this.dcs.length = w;
    }
    // smoke
    if (this.smokes.length) {
      let w = 0;
      for (let i = 0; i < this.smokes.length; i++) {
        const s = this.smokes[i];
        const age = t - s.t0;
        if (age > s.life) continue;
        s.x += (s.vx + this.env.windX * (s.squall ? 0.3 : 1)) * dt;
        s.y += (s.vy + this.env.windY * (s.squall ? 0.3 : 1)) * dt;
        s.r = s.squall ? s.r0 : s.r0 + (s.r1 - s.r0) * Math.min(1, age / 150);
        this.smokes[w++] = s;
      }
      this.smokes.length = w;
    }
    airStep(this, dt);
    this.secTimer += dt;
    if (this.secTimer >= 1) {
      this.secTimer -= 1;
      sense(this);
      airSecond(this);
      this.checkAlerts();
      evaluateTriggers(this);
      evaluateObjectives(this);
      if (this.squadrons.length > 200) {
        const keep = this.squadrons.filter((s) => s.state !== 'gone');
        this.squadrons = keep;
      }
    }
    aiThink(this);
  }

  // ------------------------------------------------------------------ alerts
  alertUnit(u: Unit, delay: number) {
    if (u.alert) return;
    const at = this.time + delay;
    if (u.alertAt === null || at < u.alertAt) u.alertAt = at;
  }

  /**
   * Gunfire, splashes or hits around a sleeping ship. Even then a crew at
   * harbour stations takes a while to man the guns, and the alarm spreads to
   * the rest of the group.
   */
  alarm(u: Unit, delay: number) {
    if (u.alert) return;
    const g = this.groups.get(u.group);
    const slow = (g?.data.alertDelay ?? 30) * 0.5;
    this.alertUnit(u, Math.max(delay, slow));
    if (g) for (const id of g.members) {
      const m = this.unit(id);
      if (m && m !== u && !m.alert) this.alertUnit(m, Math.max(delay, slow) + this.rng.range(10, 40));
    }
  }

  private checkAlerts() {
    for (const u of this.units) {
      if (u.alert || u.sunk) continue;
      if (u.alertAt !== null && this.time >= u.alertAt) {
        u.alert = true;
        if (u.steamAt === Infinity) u.steamAt = this.time + steamTime(u.cls);
        const g = this.groups.get(u.group);
        if (g && g.behavior.kind === 'hold' && g.behavior.onAlert) {
          g.behavior = g.behavior.onAlert;
          g.mode = 'cruise';
        }
        if (u.speedSet === 0 && !u.disabled && !isStructureType(u.cls.type)) u.speedSet = 3;
      }
    }
  }

  alertGroup(id: string, delay: number) {
    for (const u of this.units) if (u.group === id) this.alertUnit(u, delay + this.rng.range(0, 30));
  }

  // ------------------------------------------------------------------ helpers
  maxSpeed(u: Unit): number {
    const c = u.cls;
    if (u.disabled || isStructureType(c.type) || this.time < u.steamAt) return 0;
    let kn = c.speed;
    if (c.sub && u.depth !== 'surface') kn = u.battery > 0 ? c.sub.sspeed : 1.5;
    if (u.crits.engine > 0) kn *= 0.55;
    kn *= 1 - 0.08 * u.flood;
    const hpf = u.hp / u.maxHp;
    if (hpf < 0.35) kn *= 0.5 + hpf * 1.4;
    if (u.rudderJam) kn = Math.min(kn, 8);
    if (this.env.sea && this.env.sea >= 3 && (c.type === 'PT' || c.type === 'DD' || c.type === 'DE' || c.type === 'TB')) kn *= c.type === 'PT' ? 0.55 : 0.85;
    return Math.max(0, kn) * KN;
  }

  clearance(u: Unit): number {
    return clamp(u.cls.beam * 3, 45, 200);
  }

  crewSkill(u: Unit): number {
    return u.crew * (1 + 0.06 * u.vet);
  }

  pathTo(u: Unit, x: number, y: number, append = false): boolean {
    const from = append && u.path.length ? u.path[u.path.length - 1] : { x: u.x, y: u.y };
    const p = this.terrain.findPath(from.x, from.y, x, y, this.clearance(u));
    if (!p) return false;
    u.path = append ? u.path.concat(p) : p;
    u.orderH = null;
    return true;
  }

  sternPos(u: Unit): Vec {
    return { x: u.x - Math.cos(u.h) * u.cls.length * 0.45, y: u.y - Math.sin(u.h) * u.cls.length * 0.45 };
  }

  inZone(u: Unit | Vec, z: Zone): boolean {
    return dist2(u.x, u.y, z.x, z.y) <= z.r * z.r;
  }

  nationOf(c: ShipClass): NationId {
    return c.nation;
  }

  // ------------------------------------------------------------------ submarines
  private updateSub(u: Unit, dt: number) {
    const sub = u.cls.sub;
    if (!sub) return;
    if (this.env.shallow && u.depthOrder === 'deep') u.depthOrder = 'periscope';
    if (u.depthOrder !== u.depth) {
      u.depthTimer -= dt;
      if (u.depthTimer <= 0) {
        const order: ('surface' | 'periscope' | 'deep')[] = ['surface', 'periscope', 'deep'];
        const cur = order.indexOf(u.depth);
        const tgt = order.indexOf(u.depthOrder);
        u.depth = order[cur + Math.sign(tgt - cur)];
        if (u.depth !== u.depthOrder) u.depthTimer = sub.dive * 0.7;
      }
    }
    if (u.depth === 'surface') {
      u.battery = Math.min(1, u.battery + dt / 5400);
    } else {
      const frac = u.v / (sub.sspeed * KN);
      u.battery = Math.max(0, u.battery - (dt / (7200 * sub.battery)) * (0.15 + 2.4 * frac * frac));
    }
  }

  setDepth(u: Unit, d: 'surface' | 'periscope' | 'deep') {
    if (!u.cls.sub) return;
    if (this.env.shallow && d === 'deep') d = 'periscope';
    if (u.depthOrder === d) return;
    const fromSurface = u.depth === 'surface';
    u.depthOrder = d;
    u.depthTimer = fromSurface ? u.cls.sub.dive : u.cls.sub.dive * 0.7;
  }

  // ------------------------------------------------------------------ movement
  private move(u: Unit, dt: number) {
    const c = u.cls;
    if (isStructureType(c.type)) return;
    let vmax = this.maxSpeed(u);
    if (!u.alert && (u.speedSet === 0 || u.disabled)) vmax = 0;
    let targetV = Math.min(vmax * SPEED_FRAC[u.speedSet], u.speedCap);
    let desired = u.h;

    const selfDefence = u.side === 1 || !u.controllable || this.controllers[0] !== 'human' || this.autoEvade;
    // ships at anchor or stopped cannot simply ring up full speed
    const raid = u.airAlertUntil > this.time && selfDefence && u.alert && !u.disabled && u.speedSet > 0;
    if (raid) targetV = vmax;
    if (u.evadeUntil > this.time) {
      desired = u.evadeH;
      targetV = vmax;
    } else if (u.follow) {
      const L = this.unit(u.follow.id);
      if (!this.alive(L)) {
        u.follow = null;
      } else {
        const ch = Math.cos(L.h);
        const sh = Math.sin(L.h);
        let sx = L.x + u.follow.dx * ch - u.follow.dy * sh;
        let sy = L.y + u.follow.dx * sh + u.follow.dy * ch;
        // where the station is over land, follow in the leader's wake instead
        if (this.terrain.hasLand && this.terrain.sample(sx, sy) > -this.clearance(u)) {
          const p = trailPoint(L, Math.hypot(u.follow.dx, u.follow.dy));
          sx = p.x;
          sy = p.y;
        }
        const d = dist(u.x, u.y, sx, sy);
        const along = (sx - u.x) * ch + (sy - u.y) * sh;
        if (d > 700) {
          desired = headingTo(u.x, u.y, sx, sy);
          targetV = vmax;
        } else {
          const toward = headingTo(u.x, u.y, sx, sy);
          const blend = d / 700;
          desired = wrap(L.h + angleDiff(L.h, toward) * blend);
          targetV = clamp(L.v + along * 0.02, 0, vmax);
        }
      }
    } else if (u.path.length) {
      const wp = u.path[0];
      const d = dist(u.x, u.y, wp.x, wp.y);
      const arrive = Math.max(120, u.v * 12);
      if (d < arrive) {
        u.path.shift();
        if (!u.path.length) u.orderH = u.h;
      }
      if (u.path.length) desired = headingTo(u.x, u.y, u.path[0].x, u.path[0].y);
    } else if (u.orderH !== null) {
      desired = u.orderH;
    }

    if (raid && u.evadeUntil <= this.time) {
      // weave under air attack
      targetV = vmax;
      desired = wrap(desired + Math.sin((this.time + u.id * 37) / 22) * 0.45);
    } else if (u.underFire > this.time && selfDefence && u.alert && !u.disabled && u.speedSet > 0 && u.evadeUntil <= this.time && !u.cls.merchant) {
      // chase the salvoes: small, irregular alterations spoil the enemy's solution
      desired = wrap(desired + Math.sin((this.time + u.id * 53) / 18) * 0.35);
    }

    // look ahead for land and the map edge
    if (vmax > 0.5 && (this.terrain.hasLand || true)) {
      desired = this.avoid(u, desired);
    }

    let turn = c.turn * DEG * clamp(u.v / (c.speed * KN * 0.5), 0.3, 1);
    if (u.crits.rudder > 0) turn *= 0.4;
    if (c.sub && u.depth !== 'surface') turn *= 0.85;
    if (u.rudderJam) {
      turn *= 0.25;
      desired = u.h + 0.6; // circling to port in this frame
    }
    const dh = angleDiff(u.h, desired);
    u.h = wrap(u.h + clamp(dh, -turn * dt, turn * dt));
    if (Math.abs(dh) > 0.6) targetV *= 0.92;

    const acc = c.accel * KN;
    const dv = targetV - u.v;
    u.v += clamp(dv, -acc * dt * 1.6, acc * dt);
    if (u.v < 0) u.v = 0;

    const nx = u.x + Math.cos(u.h) * u.v * dt;
    const ny = u.y + Math.sin(u.h) * u.v * dt;
    if (this.terrain.hasLand && this.terrain.sample(nx, ny) > -8) {
      // run aground: stop and nudge back toward water
      if (!u.grounded) {
        u.grounded = true;
        // one scrape does the damage; bumping along the same shoal does not
        if (this.time - u.groundT > 90) {
          if (u.side === 0) this.msg(`${u.name} has run aground!`, 'bad', u);
          applyDamage(this, u, u.maxHp * 0.03, { kind: 'ground', side: u.side === 0 ? 1 : 0, from: -1 });
        }
        u.groundT = this.time;
      }
      u.v = 0;
      const wpt = this.terrain.nearestWater(u.x, u.y, 60);
      u.x += (wpt.x - u.x) * 0.05;
      u.y += (wpt.y - u.y) * 0.05;
      u.h = wrap(u.h + 0.02);
      u.stuck += dt;
    } else {
      u.x = nx;
      u.y = ny;
      u.grounded = false;
    }
    // breadcrumb trail every 150 m
    const tl = u.trail.length;
    if (!tl || dist2(u.x, u.y, u.trail[tl - 2], u.trail[tl - 1]) > 150 * 150) {
      u.trail.push(u.x, u.y);
      if (u.trail.length > 2 * 48) u.trail.splice(0, 2);
    }
    // map bounds (exits handled by zones)
    const W = this.terrain.w;
    const H = this.terrain.h;
    u.x = clamp(u.x, 20, W - 20);
    u.y = clamp(u.y, 20, H - 20);

    // separation from nearby ships of the same side
    // (cheap and only for moving ships)
    if (u.v > 0.5) {
      for (const o of this.units) {
        if (o === u || o.sunk || o.escaped || o.side !== u.side || isStructureType(o.cls.type)) continue;
        const dx = u.x - o.x;
        const dy = u.y - o.y;
        const minD = (u.cls.length + o.cls.length) * 0.35 + 30;
        if (Math.abs(dx) > minD || Math.abs(dy) > minD) continue;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < minD && !(c.sub && u.depth !== 'surface') && !(o.cls.sub && o.depth !== 'surface')) {
          const push = ((minD - d) / minD) * 6 * dt;
          u.x += (dx / d) * push;
          u.y += (dy / d) * push;
        }
      }
    }

    // wake trail
    u.wakeTick -= dt;
    if (u.wakeTick <= 0) {
      u.wakeTick = 3;
      if (u.v > 1 && !(c.sub && u.depth === 'deep')) {
        u.wake.push(u.x, u.y, this.time);
        if (u.wake.length > 3 * 14) u.wake.splice(0, 3);
      } else if (u.wake.length) {
        u.wake.splice(0, 3);
      }
    }

    // exits
    for (const z of this.zones) {
      if (z.kind !== 'exit') continue;
      if (!this.inZone(u, z)) continue;
      if (this.mayExit(u, z)) {
        u.escaped = true;
        u.v = 0;
        if (u.side === 0) this.msg(`${u.name} has reached ${z.name}.`, 'good', u);
        else this.msg(`Enemy ${this.enemyLabel(u)} has escaped to ${z.name}.`, 'warn', u);
        for (const sqId of u.hangar) {
          const s = this.sq(sqId);
          if (s && s.state === 'deck') s.state = 'gone';
        }
        break;
      }
    }
  }

  /** Can this unit leave the battle through the exit zone? */
  mayExit(u: Unit, z: Zone): boolean {
    const g = this.groups.get(u.group);
    if (g) {
      const b = g.behavior;
      if ((b.kind === 'route' || b.kind === 'flee' || b.kind === 'raider' || b.kind === 'bombard') && (b as { exit?: string }).exit === z.id) return true;
      if (g.mode === 'retreat' && g.data.retreatZone === this.zones.indexOf(z)) return true;
    }
    if (u.side === 0 && u.controllable) {
      // player units leave through exits that an objective points at
      return this.objectives.some((o) => (o.def.kind === 'reach') && o.def.zone === z.id && (!o.def.tag || u.tags.includes(o.def.tag)));
    }
    if (u.side === 0 && !u.controllable && g) {
      const b = g.behavior;
      return b.kind === 'route' && b.exit === z.id;
    }
    return false;
  }

  enemyLabel(u: Unit): string {
    const c = this.contacts[0].get(u.id);
    return c && c.level >= 3 ? u.name : 'ship';
  }

  private avoid(u: Unit, desired: number): number {
    const look = Math.max(500, u.v * 70);
    const W = this.terrain.w;
    const H = this.terrain.h;
    const clear = (h: number) => {
      const steps = 4;
      for (let i = 1; i <= steps; i++) {
        const d = (look * i) / steps;
        const px = u.x + Math.cos(h) * d;
        const py = u.y + Math.sin(h) * d;
        if (px < 300 || py < 300 || px > W - 300 || py > H - 300) {
          // edges are only a problem if no exit zone covers the point
          if (!this.zones.some((z) => z.kind === 'exit' && dist2(px, py, z.x, z.y) < z.r * z.r * 1.5)) return false;
        }
        if (this.terrain.hasLand && this.terrain.sample(px, py) > -this.clearance(u) * 0.6) return false;
      }
      return true;
    };
    if (clear(desired)) return desired;
    // following a path that is known to be clear: trust the path near waypoints
    for (const off of [0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5, 2.1, -2.1, Math.PI]) {
      const h = wrap(desired + off);
      if (clear(h)) return h;
    }
    return wrap(u.h + 0.8);
  }

  private updateSmoke(u: Unit, dt: number) {
    if (u.smokeOn <= 0) return;
    u.smokeOn -= dt;
    u.smokeTick -= dt;
    if (u.smokeTick <= 0 && u.v > 2) {
      u.smokeTick = 7;
      const p = this.sternPos(u);
      this.smokes.push({
        id: this.newId(), x: p.x, y: p.y, r: 150, r0: 150, r1: 520, t0: this.time, life: 540,
        vx: 0, vy: 0, squall: false,
      });
    }
  }

  private updateMines(u: Unit, dt: number) {
    for (const z of this.zones) {
      if (z.kind !== 'mine' || !z.density) continue;
      if (!this.inZone(u, z)) continue;
      if (u.cls.sub && u.depth === 'deep') continue;
      const p = ((u.v * dt) / 1000) * z.density * (u.cls.type === 'PT' ? 0.3 : 1);
      if (this.rng.chance(p)) {
        this.events.push({ k: 'boom', x: u.x, y: u.y, size: 2 });
        this.msg(`${u.name} has struck a mine!`, u.side === 0 ? 'bad' : 'good', u);
        applyDamage(this, u, 450 + this.rng.range(0, 300), { kind: 'mine', side: u.side === 0 ? 1 : 0, from: -1 });
      }
    }
  }

  // ------------------------------------------------------------------ orders (player commands)
  orderMove(ids: number[], x: number, y: number, append = false) {
    const us = ids.map((i) => this.unit(i)).filter((u): u is Unit => this.alive(u) && !isStructureType(u.cls.type));
    if (!us.length) return;
    let cx = 0;
    let cy = 0;
    for (const u of us) {
      cx += u.x;
      cy += u.y;
    }
    cx /= us.length;
    cy /= us.length;
    let cap = Infinity;
    if (us.length > 1) for (const u of us) cap = Math.min(cap, u.cls.speed * KN * (u.cls.sub && u.depth !== 'surface' ? u.cls.sub.sspeed / u.cls.speed : 1));
    for (const u of us) {
      let ox = 0;
      let oy = 0;
      if (us.length > 1) {
        ox = clamp(u.x - cx, -4000, 4000);
        oy = clamp(u.y - cy, -4000, 4000);
      }
      u.follow = null;
      u.engage = null;
      u.evadeUntil = 0;
      u.speedCap = us.length > 1 ? cap * 0.98 : Infinity;
      if (u.speedSet === 0) u.speedSet = 3;
      u.lastOrder = this.time;
      this.pathTo(u, clamp(x + ox, 200, this.terrain.w - 200), clamp(y + oy, 200, this.terrain.h - 200), append);
    }
  }

  orderSpeed(ids: number[], s: number) {
    for (const id of ids) {
      const u = this.unit(id);
      if (this.alive(u)) {
        u.speedSet = clamp(s, 0, 4);
        u.lastOrder = this.time;
      }
    }
  }

  orderHeading(ids: number[], delta: number) {
    for (const id of ids) {
      const u = this.unit(id);
      if (!this.alive(u) || isStructureType(u.cls.type)) continue;
      const base = u.orderH ?? u.h;
      u.path = [];
      u.follow = null;
      u.engage = null;
      u.orderH = wrap(base + delta);
      if (u.speedSet === 0) u.speedSet = 2;
      u.lastOrder = this.time;
    }
  }

  orderTarget(ids: number[], tid: number | null, engage = true) {
    const t = this.unit(tid);
    for (const id of ids) {
      const u = this.unit(id);
      if (!this.alive(u)) continue;
      u.target = tid;
      u.holdFire = false;
      if (engage && t && !isCarrierType(u.cls.type) && !u.cls.sub && !isMerchantType(u.cls.type) && !isStructureType(u.cls.type)) {
        u.engage = tid;
        u.path = [];
        u.follow = null;
        if (u.speedSet < 3) u.speedSet = 3;
      }
      u.lastOrder = this.time;
    }
  }

  orderFollow(ids: number[], leaderId: number) {
    const L = this.unit(leaderId);
    if (!this.alive(L)) return;
    let k = 0;
    for (const id of ids) {
      const u = this.unit(id);
      if (!this.alive(u) || u === L || isStructureType(u.cls.type)) continue;
      // keep the current relative position, clamped to a sensible screen distance
      const dx = u.x - L.x;
      const dy = u.y - L.y;
      const ch = Math.cos(-L.h);
      const sh = Math.sin(-L.h);
      let lx = dx * ch - dy * sh;
      let ly = dx * sh + dy * ch;
      const d = Math.hypot(lx, ly);
      if (d > 3000 || d < 300) {
        const a = Math.PI * (0.25 + 0.5 * (k % 2)) * (k % 4 < 2 ? 1 : -1) + Math.PI * 0.5;
        lx = Math.cos(a) * 1500;
        ly = Math.sin(a) * 1500;
      }
      u.follow = { id: leaderId, dx: lx, dy: ly };
      u.path = [];
      u.engage = null;
      u.speedCap = Infinity;
      if (u.speedSet === 0) u.speedSet = 3;
      u.lastOrder = this.time;
      k++;
    }
  }

  orderHoldFire(ids: number[], hold: boolean) {
    for (const id of ids) {
      const u = this.unit(id);
      if (this.alive(u)) u.holdFire = hold;
    }
  }

  orderDepth(ids: number[], d: 'surface' | 'periscope' | 'deep') {
    for (const id of ids) {
      const u = this.unit(id);
      if (this.alive(u) && u.cls.sub) this.setDepth(u, d);
    }
  }

  orderSmoke(ids: number[]) {
    for (const id of ids) {
      const u = this.unit(id);
      if (!this.alive(u) || !u.cls.smoke) continue;
      if (u.smokeOn > 0) {
        u.smokeOn = 0;
        continue;
      }
      if (u.smokeLeft <= 0) continue;
      u.smokeLeft--;
      u.smokeOn = 240;
      u.smokeTick = 0;
      if (u.side === 0) this.msg(`${u.name} is making smoke.`, 'info', u);
    }
  }

  // ------------------------------------------------------------------ results
  finish(outcome: NonNullable<BattleResult>['outcome'], reason: string) {
    if (this.result) return;
    this.result = { outcome, reason };
    this.msg(reason, outcome === 'defeat' ? 'bad' : 'good');
  }

  sideUnits(side: Side): Unit[] {
    return this.units.filter((u) => u.side === side);
  }

  /** Distance from a point to the nearest map edge. */
  edgeDist(x: number, y: number): number {
    return Math.min(x, y, this.terrain.w - x, this.terrain.h - y);
  }

  smokeBlocks(x0: number, y0: number, x1: number, y1: number): boolean {
    for (const s of this.smokes) {
      const r = s.r * (s.squall ? 0.85 : 0.75);
      // quick reject
      const minx = Math.min(x0, x1) - r;
      const maxx = Math.max(x0, x1) + r;
      const miny = Math.min(y0, y1) - r;
      const maxy = Math.max(y0, y1) + r;
      if (s.x < minx || s.x > maxx || s.y < miny || s.y > maxy) continue;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((s.x - x0) * dx + (s.y - y0) * dy) / len2 : 0;
      t = clamp(t, 0, 1);
      const px = x0 + dx * t - s.x;
      const py = y0 + dy * t - s.y;
      if (px * px + py * py < r * r) return true;
    }
    return false;
  }

  inSquall(x: number, y: number): boolean {
    for (const s of this.smokes) if (s.squall && dist2(x, y, s.x, s.y) < s.r * s.r) return true;
    return false;
  }

  gunsOf(u: Unit) {
    return u.mounts;
  }

  torpDef(u: Unit) {
    return u.cls.torps ? TORPS[u.cls.torps.t] : undefined;
  }

  mainGunRange(u: Unit): number {
    let r = 0;
    for (const m of u.mounts) if (!m.def.sec && !m.dead) r = Math.max(r, m.gun.range);
    if (!r) for (const m of u.mounts) if (!m.dead) r = Math.max(r, m.gun.range);
    return r;
  }

  nationName(n: NationId) {
    return NATIONS[n].name;
  }
}

function newStats(): SideStats {
  return { sunk: [], lost: [], tonsSunk: 0, planesKilled: 0, planesLost: 0, shots: 0, hits: 0, torpsFired: 0, torpHits: 0 };
}

// re-export so callers have a single import
export { GUNS, TORPS, TAU };
