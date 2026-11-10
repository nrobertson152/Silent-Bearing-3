// Title screen, with a battle fought out by the computer behind the menu.

import { CAMPAIGNS, findMission } from '../../data/campaigns';
import { lastNation, loadCampaign } from '../../campaign/state';
import { BattleRenderer, type ViewState } from '../../render/battleRenderer';
import { Camera } from '../../render/camera';
import { buildWorld } from '../../sim/build';
import type { Unit } from '../../sim/types';
import type { World } from '../../sim/world';
import { isStructureType } from '../../data/ships';
import type { App, Screen } from '../app';
import { helpDialog, settingsDialog } from '../dialogs';
import { el, esc } from '../dom';
import { flagSvg } from '../flags';

// daylight battles read best behind the menu
const SHOWCASE = ['uk1', 'jp1', 'de2', 'us7', 'uk6', 'us2', 'jp2', 'uk5', 'us8', 'de5'];
const RATE = 7; // game seconds per real second

/** A self-running battle drawn with every ship visible. */
export class Attract {
  private w!: World;
  private r!: BattleRenderer;
  private cam = new Camera();
  private raf = 0;
  private last = 0;
  private age = 0;
  private pick = Math.floor(Math.random() * SHOWCASE.length);
  private ro: ResizeObserver | null = null;
  private focus = { x: 0, y: 0 };

  constructor(private canvas: HTMLCanvasElement) {}

  start() {
    this.next();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas.parentElement!);
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
  }

  private next() {
    const m = findMission(SHOWCASE[this.pick++ % SHOWCASE.length])!;
    this.w = buildWorld(m, { controllers: ['ai', 'ai'], seed: (Math.random() * 1e6) | 0 });
    this.r = new BattleRenderer(this.canvas, this.w, this.cam);
    this.r.spectator = true;
    this.cam.setWorld(this.w.terrain.w, this.w.terrain.h);
    this.resize();
    const c = this.action();
    this.focus = { x: c.x, y: c.y };
    this.span = c.span;
    this.cam.zoom = this.zoomFor(this.span);
    this.look();
    this.age = 0;
  }

  /** The menu covers the left of the screen, so the action is framed in the rest of it. */
  private zoomFor(span: number) {
    const room = this.cam.w > 900 ? this.cam.w * 0.62 : this.cam.w;
    return Math.min(this.cam.maxZoom, Math.max(this.cam.minZoom, room / span));
  }

  private look() {
    const shift = this.cam.w > 900 ? (this.cam.w * 0.17) / this.cam.zoom : 0;
    this.cam.centerOn(this.focus.x - shift, this.focus.y);
  }

  private resize() {
    const p = this.canvas.parentElement!;
    this.r?.resize(p.clientWidth, p.clientHeight, Math.min(2, window.devicePixelRatio || 1));
  }

  private star: number | null = null;
  private starT = -1e9;
  private span = 13000;

  /**
   * Where to look, and how much sea to show: a ship that is firing (and her target), changing now
   * and then; failing that, a squadron about to attack, or the two fleets closing on each other.
   */
  private action(): { x: number; y: number; span: number } {
    const w = this.w;
    let u = w.unit(this.star);
    if (!w.alive(u) || w.time - this.starT > 90 || (w.time - u.lastFire > 40 && w.units.some((v) => w.alive(v) && w.time - v.lastFire < 10))) {
      const firing = w.units.filter((v) => w.alive(v) && w.time - v.lastFire < 15 && !v.cls.merchant);
      const pool = firing.length ? firing : w.units.filter((v) => w.alive(v) && v.side === 0 && !v.cls.merchant);
      u = pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;
      this.star = u?.id ?? null;
      this.starT = w.time;
    }
    const strike = w.squadrons.find((s) => s.n > 0 && (s.state === 'attack' || (s.state === 'outbound' && s.target && Math.hypot(s.x - s.target.x, s.y - s.target.y) < 15000)));
    if (strike && (!u || w.time - u.lastFire > 30)) return { x: strike.x, y: strike.y, span: 11000 };
    if (u && w.time - u.lastFire < 60) {
      const t = w.unit(u.autoTarget ?? u.target);
      if (w.alive(t) && Math.hypot(t.x - u.x, t.y - u.y) < 12000) return { x: (u.x * 2 + t.x) / 3, y: (u.y * 2 + t.y) / 3, span: 13000 };
      return { x: u.x, y: u.y, span: 13000 };
    }
    // nobody firing yet: the closest pair of enemies, both in view
    let best: { x: number; y: number; d: number } | null = null;
    for (const a of w.units) {
      if (a.side !== 0 || !w.alive(a)) continue;
      for (const b of w.units) {
        if (b.side !== 1 || !w.alive(b)) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (!best || d < best.d) best = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d };
      }
    }
    if (best && best.d < 16000) return { x: best.x, y: best.y, span: Math.max(9000, best.d * 1.5) };
    // still far apart: the biggest formation, close enough to see the ships and their wakes
    let core: Unit | null = null;
    let most = 0;
    for (const a of w.units) {
      if (!w.alive(a) || isStructureType(a.cls.type)) continue;
      let n = 0;
      for (const b of w.units) if (w.alive(b) && b.side === a.side && Math.hypot(a.x - b.x, a.y - b.y) < 4000) n++;
      if (n > most) {
        most = n;
        core = a;
      }
    }
    if (core) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      let r = 0;
      for (const b of w.units) {
        if (!w.alive(b) || b.side !== core.side || Math.hypot(core.x - b.x, core.y - b.y) >= 4000) continue;
        sx += b.x;
        sy += b.y;
        n++;
      }
      sx /= n;
      sy /= n;
      for (const b of w.units) if (w.alive(b) && b.side === core.side && Math.hypot(core.x - b.x, core.y - b.y) < 4000) r = Math.max(r, Math.hypot(b.x - sx, b.y - sy));
      return { x: sx, y: sy, span: Math.min(14000, Math.max(5000, r * 2.6)) };
    }
    return { x: w.terrain.w / 2, y: w.terrain.h / 2, span: 30000 };
  }

  private loop(t: number) {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    this.age += dt;
    // race through the approach until the first shots are fired
    const fighting = this.w.units.some((u) => u.lastFire > 0 || u.sunk);
    if (!this.w.result) this.w.advance(dt * (fighting ? RATE : 45));
    this.r.consume(this.w.events);
    this.w.events.length = 0;
    const a = this.action();
    const k = Math.min(1, dt * 0.25);
    this.focus.x += (a.x - this.focus.x) * k;
    this.focus.y += (a.y - this.focus.y) * k;
    this.span += (a.span - this.span) * k * 0.6;
    this.cam.zoom = this.zoomFor(this.span);
    this.look();
    const vs: ViewState = {
      selected: new Set(), selectedSq: new Set(), hover: null, showLabels: false, mode: 'normal',
      cursorX: 0, cursorY: 0, box: null, spread: 0, realTime: t / 1000,
    };
    this.r.draw(vs, dt);
    if (this.age > 150 || (this.w.result && this.age > 20)) this.next();
    this.raf = requestAnimationFrame((tt) => this.loop(tt));
  }
}

export function menuScreen(app: App): Screen {
  let attract: Attract | null = null;
  let root: HTMLElement;
  return {
    mount(parent) {
      const canvas = el('canvas', { class: 'attract' });
      const last = lastNation();
      const st = last ? loadCampaign(last) : null;
      const box = el('div', { class: 'menu-box' });
      box.innerHTML = `
        <div class="logo"><span class="l1">Silent Bearing</span><span class="l2">III</span></div>
        <div class="tagline">Naval war at sea, 1939 &ndash; 1945</div>`;
      const btns = el('div', { class: 'menu-btns' });
      if (st && last) {
        const c = CAMPAIGNS[last];
        const m = c.missions[Math.min(st.index, c.missions.length - 1)];
        btns.append(
          el('button', {
            class: 'btn primary big',
            onclick: () => {
              app.state = st;
              app.go(st.finished ? 'epilogue' : 'campaign');
            },
            html: `${flagSvg(last, 16)} Continue <small>${esc(c.title)} &middot; ${st.finished ? 'complete' : esc(m.title)}</small>`,
          }),
        );
      }
      btns.append(
        el('button', { class: `btn ${st ? '' : 'primary'} big`, onclick: () => app.go('nations') }, 'Campaigns'),
        el('button', { class: 'btn big', onclick: () => app.go('battles') }, 'Historical battles'),
        el('button', { class: 'btn big', onclick: () => helpDialog(root) }, 'How to play'),
        el('button', { class: 'btn big', onclick: () => settingsDialog(root, app) }, 'Settings'),
      );
      box.append(btns);
      const foot = el('div', {
        class: 'menu-foot',
        html: 'Every ship, map and sound is generated in code. &middot; <span class="dim">Behind this menu: a battle from the campaigns, fought by the computer.</span>',
      });
      root = el('div', { class: 'menu' }, canvas, el('div', { class: 'menu-vignette' }), box, foot);
      parent.append(root);
      attract = new Attract(canvas);
      try {
        attract.start();
      } catch (e) {
        console.error(e);
      }
    },
    unmount() {
      attract?.stop();
    },
  };
}
