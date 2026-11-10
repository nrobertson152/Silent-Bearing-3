// Helpers and shared battle maps for the campaigns. Coordinates are kilometres,
// x east and y south, headings are compass degrees.

import type { LandFeature, UnitDef, ZoneDef } from '../types';

export const U = (c: string, n?: string, t?: string[], extra: Partial<UnitDef> = {}): UnitDef => ({ c, n, t, ...extra });

export const many = (c: string, list: string[], t?: string[], extra: Partial<UnitDef> = {}): UnitDef[] =>
  list.map((n) => U(c, n, t, extra));

export const anon = (c: string, count: number, t?: string[], extra: Partial<UnitDef> = {}): UnitDef[] =>
  Array.from({ length: count }, () => U(c, undefined, t, extra));

/** Ironbottom Sound, between Guadalcanal, Savo Island and Florida Island. */
export function ironbottomSound(): { w: number; h: number; land: LandFeature[] } {
  return {
    w: 50,
    h: 38,
    land: [
      { k: 'coast', side: 's', depth: 8, rough: 0.35 },
      { k: 'island', x: 3, y: 31, r: 5, rough: 0.3 }, // Cape Esperance
      { k: 'island', x: 12, y: 9, r: 2.3, rough: 0.35 }, // Savo
      { k: 'coast', side: 'n', depth: 7, from: 26, rough: 0.4 }, // Florida Island
      { k: 'island', x: 39, y: 9.5, r: 0.9, rough: 0.3 }, // Tulagi
    ],
  };
}

export const IRONBOTTOM_ZONES: ZoneDef[] = [
  { id: 'west', name: 'The Slot (west)', kind: 'exit', x: 1, y: 14, r: 3 },
];

/** Midway atoll in the open Pacific. */
export function midwayMap(): { w: number; h: number; land: LandFeature[] } {
  return {
    w: 240,
    h: 170,
    land: [
      { k: 'island', x: 70, y: 110, r: 1.1, rough: 0.3 }, // Sand Island
      { k: 'island', x: 73.2, y: 111, r: 0.8, rough: 0.3 }, // Eastern Island
    ],
  };
}

/** The Barents Sea off North Cape, with the Norwegian coast to the south. */
export function northCapeMap(): { w: number; h: number; land: LandFeature[] } {
  return {
    w: 80,
    h: 52,
    land: [{ k: 'coast', side: 's', depth: 4, from: 14, rough: 0.45 }],
  };
}

export const NORTH_CAPE_ZONES: ZoneDef[] = [
  { id: 'altafjord', name: 'Altafjord', kind: 'exit', x: 36, y: 46.5, r: 3.5 },
  { id: 'east', name: 'Kola Inlet', kind: 'exit', x: 79, y: 8, r: 4 },
];

/** Off Samar, with the island's coast to the west. */
export function samarMap(): { w: number; h: number; land: LandFeature[] } {
  return {
    w: 90,
    h: 64,
    land: [{ k: 'coast', side: 'w', depth: 7, rough: 0.35 }],
  };
}
