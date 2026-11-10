// A small chart of the battle area for the briefing: coastlines, zones and
// the player's starting forces (plus anything the briefing already reveals).

import type { MissionDef } from '../data/types';
import { makeTerrainImage } from '../render/terrainImage';
import { buildWorld } from '../sim/build';
import type { DeployedCore } from '../sim/types';

export function drawPreview(canvas: HTMLCanvasElement, m: MissionDef, core: DeployedCore[]) {
  const w = buildWorld(m, { controllers: ['human', 'ai'], core, seed: 1 });
  const W = canvas.clientWidth || 420;
  const H = canvas.clientHeight || 300;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const tw = w.terrain.w;
  const th = w.terrain.h;
  const s = Math.min(W / tw, H / th);
  const ox = (W - tw * s) / 2;
  const oy = (H - th * s) / 2;
  const night = w.env.tod === 'night';
  ctx.fillStyle = '#0a131c';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = night ? '#0e2236' : '#173f5c';
  ctx.fillRect(ox, oy, tw * s, th * s);
  // grid every 10 km
  ctx.strokeStyle = 'rgba(200,225,245,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= tw; x += 10000) {
    ctx.beginPath();
    ctx.moveTo(ox + x * s, oy);
    ctx.lineTo(ox + x * s, oy + th * s);
    ctx.stroke();
  }
  for (let y = 0; y <= th; y += 10000) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + y * s);
    ctx.lineTo(ox + tw * s, oy + y * s);
    ctx.stroke();
  }
  if (w.terrain.hasLand) {
    const img = makeTerrainImage(w.terrain, w.env.biome ?? 'temperate', 640);
    ctx.drawImage(img.canvas, ox, oy, tw * s, th * s);
  }
  // zones
  for (const z of w.zones) {
    const col = z.kind === 'mine' ? '255,120,90' : z.kind === 'exit' ? '120,220,255' : '255,214,120';
    ctx.strokeStyle = `rgba(${col},0.9)`;
    ctx.fillStyle = `rgba(${col},0.12)`;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(ox + z.x * s, oy + z.y * s, Math.max(4, z.r * s), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(${col},0.95)`;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(z.name, ox + z.x * s, oy + z.y * s - Math.max(6, z.r * s) - 4);
  }
  // forces: own side, plus enemies revealed at the start
  const revealed = new Set<number>();
  for (const t of m.triggers ?? []) {
    if (!('time' in t.when) || t.when.time !== 0) continue;
    for (const a of t.do) {
      if ('reveal' in a) for (const u of w.units) if (u.side === (a.side ?? 1) && u.tags.includes(a.reveal)) revealed.add(u.id);
    }
  }
  for (const u of w.units) {
    if (u.side === 1 && !revealed.has(u.id)) continue;
    const x = ox + u.x * s;
    const y = oy + u.y * s;
    const own = u.side === 0;
    ctx.fillStyle = own ? (u.controllable ? '#7cc4ff' : '#9fe0b8') : '#ff7a6a';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (u.cls.type === 'BASE' || u.cls.type === 'BTY') ctx.rect(x - 4, y - 4, 8, 8);
    else if (u.cls.sub) ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(u.h);
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, 4);
      ctx.lineTo(-5, -4);
      ctx.closePath();
      ctx.restore();
    }
    ctx.fill();
    ctx.stroke();
  }
  // scale bar
  const km = tw > 120000 ? 50 : tw > 50000 ? 20 : tw > 20000 ? 10 : 5;
  const bx = ox + 10;
  const by = oy + th * s - 12;
  ctx.strokeStyle = '#d9e4ec';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + km * 1000 * s, by);
  ctx.stroke();
  ctx.fillStyle = '#d9e4ec';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${km} km`, bx, by - 5);
  // north arrow
  ctx.textAlign = 'center';
  ctx.fillText('N', ox + tw * s - 14, oy + 16);
  ctx.beginPath();
  ctx.moveTo(ox + tw * s - 14, oy + 20);
  ctx.lineTo(ox + tw * s - 14, oy + 34);
  ctx.stroke();
}
