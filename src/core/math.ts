// Geometry and unit helpers shared by the simulation and the views.
//
// World coordinates are metres. x grows to the east, y grows to the SOUTH (screen
// convention). Headings are radians in that frame: 0 = east, +PI/2 = south.
// Compass bearings (what the player sees) are degrees clockwise from north.

export const TAU = Math.PI * 2;
export const KN = 0.514444; // metres per second in one knot
export const DEG = Math.PI / 180;

export interface Vec {
  x: number;
  y: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Wrap an angle to (-PI, PI]. */
export function wrap(a: number): number {
  a = a % TAU;
  if (a <= -Math.PI) a += TAU;
  else if (a > Math.PI) a -= TAU;
  return a;
}

/** Signed smallest rotation from a to b. */
export function angleDiff(a: number, b: number): number {
  return wrap(b - a);
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Heading (radians, world frame) to compass bearing in degrees [0, 360). */
export function toBearing(h: number): number {
  let d = h / DEG + 90;
  d %= 360;
  if (d < 0) d += 360;
  return d;
}

/** Compass bearing in degrees to world heading in radians. */
export function fromBearing(deg: number): number {
  return wrap((deg - 90) * DEG);
}

export function headingTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

/**
 * Time for a projectile of `speed` launched from p to meet a target at t moving
 * with velocity v. Returns null when the target cannot be caught.
 */
export function interceptTime(
  px: number, py: number,
  tx: number, ty: number,
  vx: number, vy: number,
  speed: number,
): number | null {
  const dx = tx - px;
  const dy = ty - py;
  const a = vx * vx + vy * vy - speed * speed;
  const b = 2 * (dx * vx + dy * vy);
  const c = dx * dx + dy * dy;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) < 1e-9) return null;
    const t = -c / b;
    return t > 0 ? t : null;
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a);
  const t2 = (-b + s) / (2 * a);
  let t = Infinity;
  if (t1 > 0) t = t1;
  if (t2 > 0 && t2 < t) t = t2;
  return isFinite(t) ? t : null;
}

/** Point inside an ellipse centred at (cx, cy) whose major axis follows heading h. */
export function inEllipse(
  px: number, py: number,
  cx: number, cy: number, h: number,
  a: number, b: number,
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const c = Math.cos(h);
  const s = Math.sin(h);
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  return (lx * lx) / (a * a) + (ly * ly) / (b * b) <= 1;
}

/** Does the segment p0-p1 pass through the ellipse? */
export function segHitsEllipse(
  x0: number, y0: number, x1: number, y1: number,
  cx: number, cy: number, h: number,
  a: number, b: number,
): boolean {
  const c = Math.cos(h);
  const s = Math.sin(h);
  // transform both ends into the unit-circle frame of the ellipse
  const ax = ((x0 - cx) * c + (y0 - cy) * s) / a;
  const ay = (-(x0 - cx) * s + (y0 - cy) * c) / b;
  const bx = ((x1 - cx) * c + (y1 - cy) * s) / a;
  const by = (-(x1 - cx) * s + (y1 - cy) * c) / b;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  const qx = ax + dx * t;
  const qy = ay + dy * t;
  return qx * qx + qy * qy <= 1;
}

/** Distance from point to segment. */
export function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return dist(px, py, ax + dx * t, ay + dy * t);
}

/** Does the segment a-b pass within r of the point c? */
export function segNearPoint(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number): boolean {
  return distToSeg(cx, cy, ax, ay, bx, by) <= r;
}

/** Intersection of two rays given as point + heading. Returns null if nearly parallel. */
export function rayIntersect(
  ax: number, ay: number, ah: number,
  bx: number, by: number, bh: number,
): Vec | null {
  const adx = Math.cos(ah);
  const ady = Math.sin(ah);
  const bdx = Math.cos(bh);
  const bdy = Math.sin(bh);
  const den = adx * bdy - ady * bdx;
  if (Math.abs(den) < 0.12) return null;
  const t = ((bx - ax) * bdy - (by - ay) * bdx) / den;
  const u = ((bx - ax) * ady - (by - ay) * adx) / den;
  if (t < 0 || u < 0) return null;
  return { x: ax + adx * t, y: ay + ady * t };
}

export function fmtClock(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtKm(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function fmtBearing(h: number): string {
  return String(Math.round(toBearing(h)) % 360).padStart(3, '0') + '°';
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Decimal year from an ISO date string, e.g. '1942-06-04' -> 1942.42 */
export function decimalYear(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return y + ((m || 1) - 1) / 12 + ((d || 1) - 1) / 365;
}

export function fmtDate(iso: string): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${months[(m || 1) - 1]} ${y}`;
}
