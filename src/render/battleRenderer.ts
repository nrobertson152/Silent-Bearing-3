// Draws a battle: ocean, coastlines, ships, aircraft, weapons, effects and the
// player's contact picture.

import { clamp, dist } from '../core/math';
import { SIZE, isCarrierType, isMerchantType, isStructureType } from '../data/ships';
import { TORPS } from '../data/weapons';
import type { Squadron, Unit } from '../sim/types';
import type { World } from '../sim/world';
import { airborne } from '../sim/sensors';
import type { Camera } from './camera';
import { Effects } from './effects';
import { drawShip, drawSymbol, plane } from './shipArt';
import { makeOceanTile, makeTerrainImage, type TerrainImage } from './terrainImage';

export type CursorMode = 'normal' | 'torpedo' | 'strike' | 'scout' | 'cap' | 'waypoint';

export interface ViewState {
  selected: Set<number>;
  selectedSq: Set<number>;
  hover: { kind: 'unit' | 'sq'; id: number } | null;
  showLabels: boolean;
  mode: CursorMode;
  cursorX: number;
  cursorY: number;
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  spread: number;
  realTime: number;
}

const OCEAN: Record<string, string> = {
  day: '#1a4868',
  dawn: '#1f3d5a',
  dusk: '#1e3550',
  night: '#0b1828',
};

export class BattleRenderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly fx = new Effects();
  private terrain: TerrainImage;
  private oceanTile: HTMLCanvasElement;
  private pattern: CanvasPattern | null = null;
  private precip: { x: number; y: number; s: number }[] = [];
  private dpr = 1;
  private lastFireEmit = 0;
  /** Show every ship regardless of the player's contact picture (title-screen battles). */
  spectator = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly world: World,
    readonly cam: Camera,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.terrain = makeTerrainImage(world.terrain, world.env.biome ?? 'temperate');
    this.oceanTile = makeOceanTile(world.mission.map.seed);
    this.pattern = this.ctx.createPattern(this.oceanTile, 'repeat');
    this.fx.windX = world.env.windX;
    this.fx.windY = world.env.windY;
    if (world.env.wx === 'rain' || world.env.wx === 'storm' || world.env.wx === 'snow') {
      for (let i = 0; i < 260; i++) this.precip.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 });
    }
  }

  resize(w: number, h: number, dpr: number) {
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.cam.resize(w, h);
  }

  /** Turn simulation events into effects. Returns nothing; sounds are handled elsewhere. */
  consume(events: World['events']) {
    for (const e of events) {
      switch (e.k) {
        case 'fire':
          this.fx.muzzle(e.x, e.y, e.ang, e.cal);
          break;
        case 'splash':
          this.fx.splash(e.x, e.y, e.cal);
          break;
        case 'hit':
          this.fx.hit(e.x, e.y, e.cal);
          break;
        case 'boom':
          this.fx.boom(e.x, e.y, e.size);
          break;
        case 'sunk':
          this.fx.boom(e.x, e.y, 3);
          break;
        case 'dc':
          this.fx.dc(e.x, e.y);
          break;
        case 'flak':
          this.fx.flak(e.x, e.y);
          break;
        case 'planeDown':
          this.fx.planeDown(e.x, e.y);
          break;
        case 'bomb':
          if (e.hit) this.fx.boom(e.x, e.y, 1.2);
          else this.fx.splash(e.x, e.y, 300);
          break;
        case 'ping':
          this.fx.ping(e.x, e.y, 2200);
          break;
      }
    }
  }

  draw(vs: ViewState, dtReal: number) {
    const ctx = this.ctx;
    const cam = this.cam;
    const w = this.world;
    this.fx.update(dtReal);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // ocean
    const tod = w.env.tod;
    ctx.fillStyle = OCEAN[tod] ?? OCEAN.day;
    if (w.env.wx === 'overcast' || w.env.wx === 'rain' || w.env.wx === 'storm') ctx.fillStyle = tod === 'night' ? '#0a1520' : '#25455a';
    if (w.env.biome === 'arctic' || w.env.biome === 'ice') ctx.fillStyle = tod === 'night' ? '#0a1822' : '#1f4252';
    if (w.env.biome === 'tropical' && tod === 'day' && w.env.wx === 'clear') ctx.fillStyle = '#145878';
    ctx.fillRect(0, 0, cam.w, cam.h);
    if (this.pattern) {
      const tileM = 2400;
      const s = (tileM * cam.zoom) / 256;
      if (s > 0.25) {
        const ox = cam.sx(0);
        const oy = cam.sy(0);
        const drift = vs.realTime * 4;
        this.pattern.setTransform(new DOMMatrix([s, 0, 0, s, ox + drift * cam.zoom, oy]));
        ctx.globalAlpha = clamp((s - 0.25) * 2, 0, 1) * 0.45;
        ctx.fillStyle = this.pattern;
        ctx.fillRect(0, 0, cam.w, cam.h);
        ctx.globalAlpha = 1;
      }
    }
    // land
    if (w.terrain.hasLand) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.terrain.canvas, cam.sx(0), cam.sy(0), w.terrain.w * cam.zoom, w.terrain.h * cam.zoom);
    }
    if (!this.spectator) {
      // map edge
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cam.sx(0), cam.sy(0), w.terrain.w * cam.zoom, w.terrain.h * cam.zoom);
      this.drawGrid();
      this.drawZones(vs);
    }
    this.drawWakes();
    this.drawTorps();
    this.fx.draw(ctx, cam, 'water');
    this.drawUnits(vs);
    this.drawSmoke();
    // darkness and weather
    this.drawSky(vs, dtReal);
    this.emitFires();
    this.fx.draw(ctx, cam, 'air');
    this.drawShells();
    this.drawAir(vs);
    if (!this.spectator) {
      this.drawContacts(vs);
      this.drawSelection(vs);
      this.drawLabels(vs);
    }
    if (vs.box) {
      const b = vs.box;
      ctx.strokeStyle = 'rgba(160,255,190,0.9)';
      ctx.fillStyle = 'rgba(160,255,190,0.08)';
      ctx.lineWidth = 1;
      ctx.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
      ctx.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    }
  }

  private drawGrid() {
    const ctx = this.ctx;
    const cam = this.cam;
    const steps = [500, 1000, 2000, 5000, 10000, 20000, 50000];
    let step = steps[steps.length - 1];
    for (const s of steps) {
      if (s * cam.zoom >= 90) {
        step = s;
        break;
      }
    }
    const v = cam.view();
    const W = this.world.terrain.w;
    const H = this.world.terrain.h;
    ctx.strokeStyle = 'rgba(200,230,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.max(0, Math.floor(v.x0 / step) * step); x <= Math.min(W, v.x1); x += step) {
      const sx = Math.round(cam.sx(x)) + 0.5;
      ctx.moveTo(sx, Math.max(0, cam.sy(0)));
      ctx.lineTo(sx, Math.min(cam.h, cam.sy(H)));
    }
    for (let y = Math.max(0, Math.floor(v.y0 / step) * step); y <= Math.min(H, v.y1); y += step) {
      const sy = Math.round(cam.sy(y)) + 0.5;
      ctx.moveTo(Math.max(0, cam.sx(0)), sy);
      ctx.lineTo(Math.min(cam.w, cam.sx(W)), sy);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,230,255,0.35)';
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'left';
    for (let x = Math.max(0, Math.ceil(v.x0 / step) * step); x <= Math.min(W, v.x1); x += step) {
      ctx.fillText(step < 1000 ? (x / 1000).toFixed(1) : `${Math.round(x / 1000)}`, cam.sx(x) + 3, Math.max(12, cam.sy(0) + 12));
    }
    for (let y = Math.max(0, Math.ceil(v.y0 / step) * step); y <= Math.min(H, v.y1); y += step) {
      ctx.fillText(step < 1000 ? (y / 1000).toFixed(1) : `${Math.round(y / 1000)}`, Math.max(3, cam.sx(0) + 3), cam.sy(y) - 3);
    }
  }

  private drawZones(vs: ViewState) {
    const ctx = this.ctx;
    const cam = this.cam;
    for (const z of this.world.zones) {
      if (z.hidden) continue;
      const sx = cam.sx(z.x);
      const sy = cam.sy(z.y);
      const r = z.r * cam.zoom;
      if (sx + r < 0 || sy + r < 0 || sx - r > cam.w || sy - r > cam.h) continue;
      const col = z.kind === 'exit' ? '120,230,150' : z.kind === 'mine' ? '255,110,90' : z.kind === 'bombard' ? '255,140,90' : '255,210,110';
      ctx.save();
      ctx.setLineDash(z.kind === 'mine' ? [3, 5] : [10, 7]);
      ctx.lineDashOffset = -vs.realTime * 8;
      ctx.strokeStyle = `rgba(${col},0.75)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(r, 6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(${col},${z.kind === 'mine' ? 0.1 : 0.05})`;
      ctx.fill();
      ctx.setLineDash([]);
      ctx.font = 'bold 11px "Bahnschrift", "Arial Narrow", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(${col},0.95)`;
      const label = z.kind === 'mine' ? `${z.name} (mines)` : z.name;
      ctx.fillText(label.toUpperCase(), sx, sy - Math.max(r, 6) - 6);
      ctx.restore();
    }
  }

  private visible(u: Unit): boolean {
    if (u.side === 0 || this.spectator) return true;
    const c = this.world.contacts[0].get(u.id);
    return !!c && c.level >= 2;
  }

  private drawWakes() {
    const ctx = this.ctx;
    const cam = this.cam;
    const t = this.world.time;
    for (const u of this.world.units) {
      if (u.escaped || (u.sunk && t - u.sinkT > 5)) continue;
      if (!this.visible(u)) continue;
      if (u.cls.sub && u.depth === 'deep') continue;
      const wk = u.wake;
      if (wk.length < 3 || u.v < 1) continue;
      const stern = this.world.sternPos(u);
      const pts: { x: number; y: number; w: number }[] = [{ x: cam.sx(stern.x), y: cam.sy(stern.y), w: 0 }];
      const beamPx = Math.max(1.2, u.cls.beam * cam.zoom * this.inflate(u));
      for (let i = wk.length - 3; i >= 0; i -= 3) {
        const age = t - wk[i + 2];
        if (age > 50) break;
        pts.push({ x: cam.sx(wk[i]), y: cam.sy(wk[i + 1]), w: age });
      }
      if (pts.length < 2) continue;
      const strength = clamp(u.v / 9, 0.25, 1) * (u.cls.sub && u.depth !== 'surface' ? 0.4 : 1);
      // ribbon polygon, wider and fainter with age
      const left: number[] = [];
      const right: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        let nx = -(b.y - a.y);
        let ny = b.x - a.x;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl;
        ny /= nl;
        const hw = beamPx * (0.45 + pts[i].w / 14);
        left.push(pts[i].x + nx * hw, pts[i].y + ny * hw);
        right.push(pts[i].x - nx * hw, pts[i].y - ny * hw);
      }
      const last = pts[pts.length - 1];
      const g = ctx.createLinearGradient(pts[0].x, pts[0].y, last.x, last.y);
      g.addColorStop(0, `rgba(236,246,250,${0.5 * strength})`);
      g.addColorStop(1, 'rgba(236,246,250,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(left[0], left[1]);
      for (let i = 2; i < left.length; i += 2) ctx.lineTo(left[i], left[i + 1]);
      for (let i = right.length - 2; i >= 0; i -= 2) ctx.lineTo(right[i], right[i + 1]);
      ctx.closePath();
      ctx.fill();
      // bow wave
      const L = u.cls.length * cam.zoom * this.inflate(u);
      if (L > 10 && u.v > 3 && !(u.cls.sub && u.depth !== 'surface')) {
        const bx = cam.sx(u.x) + Math.cos(u.h) * L * 0.5;
        const by = cam.sy(u.y) + Math.sin(u.h) * L * 0.5;
        const len = L * 0.42;
        const sp = 0.3;
        for (const sgn of [-1, 1]) {
          const ex = bx - Math.cos(u.h + sgn * sp) * len;
          const ey = by - Math.sin(u.h + sgn * sp) * len;
          const gg = ctx.createLinearGradient(bx, by, ex, ey);
          gg.addColorStop(0, `rgba(245,252,255,${0.6 * strength})`);
          gg.addColorStop(1, 'rgba(245,252,255,0)');
          ctx.strokeStyle = gg;
          ctx.lineWidth = Math.max(1, beamPx * 0.22);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }
    }
  }

  /** Sprite inflation so small ships stay visible at tactical zoom levels. */
  inflate(u: Unit): number {
    const L = u.cls.length * this.cam.zoom;
    if (L >= 26 || isStructureType(u.cls.type)) return 1;
    const min = u.cls.type === 'PT' ? 12 : u.cls.sub ? 18 : isMerchantType(u.cls.type) ? 20 : SIZE[u.cls.type] >= 0.9 ? 26 : 20;
    return Math.max(1, Math.min(min / Math.max(L, 0.01), 3.2));
  }

  private drawTorps() {
    const ctx = this.ctx;
    const cam = this.cam;
    const known = this.world.knownTorps[0];
    for (const tp of this.world.torps) {
      const mine = tp.side === 0;
      if (!mine && !known.has(tp.id)) continue;
      const sx = cam.sx(tp.x);
      const sy = cam.sy(tp.y);
      if (sx < -50 || sy < -50 || sx > cam.w + 50 || sy > cam.h + 50) continue;
      const len = Math.max(10, 220 * cam.zoom);
      ctx.strokeStyle = mine ? `rgba(255,255,240,${tp.wake ? 0.7 : 0.45})` : 'rgba(255,120,90,0.9)';
      ctx.lineWidth = mine ? 1.2 : 1.8;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - Math.cos(tp.h) * len, sy - Math.sin(tp.h) * len);
      ctx.stroke();
      ctx.fillStyle = mine ? '#fff7c2' : '#ff6b4a';
      ctx.beginPath();
      ctx.arc(sx, sy, mine ? 1.8 : 2.4, 0, Math.PI * 2);
      ctx.fill();
      if (!mine) {
        // projected track
        ctx.setLineDash([3, 6]);
        ctx.strokeStyle = 'rgba(255,120,90,0.35)';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        const ahead = Math.min(tp.left, 4000) * cam.zoom;
        ctx.lineTo(sx + Math.cos(tp.h) * ahead, sy + Math.sin(tp.h) * ahead);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private planesOnDeck(u: Unit): number {
    let n = 0;
    for (const id of u.hangar) {
      const s = this.world.sq(id);
      if (s && (s.state === 'deck' || s.state === 'queued') && s.def.role !== 'scout') n += s.n;
    }
    return n;
  }

  private drawUnits(vs: ViewState) {
    const ctx = this.ctx;
    const cam = this.cam;
    const w = this.world;
    const z = cam.zoom;
    const order = w.units.slice().sort((a, b) => (isStructureType(a.cls.type) ? -1 : 0) - (isStructureType(b.cls.type) ? -1 : 0));
    for (const u of order) {
      if (u.escaped) continue;
      let alpha = 1;
      if (u.sunk) {
        const age = w.time - u.sinkT;
        alpha = 1 - age / 50;
        if (alpha <= 0) continue;
      }
      const c = w.contacts[0].get(u.id);
      const isOwn = u.side === 0;
      const known = isOwn || this.spectator;
      if (!known && !(c && c.level >= 2) && !u.sunk) continue;
      if (!known && u.sunk && !(c && w.time - c.seen < 60)) continue;
      const sx = cam.sx(u.x);
      const sy = cam.sy(u.y);
      const L = u.cls.length * z;
      const margin = Math.max(30, L);
      if (sx < -margin || sy < -margin || sx > cam.w + margin || sy > cam.h + margin) continue;
      const identified = known || (c && c.level >= 3);
      const submerged = !!u.cls.sub && u.depth !== 'surface';
      const inf = this.inflate(u);
      if (L * inf >= 9 && L >= 2.5 && identified) {
        const zz = z * inf;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(u.h);
        ctx.scale(zz, zz * (u.sunk ? 1 - (1 - alpha) * 0.5 : 1));
        ctx.globalAlpha = alpha * (submerged ? (u.depth === 'deep' ? 0.25 : 0.5) : 1);
        // side halo
        if (L * inf < 60 && !u.sunk) {
          ctx.beginPath();
          ctx.ellipse(0, 0, u.cls.length * 0.62, Math.max(u.cls.beam * 1.4, 6 / zz), 0, 0, Math.PI * 2);
          ctx.fillStyle = isOwn ? (u.controllable ? 'rgba(110,190,255,0.18)' : 'rgba(150,230,190,0.16)') : 'rgba(255,100,90,0.2)';
          ctx.fill();
        }
        drawShip(ctx, u, zz, { planesOnDeck: isCarrierType(u.cls.type) ? this.planesOnDeck(u) : 0 });
        ctx.restore();
        if (u.sunk) {
          ctx.globalAlpha = alpha * 0.5;
          ctx.fillStyle = '#0d0f10';
          ctx.beginPath();
          ctx.ellipse(sx, sy, Math.max(4, L * 0.7), Math.max(3, L * 0.25), u.h, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else {
        const kind = isOwn ? (u.controllable ? 'friend' : 'ally') : identified ? 'foe' : 'unknown';
        const shape = u.cls.sub ? 'sub' : isCarrierType(u.cls.type) ? 'carrier' : isMerchantType(u.cls.type) ? 'merchant' : isStructureType(u.cls.type) ? 'base' : 'ship';
        const size = isStructureType(u.cls.type) ? 8 : 4 + SIZE[u.cls.type] * 4.5;
        ctx.globalAlpha = alpha * (submerged ? 0.55 : 1);
        drawSymbol(ctx, sx, sy, u.h, size, kind, shape);
        ctx.globalAlpha = 1;
      }
    }
  }

  private emitFires() {
    const w = this.world;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFireEmit) / 1000);
    this.lastFireEmit = now;
    for (const u of w.units) {
      if (u.escaped || u.fires <= 0) continue;
      if (!this.visible(u) && !u.sunk) continue;
      if (u.sunk && w.time - u.sinkT > 25) continue;
      const rate = u.fires * 14 * dt;
      let n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
      while (n-- > 0) {
        const along = (Math.random() - 0.5) * u.cls.length * 0.7;
        const across = (Math.random() - 0.5) * u.cls.beam * 0.5;
        const x = u.x + Math.cos(u.h) * along - Math.sin(u.h) * across;
        const y = u.y + Math.sin(u.h) * along + Math.cos(u.h) * across;
        this.fx.fire(x, y, Math.max(4, u.cls.beam * 0.3));
      }
    }
  }

  private drawSmoke() {
    const ctx = this.ctx;
    const cam = this.cam;
    for (const s of this.world.smokes) {
      const sx = cam.sx(s.x);
      const sy = cam.sy(s.y);
      const r = s.r * cam.zoom;
      if (sx + r < 0 || sy + r < 0 || sx - r > cam.w || sy - r > cam.h) continue;
      const age = this.world.time - s.t0;
      const fade = s.squall ? 1 : clamp(1 - (age - s.life * 0.6) / (s.life * 0.4), 0, 1);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(2, r));
      if (s.squall) {
        g.addColorStop(0, 'rgba(120,135,150,0.42)');
        g.addColorStop(0.7, 'rgba(110,125,140,0.28)');
        g.addColorStop(1, 'rgba(110,125,140,0)');
      } else {
        g.addColorStop(0, `rgba(70,70,72,${0.55 * fade})`);
        g.addColorStop(0.6, `rgba(80,80,82,${0.4 * fade})`);
        g.addColorStop(1, 'rgba(80,80,82,0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(2, r), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawSky(vs: ViewState, dt: number) {
    const ctx = this.ctx;
    const cam = this.cam;
    const env = this.world.env;
    let a = 0;
    let col = '5,10,28';
    if (env.tod === 'night') a = 0.5;
    else if (env.tod === 'dusk' || env.tod === 'dawn') {
      a = 0.28;
      col = env.tod === 'dusk' ? '40,20,40' : '30,30,55';
    }
    if (env.wx === 'fog') {
      ctx.fillStyle = 'rgba(190,200,210,0.22)';
      ctx.fillRect(0, 0, cam.w, cam.h);
    }
    if (env.wx === 'storm' || env.wx === 'rain') {
      ctx.fillStyle = 'rgba(30,40,50,0.18)';
      ctx.fillRect(0, 0, cam.w, cam.h);
    }
    if (a > 0) {
      ctx.fillStyle = `rgba(${col},${a})`;
      ctx.fillRect(0, 0, cam.w, cam.h);
    }
    if (env.aurora && env.tod === 'night') {
      const g = ctx.createLinearGradient(0, 0, 0, cam.h * 0.6);
      g.addColorStop(0, `rgba(80,255,170,${0.07 + 0.03 * Math.sin(vs.realTime * 0.4)})`);
      g.addColorStop(1, 'rgba(80,255,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cam.w, cam.h * 0.6);
    }
    // vignette
    const vg = ctx.createRadialGradient(cam.w / 2, cam.h / 2, Math.min(cam.w, cam.h) * 0.35, cam.w / 2, cam.h / 2, Math.max(cam.w, cam.h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${env.tod === 'night' ? 0.45 : 0.25})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cam.w, cam.h);
    if (this.precip.length) {
      const snow = env.wx === 'snow';
      ctx.strokeStyle = snow ? 'rgba(240,245,255,0.7)' : 'rgba(190,210,230,0.35)';
      ctx.fillStyle = 'rgba(240,245,255,0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const p of this.precip) {
        p.y += dt * (snow ? 0.08 : 0.9) * p.s;
        p.x += dt * (snow ? 0.02 : 0.15) * p.s;
        if (p.y > 1) p.y -= 1;
        if (p.x > 1) p.x -= 1;
        const x = p.x * cam.w;
        const y = p.y * cam.h;
        if (snow) ctx.rect(x, y, 1.6 * p.s, 1.6 * p.s);
        else {
          ctx.moveTo(x, y);
          ctx.lineTo(x - 3 * p.s, y - 12 * p.s);
        }
      }
      if (snow) ctx.fill();
      else ctx.stroke();
    }
  }

  private drawShells() {
    const ctx = this.ctx;
    const cam = this.cam;
    const t = this.world.time;
    const night = this.world.env.night;
    ctx.fillStyle = night ? '#ffdf8a' : '#fff3c4';
    ctx.strokeStyle = night ? 'rgba(255,200,110,0.55)' : 'rgba(255,240,200,0.35)';
    ctx.lineWidth = 1;
    for (const s of this.world.shells) {
      const f = clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
      const x = s.x0 + (s.x1 - s.x0) * f;
      const y = s.y0 + (s.y1 - s.y0) * f;
      const sx = cam.sx(x);
      const sy = cam.sy(y);
      if (sx < -10 || sy < -10 || sx > cam.w + 10 || sy > cam.h + 10) continue;
      const arc = Math.sin(f * Math.PI);
      const r = (0.8 + s.cal / 300) * (1 + arc * 0.6);
      const dx = s.x1 - s.x0;
      const dy = s.y1 - s.y0;
      const d = Math.hypot(dx, dy) || 1;
      const tail = Math.min(14, 6 + s.cal / 50);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - (dx / d) * tail, sy - (dy / d) * tail);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawAir(vs: ViewState) {
    const ctx = this.ctx;
    const cam = this.cam;
    const w = this.world;
    for (const s of w.squadrons) {
      if (!airborne(s) || s.n <= 0) continue;
      const own = s.side === 0;
      if (!own && !w.airSeen[0].has(s.id) && !this.spectator) continue;
      const sx = cam.sx(s.x);
      const sy = cam.sy(s.y);
      if (sx < -40 || sy < -40 || sx > cam.w + 40 || sy > cam.h + 40) continue;
      const col = own ? '#bfe3ff' : '#ff8c7a';
      const n = Math.min(5, Math.ceil(s.n / 4));
      ctx.fillStyle = col;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(s.h);
      const offs = [[0, 0], [-7, -6], [-7, 6], [-14, -12], [-14, 12]];
      for (let i = 0; i < n; i++) plane(ctx, offs[i][0], offs[i][1], 4.2);
      ctx.restore();
      if (vs.selectedSq.has(s.id)) {
        ctx.strokeStyle = '#9dffb0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (own && !this.spectator && s.target && (s.state === 'outbound' || s.state === 'scout' || s.state === 'attack')) {
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(191,227,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(cam.sx(s.target.x), cam.sy(s.target.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (cam.zoom > 0.004 && !this.spectator) {
        ctx.font = '10px "Bahnschrift", "Arial Narrow", sans-serif';
        ctx.fillStyle = col;
        ctx.textAlign = 'left';
        ctx.fillText(`${s.n} ${s.def.name.split(' ')[0]}`, sx + 10, sy - 8);
      }
    }
  }

  private drawContacts(vs: ViewState) {
    const ctx = this.ctx;
    const cam = this.cam;
    const w = this.world;
    const t = w.time;
    // bearing lines
    for (const b of w.bearings[0]) {
      const age = t - b.t;
      const life = b.kind === 'hfdf' ? 70 : 25;
      const a = clamp(1 - age / life, 0, 1);
      if (a <= 0) continue;
      const len = b.kind === 'hfdf' ? 45000 : 22000;
      const x0 = cam.sx(b.ox);
      const y0 = cam.sy(b.oy);
      const x1 = cam.sx(b.ox + Math.cos(b.ang) * len);
      const y1 = cam.sy(b.oy + Math.sin(b.ang) * len);
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      const col = b.kind === 'hfdf' ? '197,140,255' : '88,214,201';
      grad.addColorStop(0, `rgba(${col},${0.7 * a})`);
      grad.addColorStop(1, `rgba(${col},0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const c of w.contacts[0].values()) {
      const u = w.unit(c.id);
      if (!u || u.sunk || u.escaped) continue;
      if (c.level === 1 && c.fix) {
        const sx = cam.sx(c.x);
        const sy = cam.sy(c.y);
        const r = Math.max(10, 1500 * cam.zoom);
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(255,214,110,0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = 'bold 11px "Bahnschrift", "Arial Narrow", sans-serif';
        ctx.fillStyle = 'rgba(255,214,110,0.95)';
        ctx.textAlign = 'center';
        ctx.fillText('BEARING FIX', sx, sy - r - 5);
      } else if (c.level === 0 && !isNaN(c.x) && t - c.seen < 600) {
        // lost contact: dead-reckoned ghost
        const age = t - c.seen;
        const dr = Math.min(age, 300);
        const gx = c.x + Math.cos(c.h) * c.v * dr;
        const gy = c.y + Math.sin(c.h) * c.v * dr;
        const sx = cam.sx(gx);
        const sy = cam.sy(gy);
        ctx.globalAlpha = clamp(1 - age / 600, 0.15, 0.6);
        drawSymbol(ctx, sx, sy, c.h, 5, 'unknown', u.cls.sub ? 'sub' : 'ship');
        ctx.globalAlpha = 1;
        ctx.font = '10px "Bahnschrift", "Arial Narrow", sans-serif';
        ctx.fillStyle = 'rgba(255,214,110,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(`lost ${Math.floor(age / 60)}m`, sx, sy + 16);
      } else if (c.level >= 2 && c.sonar) {
        const sx = cam.sx(c.x);
        const sy = cam.sy(c.y);
        const pulse = (vs.realTime * 1.5) % 1;
        ctx.strokeStyle = `rgba(88,214,201,${1 - pulse})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 6 + pulse * 18, 0, Math.PI * 2);
        ctx.stroke();
        drawSymbol(ctx, sx, sy, c.h, 5, 'foe', 'sub');
      }
    }
  }

  private drawSelection(vs: ViewState) {
    const ctx = this.ctx;
    const cam = this.cam;
    const w = this.world;
    let primary: Unit | undefined;
    for (const id of vs.selected) {
      const u = w.unit(id);
      if (!u || u.sunk || u.escaped) continue;
      if (!primary) primary = u;
      const sx = cam.sx(u.x);
      const sy = cam.sy(u.y);
      const r = Math.max(11, (u.cls.length / 2) * cam.zoom * this.inflate(u) + 5);
      ctx.strokeStyle = u.side === 0 ? '#9dffb0' : '#ffb09d';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (u.side !== 0) continue;
      // path
      if (u.path.length) {
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = 'rgba(157,255,176,0.6)';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        for (const p of u.path) ctx.lineTo(cam.sx(p.x), cam.sy(p.y));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(157,255,176,0.8)';
        for (const p of u.path) {
          ctx.beginPath();
          ctx.arc(cam.sx(p.x), cam.sy(p.y), 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (u.orderH !== null && !u.follow && u.v > 0.5) {
        ctx.setLineDash([2, 6]);
        ctx.strokeStyle = 'rgba(157,255,176,0.35)';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(u.orderH) * 80, sy + Math.sin(u.orderH) * 80);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const L = w.unit(u.follow?.id);
      if (L) {
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = 'rgba(157,255,176,0.35)';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(cam.sx(L.x), cam.sy(L.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const tgt = w.unit(u.target ?? u.engage);
      const tc = tgt ? w.contacts[0].get(tgt.id) : undefined;
      if (tgt && !tgt.sunk && tc && tc.level >= 2) {
        ctx.setLineDash([8, 4]);
        ctx.strokeStyle = 'rgba(255,120,100,0.55)';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(cam.sx(tgt.x), cam.sy(tgt.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (primary && primary.side === 0) {
      const sx = cam.sx(primary.x);
      const sy = cam.sy(primary.y);
      const rings: [number, string][] = [];
      const gr = w.mainGunRange(primary);
      if (gr) rings.push([gr, 'rgba(255,200,120,0.35)']);
      const td = primary.cls.torps ? TORPS[primary.cls.torps.t] : undefined;
      if (td && primary.torpLoaded > 0) rings.push([td.range, 'rgba(240,240,255,0.25)']);
      if (primary.cls.sonar) rings.push([primary.cls.sonar, 'rgba(88,214,201,0.35)']);
      if (primary.hangar.length) {
        let r = 0;
        for (const id of primary.hangar) {
          const s = w.sq(id);
          if (s && s.def.role !== 'fighter') r = Math.max(r, s.def.radius * 1000);
        }
        if (r) rings.push([r, 'rgba(140,190,255,0.25)']);
      }
      for (const [r, col] of rings) {
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, r * cam.zoom, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      if (vs.mode === 'torpedo' && td) {
        const a = Math.atan2(vs.cursorY - primary.y, vs.cursorX - primary.x);
        const n = Math.max(1, Math.min(vs.spread, primary.torpLoaded));
        const spread = (primary.cls.sub ? 1.6 : 2.4) * (Math.PI / 180);
        ctx.strokeStyle = 'rgba(255,250,200,0.6)';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const h = a + (i - (n - 1) / 2) * spread;
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(h) * td.range * cam.zoom, sy + Math.sin(h) * td.range * cam.zoom);
        }
        ctx.stroke();
      }
    }
    if (vs.hover) {
      const p = vs.hover.kind === 'unit' ? w.unit(vs.hover.id) : w.sq(vs.hover.id);
      if (p) {
        const r = vs.hover.kind === 'unit' ? Math.max(12, ((p as Unit).cls.length / 2) * cam.zoom + 7) : 18;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cam.sx(p.x), cam.sy(p.y), r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawLabels(vs: ViewState) {
    if (!vs.showLabels) return;
    const ctx = this.ctx;
    const cam = this.cam;
    const w = this.world;
    ctx.font = '11px "Bahnschrift", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    for (const u of w.units) {
      if (u.sunk || u.escaped) continue;
      const own = u.side === 0;
      const c = w.contacts[0].get(u.id);
      if (!own && !(c && c.level >= 2)) continue;
      const L = u.cls.length * cam.zoom;
      const sel = vs.selected.has(u.id);
      if (!sel && L < 12 && cam.zoom < 0.02) continue;
      const sx = cam.sx(u.x);
      const sy = cam.sy(u.y);
      if (sx < -80 || sy < -30 || sx > cam.w + 80 || sy > cam.h + 30) continue;
      const off = Math.max(14, L * this.inflate(u) * 0.35 + 12);
      const name = own || (c && c.level >= 3) ? u.name : c && c.sonar ? 'sonar contact' : 'unknown';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(name, sx + 1, sy + off + 1);
      ctx.fillStyle = own ? (u.controllable ? '#cfe9ff' : '#bfeedd') : '#ffb2a6';
      ctx.fillText(name, sx, sy + off);
      if (own && u.hp < u.maxHp * 0.999) {
        const bw = 30;
        const f = clamp(u.hp / u.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(sx - bw / 2, sy + off + 4, bw, 3);
        ctx.fillStyle = f > 0.6 ? '#7ddf7a' : f > 0.3 ? '#ffc857' : '#ff5e5e';
        ctx.fillRect(sx - bw / 2, sy + off + 4, bw * f, 3);
      }
      if (u.cls.sub && own && u.depth !== 'surface') {
        ctx.fillStyle = '#9fd8ff';
        ctx.fillText(u.depth === 'deep' ? '▼ deep' : '▾ periscope', sx, sy - off + 4);
      }
    }
  }

  /** Units or squadrons under a screen point. */
  pick(sx: number, sy: number): { kind: 'unit' | 'sq'; id: number } | null {
    const cam = this.cam;
    const w = this.world;
    let best: { kind: 'unit' | 'sq'; id: number } | null = null;
    let bd = Infinity;
    for (const s of w.squadrons) {
      if (!airborne(s) || s.n <= 0) continue;
      if (s.side !== 0 && !w.airSeen[0].has(s.id)) continue;
      const d = dist(sx, sy, cam.sx(s.x), cam.sy(s.y));
      if (d < 14 && d < bd) {
        bd = d;
        best = { kind: 'sq', id: s.id };
      }
    }
    for (const u of w.units) {
      if (u.sunk || u.escaped) continue;
      if (u.side !== 0) {
        const c = w.contacts[0].get(u.id);
        if (!c || c.level < 2) continue;
      }
      const r = Math.max(12, (u.cls.length / 2) * cam.zoom);
      const d = dist(sx, sy, cam.sx(u.x), cam.sy(u.y));
      if (d < r && d < bd) {
        bd = d;
        best = { kind: 'unit', id: u.id };
      }
    }
    return best;
  }

  squadronAt(sx: number, sy: number): Squadron | undefined {
    const p = this.pick(sx, sy);
    return p && p.kind === 'sq' ? this.world.sq(p.id) : undefined;
  }
}
