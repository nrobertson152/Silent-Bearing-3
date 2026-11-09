// 2D camera: world metres to screen pixels.

import { clamp } from '../core/math';

export class Camera {
  x = 0; // world centre
  y = 0;
  zoom = 0.05; // pixels per metre
  w = 800; // viewport, CSS pixels
  h = 600;
  minZoom = 0.004;
  maxZoom = 1.2;
  worldW = 1;
  worldH = 1;

  setWorld(w: number, h: number) {
    this.worldW = w;
    this.worldH = h;
    this.minZoom = Math.min(this.w / (w * 1.15), this.h / (h * 1.15));
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.minZoom = Math.min(this.w / (this.worldW * 1.15), this.h / (this.worldH * 1.15));
    this.zoom = clamp(this.zoom, this.minZoom, this.maxZoom);
    this.clampPos();
  }

  sx(wx: number): number {
    return (wx - this.x) * this.zoom + this.w / 2;
  }

  sy(wy: number): number {
    return (wy - this.y) * this.zoom + this.h / 2;
  }

  wx(sx: number): number {
    return (sx - this.w / 2) / this.zoom + this.x;
  }

  wy(sy: number): number {
    return (sy - this.h / 2) / this.zoom + this.y;
  }

  zoomAt(sx: number, sy: number, factor: number) {
    const bx = this.wx(sx);
    const by = this.wy(sy);
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    this.x = bx - (sx - this.w / 2) / this.zoom;
    this.y = by - (sy - this.h / 2) / this.zoom;
    this.clampPos();
  }

  pan(dxPx: number, dyPx: number) {
    this.x -= dxPx / this.zoom;
    this.y -= dyPx / this.zoom;
    this.clampPos();
  }

  centerOn(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.clampPos();
  }

  fit(x0: number, y0: number, x1: number, y1: number, pad = 1.3) {
    const w = Math.max(2000, (x1 - x0) * pad);
    const h = Math.max(2000, (y1 - y0) * pad);
    this.zoom = clamp(Math.min(this.w / w, this.h / h), this.minZoom, this.maxZoom);
    this.x = (x0 + x1) / 2;
    this.y = (y0 + y1) / 2;
    this.clampPos();
  }

  clampPos() {
    const mx = this.worldW * 0.1;
    const my = this.worldH * 0.1;
    this.x = clamp(this.x, -mx, this.worldW + mx);
    this.y = clamp(this.y, -my, this.worldH + my);
  }

  /** Visible world rectangle. */
  view() {
    return { x0: this.wx(0), y0: this.wy(0), x1: this.wx(this.w), y1: this.wy(this.h) };
  }
}
