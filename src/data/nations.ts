import type { NationDef, NationId } from './types';

export const NATIONS: Record<NationId, NationDef> = {
  us: {
    id: 'us', name: 'United States', navy: 'United States Navy', adj: 'American',
    prefix: 'USS ', merchantPrefix: 'SS ', color: '#4a7cc4',
    hull: '#58636f', deck: '#6f7a87', sup: '#8f99a5', playable: true,
    pilots: [[1939, 0.95], [1943, 1.1], [1944, 1.2]], crew: 1.0,
    asw: [[1939, 0.75], [1942.5, 0.95], [1943.5, 1.2]],
  },
  uk: {
    id: 'uk', name: 'United Kingdom', navy: 'Royal Navy', adj: 'British',
    prefix: 'HMS ', merchantPrefix: 'SS ', color: '#c9a227',
    hull: '#8d969c', deck: '#ac9978', sup: '#b9c0c5', playable: true,
    pilots: [[1939, 1.0]], crew: 1.05,
    asw: [[1939, 0.85], [1941, 1.0], [1943, 1.3]],
  },
  de: {
    id: 'de', name: 'Germany', navy: 'Kriegsmarine', adj: 'German',
    prefix: '', merchantPrefix: '', color: '#9aa3a9',
    hull: '#878e93', deck: '#b19e7c', sup: '#a8afb4', playable: true,
    pilots: [[1939, 1.05], [1943, 0.95], [1944, 0.85]], crew: 1.08,
    asw: [[1939, 0.8]],
  },
  jp: {
    id: 'jp', name: 'Japan', navy: 'Imperial Japanese Navy', adj: 'Japanese',
    prefix: '', merchantPrefix: '', color: '#c8323a',
    hull: '#666c71', deck: '#8a6a4c', sup: '#80878c', playable: true,
    pilots: [[1939, 1.25], [1942.6, 1.1], [1943.5, 0.85], [1944.3, 0.65], [1945, 0.55]],
    nightBonus: 1.45, crew: 1.08,
    asw: [[1939, 0.55], [1943.5, 0.7]],
  },
  it: {
    id: 'it', name: 'Italy', navy: 'Regia Marina', adj: 'Italian',
    prefix: '', merchantPrefix: '', color: '#3f9a63',
    hull: '#939a9e', deck: '#ad9b80', sup: '#b2b8bc', playable: false,
    pilots: [[1939, 0.95]], crew: 0.9,
    asw: [[1939, 0.7]],
  },
  nl: {
    id: 'nl', name: 'Netherlands', navy: 'Royal Netherlands Navy', adj: 'Dutch',
    prefix: 'HNLMS ', merchantPrefix: 'SS ', color: '#e07a2b',
    hull: '#899097', deck: '#a08f78', sup: '#aeb5ba', playable: false,
    pilots: [[1939, 0.9]], crew: 0.95,
    asw: [[1939, 0.7]],
  },
};

export function aswSkill(n: NationId, year: number): number {
  let q = 1;
  for (const [y, v] of NATIONS[n].asw) if (year >= y) q = v;
  return q;
}

export function pilotQuality(n: NationId, year: number): number {
  let q = 1;
  for (const [y, v] of NATIONS[n].pilots) if (year >= y) q = v;
  return q;
}

export const SIDE_OF: Record<NationId, 'allies' | 'axis'> = {
  us: 'allies', uk: 'allies', nl: 'allies', de: 'axis', jp: 'axis', it: 'axis',
};
