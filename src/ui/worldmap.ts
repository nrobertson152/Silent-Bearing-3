// The campaign war map: an SVG world map coloured by who held what on a given
// date, with the campaign's battles marked on it.

import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countries110 from 'world-atlas/countries-110m.json';
import { alignmentOn, THEATRES, type Alignment } from '../data/warmap';
import type { NationId } from '../data/types';
import { esc } from './dom';

type Countries = FeatureCollection<Geometry, { name: string }>;

let world: Countries | null = null;
function countries(): Countries {
  if (!world) {
    const topo = countries110 as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    world = feature(topo, topo.objects.countries) as Countries;
  }
  return world;
}

export const HOME_COUNTRY: Partial<Record<NationId, string>> = { uk: '826', us: '840', de: '276', jp: '392', it: '380' };

const FILL: Record<Alignment, string> = {
  allies: '#2d5476',
  axis: '#6f2c28',
  occupied: '#523936',
  neutral: '#394148',
};

/** A battle fought (with its result), the next one, one still to come (not drawn), or one on the plan of a campaign not yet begun. */
export type MarkerState = 'decisive' | 'victory' | 'marginal' | 'defeat' | 'next' | 'future' | 'plan';

export interface MapMarker {
  id: string;
  lon: number;
  lat: number;
  label: string;
  state: MarkerState;
  index: number;
}

const OCEAN_LABELS: Record<keyof typeof THEATRES, [number, number, string][]> = {
  atlantic: [[-38, 32, 'North Atlantic'], [-22, -22, 'South Atlantic'], [17, 36.4, 'Mediterranean'], [-2, 67, 'Norwegian Sea']],
  northsea: [[-32, 52, 'North Atlantic'], [3.5, 56, 'North Sea'], [4, 69, 'Norwegian Sea'], [35, 75.5, 'Barents Sea']],
  pacific: [[172, 8, 'Pacific Ocean'], [86, -12, 'Indian Ocean'], [114, 13, 'South China Sea'], [158, -18, 'Coral Sea']],
};

/** SVG markup for the theatre on `date`; markers carry data-mission attributes. */
export function warMapSvg(
  theatre: keyof typeof THEATRES, date: string, markers: MapMarker[], home: NationId | null, w = 1000, h = 700,
): string {
  const th = THEATRES[theatre];
  const [x0, y0, x1, y1] = th.bounds;
  const edge: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const lon = x0 + ((x1 - x0) * i) / 8;
    edge.push([lon, y0], [lon, y1]);
  }
  for (let i = 0; i <= 8; i++) {
    const lat = y0 + ((y1 - y0) * i) / 8;
    edge.push([x0, lat], [x1, lat]);
  }
  // leave room for the date at the top left and the legend at the bottom
  const proj = geoNaturalEarth1().rotate([th.rotate, 0]).fitExtent([[24, 70], [w - 24, h - 44]], { type: 'MultiPoint', coordinates: edge });
  const path = geoPath(proj);
  const homeId = home ? HOME_COUNTRY[home] : undefined;
  let out = `<svg class="warmap" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">`;
  out += `<defs><radialGradient id="sea" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#16324a"/><stop offset="1" stop-color="#0a1724"/></radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>`;
  out += `<rect width="${w}" height="${h}" fill="url(#sea)"/>`;
  out += `<path d="${path(geoGraticule10()) ?? ''}" fill="none" stroke="rgba(160,196,224,0.07)" stroke-width="0.8"/>`;
  let homePath = '';
  for (const f of countries().features) {
    const d = path(f);
    if (!d) continue;
    const id = (f.id as string | undefined) ?? '';
    const a = alignmentOn(id, date);
    out += `<path d="${d}" fill="${FILL[a]}" stroke="rgba(10,19,28,0.85)" stroke-width="0.6"><title>${esc(f.properties.name)}</title></path>`;
    if (id === homeId) homePath = d;
  }
  if (homePath) out += `<path d="${homePath}" fill="none" stroke="#d6a94a" stroke-width="1.4" opacity="0.9"/>`;
  for (const [lon, lat, name] of OCEAN_LABELS[theatre]) {
    const p = proj([lon, lat]);
    if (!p) continue;
    out += `<text x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" class="wm-ocean">${esc(name.toUpperCase())}</text>`;
  }
  // a thin line through the campaign so far
  const done = markers.filter((m) => m.state !== 'future').sort((a, b) => a.index - b.index);
  if (done.length > 1) {
    const pts = done.map((m) => proj([m.lon, m.lat])).filter((p): p is [number, number] => !!p);
    out += `<polyline points="${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="none" stroke="rgba(214,169,74,0.35)" stroke-width="1.2" stroke-dasharray="4 5"/>`;
  }
  const shown = markers
    .filter((m) => m.state !== 'future')
    .map((m) => ({ m, p: proj([m.lon, m.lat]) }))
    .filter((x): x is { m: MapMarker; p: [number, number] } => !!x.p);
  const labels = placeLabels(shown, w, h);
  // markers: later ones underneath
  for (const { m, p } of [...shown].sort((a, b) => b.m.index - a.m.index)) {
    const [x, y] = p;
    const cls = `wm-mark ${m.state}`;
    out += `<g class="${cls}" data-mission="${esc(m.id)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><title>${esc(m.label)}</title>`;
    if (m.state === 'next') out += '<circle r="16" class="wm-pulse"/><circle r="9" class="wm-ring"/>';
    out += `<circle r="${m.state === 'next' ? 5.5 : 4.5}" class="wm-dot"/>`;
    const l = labels.get(m.id);
    if (l) out += `<text x="${l.dx}" y="${l.dy}" text-anchor="${l.anchor}" class="wm-label">${esc(m.label)}</text>`;
    out += '</g>';
  }
  out += '</svg>';
  return out;
}

/**
 * Battles fought in the same waters would print their names over each other. Labels are placed
 * greedily, the next operation first and then the latest battles, at the first of four spots round
 * the dot that is clear of the dots and of the labels already placed. A label with no room is left
 * off: the dot still shows its name on hover.
 */
function placeLabels(shown: { m: MapMarker; p: [number, number] }[], w: number, h: number) {
  const boxes: [number, number, number, number][] = shown.map(({ p }) => [p[0] - 6, p[1] - 6, p[0] + 6, p[1] + 6]);
  const out = new Map<string, { dx: number; dy: number; anchor: 'start' | 'end' }>();
  const order = [...shown].sort((a, b) => Number(b.m.state === 'next') - Number(a.m.state === 'next') || b.m.index - a.m.index);
  const spots = [[10, -8, 'start'], [10, 16, 'start'], [-10, -8, 'end'], [-10, 16, 'end']] as const;
  for (const { m, p } of order) {
    const lw = m.label.length * 7.4 + 4;
    for (const [dx, dy, anchor] of spots) {
      const x0 = anchor === 'start' ? p[0] + dx : p[0] + dx - lw;
      const b: [number, number, number, number] = [x0, p[1] + dy - 11, x0 + lw, p[1] + dy + 3];
      if (b[0] < 2 || b[2] > w - 2 || b[1] < 2 || b[3] > h - 2) continue;
      if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
      boxes.push(b);
      out.set(m.id, { dx, dy, anchor });
      break;
    }
  }
  return out;
}
