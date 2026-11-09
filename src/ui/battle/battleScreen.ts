// The battle view: canvas, camera, mouse/keyboard/touch input and the HUD.

import { clamp, dist, fmtBearing, fmtClock, fmtKm, KN, toBearing } from '../../core/math';
import { AIRCRAFT, ROLE_NAMES } from '../../data/aircraft';
import { NATIONS } from '../../data/nations';
import { TYPE_NAMES, isCarrierType, isMerchantType, isStructureType } from '../../data/ships';
import { TORPS } from '../../data/weapons';
import { sfx } from '../../audio/sfx';
import { BattleRenderer, type CursorMode, type ViewState } from '../../render/battleRenderer';
import { Camera } from '../../render/camera';
import { orderCap, orderRecall, orderScout, orderStrike } from '../../sim/air';
import { fireTorpedoes } from '../../sim/combat';
import { finishWithRating } from '../../sim/objectives';
import { airborne } from '../../sim/sensors';
import type { Squadron, Unit } from '../../sim/types';
import { SPEED_NAMES, type World } from '../../sim/world';
import { VET_NAMES } from '../../sim/build';
import type { Settings } from '../../campaign/settings';
import { el, esc } from '../dom';
import { flagSvg } from '../flags';

export const TIME_STEPS = [1, 2, 4, 8, 16];
export const BASE_RATE = 5; // game seconds per real second at 1x

export interface BattleCallbacks {
  onFinish(w: World): void;
  onQuit(): void;
  onRestart?(): void;
}

export class BattleScreen {
  readonly cam = new Camera();
  renderer!: BattleRenderer;
  root!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private mini!: HTMLCanvasElement;
  private miniCtx!: CanvasRenderingContext2D;
  private hud: Record<string, HTMLElement> = {};
  private raf = 0;
  private lastT = 0;
  private realTime = 0;
  private paused = false;
  private speedIdx = 0;
  private selected = new Set<number>();
  private selectedSq = new Set<number>();
  private mode: CursorMode = 'normal';
  private pendingSq: number[] = [];
  private spread = 4;
  private hover: ViewState['hover'] = null;
  private mouse = { x: 0, y: 0, inside: false };
  private drag: { x0: number; y0: number; button: number; moved: boolean; t: number } | null = null;
  private box: ViewState['box'] = null;
  private keys = new Set<string>();
  private followId: number | null = null;
  private hudTimer = 0;
  private logSeen = 0;
  private bannerShown = false;
  private resultShown = false;
  private overlayOpen: string | null = null;
  private pingTimer = 0;
  private lastSel = '';
  private lastFleet = '';
  private lastObj = '';
  private touches = new Map<number, { x: number; y: number }>();
  private pinch: { d: number; cx: number; cy: number } | null = null;
  private longPress: number | null = null;
  private subsInMission: boolean;
  private resizeObs: ResizeObserver | null = null;

  constructor(
    readonly w: World,
    readonly settings: Settings,
    readonly cb: BattleCallbacks,
    readonly hints: string[] = [],
  ) {
    this.w.autoEvade = settings.autoEvade;
    this.subsInMission = w.units.some((u) => u.side === 1 && u.cls.sub);
  }

  mount(parent: HTMLElement) {
    this.root = el('div', { class: 'battle' });
    this.canvas = el('canvas', { class: 'battle-canvas' });
    this.root.append(this.canvas);
    const top = el('div', { class: 'hud-top' });
    const fleet = el('div', { class: 'hud-fleet panel' });
    const side = el('div', { class: 'hud-side' });
    const obj = el('div', { class: 'hud-obj panel' });
    const log = el('div', { class: 'hud-log panel' });
    side.append(obj, log);
    const sel = el('div', { class: 'hud-sel panel hidden' });
    this.mini = el('canvas', { class: 'minimap panel' });
    const tip = el('div', { class: 'hud-tip hidden' });
    const hint = el('div', { class: 'hud-hint hidden' });
    const banner = el('div', { class: 'hud-banner hidden' });
    const overlay = el('div', { class: 'overlay hidden' });
    this.root.append(top, fleet, side, sel, this.mini, tip, hint, banner, overlay);
    this.hud = { top, fleet, obj, log, sel, tip, hint, banner, overlay };
    parent.append(this.root);
    this.miniCtx = this.mini.getContext('2d')!;
    this.renderer = new BattleRenderer(this.canvas, this.w, this.cam);
    this.cam.setWorld(this.w.terrain.w, this.w.terrain.h);
    this.onResize();
    this.resizeObs = new ResizeObserver(() => this.onResize());
    this.resizeObs.observe(this.root);
    this.initialCamera();
    this.buildTop();
    this.bindInput();
    for (const el2 of [top, fleet, side, sel, banner, overlay, this.mini]) {
      el2.addEventListener('pointerdown', (e) => this.onHudPointer(e as PointerEvent));
      el2.addEventListener('wheel', (e) => e.stopPropagation());
    }
    this.lastT = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
    sfx.startAmbience(this.w.env.wx === 'storm' || (this.w.env.sea ?? 1) >= 3);
    // first selection: the whole player force
    const own = this.ownUnits();
    if (own.length) this.select(own.slice(0, 1).map((u) => u.id));
    this.showStartHints();
  }

  unmount() {
    cancelAnimationFrame(this.raf);
    this.resizeObs?.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    sfx.stopAmbience();
    this.root.remove();
  }

  private onBlur = () => this.keys.clear();

  private onResize() {
    const r = this.root.getBoundingClientRect();
    const w = Math.max(320, r.width || window.innerWidth);
    const h = Math.max(240, r.height || window.innerHeight);
    this.renderer.resize(w, h, Math.min(2, window.devicePixelRatio || 1));
    const mw = Math.min(240, Math.max(150, w * 0.17));
    const ratio = this.w.terrain.h / this.w.terrain.w;
    const mh = clamp(mw * ratio, 80, 200);
    this.mini.width = Math.round(mw * 2);
    this.mini.height = Math.round(mh * 2);
    this.mini.style.width = `${mw}px`;
    this.mini.style.height = `${mh}px`;
  }

  private initialCamera() {
    const own = this.ownUnits();
    if (!own.length) {
      this.cam.fit(0, 0, this.w.terrain.w, this.w.terrain.h);
      return;
    }
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const u of own) {
      x0 = Math.min(x0, u.x);
      y0 = Math.min(y0, u.y);
      x1 = Math.max(x1, u.x);
      y1 = Math.max(y1, u.y);
    }
    const span = Math.max(x1 - x0, y1 - y0, 7000);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    this.cam.fit(cx - span / 2, cy - span / 2, cx + span / 2, cy + span / 2, 1.4);
  }

  private ownUnits(): Unit[] {
    return this.w.units.filter((u) => u.side === 0 && u.controllable && !u.sunk && !u.escaped);
  }

  // ------------------------------------------------------------------ main loop
  private loop(t: number) {
    this.raf = requestAnimationFrame((tt) => this.loop(tt));
    const dt = Math.min(0.1, (t - this.lastT) / 1000);
    this.lastT = t;
    this.realTime += dt;
    if (!this.paused && !this.overlayOpen && !this.w.result) {
      this.w.advance(dt * BASE_RATE * TIME_STEPS[this.speedIdx], 2400);
    }
    this.processEvents();
    this.updateCameraKeys(dt);
    if (this.followId !== null) {
      const f = this.w.unit(this.followId);
      if (f && !f.sunk && !f.escaped) this.cam.centerOn(f.x, f.y);
      else this.followId = null;
    }
    this.pingTimer -= dt;
    if (this.pingTimer <= 0 && this.subsInMission && !this.paused) {
      this.pingTimer = 6 / Math.min(4, TIME_STEPS[this.speedIdx]);
      this.emitPings();
    }
    const vs: ViewState = {
      selected: this.selected, selectedSq: this.selectedSq, hover: this.hover,
      showLabels: this.settings.labels, mode: this.mode,
      cursorX: this.cam.wx(this.mouse.x), cursorY: this.cam.wy(this.mouse.y),
      box: this.box, spread: this.spread, realTime: this.realTime,
    };
    this.renderer.draw(vs, dt);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.2;
      this.updateHud();
    }
    this.drawMinimap();
    if (this.w.result && !this.resultShown) this.showResult();
  }

  private emitPings() {
    let n = 0;
    for (const u of this.w.units) {
      if (u.side !== 0 || !u.cls.sonar || u.sunk || u.escaped || !u.alert || u.v > 9.5) continue;
      if (this.w.time < u.sonarBlind) continue;
      const sx = this.cam.sx(u.x);
      const sy = this.cam.sy(u.y);
      if (sx < 0 || sy < 0 || sx > this.cam.w || sy > this.cam.h) continue;
      this.renderer.fx.ping(u.x, u.y, u.cls.sonar);
      if (n++ === 0) sfx.ping(this.audibility(u.x, u.y).vol * 0.8 + 0.1);
      if (n > 4) break;
    }
  }

  private audibility(x: number, y: number) {
    const cam = this.cam;
    const sx = cam.sx(x);
    const sy = cam.sy(y);
    const R = Math.hypot(cam.w, cam.h) * 0.5;
    const d = Math.hypot(sx - cam.w / 2, sy - cam.h / 2);
    const zoomF = clamp(cam.zoom / 0.03, 0.25, 1);
    const vol = Math.pow(clamp(1 - d / (R * 1.6), 0, 1), 1.5) * zoomF;
    return { vol, pan: clamp((sx - cam.w / 2) / (cam.w / 2), -1, 1) * 0.8 };
  }

  private processEvents() {
    const evs = this.w.events;
    if (!evs.length) return;
    this.renderer.consume(evs);
    for (const e of evs) {
      if (e.k === 'msg') {
        if (e.kind === 'radio') sfx.radio();
        if (e.kind === 'warn' && /Torpedo tracks/.test(e.text)) sfx.alarm();
        if (/Diving|diving/.test(e.text)) sfx.klaxon();
        if (this.settings.autoSlow && this.speedIdx > 1 && (e.kind === 'warn' || e.kind === 'bad' || (e.kind === 'radio' && /sighted|aircraft/i.test(e.text)))) {
          this.speedIdx = 0;
          this.buildTop();
        }
        continue;
      }
      if (!('x' in e)) continue;
      const a = this.audibility(e.x, e.y);
      switch (e.k) {
        case 'fire':
          sfx.gun(e.cal, a.vol, a.pan);
          break;
        case 'splash':
          sfx.splash(e.cal, a.vol, a.pan);
          break;
        case 'hit':
          sfx.hit(e.cal, a.vol, a.pan);
          break;
        case 'boom':
          sfx.boom(e.size, Math.max(a.vol, e.size > 4 ? 0.3 : 0), a.pan);
          break;
        case 'sunk':
          sfx.boom(5, Math.max(a.vol, 0.25), a.pan);
          break;
        case 'torpLaunch':
          if (e.side === 0) sfx.torpedo(Math.max(0.3, a.vol), a.pan);
          break;
        case 'dc':
          sfx.depthCharge(Math.max(a.vol, 0.15), a.pan);
          break;
        case 'planeDown':
          sfx.planeDown(a.vol, a.pan);
          break;
        case 'bomb':
          if (e.hit) sfx.boom(1.5, a.vol, a.pan);
          else sfx.splash(300, a.vol, a.pan);
          break;
        case 'flak':
          sfx.flak(a.vol, a.pan);
          break;
      }
    }
    this.w.events.length = 0;
  }

  private updateCameraKeys(dt: number) {
    const k = this.keys;
    const sp = (k.has('Shift') ? 1400 : 700) * dt;
    let dx = 0;
    let dy = 0;
    if (k.has('a') || k.has('ArrowLeft')) dx += sp;
    if (k.has('d') || k.has('ArrowRight')) dx -= sp;
    if (k.has('w') || k.has('ArrowUp')) dy += sp;
    if (k.has('s') || k.has('ArrowDown')) dy -= sp;
    if (this.settings.edgeScroll && this.mouse.inside && !this.drag) {
      const m = 14;
      if (this.mouse.x < m) dx += sp;
      if (this.mouse.x > this.cam.w - m) dx -= sp;
      if (this.mouse.y < m) dy += sp;
      if (this.mouse.y > this.cam.h - m) dy -= sp;
    }
    if (dx || dy) {
      this.cam.pan(dx, dy);
      this.followId = null;
    }
  }

  // ------------------------------------------------------------------ selection
  private select(ids: number[], add = false) {
    if (!add) {
      this.selected.clear();
      this.selectedSq.clear();
    }
    for (const id of ids) {
      if (add && this.selected.has(id)) this.selected.delete(id);
      else this.selected.add(id);
    }
    this.lastSel = '';
    this.hudTimer = 0;
  }

  private selectSq(id: number, add = false) {
    if (!add) {
      this.selected.clear();
      this.selectedSq.clear();
    }
    this.selectedSq.add(id);
    this.lastSel = '';
    this.hudTimer = 0;
  }

  private selectedUnits(): Unit[] {
    const out: Unit[] = [];
    for (const id of this.selected) {
      const u = this.w.unit(id);
      if (u && !u.sunk && !u.escaped) out.push(u);
    }
    return out;
  }

  private controlled(): Unit[] {
    return this.selectedUnits().filter((u) => u.side === 0 && u.controllable);
  }

  // ------------------------------------------------------------------ input
  private bindInput() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    c.addEventListener('pointermove', (e) => this.onPointerMove(e));
    c.addEventListener('pointerup', (e) => this.onPointerUp(e));
    c.addEventListener('pointercancel', (e) => {
      this.touches.delete(e.pointerId);
      this.drag = null;
      this.box = null;
    });
    c.addEventListener('pointerleave', () => {
      this.mouse.inside = false;
      this.hover = null;
      this.hud.tip.classList.add('hidden');
    });
    c.addEventListener('dblclick', (e) => {
      const p = this.renderer.pick(e.offsetX, e.offsetY);
      if (p && p.kind === 'unit') {
        this.followId = p.id;
      }
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
      this.cam.zoomAt(e.offsetX, e.offsetY, f);
    }, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.mini.addEventListener('pointerdown', (e) => this.miniPointer(e));
    this.mini.addEventListener('pointermove', (e) => {
      if (e.buttons & 1) this.miniPointer(e);
    });
  }

  private miniPointer(e: PointerEvent) {
    const r = this.mini.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    this.cam.centerOn(fx * this.w.terrain.w, fy * this.w.terrain.h);
    this.followId = null;
    e.stopPropagation();
  }

  private onPointerDown(e: PointerEvent) {
    sfx.unlock();
    this.canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (this.touches.size === 2) {
        const [a, b] = [...this.touches.values()];
        this.pinch = { d: dist(a.x, a.y, b.x, b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        this.drag = null;
        if (this.longPress) clearTimeout(this.longPress);
        return;
      }
      this.drag = { x0: e.offsetX, y0: e.offsetY, button: 0, moved: false, t: performance.now() };
      const x = e.offsetX;
      const y = e.offsetY;
      this.longPress = window.setTimeout(() => {
        if (this.drag && !this.drag.moved) {
          this.drag = null;
          this.command(x, y, false);
        }
      }, 480);
      return;
    }
    this.drag = { x0: e.offsetX, y0: e.offsetY, button: e.button, moved: false, t: performance.now() };
  }

  private onPointerMove(e: PointerEvent) {
    this.mouse = { x: e.offsetX, y: e.offsetY, inside: true };
    if (e.pointerType === 'touch') {
      const prev = this.touches.get(e.pointerId);
      if (prev) this.touches.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (this.pinch && this.touches.size === 2) {
        const [a, b] = [...this.touches.values()];
        const d = dist(a.x, a.y, b.x, b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        this.cam.zoomAt(cx, cy, d / Math.max(1, this.pinch.d));
        this.cam.pan(cx - this.pinch.cx, cy - this.pinch.cy);
        this.pinch = { d, cx, cy };
        return;
      }
      if (this.drag && prev) {
        const moved = Math.hypot(e.offsetX - this.drag.x0, e.offsetY - this.drag.y0) > 8;
        if (moved) this.drag.moved = true;
        if (this.drag.moved) {
          this.cam.pan(e.offsetX - prev.x, e.offsetY - prev.y);
          this.followId = null;
        }
      }
      return;
    }
    if (this.drag) {
      const dx = e.offsetX - this.drag.x0;
      const dy = e.offsetY - this.drag.y0;
      if (!this.drag.moved && Math.hypot(dx, dy) > 5) this.drag.moved = true;
      if (this.drag.moved) {
        if (this.drag.button === 0 && this.mode === 'normal') {
          this.box = { x0: this.drag.x0, y0: this.drag.y0, x1: e.offsetX, y1: e.offsetY };
        } else if (this.drag.button === 1 || this.drag.button === 2) {
          this.cam.pan(e.movementX, e.movementY);
          this.followId = null;
        }
      }
    }
    this.hover = this.renderer.pick(e.offsetX, e.offsetY);
    this.updateTip();
  }

  private onPointerUp(e: PointerEvent) {
    if (e.pointerType === 'touch') {
      this.touches.delete(e.pointerId);
      if (this.longPress) clearTimeout(this.longPress);
      if (this.pinch) {
        if (this.touches.size < 2) this.pinch = null;
        this.drag = null;
        return;
      }
    }
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.button === 0) {
      if (this.box) {
        this.boxSelect(this.box, e.shiftKey);
        this.box = null;
        return;
      }
      if (!d.moved) this.click(e.offsetX, e.offsetY, e.shiftKey);
    } else if (d.button === 2 && !d.moved) {
      this.command(e.offsetX, e.offsetY, e.shiftKey);
    }
  }

  private boxSelect(b: NonNullable<ViewState['box']>, add: boolean) {
    const x0 = Math.min(b.x0, b.x1);
    const x1 = Math.max(b.x0, b.x1);
    const y0 = Math.min(b.y0, b.y1);
    const y1 = Math.max(b.y0, b.y1);
    const ids: number[] = [];
    for (const u of this.ownUnits()) {
      const sx = this.cam.sx(u.x);
      const sy = this.cam.sy(u.y);
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) ids.push(u.id);
    }
    if (ids.length) this.select(ids, add);
  }

  private click(sx: number, sy: number, shift: boolean) {
    const wx = this.cam.wx(sx);
    const wy = this.cam.wy(sy);
    const p = this.renderer.pick(sx, sy);
    if (this.mode !== 'normal') {
      this.modeClick(wx, wy, p);
      return;
    }
    if (!p) {
      if (!shift) this.select([]);
      return;
    }
    if (p.kind === 'sq') {
      const s = this.w.sq(p.id);
      if (s && s.side === 0) this.selectSq(p.id, shift);
      return;
    }
    const u = this.w.unit(p.id)!;
    if (u.side === 0 && u.controllable) this.select([u.id], shift);
    else this.select([u.id]);
    sfx.click();
  }

  private modeClick(wx: number, wy: number, p: ViewState['hover']) {
    const target = p && p.kind === 'unit' ? this.w.unit(p.id) : undefined;
    const enemy = target && target.side !== 0 ? target : undefined;
    if (this.mode === 'torpedo') {
      for (const u of this.controlled()) {
        if (!u.cls.torps || u.torpLoaded <= 0) continue;
        const n = this.spread >= 99 ? u.torpLoaded : this.spread;
        if (!fireTorpedoes(this.w, u, { unit: enemy, x: wx, y: wy }, n) && u.cls.sub && u.depth === 'deep') {
          this.w.msg(`${u.name} cannot fire torpedoes while deep.`, 'warn');
        }
      }
      this.setMode('normal');
    } else if (this.mode === 'strike') {
      const ids = this.pendingSq;
      const tgt = enemy ? { unit: enemy.id, x: enemy.x, y: enemy.y } : { unit: null, x: wx, y: wy };
      const sent = orderStrike(this.w, ids, tgt);
      if (sent) this.w.msg(`Strike ordered against ${enemy ? this.label(enemy) : 'the marked position'}.`, 'info');
      this.setMode('normal');
    } else if (this.mode === 'scout') {
      for (const id of this.pendingSq) orderScout(this.w, id, wx, wy);
      this.setMode('normal');
    } else if (this.mode === 'waypoint') {
      this.w.orderMove(this.controlled().map((u) => u.id), wx, wy, true);
    }
  }

  private command(sx: number, sy: number, shift: boolean) {
    if (this.mode !== 'normal') {
      this.setMode('normal');
      return;
    }
    const wx = this.cam.wx(sx);
    const wy = this.cam.wy(sy);
    const p = this.renderer.pick(sx, sy);
    const units = this.controlled();
    // aircraft selected
    if (this.selectedSq.size) {
      const ids = [...this.selectedSq];
      const t = p && p.kind === 'unit' ? this.w.unit(p.id) : undefined;
      if (t && t.side !== 0) orderStrike(this.w, ids, { unit: t.id, x: t.x, y: t.y });
      else if (t && t.side === 0) orderCap(this.w, ids, t.id);
      else for (const id of ids) orderScout(this.w, id, wx, wy);
      sfx.click();
      return;
    }
    if (!units.length) return;
    const t = p && p.kind === 'unit' ? this.w.unit(p.id) : undefined;
    if (t && t.side !== 0) {
      this.w.orderTarget(units.map((u) => u.id), t.id, true);
      this.w.msg(`${units.length > 1 ? `${units.length} ships` : units[0].name} engaging ${this.label(t)}.`, 'info');
    } else if (t && t.side === 0 && !units.includes(t)) {
      this.w.orderFollow(units.map((u) => u.id), t.id);
      this.w.msg(`${units.length > 1 ? `${units.length} ships` : units[0].name} forming on ${t.name}.`, 'info');
    } else {
      this.w.orderMove(units.map((u) => u.id), wx, wy, shift);
    }
    sfx.click();
  }

  private label(u: Unit): string {
    const c = this.w.contacts[0].get(u.id);
    return u.side === 0 || (c && c.level >= 3) ? u.name : 'the contact';
  }

  private setMode(m: CursorMode, sq: number[] = []) {
    this.mode = m;
    this.pendingSq = sq;
    const hint = this.hud.hint;
    const msgs: Record<CursorMode, string> = {
      normal: '',
      torpedo: `Torpedo attack (spread ${this.spread >= 99 ? 'all' : this.spread}): click a target or a point. Right-click or Esc cancels.`,
      strike: 'Air strike: click an enemy ship or a point to attack. Right-click or Esc cancels.',
      scout: 'Scouting: click where the aircraft should search. Right-click or Esc cancels.',
      cap: '',
      waypoint: 'Waypoints: click to add waypoints. Right-click or Esc to finish.',
    };
    hint.textContent = msgs[m];
    hint.classList.toggle('hidden', m === 'normal');
    this.canvas.style.cursor = m === 'normal' ? '' : 'crosshair';
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (this.overlayOpen) {
      if (k === 'Escape') this.closeOverlay();
      return;
    }
    this.keys.add(k === 'shift' ? 'Shift' : k);
    if (e.shiftKey) this.keys.add('Shift');
    const ids = this.controlled().map((u) => u.id);
    switch (k) {
      case ' ':
      case 'p':
        this.paused = !this.paused;
        this.buildTop();
        e.preventDefault();
        break;
      case '[':
      case ',':
        this.speedIdx = Math.max(0, this.speedIdx - 1);
        this.paused = false;
        this.buildTop();
        break;
      case ']':
      case '.':
        this.speedIdx = Math.min(TIME_STEPS.length - 1, this.speedIdx + 1);
        this.paused = false;
        this.buildTop();
        break;
      case '1': case '2': case '3': case '4': case '5':
        this.w.orderSpeed(ids, Number(k) - 1);
        break;
      case 'q':
        for (const u of this.controlled()) this.w.orderSpeed([u.id], u.speedSet - 1);
        break;
      case 'e':
        for (const u of this.controlled()) this.w.orderSpeed([u.id], u.speedSet + 1);
        break;
      case 'z':
        this.w.orderHeading(ids, -Math.PI / 12);
        break;
      case 'c':
        this.w.orderHeading(ids, Math.PI / 12);
        break;
      case 't':
        if (this.controlled().some((u) => u.cls.torps && u.torpLoaded > 0)) this.setMode(this.mode === 'torpedo' ? 'normal' : 'torpedo');
        break;
      case 'y':
        this.spread = this.spread === 1 ? 2 : this.spread === 2 ? 4 : this.spread === 4 ? 99 : 1;
        if (this.mode === 'torpedo') this.setMode('torpedo');
        this.lastSel = '';
        break;
      case 'h': {
        const us = this.controlled();
        const hold = !us.every((u) => u.holdFire);
        this.w.orderHoldFire(ids, hold);
        break;
      }
      case 'm':
        this.w.orderSmoke(ids);
        break;
      case 'r':
        for (const u of this.controlled()) if (u.cls.sub) this.w.setDepth(u, u.depthOrder === 'deep' ? 'periscope' : 'surface');
        break;
      case 'f':
        for (const u of this.controlled()) if (u.cls.sub) this.w.setDepth(u, u.depthOrder === 'surface' ? 'periscope' : 'deep');
        break;
      case 'b':
        this.carrierStrikeMode();
        break;
      case 'l':
        this.settings.labels = !this.settings.labels;
        break;
      case 'v': {
        const u = this.controlled()[0];
        this.followId = this.followId === null && u ? u.id : null;
        break;
      }
      case 'Tab': {
        e.preventDefault();
        const own = this.ownUnits();
        if (!own.length) break;
        const cur = own.findIndex((u) => this.selected.has(u.id));
        const next = own[(cur + 1) % own.length];
        this.select([next.id]);
        this.cam.centerOn(next.x, next.y);
        break;
      }
      case 'Home':
      case 'g': {
        const u = this.selectedUnits()[0];
        if (u) this.cam.centerOn(u.x, u.y);
        break;
      }
      case '=':
      case '+':
        this.cam.zoomAt(this.cam.w / 2, this.cam.h / 2, 1.25);
        break;
      case '-':
        this.cam.zoomAt(this.cam.w / 2, this.cam.h / 2, 0.8);
        break;
      case 'Escape':
        if (this.mode !== 'normal') this.setMode('normal');
        else if (this.selected.size || this.selectedSq.size) this.select([]);
        else this.openMenu();
        break;
      case 'F1':
      case '?':
      case '/':
        e.preventDefault();
        this.openHelp();
        break;
    }
    this.lastSel = '';
    this.hudTimer = Math.min(this.hudTimer, 0.05);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    this.keys.delete(k);
    if (!e.shiftKey) this.keys.delete('Shift');
  };

  private carrierStrikeMode() {
    const ids: number[] = [];
    for (const u of this.controlled()) {
      for (const sid of u.hangar) {
        const s = this.w.sq(sid);
        if (s && s.state === 'deck' && s.n > 0 && s.def.role !== 'fighter' && s.def.role !== 'scout') ids.push(sid);
      }
    }
    if (ids.length) this.setMode('strike', ids);
    else this.w.msg('No strike aircraft are ready on the selected carriers.', 'warn');
  }

  // ------------------------------------------------------------------ HUD
  private onHudPointer(e: PointerEvent) {
    sfx.unlock();
    const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    e.stopPropagation();
    if (!t) {
      const row = (e.target as HTMLElement).closest('[data-unit]') as HTMLElement | null;
      if (row) {
        const id = Number(row.dataset.unit);
        const u = this.w.unit(id);
        if (u) {
          if (e.detail >= 2 || e.altKey) this.cam.centerOn(u.x, u.y);
          this.select([id], e.shiftKey);
          if (!e.shiftKey && performance.now() - (row as unknown as { _t?: number })._t! < 350) this.cam.centerOn(u.x, u.y);
          (row as unknown as { _t?: number })._t = performance.now();
        }
      }
      const msg = (e.target as HTMLElement).closest('[data-x]') as HTMLElement | null;
      if (msg) this.cam.centerOn(Number(msg.dataset.x), Number(msg.dataset.y));
      return;
    }
    e.preventDefault();
    sfx.click();
    this.action(t.dataset.act!, t.dataset.v, t.dataset.id ? Number(t.dataset.id) : undefined);
  }

  private action(act: string, v?: string, id?: number) {
    const ids = this.controlled().map((u) => u.id);
    switch (act) {
      case 'pause':
        this.paused = !this.paused;
        this.buildTop();
        break;
      case 'speed':
        this.speedIdx = Number(v);
        this.paused = false;
        this.buildTop();
        break;
      case 'menu':
        this.openMenu();
        break;
      case 'help':
        this.openHelp();
        break;
      case 'objectives':
        this.hud.obj.classList.toggle('collapsed');
        break;
      case 'spd':
        this.w.orderSpeed(ids, Number(v));
        break;
      case 'turn':
        this.w.orderHeading(ids, (Number(v) * Math.PI) / 180);
        break;
      case 'hold': {
        const hold = !this.controlled().every((u) => u.holdFire);
        this.w.orderHoldFire(ids, hold);
        break;
      }
      case 'smoke':
        this.w.orderSmoke(ids);
        break;
      case 'torp':
        this.setMode(this.mode === 'torpedo' ? 'normal' : 'torpedo');
        break;
      case 'spread':
        this.spread = Number(v);
        if (this.mode === 'torpedo') this.setMode('torpedo');
        break;
      case 'depth':
        this.w.orderDepth(ids, v as 'surface' | 'periscope' | 'deep');
        break;
      case 'form': {
        const us = this.controlled();
        if (us.length > 1) this.w.orderFollow(us.slice(1).map((u) => u.id), us[0].id);
        break;
      }
      case 'waypoints':
        this.setMode(this.mode === 'waypoint' ? 'normal' : 'waypoint');
        break;
      case 'center': {
        const u = this.selectedUnits()[0];
        if (u) this.cam.centerOn(u.x, u.y);
        break;
      }
      case 'follow': {
        const u = this.selectedUnits()[0];
        this.followId = this.followId === null && u ? u.id : null;
        break;
      }
      case 'cancelTarget':
        this.w.orderTarget(ids, null, false);
        for (const u of this.controlled()) u.engage = null;
        break;
      case 'sq-strike':
        if (id !== undefined) this.setMode('strike', [id]);
        break;
      case 'sq-scout':
        if (id !== undefined) this.setMode('scout', [id]);
        break;
      case 'sq-cap': {
        const s = this.w.sq(id);
        if (s) orderCap(this.w, [s.id], s.home ?? this.controlled()[0]?.id ?? -1);
        break;
      }
      case 'sq-recall':
        if (id !== undefined) orderRecall(this.w, [id]);
        break;
      case 'sq-select':
        if (id !== undefined) this.selectSq(id);
        break;
      case 'cv-strike':
        this.carrierStrikeMode();
        break;
      case 'cv-autocap':
        for (const u of this.controlled()) if (u.hangar.length) u.autoCap = !u.autoCap;
        break;
      case 'end':
        this.hud.banner.classList.add('hidden');
        finishWithRating(this.w);
        break;
      case 'dismiss':
        this.hud.banner.classList.add('hidden');
        break;
      case 'resume':
        this.closeOverlay();
        break;
      case 'restart':
        this.closeOverlay();
        this.cb.onRestart?.();
        break;
      case 'abandon':
        this.closeOverlay();
        if (this.w.victoryReady) finishWithRating(this.w);
        else this.w.finish('defeat', 'The mission was abandoned.');
        break;
      case 'quit':
        this.cb.onQuit();
        break;
      case 'debrief':
        this.cb.onFinish(this.w);
        break;
      case 'toggle-evade':
        this.settings.autoEvade = !this.settings.autoEvade;
        this.w.autoEvade = this.settings.autoEvade;
        this.openMenu();
        break;
      case 'toggle-slow':
        this.settings.autoSlow = !this.settings.autoSlow;
        this.openMenu();
        break;
      case 'toggle-sound':
        this.settings.muted = !this.settings.muted;
        sfx.setMuted(this.settings.muted);
        this.openMenu();
        break;
    }
    this.lastSel = '';
    this.hudTimer = 0;
  }

  private buildTop() {
    const m = this.w.mission;
    const btns = TIME_STEPS.map((s, i) => `<button class="tbtn ${!this.paused && this.speedIdx === i ? 'on' : ''}" data-act="speed" data-v="${i}" title="${s * BASE_RATE} game seconds per second">${s}×</button>`).join('');
    this.hud.top.innerHTML = `
      <div class="ht-left"><div class="ht-title">${esc(m.title)}</div><div class="ht-sub">${esc(m.place)}</div></div>
      <div class="ht-center">
        <span class="clock" data-clock>${fmtClock(this.w.time)}</span>
        <button class="tbtn ${this.paused ? 'on pause' : ''}" data-act="pause" title="Pause (Space)">${this.paused ? '▶' : '❚❚'}</button>${btns}
      </div>
      <div class="ht-right">
        <button class="tbtn" data-act="objectives" title="Objectives">Objectives</button>
        <button class="tbtn" data-act="help" title="Controls (F1)">?</button>
        <button class="tbtn" data-act="menu" title="Menu (Esc)">Menu</button>
      </div>`;
  }

  private updateHud() {
    const clock = this.hud.top.querySelector('[data-clock]');
    if (clock) {
      const left = this.w.timeLimit - this.w.time;
      clock.textContent = `${fmtClock(this.w.time)}${left < 600 && left > 0 ? `  (${Math.ceil(left / 60)} min left)` : ''}`;
      clock.classList.toggle('warn', left < 600);
    }
    this.updateFleet();
    this.updateObjectives();
    this.updateLog();
    this.updateSel();
    if (this.w.victoryReady && !this.bannerShown && !this.w.result) {
      this.bannerShown = true;
      const b = this.hud.banner;
      b.innerHTML = `<span>Primary objectives achieved.</span><button class="btn small primary" data-act="end">End mission</button><button class="btn small" data-act="dismiss">Fight on</button>`;
      b.classList.remove('hidden');
    }
  }

  private statusIcons(u: Unit): string {
    const s: string[] = [];
    if (u.fires) s.push(`<i class="ico fire" title="Fires">${u.fires > 1 ? u.fires : ''}</i>`);
    if (u.flood) s.push('<i class="ico flood" title="Flooding"></i>');
    if (u.crits.engine > 0) s.push('<i class="ico eng" title="Engines damaged"></i>');
    if (u.crits.rudder > 0 || u.rudderJam) s.push('<i class="ico rud" title="Steering damaged"></i>');
    if (u.cls.sub && u.depth !== 'surface') s.push(`<i class="ico sub" title="${u.depth}"></i>`);
    if (u.holdFire) s.push('<i class="ico hold" title="Holding fire"></i>');
    return s.join('');
  }

  private updateFleet() {
    const own = this.w.units.filter((u) => u.side === 0 && u.controllable);
    const allies = this.w.units.filter((u) => u.side === 0 && !u.controllable);
    const sig = own.map((u) => `${u.id}:${Math.round((u.hp / u.maxHp) * 50)}:${u.sunk}:${u.escaped}:${u.fires}:${u.flood}:${u.depth}:${this.selected.has(u.id)}:${u.holdFire}`).join('|') +
      allies.map((u) => `${u.sunk}${u.escaped}`).join('');
    if (sig === this.lastFleet) return;
    this.lastFleet = sig;
    const row = (u: Unit) => {
      const f = clamp(u.hp / u.maxHp, 0, 1);
      const cls = u.sunk ? 'sunk' : u.escaped ? 'escaped' : this.selected.has(u.id) ? 'sel' : '';
      return `<div class="fl-row ${cls}" data-unit="${u.id}" title="${esc(u.cls.name)}-class ${esc(TYPE_NAMES[u.cls.type].toLowerCase())}">
        <span class="badge t-${u.cls.type}">${u.cls.type}</span><span class="nm">${esc(u.name)}</span>
        <span class="hp"><i style="width:${(f * 100).toFixed(0)}%;background:${f > 0.6 ? '#7ddf7a' : f > 0.3 ? '#ffc857' : '#ff5e5e'}"></i></span>
        <span class="st">${u.sunk ? 'sunk' : u.escaped ? 'safe' : this.statusIcons(u)}</span></div>`;
    };
    let html = `<div class="ph">Task force</div>${own.map(row).join('')}`;
    if (allies.length) {
      const alive = allies.filter((u) => !u.sunk && !u.escaped).length;
      const safe = allies.filter((u) => u.escaped).length;
      const lost = allies.filter((u) => u.sunk).length;
      html += `<div class="ph">Under escort</div><div class="fl-sum">${alive} at sea · ${safe} safe · ${lost} lost</div>`;
    }
    this.hud.fleet.innerHTML = html;
  }

  private updateObjectives() {
    const objs = this.w.objectives;
    const sig = objs.map((o) => `${o.status}:${Math.floor(o.progress)}`).join('|');
    if (sig === this.lastObj) return;
    this.lastObj = sig;
    const fmt = (o: (typeof objs)[number]) => {
      let prog = '';
      const d = o.def;
      if (o.status === 'active') {
        if (d.kind === 'destroy' || d.kind === 'damage' || d.kind === 'reach' || d.kind === 'shootdown') prog = ` (${Math.floor(o.progress)}/${o.needed})`;
        if (d.kind === 'tonnage') prog = ` (${Math.round(o.progress).toLocaleString()}/${o.needed.toLocaleString()} t)`;
        if (d.kind === 'survive') prog = ` (${Math.max(0, Math.ceil((o.needed - o.progress) / 60))} min)`;
        if (d.kind === 'protect' && d.maxLoss) prog = ` (lost ${o.progress}/${d.maxLoss})`;
      }
      const mark = o.status === 'done' ? '✔' : o.status === 'failed' ? '✖' : '○';
      return `<div class="ob ${o.status} ${d.bonus ? 'bonus' : ''}"><span class="mk">${mark}</span><span>${d.bonus ? '<em>Bonus:</em> ' : ''}${esc(d.text)}${prog}</span></div>`;
    };
    this.hud.obj.innerHTML = `<div class="ph">Objectives</div>${objs.map(fmt).join('')}`;
  }

  private updateLog() {
    const log = this.w.log;
    if (this.logSeen === log.length) return;
    const start = Math.max(0, log.length - 7);
    this.logSeen = log.length;
    this.hud.log.innerHTML = log
      .slice(start)
      .map((m) => `<div class="lg ${m.kind}" ${m.x !== undefined ? `data-x="${m.x}" data-y="${m.y}"` : ''}><span class="t">${fmtClock(m.t).slice(0, 5)}</span>${esc(m.text)}</div>`)
      .join('');
  }

  private updateSel() {
    const el2 = this.hud.sel;
    const units = this.selectedUnits();
    const sqs = [...this.selectedSq].map((id) => this.w.sq(id)).filter((s): s is Squadron => !!s && s.state !== 'gone' && s.n > 0);
    let html = '';
    if (sqs.length) html = this.squadronPanel(sqs);
    else if (units.length === 1) html = this.unitPanel(units[0]);
    else if (units.length > 1) html = this.multiPanel(units);
    if (html === this.lastSel) return;
    this.lastSel = html;
    el2.innerHTML = html;
    el2.classList.toggle('hidden', !html);
  }

  private unitPanel(u: Unit): string {
    const w = this.w;
    const own = u.side === 0;
    const c = w.contacts[0].get(u.id);
    if (!own && !(c && c.level >= 3)) {
      return `<div class="sel-head"><div><div class="sel-name">Unidentified contact</div><div class="sel-cls">${c?.sonar ? 'Sonar contact' : 'Surface contact'} · course ${fmtBearing(u.h)} · ${(u.v / KN).toFixed(0)} kn</div></div></div>
        <div class="sel-note">Close to visual range, or bring a scout plane overhead, to identify it.</div>`;
    }
    const nat = NATIONS[u.nation];
    const f = clamp(u.hp / u.maxHp, 0, 1);
    const stars = u.vet > 0 ? `<span class="stars" title="${VET_NAMES[u.vet]}">${'★'.repeat(u.vet)}</span>` : '';
    const chips: string[] = [];
    if (u.fires) chips.push(`<span class="chip bad">Fire ×${u.fires}</span>`);
    if (u.flood) chips.push(`<span class="chip bad">Flooding ×${u.flood}</span>`);
    if (u.crits.engine > 0 && !u.disabled) chips.push('<span class="chip warn">Engines</span>');
    if (u.disabled) chips.push('<span class="chip bad">Dead in the water</span>');
    if (u.crits.rudder > 0) chips.push('<span class="chip warn">Steering</span>');
    if (u.rudderJam) chips.push('<span class="chip bad">Rudder jammed</span>');
    if (u.crits.fc > 0) chips.push('<span class="chip warn">Fire control</span>');
    if (u.crits.radar > 0) chips.push('<span class="chip warn">Radar</span>');
    if (u.crits.deck > 0) chips.push('<span class="chip warn">Flight deck</span>');
    if (u.smokeOn > 0) chips.push('<span class="chip">Making smoke</span>');
    if (!u.alert) chips.push('<span class="chip">Not at action stations</span>');
    if (u.evadeUntil > w.time) chips.push('<span class="chip">Evading torpedoes</span>');
    const head = `<div class="sel-head">${flagSvg(u.nation, 28)}<div><div class="sel-name">${esc(u.name)} ${stars}</div>
      <div class="sel-cls">${esc(u.cls.name)}-class ${esc(TYPE_NAMES[u.cls.type].toLowerCase())} · ${esc(nat.navy)}</div></div>
      <div class="sel-hp"><div class="hpbar"><i style="width:${(f * 100).toFixed(0)}%;background:${f > 0.6 ? '#7ddf7a' : f > 0.3 ? '#ffc857' : '#ff5e5e'}"></i></div><span>${(f * 100).toFixed(0)}%</span></div></div>
      ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}`;
    if (!own) {
      const guns = u.mounts.filter((m) => !m.def.sec);
      const g = guns[0]?.gun;
      return `${head}<div class="sel-info">Course ${fmtBearing(u.h)} · ${(u.v / KN).toFixed(0)} kn${g ? ` · ${guns.length}×${guns[0].def.n} ${esc(g.name)}` : ''}</div><div class="sel-note">${esc(u.cls.notes)}</div>`;
    }
    if (!u.controllable) {
      return `${head}<div class="sel-info">Course ${fmtBearing(u.h)} · ${(u.v / KN).toFixed(1)} kn · ${isMerchantType(u.cls.type) ? `${u.cls.tons.toLocaleString()} GRT` : ''}</div><div class="sel-note">Under convoy orders. Protect her.</div>`;
    }
    const structure = isStructureType(u.cls.type);
    let body = '';
    if (!structure) {
      const spd = SPEED_NAMES.map((n, i) => `<button class="sbtn ${u.speedSet === i ? 'on' : ''}" data-act="spd" data-v="${i}" title="Key ${i + 1}">${n}</button>`).join('');
      body += `<div class="row"><span class="lbl">Engines</span>${spd}<span class="val">${(u.v / KN).toFixed(1)} kn · ${fmtBearing(u.h)}</span>
        <button class="sbtn" data-act="turn" data-v="-15" title="Come left 15° (Z)">◀</button><button class="sbtn" data-act="turn" data-v="15" title="Come right 15° (C)">▶</button></div>`;
    }
    const main = u.mounts.filter((m) => !m.def.sec);
    const sec = u.mounts.filter((m) => m.def.sec);
    const tgt = w.unit(u.target) ?? w.unit(u.autoTarget);
    const tc = tgt ? w.contacts[0].get(tgt.id) : undefined;
    if (main.length) {
      const g = main[0].gun;
      const alive = main.filter((m) => !m.dead).length;
      const tInfo = tgt && !tgt.sunk && tc && tc.level >= 2 && w.time - (u.lastFire ?? -1e9) < 30
        ? `→ ${esc(this.label(tgt))} ${fmtKm(dist(u.x, u.y, tgt.x, tgt.y))}${u.fc.tid === tgt.id ? ` · solution ${(u.fc.q * 100).toFixed(0)}%` : ''}`
        : u.target ? `→ ${esc(this.label(tgt!))}` : '';
      body += `<div class="row"><span class="lbl">Guns</span><span class="val">${alive}/${main.length}×${main[0].def.n} ${esc(g.name)} · ${fmtKm(g.range)}${sec.length ? ` · ${sec.length} secondary` : ''} ${tInfo}</span>
        <button class="sbtn ${u.holdFire ? 'on warn' : ''}" data-act="hold" title="Hold fire (H)">${u.holdFire ? 'Holding fire' : 'Hold fire'}</button>
        ${u.target !== null || u.engage !== null ? '<button class="sbtn" data-act="cancelTarget">Clear target</button>' : ''}</div>`;
    }
    if (u.cls.torps) {
      const td = TORPS[u.cls.torps.t];
      const reload = u.torpTimer > 0 ? ` · reloading ${fmtClock(u.torpTimer).slice(3)}` : '';
      const spreads = [1, 2, 4, 99].map((s) => `<button class="sbtn ${this.spread === s ? 'on' : ''}" data-act="spread" data-v="${s}">${s === 99 ? 'All' : s}</button>`).join('');
      body += `<div class="row"><span class="lbl">Torpedoes</span><span class="val">${u.torpLoaded}/${u.cls.torps.tubes} ${esc(td.name)}${u.torpReloads ? ` +${u.torpReloads}` : ''} · ${fmtKm(td.range)} at ${td.speed} kn${reload}</span>
        ${spreads}<button class="sbtn ${this.mode === 'torpedo' ? 'on' : ''}" data-act="torp" ${u.torpLoaded ? '' : 'disabled'} title="Torpedo attack (T)">Fire…</button></div>`;
    }
    if (u.cls.sub) {
      const depths = (['surface', 'periscope', 'deep'] as const).map((d) => `<button class="sbtn ${u.depthOrder === d ? 'on' : ''} ${w.env.shallow && d === 'deep' ? 'dis' : ''}" data-act="depth" data-v="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('');
      const changing = u.depth !== u.depthOrder ? ` → ${u.depthOrder} in ${Math.ceil(u.depthTimer)}s` : '';
      body += `<div class="row"><span class="lbl">Depth</span>${depths}<span class="val">${u.depth}${changing} · battery ${(u.battery * 100).toFixed(0)}%</span></div>`;
    }
    const extra: string[] = [];
    if (u.cls.dc) extra.push(`Depth charges: ${Math.floor(u.dcLeft)} patterns${u.cls.hedgehog ? ' + Hedgehog' : ''}`);
    if (u.cls.sonar) extra.push(`Sonar ${fmtKm(u.cls.sonar)}`);
    if (u.radar) extra.push(`Radar ${fmtKm(u.radar)}${u.fcRadar ? ' (fire control)' : ''}`);
    if (u.cls.hydro) extra.push(`Hydrophones ${fmtKm(u.cls.hydro)}`);
    if (u.cls.aa) extra.push(`AA ${u.cls.aa}`);
    const smokeBtn = u.cls.smoke ? `<button class="sbtn ${u.smokeOn > 0 ? 'on' : ''}" data-act="smoke" ${u.smokeLeft <= 0 && u.smokeOn <= 0 ? 'disabled' : ''} title="Smoke screen (M)">Smoke (${u.smokeLeft})</button>` : '';
    body += `<div class="row small"><span class="val">${extra.join(' · ')}</span>${smokeBtn}<button class="sbtn" data-act="follow" title="Camera follows (V)">${this.followId === u.id ? 'Unfollow' : 'Follow'}</button></div>`;
    if (u.hangar.length) body += this.airPanel(u);
    return head + body;
  }

  private airPanel(u: Unit): string {
    const w = this.w;
    const rows = u.hangar
      .map((id) => w.sq(id))
      .filter((s): s is Squadron => !!s && s.state !== 'gone' && s.n > 0)
      .map((s) => {
        let st: string;
        switch (s.state) {
          case 'deck':
            st = s.ready > w.time ? `rearming ${fmtClock(s.ready - w.time).slice(3)}` : 'ready on deck';
            break;
          case 'queued':
            st = `launching (${s.next})`;
            break;
          case 'outbound':
            st = 'strike outbound';
            break;
          case 'attack':
            st = 'attacking';
            break;
          case 'return':
            st = 'returning';
            break;
          case 'cap':
            st = 'combat air patrol';
            break;
          case 'intercept':
            st = 'intercepting';
            break;
          case 'escort':
            st = 'escorting strike';
            break;
          case 'scout':
            st = 'scouting';
            break;
          default:
            st = s.state;
        }
        const role = s.def.role;
        const canStrike = role !== 'fighter' && role !== 'scout';
        const btns = [
          canStrike ? `<button class="sbtn" data-act="sq-strike" data-id="${s.id}">Strike</button>` : '',
          role === 'fighter' ? `<button class="sbtn" data-act="sq-cap" data-id="${s.id}">CAP</button>` : '',
          role === 'fighter' && s.state === 'deck' ? `<button class="sbtn" data-act="sq-strike" data-id="${s.id}" title="Fighter sweep">Sweep</button>` : '',
          `<button class="sbtn" data-act="sq-scout" data-id="${s.id}">Scout</button>`,
          s.state !== 'deck' ? `<button class="sbtn" data-act="sq-recall" data-id="${s.id}">Recall</button>` : '',
          airborne(s) ? `<button class="sbtn" data-act="sq-select" data-id="${s.id}">Select</button>` : '',
        ].join('');
        return `<div class="sq-row"><span class="sq-n">${s.n}/${s.max}</span><span class="sq-name">${esc(s.def.name)} <em>${esc(ROLE_NAMES[role].toLowerCase())}</em></span><span class="sq-st">${st}</span>${btns}</div>`;
      })
      .join('');
    const blocked = u.crits.deck > 0 ? '<span class="chip bad">deck damaged</span>' : '';
    return `<div class="air"><div class="row"><span class="lbl">Air group</span>
      <button class="sbtn" data-act="cv-strike" title="Launch all ready bombers (B)">Launch strike…</button>
      <button class="sbtn ${u.autoCap ? 'on' : ''}" data-act="cv-autocap" title="Keep a fighter patrol overhead">Auto CAP</button>${blocked}</div>${rows || '<div class="sel-note">No aircraft remaining.</div>'}</div>`;
  }

  private multiPanel(us: Unit[]): string {
    const own = us.filter((u) => u.side === 0 && u.controllable);
    if (!own.length) return '';
    const chips = own
      .map((u) => {
        const f = clamp(u.hp / u.maxHp, 0, 1);
        return `<span class="mchip" data-unit="${u.id}"><span class="badge t-${u.cls.type}">${u.cls.type}</span>${esc(u.name)}<i class="mhp" style="width:${(f * 100).toFixed(0)}%"></i></span>`;
      })
      .join('');
    const spd = SPEED_NAMES.map((n, i) => `<button class="sbtn" data-act="spd" data-v="${i}">${n}</button>`).join('');
    const torps = own.some((u) => u.cls.torps && u.torpLoaded > 0);
    const smoke = own.some((u) => u.cls.smoke);
    const hold = own.every((u) => u.holdFire);
    const subs = own.some((u) => u.cls.sub);
    return `<div class="sel-head"><div><div class="sel-name">${own.length} ships selected</div><div class="sel-cls">Orders apply to all of them. Right-click water to move in formation, an enemy to engage, a friendly ship to form on her.</div></div></div>
      <div class="mchips">${chips}</div>
      <div class="row"><span class="lbl">Engines</span>${spd}<button class="sbtn" data-act="turn" data-v="-15">◀</button><button class="sbtn" data-act="turn" data-v="15">▶</button></div>
      <div class="row"><button class="sbtn" data-act="form">Form on ${esc(own[0].name)}</button>
      <button class="sbtn ${hold ? 'on warn' : ''}" data-act="hold">${hold ? 'Holding fire' : 'Hold fire'}</button>
      ${torps ? '<button class="sbtn" data-act="torp">Torpedoes…</button>' : ''}
      ${smoke ? '<button class="sbtn" data-act="smoke">Smoke</button>' : ''}
      ${subs ? '<button class="sbtn" data-act="depth" data-v="surface">Surface</button><button class="sbtn" data-act="depth" data-v="periscope">Periscope</button><button class="sbtn" data-act="depth" data-v="deep">Deep</button>' : ''}</div>`;
  }

  private squadronPanel(sqs: Squadron[]): string {
    const s = sqs[0];
    const home = this.w.unit(s.home);
    const fuel = Math.max(0, s.fuel);
    return `<div class="sel-head">${flagSvg(s.def.nation, 28)}<div><div class="sel-name">${esc(s.name)}</div>
      <div class="sel-cls">${s.n}/${s.max} ${esc(AIRCRAFT[s.def.id].name)} · ${esc(ROLE_NAMES[s.def.role].toLowerCase())}${home ? ` · from ${esc(home.name)}` : ''}</div></div></div>
      <div class="row"><span class="val">State: ${s.state} · fuel ${fmtClock(fuel).slice(0, 5)} · radius ${s.def.radius} km</span></div>
      <div class="row">${s.def.role !== 'fighter' && s.def.role !== 'scout' ? `<button class="sbtn" data-act="sq-strike" data-id="${s.id}">Strike…</button>` : ''}
      <button class="sbtn" data-act="sq-scout" data-id="${s.id}">Patrol…</button>
      <button class="sbtn" data-act="sq-recall" data-id="${s.id}">Recall</button></div>
      <div class="sel-note">Right-click an enemy to attack it, a friendly ship to cover her, or the sea to patrol there.</div>`;
  }

  private updateTip() {
    const tip = this.hud.tip;
    const h = this.hover;
    if (!h) {
      tip.classList.add('hidden');
      return;
    }
    let html = '';
    if (h.kind === 'unit') {
      const u = this.w.unit(h.id);
      if (!u) return;
      const c = this.w.contacts[0].get(u.id);
      if (u.side === 0 || (c && c.level >= 3)) {
        html = `<b>${esc(u.name)}</b><br>${esc(u.cls.name)}-class ${esc(TYPE_NAMES[u.cls.type].toLowerCase())}<br>${Math.round((u.hp / u.maxHp) * 100)}% · ${(u.v / KN).toFixed(0)} kn · ${Math.round(toBearing(u.h))}°`;
      } else {
        html = `<b>Unidentified contact</b><br>${c?.sonar ? 'sonar' : 'surface'} · ${(u.v / KN).toFixed(0)} kn`;
      }
      const sel = this.controlled()[0];
      if (sel && sel.id !== u.id) html += `<br><span class="dim">${fmtKm(dist(sel.x, sel.y, u.x, u.y))} from ${esc(sel.name)}</span>`;
    } else {
      const s = this.w.sq(h.id);
      if (!s) return;
      html = `<b>${esc(s.name)}</b><br>${s.n} ${esc(s.def.name)} · ${s.state}`;
    }
    tip.innerHTML = html;
    tip.style.left = `${this.mouse.x + 16}px`;
    tip.style.top = `${this.mouse.y + 14}px`;
    tip.classList.remove('hidden');
  }

  private drawMinimap() {
    const ctx = this.miniCtx;
    const W = this.mini.width;
    const H = this.mini.height;
    const w = this.w;
    const sx = W / w.terrain.w;
    const sy = H / w.terrain.h;
    ctx.fillStyle = '#0d2a40';
    ctx.fillRect(0, 0, W, H);
    const timg = (this.renderer as unknown as { terrain: { canvas: HTMLCanvasElement } }).terrain;
    if (w.terrain.hasLand) ctx.drawImage(timg.canvas, 0, 0, W, H);
    for (const z of w.zones) {
      if (z.hidden) continue;
      ctx.strokeStyle = z.kind === 'exit' ? 'rgba(120,230,150,0.8)' : z.kind === 'mine' ? 'rgba(255,110,90,0.7)' : 'rgba(255,210,110,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(z.x * sx, z.y * sy, Math.max(3, z.r * sx), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const u of w.units) {
      if (u.sunk || u.escaped) continue;
      let col: string;
      if (u.side === 0) col = u.controllable ? (this.selected.has(u.id) ? '#b6ffc6' : '#7fc4ff') : '#9ee6c3';
      else {
        const c = w.contacts[0].get(u.id);
        if (!c || c.level < 2) continue;
        col = '#ff6b5e';
      }
      ctx.fillStyle = col;
      const r = isCarrierType(u.cls.type) || u.cls.type === 'BB' ? 4 : 3;
      ctx.fillRect(u.x * sx - r / 2, u.y * sy - r / 2, r, r);
    }
    for (const s of w.squadrons) {
      if (!airborne(s) || s.n <= 0) continue;
      if (s.side !== 0 && !w.airSeen[0].has(s.id)) continue;
      ctx.fillStyle = s.side === 0 ? '#d6ecff' : '#ffb0a5';
      ctx.fillRect(s.x * sx - 1, s.y * sy - 1, 2, 2);
    }
    const v = this.cam.view();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(v.x0 * sx, v.y0 * sy, (v.x1 - v.x0) * sx, (v.y1 - v.y0) * sy);
  }

  // ------------------------------------------------------------------ overlays
  private openMenu() {
    this.overlayOpen = 'menu';
    const o = this.hud.overlay;
    o.innerHTML = `<div class="dialog">
      <h2>Paused</h2>
      <button class="btn primary" data-act="resume">Resume</button>
      ${this.cb.onRestart ? '<button class="btn" data-act="restart">Restart mission</button>' : ''}
      <button class="btn" data-act="abandon">${this.w.victoryReady ? 'End mission (victory)' : 'Abandon mission'}</button>
      <div class="opts">
        <button class="btn small ${this.settings.autoEvade ? 'on' : ''}" data-act="toggle-evade">Auto-evade torpedoes: ${this.settings.autoEvade ? 'on' : 'off'}</button>
        <button class="btn small ${this.settings.autoSlow ? 'on' : ''}" data-act="toggle-slow">Slow time on contact: ${this.settings.autoSlow ? 'on' : 'off'}</button>
        <button class="btn small" data-act="toggle-sound">Sound: ${this.settings.muted ? 'off' : 'on'}</button>
      </div>
      <button class="btn ghost" data-act="quit">Quit to menu</button>
    </div>`;
    o.classList.remove('hidden');
  }

  private openHelp() {
    this.overlayOpen = 'help';
    const o = this.hud.overlay;
    o.innerHTML = `<div class="dialog wide help">
      <h2>Controls</h2>
      <div class="cols">
      <div><h3>Mouse</h3>
      <p><b>Left-click</b> select a ship · <b>drag</b> box-select · <b>Shift</b> add to selection</p>
      <p><b>Right-click</b> the sea to move there (Shift queues waypoints), an enemy to engage her, a friendly ship to form on her</p>
      <p><b>Right-drag</b> or <b>middle-drag</b> to pan · <b>wheel</b> to zoom · <b>double-click</b> follows a ship</p>
      <p>On a touchscreen: tap selects, drag pans, pinch zooms, <b>press and hold</b> gives an order.</p>
      <h3>Time</h3><p><b>Space</b> pause · <b>[ ]</b> slower/faster · the clock shows game time</p></div>
      <div><h3>Ship orders</h3>
      <p><b>1–5</b> Stop · 1/3 · 2/3 · Full · Flank &nbsp; <b>Q/E</b> slower/faster</p>
      <p><b>Z/C</b> come left/right 15° · <b>H</b> hold fire · <b>M</b> smoke screen</p>
      <p><b>T</b> torpedo attack · <b>Y</b> cycle spread size</p>
      <p><b>R/F</b> submarine shallower/deeper</p>
      <p><b>B</b> launch a carrier strike · <b>Tab</b> next ship · <b>G</b> centre · <b>V</b> follow · <b>L</b> labels · <b>WASD</b> pan</p></div>
      <div><h3>Reading the sea</h3>
      <p><span class="sw cy"></span> Cyan dashed lines are <b>hydrophone bearings</b>: something is out there on that line. Two bearings from different ships cross to give a <b>bearing fix</b>.</p>
      <p><span class="sw pu"></span> Purple lines are <b>HF/DF</b> bearings on U-boat radio traffic.</p>
      <p><span class="sw ye"></span> Yellow diamonds are unidentified or lost contacts. Get closer or send aircraft to identify them.</p>
      <p>Gunnery improves with each salvo on the same target (the <b>solution</b>); it degrades when either ship turns hard. Torpedoes run straight: aim ahead of a moving target.</p>
      <p>Night, fog and smoke cut visual range. Radar ignores darkness and smoke.</p></div>
      </div>
      <button class="btn primary" data-act="resume">Back to battle</button></div>`;
    o.classList.remove('hidden');
  }

  private closeOverlay() {
    this.overlayOpen = null;
    this.hud.overlay.classList.add('hidden');
    this.hud.overlay.innerHTML = '';
  }

  private showResult() {
    this.resultShown = true;
    const r = this.w.result!;
    const win = r.outcome !== 'defeat';
    if (win) sfx.victory();
    else sfx.defeat();
    const title = r.outcome === 'decisive' ? 'Decisive Victory' : r.outcome === 'victory' ? 'Victory' : r.outcome === 'marginal' ? 'Marginal Victory' : 'Defeat';
    this.overlayOpen = 'result';
    const o = this.hud.overlay;
    o.innerHTML = `<div class="dialog result ${win ? 'win' : 'lose'}"><div class="res-title">${title}</div><p>${esc(r.reason)}</p>
      <button class="btn primary" data-act="debrief">Continue to debrief</button></div>`;
    o.classList.remove('hidden');
  }

  private showStartHints() {
    if (!this.settings.hints || !this.hints.length) return;
    let i = 0;
    for (const h of this.hints) {
      setTimeout(() => this.w.msg(h, 'info'), 400 + i * 2500);
      i++;
    }
  }
}
