// Pre-rendered terrain: land shaded by a hill-shade, beaches, surf and shallow water.

import { clamp } from '../core/math';
import type { Biome } from '../data/types';
import type { Terrain } from '../sim/terrain';

type RGB = [number, number, number];

const PAL: Record<Biome, { beach: RGB; low: RGB; mid: RGB; high: RGB; shallow: RGB }> = {
  temperate: { beach: [196, 184, 146], low: [92, 118, 72], mid: [74, 98, 60], high: [116, 112, 92], shallow: [70, 140, 160] },
  tropical: { beach: [226, 210, 160], low: [62, 124, 58], mid: [44, 104, 46], high: [82, 100, 62], shallow: [64, 176, 182] },
  arctic: { beach: [120, 122, 118], low: [196, 204, 208], mid: [222, 230, 234], high: [242, 246, 248], shallow: [80, 120, 140] },
  desert: { beach: [226, 206, 156], low: [204, 178, 124], mid: [182, 152, 98], high: [150, 124, 82], shallow: [72, 160, 170] },
  ice: { beach: [176, 200, 214], low: [220, 232, 240], mid: [234, 242, 247], high: [246, 250, 252], shallow: [110, 150, 172] },
};

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export interface TerrainImage {
  canvas: HTMLCanvasElement;
  scale: number; // pixels per metre in the image
}

export function makeTerrainImage(t: Terrain, biome: Biome = 'temperate', maxPx = 1700): TerrainImage {
  const scale = maxPx / Math.max(t.w, t.h);
  const W = Math.max(2, Math.round(t.w * scale));
  const H = Math.max(2, Math.round(t.h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  if (!t.hasLand) return { canvas, scale };
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const F = new Float32Array(W * H);
  const E = new Float32Array(W * H);
  const amp = t.cell * 0.55;
  const dsc = 1 / Math.max(120, t.cell * 0.9);
  const esc = 1 / 2500;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const wx = (px + 0.5) / scale;
      const wy = (py + 0.5) / scale;
      let f = t.sample(wx, wy);
      if (f > -t.cell * 4 && f < t.cell * 4) f += t.detail.fbm(wx * dsc, wy * dsc, 3) * amp;
      const i = py * W + px;
      F[i] = f;
      if (f > 0) E[i] = Math.min(f, 6000) * 0.5 + (t.detail.fbm(wx * esc + 40, wy * esc - 20, 4) + 1) * 450;
    }
  }
  const pal = PAL[biome];
  const d = img.data;
  const pxM = 1 / scale; // metres per pixel
  const beachW = Math.max(40, pxM * 0.8);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      const f = F[i];
      const o = i * 4;
      if (f > 0) {
        const l = px > 0 ? E[i - 1] : E[i];
        const r = px < W - 1 ? E[i + 1] : E[i];
        const u = py > 0 ? E[i - W] : E[i];
        const dn = py < H - 1 ? E[i + W] : E[i];
        const gx = (r - l) / (2 * pxM);
        const gy = (dn - u) / (2 * pxM);
        const shade = clamp(0.62 - (gx + gy) * 1.6, 0.25, 1.15);
        const el = clamp(E[i] / 2600, 0, 1);
        let c: RGB = el < 0.45 ? mix(pal.low, pal.mid, el / 0.45) : mix(pal.mid, pal.high, (el - 0.45) / 0.55);
        if (f < beachW) c = mix(pal.beach, c, clamp(f / beachW, 0, 1) * 0.6);
        d[o] = clamp(c[0] * shade, 0, 255);
        d[o + 1] = clamp(c[1] * shade, 0, 255);
        d[o + 2] = clamp(c[2] * shade, 0, 255);
        d[o + 3] = 255;
      } else if (f > -700) {
        const depth = -f / 700;
        const surf = f > -Math.max(25, pxM * 0.6);
        if (surf) {
          d[o] = 230;
          d[o + 1] = 240;
          d[o + 2] = 240;
          d[o + 3] = 170;
        } else {
          d[o] = pal.shallow[0];
          d[o + 1] = pal.shallow[1];
          d[o + 2] = pal.shallow[2];
          d[o + 3] = Math.round(Math.pow(1 - depth, 2) * 150);
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, scale };
}

/** A tileable texture of soft swell for the open ocean. */
export function makeOceanTile(seed = 3): HTMLCanvasElement {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  // periodic value noise from a random lattice
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const octave = (cells: number) => {
    const g = new Float32Array(cells * cells).map(() => rnd());
    return (x: number, y: number) => {
      const fx = (x / N) * cells;
      const fy = (y / N) * cells;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const a = g[(iy % cells) * cells + (ix % cells)];
      const b = g[(iy % cells) * cells + ((ix + 1) % cells)];
      const cc = g[((iy + 1) % cells) * cells + (ix % cells)];
      const dd = g[((iy + 1) % cells) * cells + ((ix + 1) % cells)];
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + dd) * sx * sy;
    };
  };
  const o1 = octave(4);
  const o2 = octave(8);
  const o3 = octave(16);
  const o4 = octave(32);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = o1(x, y) * 0.45 + o2(x, y) * 0.28 + o3(x, y) * 0.17 + o4(x, y) * 0.1;
      const i = (y * N + x) * 4;
      const light = v > 0.5;
      img.data[i] = light ? 210 : 0;
      img.data[i + 1] = light ? 235 : 10;
      img.data[i + 2] = light ? 255 : 30;
      img.data[i + 3] = Math.round(Math.abs(v - 0.5) * 2 * 40);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
