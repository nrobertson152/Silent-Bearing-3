// Short-lived visual effects: splashes, muzzle flashes, explosions, smoke and flak.
// Positions are world metres, sizes are metres with a pixel minimum.

import type { Camera } from './camera';

type Kind = 'splash' | 'muzzle' | 'flash' | 'smoke' | 'fire' | 'dc' | 'flak' | 'ring' | 'spark' | 'fall';

interface P {
  k: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number; // age
  life: number;
  size: number;
  minPx: number;
  a: number;
  ang: number;
}

export class Effects {
  parts: P[] = [];
  windX = 1.5;
  windY = 0.5;
  private max = 3500;

  private add(p: Omit<P, 't'>) {
    if (this.parts.length >= this.max) this.parts.shift();
    this.parts.push({ ...p, t: 0 });
  }

  splash(x: number, y: number, cal: number) {
    const s = 5 + cal / 16;
    this.add({ k: 'splash', x, y, vx: 0, vy: 0, life: 1.4 + cal / 600, size: s, minPx: 2 + cal / 160, a: 0.9, ang: Math.random() * 6.28 });
    if (cal >= 150) this.add({ k: 'ring', x, y, vx: 0, vy: 0, life: 2.2, size: s * 2.2, minPx: 3, a: 0.35, ang: 0 });
  }

  muzzle(x: number, y: number, ang: number, cal: number) {
    const s = 6 + cal / 9;
    this.add({ k: 'muzzle', x, y, vx: 0, vy: 0, life: 0.16 + cal / 3000, size: s, minPx: 2 + cal / 120, a: 1, ang });
    this.add({ k: 'smoke', x: x + Math.cos(ang) * s, y: y + Math.sin(ang) * s, vx: Math.cos(ang) * 4, vy: Math.sin(ang) * 4, life: 2.5 + cal / 200, size: s * 1.4, minPx: 1.5, a: 0.35, ang: 0 });
  }

  hit(x: number, y: number, cal: number) {
    const s = 6 + cal / 10;
    this.add({ k: 'flash', x, y, vx: 0, vy: 0, life: 0.35, size: s, minPx: 3 + cal / 100, a: 1, ang: 0 });
    this.add({ k: 'smoke', x, y, vx: 0, vy: 0, life: 4, size: s * 1.6, minPx: 2, a: 0.6, ang: 0 });
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * 6.28;
      const v = 20 + Math.random() * 40;
      this.add({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, size: 2, minPx: 1.2, a: 1, ang: 0 });
    }
  }

  boom(x: number, y: number, size: number) {
    const s = 18 * size;
    this.add({ k: 'flash', x, y, vx: 0, vy: 0, life: 0.6 + size * 0.15, size: s, minPx: 4 + size * 2, a: 1, ang: 0 });
    this.add({ k: 'splash', x, y, vx: 0, vy: 0, life: 2 + size * 0.2, size: s * 0.9, minPx: 3, a: 0.8, ang: 0 });
    for (let i = 0; i < 3 + size; i++) {
      this.add({ k: 'smoke', x: x + (Math.random() - 0.5) * s, y: y + (Math.random() - 0.5) * s, vx: 0, vy: 0, life: 5 + size, size: s * (1 + Math.random()), minPx: 3, a: 0.7, ang: 0 });
    }
    for (let i = 0; i < 6 + size * 2; i++) {
      const a = Math.random() * 6.28;
      const v = 30 + Math.random() * 60 * size;
      this.add({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7 + Math.random() * 0.5, size: 3, minPx: 1.5, a: 1, ang: 0 });
    }
  }

  dc(x: number, y: number) {
    this.add({ k: 'dc', x, y, vx: 0, vy: 0, life: 2.6, size: 55, minPx: 4, a: 0.9, ang: 0 });
    this.add({ k: 'ring', x, y, vx: 0, vy: 0, life: 2.4, size: 120, minPx: 5, a: 0.3, ang: 0 });
  }

  flak(x: number, y: number) {
    this.add({ k: 'flak', x, y, vx: 0, vy: 0, life: 1.6, size: 30, minPx: 2, a: 0.8, ang: 0 });
  }

  planeDown(x: number, y: number) {
    this.add({ k: 'fall', x, y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 2.2, size: 20, minPx: 2.5, a: 1, ang: Math.random() * 6 });
  }

  fire(x: number, y: number, size: number) {
    this.add({ k: 'fire', x, y, vx: 0, vy: 0, life: 0.5 + Math.random() * 0.4, size: size * (0.6 + Math.random() * 0.6), minPx: 1.5, a: 1, ang: 0 });
    if (Math.random() < 0.35) this.add({ k: 'smoke', x, y, vx: this.windX * 3, vy: this.windY * 3, life: 4 + Math.random() * 3, size: size * 2.2, minPx: 2, a: 0.45, ang: 0 });
  }

  ping(x: number, y: number, r: number) {
    this.add({ k: 'ring', x, y, vx: 0, vy: 0, life: 1.8, size: r, minPx: 6, a: 0.45, ang: 1 });
  }

  update(dt: number) {
    let w = 0;
    for (const p of this.parts) {
      p.t += dt;
      if (p.t >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.k === 'smoke') {
        p.vx += this.windX * dt * 0.8;
        p.vy += this.windY * dt * 0.8;
      }
      if (p.k === 'spark') {
        p.vx *= 0.96;
        p.vy *= 0.96;
      }
      this.parts[w++] = p;
    }
    this.parts.length = w;
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera, layer: 'water' | 'air') {
    const z = cam.zoom;
    const W = cam.w;
    const H = cam.h;
    for (const p of this.parts) {
      const isAir = p.k === 'flash' || p.k === 'muzzle' || p.k === 'fire' || p.k === 'spark' || p.k === 'flak' || p.k === 'fall' || p.k === 'smoke';
      if ((layer === 'air') !== isAir) continue;
      const sx = (p.x - cam.x) * z + W / 2;
      const sy = (p.y - cam.y) * z + H / 2;
      const f = p.t / p.life;
      let r = Math.max(p.minPx, p.size * z);
      if (sx < -r * 3 || sy < -r * 3 || sx > W + r * 3 || sy > H + r * 3) continue;
      switch (p.k) {
        case 'splash': {
          const g = Math.min(1, f * 4);
          const fade = (1 - f) * (1 - f);
          ctx.fillStyle = '#f2f8fa';
          // a column of spray seen from above: a bright core and scattered foam
          ctx.globalAlpha = p.a * fade;
          ctx.beginPath();
          ctx.arc(sx, sy, r * (0.35 + g * 0.45), 0, 6.283);
          ctx.fill();
          ctx.globalAlpha = p.a * fade * 0.6;
          for (let i = 0; i < 5; i++) {
            const a = p.ang + i * 1.2566;
            const rr = r * (0.55 + g * 0.6);
            ctx.beginPath();
            ctx.arc(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr, r * 0.28 * (1 - f * 0.5), 0, 6.283);
            ctx.fill();
          }
          ctx.globalAlpha = p.a * fade * 0.35;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(1, r * 0.12);
          ctx.beginPath();
          ctx.arc(sx, sy, r * (0.9 + f * 1.1), 0, 6.283);
          ctx.stroke();
          break;
        }
        case 'ring': {
          ctx.globalAlpha = p.a * (1 - f);
          ctx.strokeStyle = p.ang ? '#7ee8ff' : '#e8f4f8';
          ctx.lineWidth = p.ang ? 1.5 : Math.max(1, r * 0.06);
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(2, r * f), 0, 6.283);
          ctx.stroke();
          break;
        }
        case 'dc': {
          const g = Math.min(1, f * 2.5);
          ctx.globalAlpha = p.a * (1 - f);
          ctx.fillStyle = '#f4fbff';
          ctx.beginPath();
          ctx.arc(sx, sy, r * (0.3 + g * 0.9), 0, 6.283);
          ctx.fill();
          break;
        }
        case 'muzzle': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1 - f;
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.6);
          g.addColorStop(0, 'rgba(255,250,210,1)');
          g.addColorStop(0.35, 'rgba(255,180,60,0.9)');
          g.addColorStop(1, 'rgba(255,90,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(sx + Math.cos(p.ang) * r * 0.8, sy + Math.sin(p.ang) * r * 0.8, r * 1.6, 0, 6.283);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'flash': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - f) * p.a;
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.8);
          g.addColorStop(0, 'rgba(255,245,200,1)');
          g.addColorStop(0.3, 'rgba(255,150,40,0.95)');
          g.addColorStop(1, 'rgba(200,40,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(sx, sy, r * 1.8, 0, 6.283);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'fire': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - f) * 0.9;
          ctx.fillStyle = f < 0.4 ? '#ffd27a' : '#ff6a1a';
          ctx.beginPath();
          ctx.arc(sx, sy, r * (1 - f * 0.5), 0, 6.283);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'smoke': {
          ctx.globalAlpha = p.a * (1 - f) * Math.min(1, f * 6);
          ctx.fillStyle = '#4a4a48';
          ctx.beginPath();
          ctx.arc(sx, sy, r * (0.6 + f * 1.4), 0, 6.283);
          ctx.fill();
          break;
        }
        case 'spark': {
          ctx.globalAlpha = 1 - f;
          ctx.fillStyle = '#ffcf6a';
          ctx.fillRect(sx - 1, sy - 1, 2, 2);
          break;
        }
        case 'flak': {
          ctx.globalAlpha = p.a * (1 - f) * Math.min(1, f * 8);
          ctx.fillStyle = '#1e1e1e';
          ctx.beginPath();
          ctx.arc(sx, sy, r * (0.5 + f), 0, 6.283);
          ctx.fill();
          break;
        }
        case 'fall': {
          ctx.globalAlpha = 1 - f;
          ctx.strokeStyle = '#2a2a2a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const a = p.ang + f * 8;
          ctx.moveTo(sx - Math.cos(a) * r, sy - Math.sin(a) * r);
          ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
          ctx.stroke();
          ctx.globalAlpha = (1 - f) * 0.5;
          ctx.fillStyle = '#555';
          ctx.beginPath();
          ctx.arc(sx - p.vx * z * 0.3, sy - p.vy * z * 0.3, Math.max(2, r * 0.6), 0, 6.283);
          ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
