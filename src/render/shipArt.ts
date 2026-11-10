// Procedural top-down ship drawings. Everything is drawn in the ship's own frame,
// in metres: +x is the bow, +y is starboard.

import { clamp } from '../core/math';
import { NATIONS } from '../data/nations';
import type { ShipClass } from '../data/types';
import type { Unit } from '../sim/types';

function hullPath(ctx: CanvasRenderingContext2D, L: number, B: number, bluntness = 0) {
  const hl = L / 2;
  const hb = B / 2;
  const bowStart = 0.15 + bluntness * 0.25;
  ctx.beginPath();
  ctx.moveTo(hl, 0);
  ctx.bezierCurveTo(hl * (0.78 - bluntness * 0.1), hb * (0.55 + bluntness * 0.3), hl * (0.48 + bluntness * 0.1), hb, hl * bowStart, hb);
  ctx.lineTo(-hl * 0.72, hb);
  ctx.quadraticCurveTo(-hl, hb * 0.95, -hl, hb * 0.42);
  ctx.lineTo(-hl, -hb * 0.42);
  ctx.quadraticCurveTo(-hl, -hb * 0.95, -hl * 0.72, -hb);
  ctx.lineTo(hl * bowStart, -hb);
  ctx.bezierCurveTo(hl * (0.48 + bluntness * 0.1), -hb, hl * (0.78 - bluntness * 0.1), -hb * (0.55 + bluntness * 0.3), hl, 0);
  ctx.closePath();
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * f, 0, 255);
  const g = clamp(((n >> 8) & 255) * f, 0, 255);
  const b = clamp((n & 255) * f, 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const FUNNEL_COLORS = ['#b8332a', '#d4a017', '#2c2c2c', '#2a6f97', '#7a2e3a', '#d8d0bc', '#3c6e47'];

export interface ShipDrawState {
  planesOnDeck?: number;
}

export function drawShip(ctx: CanvasRenderingContext2D, u: Unit, k: number, st: ShipDrawState = {}) {
  const c = u.cls;
  if (c.type === 'BASE' || c.type === 'BTY') return drawStructure(ctx, u, k);
  if (c.sil.sub) return drawSub(ctx, u, k);
  if (c.merchant) return drawMerchant(ctx, u, k);
  if (c.sil.cv) return drawCarrier(ctx, u, k, st.planesOnDeck ?? 0);
  if (c.type === 'PT') return drawBoat(ctx, u, k);
  return drawWarship(ctx, u, k);
}

function outline(ctx: CanvasRenderingContext2D, k: number, w = 0.9, a = 0.55) {
  ctx.lineWidth = w / k;
  ctx.strokeStyle = `rgba(0,0,0,${a})`;
  ctx.stroke();
}

function drawWarship(ctx: CanvasRenderingContext2D, u: Unit, k: number) {
  const c = u.cls;
  const L = c.length;
  const B = c.beam;
  const nat = NATIONS[u.nation];
  hullPath(ctx, L, B);
  ctx.fillStyle = nat.hull;
  ctx.fill();
  outline(ctx, k);
  ctx.save();
  ctx.scale(0.965, 0.82);
  hullPath(ctx, L, B);
  ctx.fillStyle = nat.deck;
  ctx.fill();
  ctx.restore();
  if (u.nation === 'it' && (c.type === 'BB' || c.type === 'CA' || c.type === 'CL')) {
    // red and white air recognition stripes on the forecastle
    ctx.save();
    hullPath(ctx, L, B);
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#f2efe8' : '#b92d2d';
      ctx.beginPath();
      const x = L * 0.33 + i * L * 0.022;
      ctx.moveTo(x, -B);
      ctx.lineTo(x + L * 0.022, -B);
      ctx.lineTo(x + L * 0.022 + B * 0.4, B);
      ctx.lineTo(x + B * 0.4, B);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  drawTopside(ctx, u, c, k);
  drawGuns(ctx, u, k);
  damageMarks(ctx, u, L, B);
}

function drawTopside(ctx: CanvasRenderingContext2D, u: Unit, c: ShipClass, k: number) {
  const L = c.length;
  const B = c.beam;
  const nat = NATIONS[u.nation];
  for (const [p, len, wid] of c.sil.sup) {
    const x = p * L;
    const l = len * L;
    const w = wid * B;
    rrect(ctx, x - l / 2, -w / 2, l, w, w * 0.3);
    ctx.fillStyle = nat.sup;
    ctx.fill();
    outline(ctx, k, 0.7, 0.45);
    // bridge highlight
    rrect(ctx, x - l * 0.3, -w * 0.3, l * 0.55, w * 0.6, w * 0.2);
    ctx.fillStyle = shade(nat.sup, 1.12);
    ctx.fill();
  }
  const fw = c.sil.funW ?? 1;
  for (const fp of c.sil.fun ?? []) {
    ctx.beginPath();
    ctx.ellipse(fp * L, 0, B * 0.12 * fw, B * 0.16 * fw, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4a4d50';
    ctx.fill();
    outline(ctx, k, 0.6, 0.5);
    ctx.beginPath();
    ctx.ellipse(fp * L, 0, B * 0.07 * fw, B * 0.1 * fw, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#151515';
    ctx.fill();
  }
  for (const mp of c.sil.mast ?? []) {
    ctx.beginPath();
    ctx.arc(mp * L, 0, Math.max(0.5, B * 0.03), 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(mp * L, -B * 0.32);
    ctx.lineTo(mp * L, B * 0.32);
    ctx.lineWidth = Math.max(0.25, 0.5 / k);
    ctx.strokeStyle = 'rgba(30,30,30,0.7)';
    ctx.stroke();
  }
}

function drawGuns(ctx: CanvasRenderingContext2D, u: Unit, k: number) {
  const c = u.cls;
  const L = c.length;
  const B = c.beam;
  const nat = NATIONS[u.nation];
  const turretColor = shade(nat.hull, 1.12);
  for (const m of u.mounts) {
    const cal = m.gun.cal;
    if (cal < 30) continue;
    const main = !m.def.sec;
    const mx = m.def.p * L;
    const my = (m.def.s ?? 0) * B * 0.3;
    const r = main ? clamp(B * (0.11 + cal / 4200) * (1 + 0.07 * (m.def.n - 1)), 1.2, 12) : clamp(B * (0.05 + cal / 6000), 0.7, 3.2);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(m.aim);
    if (!m.dead) {
      const bl = cal * 0.045;
      ctx.lineWidth = Math.max(cal / 900, 0.8 / k);
      ctx.strokeStyle = '#2b2d2f';
      ctx.beginPath();
      for (let i = 0; i < m.def.n; i++) {
        const oy = (i - (m.def.n - 1) / 2) * r * 0.42;
        ctx.moveTo(r * 0.4, oy);
        ctx.lineTo(r * 0.4 + bl, oy);
      }
      ctx.stroke();
    }
    if (main) {
      rrect(ctx, -r * 0.95, -r * 0.82, r * 1.75, r * 1.64, r * 0.5);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = m.dead ? '#2a2522' : turretColor;
    ctx.fill();
    outline(ctx, k, 0.6, 0.6);
    ctx.restore();
  }
}

function damageMarks(ctx: CanvasRenderingContext2D, u: Unit, L: number, B: number) {
  const dmg = 1 - u.hp / u.maxHp;
  if (dmg < 0.15) return;
  const n = Math.min(6, Math.floor(dmg * 8));
  let s = u.id * 7919;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  ctx.fillStyle = `rgba(20,14,10,${0.35 + dmg * 0.3})`;
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * L * 0.8;
    const y = (rnd() - 0.5) * B * 0.6;
    ctx.beginPath();
    ctx.ellipse(x, y, B * (0.12 + rnd() * 0.12), B * (0.08 + rnd() * 0.08), rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCarrier(ctx: CanvasRenderingContext2D, u: Unit, k: number, planes: number) {
  const c = u.cls;
  const L = c.length;
  const B = c.beam;
  const nat = NATIONS[u.nation];
  hullPath(ctx, L, B);
  ctx.fillStyle = nat.hull;
  ctx.fill();
  outline(ctx, k);
  const dw = B * 1.12;
  const x0 = -L * 0.485;
  const x1 = L * 0.45;
  const deckCol = u.nation === 'jp' ? '#9b7b56' : u.nation === 'uk' ? '#737a7f' : '#5c6268';
  rrect(ctx, x0, -dw / 2, x1 - x0, dw, B * 0.08);
  ctx.fillStyle = deckCol;
  ctx.fill();
  outline(ctx, k, 0.8, 0.6);
  // deck markings
  ctx.save();
  ctx.lineWidth = Math.max(0.5, 0.9 / k);
  ctx.strokeStyle = 'rgba(240,240,230,0.55)';
  ctx.setLineDash([L * 0.03, L * 0.02]);
  ctx.beginPath();
  ctx.moveTo(x0 + L * 0.03, 0);
  ctx.lineTo(x1 - L * 0.03, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(240,240,230,0.35)';
  ctx.strokeRect(x0 + L * 0.01, -dw / 2 + B * 0.06, x1 - x0 - L * 0.02, dw - B * 0.12);
  ctx.restore();
  // elevators
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (const p of [0.25, -0.02, -0.3]) ctx.fillRect(p * L - B * 0.22, -B * 0.22, B * 0.44, B * 0.44);
  if (u.nation === 'jp') {
    ctx.beginPath();
    ctx.arc(L * 0.36, 0, B * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#f1ece0';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(L * 0.36, 0, B * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#c0282e';
    ctx.fill();
  }
  // parked aircraft
  const n = Math.min(planes, 24);
  ctx.fillStyle = u.nation === 'jp' ? '#5c6b4a' : u.nation === 'uk' ? '#6c7a5f' : '#4f6276';
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const px = x0 + L * 0.06 + row * B * 0.42;
    const py = (col - 1.5) * dw * 0.22;
    plane(ctx, px, py, B * 0.2);
  }
  // island
  {
    const ix = (c.sil.island ?? 0.08) * L;
    const iw = c.type === 'CVE' ? B * 0.18 : B * 0.24;
    const il = c.type === 'CVE' ? L * 0.08 : L * 0.12;
    rrect(ctx, ix - il / 2, dw / 2 - iw * 0.55, il, iw, iw * 0.3);
    ctx.fillStyle = nat.sup;
    ctx.fill();
    outline(ctx, k, 0.7, 0.6);
    ctx.beginPath();
    ctx.ellipse(ix - il * 0.15, dw / 2 - iw * 0.05, iw * 0.25, iw * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2b2b2b';
    ctx.fill();
  }
  drawGunsWing(ctx, u, k);
  damageMarks(ctx, u, L, B);
}

function drawGunsWing(ctx: CanvasRenderingContext2D, u: Unit, k: number) {
  const L = u.cls.length;
  const B = u.cls.beam;
  ctx.fillStyle = shade(NATIONS[u.nation].hull, 0.9);
  for (const m of u.mounts) {
    const x = m.def.p * L;
    const y = (m.def.s ?? 0) * B * 0.62;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.8, B * 0.06), 0, Math.PI * 2);
    ctx.fill();
  }
  void k;
}

export function plane(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x + s, y);
  ctx.lineTo(x - s * 0.8, y);
  ctx.moveTo(x + s * 0.25, y - s * 0.95);
  ctx.lineTo(x + s * 0.25, y + s * 0.95);
  ctx.moveTo(x - s * 0.7, y - s * 0.38);
  ctx.lineTo(x - s * 0.7, y + s * 0.38);
  ctx.lineWidth = s * 0.28;
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.stroke();
}

function drawSub(ctx: CanvasRenderingContext2D, u: Unit, k: number) {
  const c = u.cls;
  const L = c.length;
  const B = c.beam;
  const hl = L / 2;
  const hb = B / 2;
  ctx.beginPath();
  ctx.moveTo(hl, 0);
  ctx.quadraticCurveTo(hl * 0.7, hb * 1.0, hl * 0.2, hb);
  ctx.lineTo(-hl * 0.6, hb * 0.85);
  ctx.quadraticCurveTo(-hl * 1.02, hb * 0.35, -hl, 0);
  ctx.quadraticCurveTo(-hl * 1.02, -hb * 0.35, -hl * 0.6, -hb * 0.85);
  ctx.lineTo(hl * 0.2, -hb);
  ctx.quadraticCurveTo(hl * 0.7, -hb * 1.0, hl, 0);
  ctx.closePath();
  ctx.fillStyle = u.nation === 'jp' ? '#2c2f31' : u.nation === 'de' ? '#5a6266' : '#30373b';
  ctx.fill();
  outline(ctx, k, 0.8, 0.6);
  // deck casing
  ctx.beginPath();
  ctx.moveTo(hl * 0.85, 0);
  ctx.lineTo(-hl * 0.8, 0);
  ctx.lineWidth = B * 0.35;
  ctx.strokeStyle = u.nation === 'de' ? '#6e777b' : '#40484c';
  ctx.stroke();
  // conning tower
  rrect(ctx, L * 0.02, -B * 0.24, L * 0.14, B * 0.48, B * 0.2);
  ctx.fillStyle = u.nation === 'de' ? '#7b8488' : '#4a5357';
  ctx.fill();
  outline(ctx, k, 0.7, 0.6);
  for (const m of u.mounts) {
    ctx.beginPath();
    ctx.arc(m.def.p * L, 0, Math.max(0.6, B * 0.12), 0, Math.PI * 2);
    ctx.fillStyle = '#2a2f32';
    ctx.fill();
  }
}

function drawMerchant(ctx: CanvasRenderingContext2D, u: Unit, k: number) {
  const c = u.cls;
  const L = c.length;
  const B = c.beam;
  const jp = u.nation === 'jp';
  hullPath(ctx, L, B, 0.6);
  ctx.fillStyle = jp ? '#55595b' : '#3a332d';
  ctx.fill();
  outline(ctx, k);
  ctx.save();
  ctx.scale(0.96, 0.84);
  hullPath(ctx, L, B, 0.6);
  ctx.fillStyle = jp ? '#7d7466' : '#857563';
  ctx.fill();
  ctx.restore();
  for (const h of c.sil.hatches ?? []) {
    ctx.fillStyle = '#4e4336';
    ctx.fillRect(h * L - L * 0.045, -B * 0.28, L * 0.09, B * 0.56);
  }
  if (c.type === 'AO') {
    ctx.beginPath();
    ctx.moveTo(L * 0.3, 0);
    ctx.lineTo(-L * 0.36, 0);
    ctx.lineWidth = B * 0.12;
    ctx.strokeStyle = '#5a5047';
    ctx.stroke();
  }
  for (const [p, len, wid] of c.sil.sup) {
    rrect(ctx, p * L - (len * L) / 2, (-wid * B) / 2, len * L, wid * B, B * 0.1);
    ctx.fillStyle = jp ? '#b9b4a8' : '#e4ddcc';
    ctx.fill();
    outline(ctx, k, 0.6, 0.45);
  }
  const fc = FUNNEL_COLORS[u.id % FUNNEL_COLORS.length];
  for (const fp of c.sil.fun ?? []) {
    ctx.beginPath();
    ctx.ellipse(fp * L, 0, B * 0.11, B * 0.14, 0, 0, Math.PI * 2);
    ctx.fillStyle = jp ? '#3a3a3a' : fc;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(fp * L, 0, B * 0.06, B * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
  }
  for (const mp of c.sil.mast ?? []) {
    ctx.beginPath();
    ctx.moveTo(mp * L, -B * 0.4);
    ctx.lineTo(mp * L, B * 0.4);
    ctx.lineWidth = Math.max(0.3, 0.6 / k);
    ctx.strokeStyle = 'rgba(40,30,20,0.85)';
    ctx.stroke();
  }
  damageMarks(ctx, u, L, B);
}

function drawBoat(ctx: CanvasRenderingContext2D, u: Unit, k: number) {
  const L = u.cls.length;
  const B = u.cls.beam;
  hullPath(ctx, L, B, 0.2);
  ctx.fillStyle = u.nation === 'us' ? '#4d5b4f' : u.nation === 'de' ? '#8a9196' : '#6f777b';
  ctx.fill();
  outline(ctx, k);
  rrect(ctx, -L * 0.05, -B * 0.25, L * 0.22, B * 0.5, B * 0.15);
  ctx.fillStyle = '#b4b9bc';
  ctx.fill();
  ctx.fillStyle = '#2b2e30';
  ctx.fillRect(-L * 0.35, -B * 0.42, L * 0.38, B * 0.12);
  ctx.fillRect(-L * 0.35, B * 0.3, L * 0.38, B * 0.12);
}

function drawStructure(ctx: CanvasRenderingContext2D, u: Unit, k: number) {
  const L = u.cls.length;
  const B = u.cls.beam;
  if (u.cls.type === 'BASE') {
    // runways
    ctx.fillStyle = '#7a776c';
    rrect(ctx, -L / 2, -B * 0.12, L, B * 0.24, B * 0.05);
    ctx.fill();
    ctx.save();
    ctx.rotate(0.9);
    rrect(ctx, -L * 0.35, -B * 0.1, L * 0.7, B * 0.2, B * 0.05);
    ctx.fill();
    ctx.restore();
    ctx.setLineDash([L * 0.03, L * 0.025]);
    ctx.beginPath();
    ctx.moveTo(-L * 0.45, 0);
    ctx.lineTo(L * 0.45, 0);
    ctx.lineWidth = Math.max(1, B * 0.015);
    ctx.strokeStyle = 'rgba(240,240,230,0.7)';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#5b5a52';
    for (let i = 0; i < 6; i++) ctx.fillRect(-L * 0.3 + i * L * 0.1, B * 0.2, L * 0.06, B * 0.12);
  } else {
    ctx.fillStyle = '#6b6a5f';
    rrect(ctx, -L / 2, -B / 2, L, B, B * 0.3);
    ctx.fill();
    outline(ctx, k);
    for (const m of u.mounts) {
      ctx.save();
      ctx.translate(m.def.p * L, 0);
      ctx.rotate(m.aim);
      ctx.beginPath();
      ctx.arc(0, 0, B * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = '#4a4a42';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(B * 0.6, 0);
      ctx.lineWidth = B * 0.06;
      ctx.strokeStyle = '#222';
      ctx.stroke();
      ctx.restore();
    }
    if (!u.mounts.length) {
      ctx.fillStyle = '#3d3d36';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(-L * 0.35 + i * L * 0.17, (i % 2 ? -1 : 1) * B * 0.15, B * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/** Tactical symbol for zoomed-out views. */
export function drawSymbol(
  ctx: CanvasRenderingContext2D, x: number, y: number, h: number, size: number,
  kind: 'friend' | 'foe' | 'unknown' | 'ally', shape: 'ship' | 'sub' | 'carrier' | 'merchant' | 'base',
) {
  const col = kind === 'friend' ? '#7fc4ff' : kind === 'ally' ? '#9ee6c3' : kind === 'foe' ? '#ff6b5e' : '#ffd166';
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = col;
  ctx.fillStyle = kind === 'unknown' ? 'rgba(255,209,102,0.15)' : kind === 'foe' ? 'rgba(255,107,94,0.22)' : 'rgba(127,196,255,0.22)';
  ctx.beginPath();
  if (shape === 'base') {
    ctx.rect(-size, -size * 0.6, size * 2, size * 1.2);
  } else if (kind === 'foe' || kind === 'unknown') {
    ctx.moveTo(0, -size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size, 0);
    ctx.closePath();
  } else {
    ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  // inner glyph
  ctx.fillStyle = col;
  if (shape === 'sub') {
    ctx.fillRect(-size * 0.45, -size * 0.12, size * 0.9, size * 0.24);
  } else if (shape === 'carrier') {
    ctx.fillRect(-size * 0.5, -size * 0.2, size, size * 0.4);
  } else if (shape === 'merchant') {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  // heading line
  if (shape !== 'base') {
    ctx.beginPath();
    ctx.moveTo(Math.cos(h) * size, Math.sin(h) * size);
    ctx.lineTo(Math.cos(h) * size * 2.1, Math.sin(h) * size * 2.1);
    ctx.stroke();
  }
  ctx.restore();
}
