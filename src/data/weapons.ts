// Naval guns and torpedoes. Figures are rounded from published wartime data and
// then compressed for play: ranges are practical engagement ranges, damage scales
// with calibre^1.8, dispersion is a fraction of range.

import type { GunDef, TorpDef } from './types';

const dmgFor = (cal: number) => Math.round(0.00848 * Math.pow(cal, 1.8));

function g(
  id: string, name: string, cal: number, range: number, reload: number,
  pen: number, vel: number, disp: number, fire: number, dp = false, dmg?: number,
): GunDef {
  return { id, name, cal, range, reload, dmg: dmg ?? dmgFor(cal), pen, vel, disp, fire, dp };
}

export const GUNS: Record<string, GunDef> = Object.fromEntries(
  [
    // United States
    g('16/50', '16-inch/50 Mark 7', 406, 32000, 30, 500, 640, 0.0105, 0.08),
    g('16/45', '16-inch/45 Mark 6', 406, 30000, 30, 450, 610, 0.0115, 0.08),
    g('16/45old', '16-inch/45 Mark 5', 406, 27000, 34, 400, 580, 0.0125, 0.08),
    g('14/50', '14-inch/50 Mark 11', 356, 27000, 34, 350, 570, 0.0125, 0.08),
    g('8/55', '8-inch/55 Mark 9', 203, 25000, 15, 170, 560, 0.0150, 0.12),
    g('6/47', '6-inch/47 Mark 16', 152, 21000, 6, 115, 520, 0.0170, 0.13),
    g('5/38', '5-inch/38 Mark 12', 127, 14500, 4, 45, 480, 0.0210, 0.10, true),
    g('5/25', '5-inch/25', 127, 11000, 5, 40, 420, 0.0230, 0.10, true),
    g('4/50', '4-inch/50 Mark 9', 102, 12000, 6, 30, 450, 0.0230, 0.08),
    g('3/50', '3-inch/50', 76, 9000, 4, 20, 430, 0.0240, 0.05, true),
    g('40mm', '40 mm Bofors', 40, 4000, 1.2, 10, 400, 0.0300, 0.03, true),
    g('20mm', '20 mm Oerlikon', 20, 2500, 0.6, 5, 380, 0.0350, 0.02, true),
    // United Kingdom
    g('16uk', 'BL 16-inch Mark I', 406, 28000, 35, 430, 590, 0.0125, 0.08),
    g('15/42', 'BL 15-inch Mark I', 381, 26000, 32, 380, 580, 0.0120, 0.08),
    g('14/45', 'BL 14-inch Mark VII', 356, 28000, 34, 390, 600, 0.0120, 0.08),
    g('9.2in', 'BL 9.2-inch coastal gun', 234, 28000, 30, 200, 560, 0.0160, 0.10),
    g('8/50', 'BL 8-inch Mark VIII', 203, 24000, 15, 160, 550, 0.0150, 0.12),
    g('6/50', 'BL 6-inch Mark XXIII', 152, 21000, 8, 110, 520, 0.0165, 0.13),
    g('6sec', 'BL 6-inch Mark XII', 152, 15000, 9, 90, 480, 0.0190, 0.12),
    g('5.25', 'QF 5.25-inch Mark I', 133, 17000, 7, 70, 500, 0.0190, 0.11, true),
    g('4.7', 'QF 4.7-inch Mark XII', 120, 13500, 6, 35, 470, 0.0220, 0.10),
    g('4.5', 'QF 4.5-inch Mark III', 114, 13000, 5, 35, 470, 0.0210, 0.10, true),
    g('4in', 'QF 4-inch Mark XVI', 102, 11000, 5, 28, 450, 0.0230, 0.08, true),
    g('2pdr', 'QF 2-pounder', 40, 3500, 1.2, 8, 380, 0.0320, 0.03, true),
    // Germany
    g('38cm', '38 cm SK C/34', 380, 30000, 28, 440, 680, 0.0108, 0.08),
    g('28cm', '28 cm SK C/34', 283, 28000, 20, 320, 690, 0.0115, 0.10),
    g('28cmDL', '28 cm SK C/28', 283, 26000, 22, 290, 650, 0.0120, 0.10),
    g('20.3cm', '20.3 cm SK C/34', 203, 25000, 14, 175, 640, 0.0140, 0.12),
    g('15cm', '15 cm SK C/28', 150, 18000, 8, 90, 560, 0.0170, 0.12),
    g('15cmTb', '15 cm TbtsK C/36', 150, 17000, 8, 85, 540, 0.0190, 0.12),
    g('12.7cm', '12.7 cm SK C/34', 127, 14000, 5, 40, 520, 0.0200, 0.10),
    g('10.5cm', '10.5 cm SK C/32', 105, 12000, 4, 30, 500, 0.0220, 0.08, true),
    g('8.8cm', '8.8 cm SK C/35', 88, 9000, 5, 22, 450, 0.0240, 0.06),
    g('2cm', '2 cm Flak 30', 20, 2500, 0.6, 5, 380, 0.0350, 0.02, true),
    // Japan
    g('46cm', '46 cm/45 Type 94', 460, 34000, 40, 560, 650, 0.0115, 0.08),
    g('41cm', '41 cm/45 3rd Year Type', 410, 30000, 32, 430, 610, 0.0120, 0.08),
    g('36cm', '35.6 cm/45 41st Year Type', 356, 28000, 34, 340, 600, 0.0125, 0.08),
    g('20cm', '20.3 cm/50 3rd Year Type', 203, 25000, 15, 165, 580, 0.0145, 0.12),
    g('15.5cm', '15.5 cm/60 3rd Year Type', 155, 22000, 9, 110, 600, 0.0160, 0.12),
    g('15cmJ', '15.2 cm/50 41st Year Type', 152, 17000, 9, 85, 520, 0.0185, 0.12),
    g('14cm', '14 cm/50 3rd Year Type', 140, 16000, 8, 60, 520, 0.0185, 0.12),
    g('12.7cmJ', '12.7 cm/50 3rd Year Type', 127, 14000, 6, 40, 500, 0.0200, 0.10),
    g('12cmJ', '12 cm/45 10th Year Type', 120, 11000, 6, 32, 460, 0.0230, 0.08, true),
    g('10cmJ', '10 cm/65 Type 98', 100, 13000, 3.5, 30, 560, 0.0200, 0.08, true),
    g('14cmSub', '14 cm/40 deck gun', 140, 10000, 8, 50, 450, 0.0240, 0.10),
    g('25mm', '25 mm Type 96', 25, 2500, 0.6, 6, 380, 0.0350, 0.02, true),
    // Italy
    g('381It', '381 mm/50 Ansaldo', 381, 30000, 45, 450, 700, 0.0165, 0.08),
    g('320It', '320 mm/44', 320, 25000, 40, 300, 620, 0.0160, 0.08),
    g('203It', '203 mm/53 Ansaldo', 203, 24000, 18, 170, 620, 0.0175, 0.12),
    g('152It', '152 mm/53 OTO', 152, 20000, 9, 100, 560, 0.0185, 0.12),
    g('120It', '120 mm/50 OTO', 120, 13000, 7, 32, 480, 0.0220, 0.10),
    // Netherlands
    g('15cmNL', '15 cm/50 Bofors', 150, 20000, 8, 95, 520, 0.0180, 0.12),
    g('12cmNL', '12 cm/50 Bofors', 120, 13000, 6, 32, 470, 0.0220, 0.10),
  ].map((d) => [d.id, d]),
);

export const TORPS: Record<string, TorpDef> = Object.fromEntries(
  ([
    // United States: the infamous Mark 14/15 depth and exploder problems
    { id: 'mk15', name: 'Mark 15', speed: 45, range: 5500, dmg: 780, wake: true, dud: [[1939, 0.25], [1943.7, 0.08]] },
    { id: 'mk14', name: 'Mark 14', speed: 46, range: 4100, dmg: 820, wake: true, dud: [[1939, 0.30], [1943.7, 0.08]] },
    { id: 'mk13', name: 'Mark 13 (aerial)', speed: 33, range: 5000, dmg: 620, wake: true, dud: [[1939, 0.25], [1944, 0.05]], air: true },
    { id: 'mk8', name: 'Mark 8 (PT boat)', speed: 36, range: 8000, dmg: 650, wake: true, dud: [[1939, 0.15]] },
    // United Kingdom
    { id: 'mk9', name: 'Mark IX', speed: 41, range: 10000, dmg: 800, wake: true, dud: [[1939, 0.05]] },
    { id: 'mk8uk', name: 'Mark VIII', speed: 45, range: 4600, dmg: 800, wake: true, dud: [[1939, 0.05]] },
    { id: 'mk12', name: 'Mark XII (aerial)', speed: 40, range: 1400, dmg: 560, wake: true, dud: [[1939, 0.06]], air: true },
    // Germany: magnetic pistol failures in the Norwegian campaign
    { id: 'g7a', name: 'G7a (steam)', speed: 44, range: 6000, dmg: 850, wake: true, dud: [[1939, 0.22], [1940.6, 0.06]] },
    { id: 'g7e', name: 'G7e (electric)', speed: 30, range: 5000, dmg: 850, wake: false, dud: [[1939, 0.28], [1940.6, 0.07]] },
    { id: 'f5', name: 'LT F5 (aerial)', speed: 33, range: 2000, dmg: 600, wake: true, dud: [[1939, 0.08]], air: true },
    // Japan: the Type 93 "Long Lance"
    { id: 'type93', name: 'Type 93 "Long Lance"', speed: 48, range: 20000, dmg: 1250, wake: false, dud: [[1939, 0.03]] },
    { id: 'type95', name: 'Type 95 (submarine)', speed: 49, range: 9000, dmg: 1050, wake: false, dud: [[1939, 0.03]] },
    { id: 'type91', name: 'Type 91 (aerial)', speed: 42, range: 2000, dmg: 720, wake: true, dud: [[1939, 0.04]], air: true },
    // Italy and the Netherlands
    { id: 'si533', name: 'Si 270/533', speed: 48, range: 4000, dmg: 800, wake: true, dud: [[1939, 0.08]] },
    { id: 'itair', name: 'Whitehead 450 (aerial)', speed: 40, range: 3000, dmg: 600, wake: true, dud: [[1939, 0.08]], air: true },
    { id: 'nl533', name: '53 cm Whitehead', speed: 43, range: 6000, dmg: 780, wake: true, dud: [[1939, 0.08]] },
  ] as TorpDef[]).map((d) => [d.id, d]),
);

export function dudChance(t: TorpDef, year: number): number {
  if (!t.dud) return 0;
  let p = 0;
  for (const [y, v] of t.dud) if (year >= y) p = v;
  return p;
}
