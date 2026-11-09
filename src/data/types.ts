// Static game data types: nations, weapons, aircraft, ship classes and missions.

export type NationId = 'us' | 'uk' | 'de' | 'jp' | 'it' | 'nl';
export type PlayableNation = 'us' | 'uk' | 'de' | 'jp';

export type ShipType =
  | 'BB' // battleship
  | 'BC' // battlecruiser
  | 'CV' // fleet carrier
  | 'CVL' // light carrier
  | 'CVE' // escort carrier
  | 'CA' // heavy cruiser
  | 'CL' // light cruiser
  | 'DD' // destroyer
  | 'DE' // escort (destroyer escort, sloop, frigate, corvette, kaibokan)
  | 'TB' // torpedo boat
  | 'PT' // motor torpedo boat / E-boat / MAS
  | 'SS' // submarine
  | 'AK' // merchant / cargo
  | 'AO' // tanker
  | 'AP' // troop transport
  | 'BASE' // airfield / naval base
  | 'BTY'; // coastal battery

export interface GunDef {
  id: string;
  name: string;
  cal: number; // mm
  range: number; // m (gameplay maximum)
  reload: number; // seconds between salvos
  dmg: number; // hit points per shell
  pen: number; // mm armour penetration
  vel: number; // average shell speed m/s
  disp: number; // dispersion as a fraction of range
  fire: number; // chance per hit to start a fire
  dp?: boolean; // dual purpose (adds to anti-aircraft fire)
}

export interface TorpDef {
  id: string;
  name: string;
  speed: number; // knots
  range: number; // m
  dmg: number;
  wake: boolean;
  /** dud chance by year */
  dud?: [number, number][];
  air?: boolean; // aerial torpedo
}

export type AirRole = 'fighter' | 'dive' | 'torpedo' | 'level' | 'scout' | 'patrol' | 'kamikaze';

export interface AircraftDef {
  id: string;
  nation: NationId;
  name: string;
  role: AirRole;
  speed: number; // cruise km/h
  radius: number; // strike radius km
  air: number; // air-to-air rating
  tough: number; // durability against AA (1 = average)
  dmg?: number; // bomb damage
  pen?: number; // bomb penetration
  acc?: number; // bomb accuracy per plane
  torp?: string; // torpedo id
  night?: boolean; // can operate at night
  asv?: boolean; // radar for finding surfaced submarines
  dc?: boolean; // carries depth charges / ASW bombs
  ammo?: number; // fighters: seconds of firing before breaking off (default 150)
  year: number;
}

export interface MountDef {
  g: string; // gun id
  n: number; // barrels
  p: number; // position along hull, -0.5 stern .. 0.5 bow
  s?: number; // side: 0 centreline, -1 port, 1 starboard
  sec?: boolean; // secondary battery
}

export interface Silhouette {
  /** superstructure blocks: [position, length, width] as fractions of length / beam */
  sup: [number, number, number][];
  /** funnel positions (fraction of length) */
  fun?: number[];
  /** mast positions */
  mast?: number[];
  /** aircraft carrier flight deck */
  cv?: boolean;
  /** island position for carriers */
  island?: number;
  /** merchant ship: hatches */
  hatches?: number[];
  /** submarine */
  sub?: boolean;
  /** funnel size multiplier */
  funW?: number;
}

export interface ShipClass {
  id: string;
  nation: NationId;
  type: ShipType;
  name: string; // class name, e.g. 'Fletcher'
  year: number; // in service (decimal year)
  length: number; // m
  beam: number; // m
  tons: number; // displacement (warships) or gross register tons (merchants)
  speed: number; // knots
  hp: number;
  belt: number; // mm
  deck: number; // mm
  turn: number; // degrees per second at speed
  accel: number; // knots per second
  guns: MountDef[];
  aa: number;
  torps?: { t: string; tubes: number; reloads: number; reloadTime: number };
  dc?: number; // depth charge patterns carried
  hedgehog?: boolean;
  sonar?: number; // active sonar range m
  hydro?: number; // passive hydrophone range m
  radar?: number; // surface search radar range m
  airRadar?: number; // air search radar range m
  fcRadar?: boolean; // radar fire control
  radarYear?: number; // radar sets were fitted from this date (decimal year)
  hfdf?: boolean; // high-frequency direction finding
  air?: { a: string; n: number }[];
  scouts?: { a: string; n: number };
  sub?: { sspeed: number; dive: number; battery: number };
  smoke?: boolean;
  magVuln?: number; // magazine vulnerability multiplier
  armoredDeck?: boolean;
  cost: number; // prestige to buy, 0 = not purchasable
  sil: Silhouette;
  notes: string;
  merchant?: boolean;
  noise?: number; // hydrophone noise multiplier
  role?: string; // short role description
}

export interface NationDef {
  id: NationId;
  name: string; // 'United Kingdom'
  navy: string; // 'Royal Navy'
  adj: string; // 'British'
  prefix: string; // 'HMS '
  merchantPrefix: string;
  color: string; // accent colour
  hull: string;
  deck: string;
  sup: string;
  playable: boolean;
  /** pilot quality by year */
  pilots: [number, number][];
  nightBonus?: number; // visual range multiplier at night
  crew: number; // crew training multiplier for gunnery
  /** anti-submarine skill by year (sonar handling, depth-charge tactics) */
  asw: [number, number][];
}

// ---------------------------------------------------------------------------
// Missions. Map coordinates and ranges in mission files are in KILOMETRES; the
// loader converts them to metres.

export type LandFeature =
  | { k: 'island'; x: number; y: number; r: number; rough?: number; elong?: number; rot?: number; seed?: number }
  | { k: 'coast'; side: 'n' | 's' | 'e' | 'w'; depth: number; rough?: number; from?: number; to?: number; seed?: number }
  | { k: 'poly'; pts: [number, number][]; rough?: number; seed?: number }
  | { k: 'water'; x: number; y: number; r: number; rough?: number; elong?: number; rot?: number }
  | { k: 'channel'; pts: [number, number][]; w: number; rough?: number };

export type Biome = 'temperate' | 'tropical' | 'arctic' | 'desert' | 'ice';
export type TimeOfDay = 'day' | 'dawn' | 'dusk' | 'night';
export type Weather = 'clear' | 'overcast' | 'rain' | 'fog' | 'snow' | 'storm';

export interface EnvDef {
  tod: TimeOfDay;
  wx: Weather;
  sea?: number; // 0 calm .. 3 heavy
  aurora?: boolean;
  shallow?: boolean; // submarines cannot go deep
  squalls?: number; // number of rain squalls
  biome?: Biome;
  wind?: number; // degrees the wind blows towards
}

export type ZoneKind = 'exit' | 'objective' | 'mine' | 'drop' | 'bombard' | 'area';

export interface ZoneDef {
  id: string;
  name: string;
  kind: ZoneKind;
  x: number;
  y: number;
  r: number;
  density?: number; // mines per km travelled
  hidden?: boolean;
}

export type Behavior =
  | { kind: 'route'; pts: [number, number][]; exit?: string; speed?: number; loop?: boolean; engage?: boolean; zigzag?: boolean }
  | { kind: 'patrol'; pts: [number, number][]; engage?: number; speed?: number }
  | { kind: 'hunt'; radius?: number; prefer?: string[]; speed?: number; pts?: [number, number][] } // pts: where to search while nothing is known
  | { kind: 'escort'; of: string; radius?: number }
  | { kind: 'hold'; onAlert?: Behavior }
  | { kind: 'carrier'; pts?: [number, number][]; keepAway?: number }
  | { kind: 'sub'; area?: [number, number, number]; prefer?: string[]; pts?: [number, number][]; exit?: string } // pts: search route; exit: leave once the job is done
  | { kind: 'raider'; prefer?: string[]; exit?: string; retreatHp?: number; quota?: number } // quota: head for the exit after sinking this many preferred targets
  | { kind: 'shadow'; of: string; range?: number }
  | { kind: 'flee'; exit: string }
  | { kind: 'bombard'; zone: string; exit?: string }
  | { kind: 'airfield' }
  | { kind: 'player' };

export interface UnitDef {
  c: string; // class id
  n?: string; // name
  t?: string[]; // tags
  hp?: number; // starting hull fraction
  x?: number;
  y?: number;
  h?: number; // compass heading
  special?: string[];
  speed?: number; // initial speed knots
}

export interface GroupDef {
  id: string;
  units: UnitDef[];
  x: number;
  y: number;
  h: number; // compass heading
  formation?: 'column' | 'line' | 'box' | 'screen' | 'convoy' | 'anchored' | 'scatter' | 'echelon';
  spacing?: number; // km
  speed?: number; // knots
  behavior?: Behavior;
  tags?: string[];
  alert?: boolean;
  alertDelay?: number; // s
  illuminated?: boolean;
  controllable?: boolean;
  air?: { a: string; n: number; ready?: number; name?: string }[]; // extra squadrons for the group's first unit; ready time in minutes
  airReady?: number; // minutes until carrier air groups can launch
  crew?: number; // crew quality multiplier
}

export interface AirRaidDef {
  from: 'n' | 's' | 'e' | 'w' | [number, number];
  target?: string; // tag to attack ('' = anything)
  sq: { a: string; n: number }[];
  cap?: string; // tag to fly CAP over instead of attacking
  minutes?: number; // CAP duration
}

export type Cond =
  | { time: number } // minutes
  | { lost: string; count: number; side?: 0 | 1 }
  | { enter: string; tag?: string; side?: 0 | 1 }
  | { detected: string } // player side has detected an enemy unit with tag
  | { spotted: string } // enemy side has detected a player unit with tag (or 'any')
  | { obj: string; state: 'done' | 'failed' }
  | { hp: string; below: number; side?: 0 | 1 }
  | { flag: string }
  | { torpHit: string } // a unit with this tag was hit by an aerial torpedo
  | { all: Cond[] }
  | { any: Cond[] };

export type Action =
  | { msg: string; from?: string }
  | { spawn: GroupDef; side: 0 | 1 }
  | { air: AirRaidDef; side: 0 | 1 }
  | { behavior: string; set: Behavior }
  | { reveal: string; side?: 0 | 1 }
  | { flag: string }
  | { alert: string }
  | { end: 'victory' | 'defeat' }
  | { special: string; tag: string };

export interface TriggerDef {
  id?: string;
  when: Cond;
  do: Action[];
  repeat?: number; // re-arm after this many minutes
  delay?: number; // minutes between condition and actions
}

export type ObjKind =
  | 'destroy'
  | 'protect'
  | 'reach'
  | 'prevent'
  | 'survive'
  | 'tonnage'
  | 'damage'
  | 'shootdown'
  | 'airLosses'
  | 'hpAbove'
  | 'undetected';

export interface ObjDef {
  id: string;
  text: string;
  kind: ObjKind;
  tag?: string;
  count?: number;
  zone?: string;
  time?: number; // minutes
  frac?: number;
  tons?: number;
  bonus?: boolean;
  maxLoss?: number;
  until?: string; // flag ending an 'undetected' objective
}

export interface MissionDef {
  id: string;
  title: string;
  date: string;
  place: string;
  geo: [number, number]; // lon, lat
  news: string[];
  brief: string;
  history: string;
  hints?: string[];
  env: EnvDef;
  map: { w: number; h: number; seed: number; land: LandFeature[]; baseLand?: boolean };
  zones?: ZoneDef[];
  player: {
    groups: GroupDef[];
    slots: number;
    allowed?: ShipType[];
    spawn: { x: number; y: number; h: number; formation?: GroupDef['formation']; spacing?: number };
    /** behaviour used when the computer plays the player's side (tests and attract mode) */
    auto?: Behavior;
    /** ship lent to the player when no ship in the fleet can take a required slot */
    loaner?: UnitDef;
  };
  allies?: GroupDef[];
  enemy: GroupDef[];
  objectives: ObjDef[];
  triggers?: TriggerDef[];
  timeLimit?: number; // minutes
  reward?: number;
  enemyNation: NationId;
  quick?: boolean; // generated quick battle
}

export interface CampaignDef {
  nation: PlayableNation;
  title: string;
  subtitle: string;
  years: string;
  theater: 'atlantic' | 'northsea' | 'pacific';
  intro: string;
  epilogue: string;
  startFleet: { c: string; n: string }[];
  startPrestige: number;
  missions: MissionDef[];
}
