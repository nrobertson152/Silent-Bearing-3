// Coastlines as a signed distance field: positive is land, negative is water, and the
// value is roughly the distance to the shore in metres. Features are combined in order:
// land features take the maximum, water features (channels, bays) take the minimum.

import { Noise2D } from '../core/noise';
import { clamp, dist, distToSeg, type Vec } from '../core/math';
import type { LandFeature } from '../data/types';

export interface TerrainDef {
  w: number; // km
  h: number; // km
  seed: number;
  land: LandFeature[];
  baseLand?: boolean;
}

type Feature = LandFeature & { idx: number };

export class Terrain {
  readonly w: number;
  readonly h: number;
  readonly hasLand: boolean;
  readonly cell: number;
  readonly gw: number;
  readonly gh: number;
  readonly grid: Float32Array;
  private readonly feats: Feature[];
  private readonly base: boolean;
  private readonly noise: Noise2D;
  readonly detail: Noise2D;
  // A* scratch
  private gScore: Float32Array;
  private came: Int32Array;
  private stamp: Uint32Array;
  private closedStamp: Uint32Array;
  private gen = 1;

  constructor(def: TerrainDef) {
    this.w = def.w * 1000;
    this.h = def.h * 1000;
    this.base = !!def.baseLand;
    this.noise = new Noise2D(def.seed * 7919 + 13);
    this.detail = new Noise2D(def.seed * 104729 + 7);
    this.feats = def.land.map((f, idx) => scaleFeature(f, idx));
    this.hasLand = this.base || this.feats.some((f) => f.k !== 'water' && f.k !== 'channel');
    this.cell = Math.max(60, Math.max(this.w, this.h) / 240);
    this.gw = Math.ceil(this.w / this.cell) + 1;
    this.gh = Math.ceil(this.h / this.cell) + 1;
    this.grid = new Float32Array(this.gw * this.gh);
    for (let j = 0; j < this.gh; j++) {
      for (let i = 0; i < this.gw; i++) {
        this.grid[j * this.gw + i] = this.hasLand ? this.field(i * this.cell, j * this.cell) : -1e5;
      }
    }
    const n = this.gw * this.gh;
    this.gScore = new Float32Array(n);
    this.came = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closedStamp = new Uint32Array(n);
  }

  /** Exact field value (slow; used to build the grid and the terrain image). */
  field(x: number, y: number): number {
    let f = this.base ? 1e5 : -1e5;
    const N = this.noise;
    for (const ft of this.feats) {
      switch (ft.k) {
        case 'island': {
          const rough = ft.rough ?? 0.35;
          const elong = ft.elong ?? 1;
          const rot = ft.rot ?? 0;
          const c = Math.cos(rot);
          const s = Math.sin(rot);
          const dx = x - ft.x;
          const dy = y - ft.y;
          const lx = (dx * c + dy * s) / elong;
          const ly = -dx * s + dy * c;
          const d = Math.sqrt(lx * lx + ly * ly);
          if (d > ft.r * (2 + rough * 2)) break;
          const sc = 1 / Math.max(300, ft.r * 0.85);
          const n = N.fbm(x * sc + ft.idx * 31.7, y * sc - ft.idx * 17.3, 4) * rough * ft.r;
          f = Math.max(f, ft.r - d + n);
          break;
        }
        case 'coast': {
          const rough = ft.rough ?? 0.3;
          let d: number;
          let along: number;
          if (ft.side === 'n') { d = y; along = x; }
          else if (ft.side === 's') { d = this.h - y; along = x; }
          else if (ft.side === 'w') { d = x; along = y; }
          else { d = this.w - x; along = y; }
          let depth = ft.depth;
          if (ft.from !== undefined && along < ft.from) depth -= (ft.from - along) * 1.2;
          if (ft.to !== undefined && along > ft.to) depth -= (along - ft.to) * 1.2;
          if (d > ft.depth * 2.5) break;
          const sc = 1 / Math.max(500, ft.depth * 1.1);
          const n = N.fbm(along * sc + ft.idx * 11.1, d * sc * 0.6 + ft.idx * 5.3, 4) * rough * ft.depth;
          f = Math.max(f, depth - d + n);
          break;
        }
        case 'poly': {
          const sd = signedDistPoly(x, y, ft.pts);
          const rough = ft.rough ?? 0.2;
          const sc = 1 / 2500;
          const n = N.fbm(x * sc + ft.idx * 3.3, y * sc + ft.idx * 7.7, 4) * rough * 2500;
          f = Math.max(f, sd + n);
          break;
        }
        case 'water': {
          const rough = ft.rough ?? 0.25;
          const elong = ft.elong ?? 1;
          const rot = ft.rot ?? 0;
          const c = Math.cos(rot);
          const s = Math.sin(rot);
          const dx = x - ft.x;
          const dy = y - ft.y;
          const lx = (dx * c + dy * s) / elong;
          const ly = -dx * s + dy * c;
          const d = Math.sqrt(lx * lx + ly * ly);
          const sc = 1 / Math.max(300, ft.r * 0.7);
          const n = N.fbm(x * sc - ft.idx * 13.1, y * sc + ft.idx * 21.9, 3) * rough * ft.r;
          f = Math.min(f, d - ft.r + n);
          break;
        }
        case 'channel': {
          let d = Infinity;
          const p = ft.pts;
          for (let i = 0; i < p.length - 1; i++) {
            d = Math.min(d, distToSeg(x, y, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
          }
          const rough = ft.rough ?? 0.3;
          const sc = 1 / Math.max(300, ft.w);
          const n = N.fbm(x * sc + ft.idx * 9.9, y * sc - ft.idx * 4.4, 3) * rough * ft.w * 0.5;
          f = Math.min(f, d - ft.w / 2 + n);
          break;
        }
      }
    }
    return f;
  }

  /** Bilinear sample of the grid. Outside the map counts as open water. */
  sample(x: number, y: number): number {
    if (!this.hasLand) return -1e5;
    const gx = x / this.cell;
    const gy = y / this.cell;
    if (gx < 0 || gy < 0 || gx >= this.gw - 1 || gy >= this.gh - 1) return -1e5;
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const fx = gx - i;
    const fy = gy - j;
    const g = this.grid;
    const k = j * this.gw + i;
    const a = g[k];
    const b = g[k + 1];
    const c = g[k + this.gw];
    const d = g[k + this.gw + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  isLand(x: number, y: number, clearance = 0): boolean {
    return this.sample(x, y) > -clearance;
  }

  /** True when no land lies between the two points (used for line of sight). */
  los(x0: number, y0: number, x1: number, y1: number): boolean {
    if (!this.hasLand) return true;
    const d = dist(x0, y0, x1, y1);
    const steps = Math.ceil(d / (this.cell * 0.7));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.sample(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) > 25) return false;
    }
    return true;
  }

  segClear(x0: number, y0: number, x1: number, y1: number, clearance: number): boolean {
    if (!this.hasLand) return true;
    const d = dist(x0, y0, x1, y1);
    const steps = Math.max(1, Math.ceil(d / (this.cell * 0.4)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this.sample(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) > -clearance) return false;
    }
    return true;
  }

  /** Nearest open-water point to (x, y) within a search radius. */
  nearestWater(x: number, y: number, clearance: number): Vec {
    if (!this.isLand(x, y, clearance)) return { x, y };
    for (let r = this.cell; r < 15000; r += this.cell) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const px = x + Math.cos(ang) * r;
        const py = y + Math.sin(ang) * r;
        if (px < 0 || py < 0 || px > this.w || py > this.h) continue;
        if (!this.isLand(px, py, clearance)) return { x: px, y: py };
      }
    }
    return { x, y };
  }

  /** A* over the grid, then string-pulled. Returns waypoints ending at the target. */
  findPath(sx: number, sy: number, tx: number, ty: number, clearance: number): Vec[] | null {
    tx = clamp(tx, 0, this.w);
    ty = clamp(ty, 0, this.h);
    if (!this.hasLand || this.segClear(sx, sy, tx, ty, clearance)) return [{ x: tx, y: ty }];
    const goal = this.nearestWater(tx, ty, clearance);
    const start = this.nearestWater(sx, sy, Math.min(clearance, 40));
    const gw = this.gw;
    const gh = this.gh;
    const toIdx = (x: number, y: number) =>
      clamp(Math.round(y / this.cell), 0, gh - 1) * gw + clamp(Math.round(x / this.cell), 0, gw - 1);
    const si = toIdx(start.x, start.y);
    const gi = toIdx(goal.x, goal.y);
    const blocked = (i: number) => this.grid[i] > -clearance;
    const gen = ++this.gen;
    const heap = new MinHeap();
    const gxGoal = gi % gw;
    const gyGoal = Math.floor(gi / gw);
    const h = (i: number) => {
      const dx = Math.abs((i % gw) - gxGoal);
      const dy = Math.abs(Math.floor(i / gw) - gyGoal);
      return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)) * this.cell;
    };
    this.stamp[si] = gen;
    this.gScore[si] = 0;
    this.came[si] = -1;
    heap.push(si, h(si));
    let found = false;
    let iter = 0;
    const DX = [1, -1, 0, 0, 1, 1, -1, -1];
    const DY = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.size > 0 && iter++ < 120000) {
      const cur = heap.pop();
      if (cur === gi) {
        found = true;
        break;
      }
      if (this.closedStamp[cur] === gen) continue;
      this.closedStamp[cur] = gen;
      const cx = cur % gw;
      const cy = Math.floor(cur / gw);
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k];
        const ny = cy + DY[k];
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const ni = ny * gw + nx;
        if (blocked(ni) && ni !== gi) continue;
        if (k >= 4 && (blocked(cy * gw + nx) || blocked(ny * gw + cx))) continue;
        const cost = (k >= 4 ? Math.SQRT2 : 1) * this.cell;
        const g = this.gScore[cur] + cost;
        if (this.stamp[ni] !== gen || g < this.gScore[ni]) {
          this.stamp[ni] = gen;
          this.gScore[ni] = g;
          this.came[ni] = cur;
          heap.push(ni, g + h(ni));
        }
      }
    }
    if (!found) return null;
    const cells: Vec[] = [];
    for (let i = gi; i !== -1; i = this.came[i]) {
      cells.push({ x: (i % gw) * this.cell, y: Math.floor(i / gw) * this.cell });
      if (cells.length > 5000) break;
    }
    cells.reverse();
    cells[cells.length - 1] = { x: goal.x, y: goal.y };
    // string pulling
    const out: Vec[] = [];
    let ax = sx;
    let ay = sy;
    let k = 0;
    while (k < cells.length) {
      let far = k;
      for (let j = cells.length - 1; j > k; j--) {
        if (this.segClear(ax, ay, cells[j].x, cells[j].y, clearance * 0.8)) {
          far = j;
          break;
        }
      }
      out.push(cells[far]);
      ax = cells[far].x;
      ay = cells[far].y;
      k = far + 1;
    }
    if (dist(goal.x, goal.y, tx, ty) < 1 && out.length) out[out.length - 1] = { x: tx, y: ty };
    return out;
  }
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, key: number) {
    this.ids.push(id);
    this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.ids.length > 0) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      let i = 0;
      const n = this.ids.length;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < n && this.keys[l] < this.keys[m]) m = l;
        if (r < n && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

function scaleFeature(f: LandFeature, idx: number): Feature {
  const K = 1000;
  switch (f.k) {
    case 'island':
      return { ...f, x: f.x * K, y: f.y * K, r: f.r * K, rot: ((f.rot ?? 0) * Math.PI) / 180, idx };
    case 'water':
      return { ...f, x: f.x * K, y: f.y * K, r: f.r * K, rot: ((f.rot ?? 0) * Math.PI) / 180, idx };
    case 'coast':
      return {
        ...f, depth: f.depth * K,
        from: f.from !== undefined ? f.from * K : undefined,
        to: f.to !== undefined ? f.to * K : undefined, idx,
      };
    case 'poly':
      return { ...f, pts: f.pts.map(([x, y]) => [x * K, y * K] as [number, number]), idx };
    case 'channel':
      return { ...f, pts: f.pts.map(([x, y]) => [x * K, y * K] as [number, number]), w: f.w * K, idx };
  }
}

function signedDistPoly(x: number, y: number, pts: [number, number][]): number {
  let inside = false;
  let d = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    d = Math.min(d, distToSeg(x, y, xi, yi, xj, yj));
  }
  return inside ? d : -d;
}
