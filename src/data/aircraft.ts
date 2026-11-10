// Aircraft types. Speeds are cruise speeds for strike transit, radius is the
// practical strike radius, `air` is an air-to-air rating and `tough` how well
// the type survives anti-aircraft fire.

import type { AircraftDef, AirRole, NationId } from './types';

function a(
  id: string, nation: NationId, name: string, role: AirRole, year: number,
  speed: number, radius: number, air: number, tough: number,
  extra: Partial<AircraftDef> = {},
): AircraftDef {
  return { id, nation, name, role, year, speed, radius, air, tough, ...extra };
}

export const AIRCRAFT: Record<string, AircraftDef> = Object.fromEntries(
  [
    // United States
    a('f4f', 'us', 'F4F Wildcat', 'fighter', 1940, 260, 280, 6.5, 1.15),
    a('fm2', 'us', 'FM-2 Wildcat', 'fighter', 1943.5, 270, 280, 7.2, 1.15),
    a('f6f', 'us', 'F6F Hellcat', 'fighter', 1943, 290, 320, 9.5, 1.35, { ammo: 190 }),
    a('f4u', 'us', 'F4U Corsair', 'fighter', 1943, 320, 340, 9.5, 1.25, { ammo: 190 }),
    a('f2a', 'us', 'F2A Buffalo', 'fighter', 1940, 250, 250, 3.5, 0.9),
    a('sbd', 'us', 'SBD Dauntless', 'dive', 1940, 240, 300, 2, 1.05, { dmg: 430, pen: 140, acc: 0.27 }),
    a('sb2c', 'us', 'SB2C Helldiver', 'dive', 1943.8, 250, 320, 2, 1.1, { dmg: 450, pen: 150, acc: 0.24 }),
    a('sb2u', 'us', 'SB2U Vindicator', 'dive', 1938, 220, 250, 1.5, 0.8, { dmg: 350, pen: 110, acc: 0.14 }),
    a('tbd', 'us', 'TBD Devastator', 'torpedo', 1937, 180, 180, 1, 0.6, { torp: 'mk13' }),
    a('tbf', 'us', 'TBF Avenger', 'torpedo', 1942.4, 240, 300, 2.5, 1.3, { torp: 'mk13' }),
    a('pby', 'us', 'PBY Catalina', 'patrol', 1937, 180, 900, 1, 1.0, { night: true, dc: true, asv: false }),
    a('b17', 'us', 'B-17 Flying Fortress', 'level', 1941, 300, 800, 4, 3, { dmg: 280, pen: 80, acc: 0.02 }),
    a('soc', 'us', 'SOC Seagull', 'scout', 1935, 180, 250, 0.5, 0.7),
    // United Kingdom
    a('swordfish', 'uk', 'Fairey Swordfish', 'torpedo', 1936, 160, 220, 1, 1.45, { torp: 'mk12', night: true }),
    a('swordfishasw', 'uk', 'Swordfish (ASV radar)', 'patrol', 1942, 160, 220, 1, 1.45, { night: true, dc: true, asv: true }),
    a('albacore', 'uk', 'Fairey Albacore', 'torpedo', 1940, 170, 250, 1.2, 1.2, { torp: 'mk12', night: true }),
    a('fulmar', 'uk', 'Fairey Fulmar', 'fighter', 1940, 280, 300, 4.5, 1.1),
    a('martlet', 'uk', 'Grumman Martlet', 'fighter', 1941, 260, 280, 6.5, 1.15),
    a('seahurricane', 'uk', 'Sea Hurricane', 'fighter', 1941, 290, 220, 6, 1.0),
    a('spitfire', 'uk', 'Supermarine Spitfire', 'fighter', 1938, 330, 200, 8.5, 1.0),
    a('beaufort', 'uk', 'Bristol Beaufort', 'torpedo', 1940, 300, 600, 2, 1.2, { torp: 'mk12' }),
    a('blenheim', 'uk', 'Bristol Blenheim', 'level', 1937, 300, 600, 2, 1.0, { dmg: 200, pen: 60, acc: 0.03 }),
    a('hampden', 'uk', 'Handley Page Hampden', 'level', 1938, 280, 700, 2, 1.0, { dmg: 220, pen: 70, acc: 0.03 }),
    a('sunderland', 'uk', 'Short Sunderland', 'patrol', 1938, 230, 1000, 3, 1.6, { dc: true, night: false }),
    a('liberator', 'uk', 'VLR Liberator', 'patrol', 1942.5, 300, 1500, 4, 2, { dc: true, asv: true, night: true }),
    a('walrus', 'uk', 'Supermarine Walrus', 'scout', 1935, 160, 250, 0.5, 0.8),
    // Germany
    a('bf109', 'de', 'Bf 109', 'fighter', 1938, 330, 180, 8, 1.0),
    a('fw190', 'de', 'Fw 190', 'fighter', 1941.5, 360, 200, 9, 1.2),
    a('ju87', 'de', 'Ju 87 Stuka', 'dive', 1937, 280, 300, 1.5, 1.0, { dmg: 360, pen: 120, acc: 0.3 }),
    a('ju88', 'de', 'Ju 88', 'dive', 1939, 340, 600, 3, 1.2, { dmg: 380, pen: 110, acc: 0.2 }),
    a('he111t', 'de', 'He 111 (torpedo)', 'torpedo', 1941, 300, 700, 2.5, 1.3, { torp: 'f5' }),
    a('fw200', 'de', 'Fw 200 Condor', 'patrol', 1940, 330, 1500, 2.5, 1.2, { dmg: 250, pen: 60, acc: 0.06 }),
    a('ar196', 'de', 'Arado Ar 196', 'scout', 1938, 230, 300, 2, 0.9),
    // Japan
    a('a6m', 'jp', 'A6M Zero', 'fighter', 1940.5, 330, 380, 8.5, 0.7, { ammo: 110 }),
    a('d3a', 'jp', 'D3A Val', 'dive', 1940, 300, 350, 2, 0.8, { dmg: 270, pen: 90, acc: 0.3 }),
    a('b5n', 'jp', 'B5N Kate', 'torpedo', 1937, 280, 350, 1.5, 0.8, { torp: 'type91' }),
    a('g4m', 'jp', 'G4M Betty', 'torpedo', 1941, 340, 1000, 3, 0.5, { torp: 'type91' }),
    a('d4y', 'jp', 'D4Y Judy', 'dive', 1943.5, 400, 400, 2, 0.8, { dmg: 400, pen: 130, acc: 0.25 }),
    a('b6n', 'jp', 'B6N Jill', 'torpedo', 1943.8, 330, 400, 2, 0.9, { torp: 'type91' }),
    a('kamikaze', 'jp', 'Special Attack Unit', 'kamikaze', 1944.8, 340, 400, 1, 0.8, { dmg: 520, pen: 150, acc: 0.34 }),
    a('e13a', 'jp', 'E13A Jake', 'scout', 1940, 220, 400, 1, 0.8),
    a('h6k', 'jp', 'H6K Mavis', 'patrol', 1938, 260, 1200, 2, 1.0),
    // Italy
    a('sm79', 'it', 'SM.79 Sparviero', 'torpedo', 1937, 330, 600, 2.5, 1.0, { torp: 'itair' }),
    a('cr42', 'it', 'CR.42 Falco', 'fighter', 1939, 300, 250, 4, 0.9),
    a('mc202', 'it', 'MC.202 Folgore', 'fighter', 1941.5, 360, 250, 8, 1.0),
    a('ju87it', 'it', 'Ju 87 Picchiatello', 'dive', 1940, 280, 300, 1.5, 1.0, { dmg: 360, pen: 120, acc: 0.27 }),
  ].map((d) => [d.id, d]),
);

export const ROLE_NAMES: Record<AirRole, string> = {
  fighter: 'Fighters',
  dive: 'Dive bombers',
  torpedo: 'Torpedo bombers',
  level: 'Level bombers',
  scout: 'Scouts',
  patrol: 'Patrol planes',
  kamikaze: 'Special attack',
};
