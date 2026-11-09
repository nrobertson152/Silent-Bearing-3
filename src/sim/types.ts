// Runtime battle state.

import type { Vec } from '../core/math';
import type {
  AircraftDef, Behavior, GunDef, MountDef, NationId, ObjDef, ShipClass, ShipType, TorpDef, ZoneDef,
} from '../data/types';

export type Side = 0 | 1;
export type Depth = 'surface' | 'periscope' | 'deep';

export interface MountState {
  def: MountDef;
  gun: GunDef;
  reload: number;
  dead: boolean;
  aim: number; // turret angle relative to the bow, radians
}

export interface Crits {
  engine: number; // seconds of repair left
  rudder: number;
  fc: number;
  radar: number;
  deck: number;
}

export interface FireControl {
  tid: number;
  q: number; // solution quality 0..1
  th: number; // target heading when solution last checked
  tv: number; // target speed when solution last checked
  myH: number;
}

export interface Unit {
  id: number;
  side: Side;
  cls: ShipClass;
  nation: NationId;
  name: string;
  tags: string[];
  group: string;
  x: number;
  y: number;
  h: number;
  v: number;
  speedSet: number; // 0 stop .. 4 flank
  speedCap: number; // m/s formation cap, Infinity for none
  orderH: number | null;
  path: Vec[];
  follow: { id: number; dx: number; dy: number } | null;
  engage: number | null; // unit id to manoeuvre against
  hp: number;
  maxHp: number;
  fires: number;
  flood: number;
  crits: Crits;
  /** Sensors actually fitted for this date (0 = none). */
  radar: number;
  airRadar: number;
  fcRadar: boolean;
  rudderJam: boolean;
  disabled: boolean; // dead in the water
  mounts: MountState[];
  torpLoaded: number;
  torpReloads: number;
  torpTimer: number;
  dcLeft: number;
  dcCool: number;
  depth: Depth;
  depthOrder: Depth;
  depthTimer: number;
  battery: number;
  smokeLeft: number;
  smokeOn: number;
  smokeTick: number;
  target: number | null; // designated gun target
  autoTarget: number | null;
  fc: FireControl;
  holdFire: boolean;
  alert: boolean;
  alertAt: number | null;
  illuminated: boolean;
  controllable: boolean;
  sunk: boolean;
  sinkT: number;
  escaped: boolean;
  lastFire: number;
  lastHitBy: number | null;
  xp: number;
  vet: number;
  crew: number;
  dmgDealt: number;
  kills: string[];
  coreUid?: string;
  special: string[];
  hangar: number[];
  deckTimer: number;
  autoCap: boolean;
  evadeUntil: number;
  evadeH: number;
  /** Enemy bombers close by: ring up full speed and weave. */
  airAlertUntil: number;
  /** Being shot at: chase the salvoes (until this time). */
  underFire: number;
  lastOrder: number;
  sonarBlind: number;
  wake: number[];
  /** Recent track (x, y pairs, newest last) so ships in line can follow it. */
  trail: number[];
  wakeTick: number;
  formation: Vec | null; // offset from group leader, leader frame
  stuck: number;
  grounded: boolean;
  /** At anchor with boilers cold: cannot move until this time (Infinity until alerted). */
  steamAt: number;
  /** Last time the hull was damaged by grounding. */
  groundT: number;
  /** Last time the AI planned a path round land. */
  pathAt: number;
}

export type SqState = 'deck' | 'queued' | 'outbound' | 'attack' | 'return' | 'cap' | 'intercept' | 'escort' | 'scout' | 'gone';

export interface Squadron {
  id: number;
  side: Side;
  def: AircraftDef;
  n: number;
  max: number;
  home: number | null;
  state: SqState;
  next: SqState; // state to enter after launching
  x: number;
  y: number;
  h: number;
  ready: number;
  /** Strike target: a ship and the last fix on it (course and speed for dead reckoning). */
  target: { unit: number | null; x: number; y: number; h?: number; v?: number; t?: number } | null;
  capOver: number | null;
  escortOf: number | null;
  engaged: number | null;
  fuel: number;
  attackT: number;
  searchT: number;
  disrupted: number;
  orbit: number;
  offmap: Vec | null;
  ordnance: boolean;
  /** Fighter ammunition, 1 = full. Out of ammunition means breaking off. */
  ammo: number;
  name: string;
  capUntil: number;
  launchedAt: number;
}

export interface Shell {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  t1: number;
  cal: number;
  dmg: number;
  pen: number;
  fire: number;
  side: Side;
  from: number;
  range: number;
  maxRange: number;
}

export interface Torpedo {
  id: number;
  x: number;
  y: number;
  h: number;
  speed: number;
  left: number;
  run: number;
  dmg: number;
  side: Side;
  from: number;
  wake: boolean;
  dud: boolean;
  air: boolean;
  def: TorpDef;
  /** The ship it was aimed at, if any. */
  aimAt?: number;
}

export interface DepthCharge {
  x: number;
  y: number;
  t: number;
  side: Side;
  from: number;
  power: number;
  radius: number;
  hedgehog: boolean;
}

export interface Smoke {
  id: number;
  x: number;
  y: number;
  r: number;
  r0: number;
  r1: number;
  t0: number;
  life: number;
  vx: number;
  vy: number;
  squall: boolean;
}

export interface Contact {
  id: number;
  level: number; // 1 bearing only, 2 detected, 3 identified
  fix: boolean; // position estimated by cross bearings
  x: number;
  y: number;
  h: number;
  v: number;
  t: number; // last update
  seen: number; // last time position was actually known
  type: ShipType | null;
  sonar: boolean;
}

export interface Bearing {
  from: number;
  ox: number;
  oy: number;
  ang: number;
  t: number;
  tid: number;
  kind: 'sonar' | 'hfdf' | 'flash';
}

export interface Zone extends ZoneDef {}

export type ObjStatus = 'active' | 'done' | 'failed';

export interface ObjState {
  def: ObjDef;
  status: ObjStatus;
  progress: number;
  needed: number;
}

export type MsgKind = 'info' | 'good' | 'bad' | 'warn' | 'radio';

export interface LogMsg {
  t: number;
  text: string;
  kind: MsgKind;
  x?: number;
  y?: number;
}

export type SimEvent =
  | { k: 'fire'; x: number; y: number; cal: number; side: Side; unit: number; ang: number }
  | { k: 'splash'; x: number; y: number; cal: number }
  | { k: 'hit'; x: number; y: number; cal: number; unit: number }
  | { k: 'boom'; x: number; y: number; size: number }
  | { k: 'sunk'; unit: number; x: number; y: number }
  | { k: 'torpLaunch'; x: number; y: number; side: Side }
  | { k: 'ping'; x: number; y: number; side: Side }
  | { k: 'dc'; x: number; y: number }
  | { k: 'planeDown'; x: number; y: number; side: Side }
  | { k: 'bomb'; x: number; y: number; hit: boolean }
  | { k: 'flak'; x: number; y: number }
  | { k: 'msg'; text: string; kind: MsgKind };

export interface GroupAI {
  id: string;
  side: Side;
  behavior: Behavior;
  members: number[];
  wp: number;
  mode: 'cruise' | 'engage' | 'retreat' | 'evade' | 'hold';
  nextThink: number;
  leader: number;
  lastStrike: number;
  lastScout: number;
  data: Record<string, number>;
}

export interface SideStats {
  sunk: number[]; // enemy units sunk by this side
  lost: number[]; // own units lost
  tonsSunk: number;
  planesKilled: number;
  planesLost: number;
  shots: number;
  hits: number;
  torpsFired: number;
  torpHits: number;
}

export type BattleResult = null | {
  outcome: 'decisive' | 'victory' | 'marginal' | 'defeat';
  reason: string;
};

export interface DeployedCore {
  uid: string;
  cls: string;
  name: string;
  hp: number; // fraction
  xp: number;
}
