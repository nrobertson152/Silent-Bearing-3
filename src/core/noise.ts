// Seeded 2D value noise with fractal sums, used for coastlines and textures.

export class Noise2D {
  private perm: Uint8Array;
  private vals: Float32Array;

  constructor(seed: number) {
    this.perm = new Uint8Array(512);
    this.vals = new Float32Array(256);
    let s = (seed >>> 0) || 1;
    const rnd = () => {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
      this.vals[i] = rnd();
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  private lattice(ix: number, iy: number): number {
    return this.vals[this.perm[(this.perm[ix & 255] + iy) & 511]];
  }

  /** Smooth value noise in [0, 1]. */
  value(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = this.lattice(ix, iy);
    const b = this.lattice(ix + 1, iy);
    const c = this.lattice(ix, iy + 1);
    const d = this.lattice(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  /** Fractal noise in roughly [-1, 1]. */
  fbm(x: number, y: number, octaves = 4): number {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += (this.value(x * f + o * 17.3, y * f - o * 9.1) * 2 - 1) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  }
}
