import type { CampaignDef } from '../types';
import { NORTH_CAPE_ZONES, U, anon, many, northCapeMap } from './common';

export const DE: CampaignDef = {
  nation: 'de',
  title: 'Grey Wolves',
  subtitle: 'The Kriegsmarine at sea',
  years: '1939–1943',
  theater: 'northsea',
  intro:
    'In September 1939 the German navy is years away from being ready for war with Britain. It has a handful of fast, modern capital ships, some cruisers and destroyers, and fifty-seven U-boats. Against it stands the largest navy in the world.\n\nIts strategy must be the strategy of the weak: raids on the shipping that Britain needs to survive, by surface raiders and above all by U-boats. Your campaign follows its sailors from the first daring strikes of the war to the long, losing battle in the North Atlantic and the Arctic.',
  epilogue:
    'Scharnhorst was the last German capital ship to fight at sea. Tirpitz was sunk by RAF bombers in her Norwegian fjord in November 1944. The U-boat war went on to the very end, but after May 1943 it could not be won: of some 40,000 men who served in the U-boats, about 30,000 did not come home. The war in Europe ended on 8 May 1945.',
  startFleet: [
    { c: 'type7b', n: 'U-47' },
    { c: 'hipper', n: 'Admiral Hipper' },
    { c: 'z1934', n: 'Karl Galster' },
  ],
  startPrestige: 400,
  missions: [
    // ------------------------------------------------------------------ 1
    {
      id: 'de1',
      title: 'Scapa Flow',
      date: '1939-10-14',
      place: 'Scapa Flow, Orkney',
      geo: [-3.0, 58.9],
      enemyNation: 'uk',
      news: [
        '1 September 1939: Germany invades Poland.',
        '3 September: Britain and France declare war. The liner Athenia is torpedoed on the first day.',
        'Scapa Flow, the Home Fleet\'s anchorage, is thought to be impregnable.',
      ],
      brief:
        'Scapa Flow, the great anchorage of the British Home Fleet in the Orkneys, has been considered impregnable since a U-boat was lost trying to enter it in 1918. Aerial photographs show a gap: the blockships in Kirk Sound, on the eastern side, have shifted, and at high water a determined captain might squeeze past them.\n\nKapitänleutnant Günther Prien has taken U-47 through on the surface. It is a clear night, lit by the northern lights. The water is too shallow to dive deep. Somewhere in the anchorage there should be capital ships.\n\nFind them, torpedo them, and get out the way you came before the patrols wake up.',
      history:
        'Most of the Home Fleet had sailed, but Prien found the old battleship Royal Oak. His first salvo did little; he reloaded and fired again, and Royal Oak capsized in thirteen minutes with the loss of 835 men. U-47 slipped out through Kirk Sound. Churchill ordered the Churchill Barriers built across the eastern entrances.',
      hints: [
        'Stay on the surface in the dark and keep away from the patrol trawlers.',
        'The water is too shallow to go deep. Once you fire, the destroyers will come.',
        'German torpedoes in 1939 often fail to explode. Fire more than one.',
      ],
      env: { tod: 'night', wx: 'clear', aurora: true, shallow: true, sea: 0, biome: 'temperate' },
      map: {
        w: 32, h: 26, seed: 311, baseLand: true,
        land: [
          { k: 'water', x: 15, y: 13, r: 8.6, elong: 1.25, rough: 0.18 },
          { k: 'channel', pts: [[22.5, 7.5], [26, 6.3], [32, 6]], w: 0.45, rough: 0.12 },
          { k: 'channel', pts: [[12, 19], [12, 26]], w: 1.5 },
          { k: 'channel', pts: [[5, 10], [0, 9]], w: 1.0 },
          { k: 'island', x: 12.5, y: 18, r: 1.5, rough: 0.3 },
          { k: 'island', x: 10.5, y: 11.5, r: 0.6, rough: 0.3 },
        ],
      },
      zones: [{ id: 'escape', name: 'Kirk Sound (open sea)', kind: 'exit', x: 31.6, y: 6, r: 1.4 }],
      player: {
        groups: [],
        slots: 1,
        allowed: ['SS'],
        spawn: { x: 29.5, y: 6.1, h: 265 },
        loaner: { c: 'type7b', n: 'U-47' },
        auto: { kind: 'sub', prefer: ['royaloak'], pts: [[24, 7.2], [21.5, 8.2]], exit: 'escape' },
      },
      enemy: [
        { id: 'royaloak', units: [U('revenge', 'Royal Oak', ['royaloak'])], x: 20, y: 7.2, h: 200, formation: 'anchored', alert: false, alertDelay: 240, behavior: { kind: 'hold' } },
        { id: 'ironduke', units: [U('revenge', 'Iron Duke', ['ironduke'], { hp: 0.8 })], x: 12.5, y: 14.5, h: 90, formation: 'anchored', alert: false, alertDelay: 240, behavior: { kind: 'hold' } },
        { id: 'trawlers', units: many('trawler', ['Daneman', 'Cape Warwick']), x: 16, y: 12, h: 270, formation: 'line', spacing: 4, speed: 8, crew: 0.8, behavior: { kind: 'patrol', pts: [[18, 11], [12, 9.5], [9, 14], [16, 16]], engage: 3, speed: 8 } },
        {
          id: 'boom', units: [U('hclass', 'Ivanhoe'), U('hclass', 'Impulsive')], x: 12, y: 21.5, h: 0, formation: 'anchored', spacing: 0.6, alert: false, alertDelay: 200,
          behavior: { kind: 'hold', onAlert: { kind: 'hunt', radius: 30 } },
        },
      ],
      objectives: [
        { id: 'oak', text: 'Sink HMS Royal Oak', kind: 'destroy', tag: 'royaloak' },
        { id: 'out', text: 'Escape through Kirk Sound', kind: 'reach', tag: 'ss', zone: 'escape', count: 1 },
        { id: 'stealth', text: 'Stay undetected until your first torpedo hits', kind: 'undetected', until: 'firsthit', bonus: true },
        { id: 'duke', text: 'Also torpedo the Iron Duke', kind: 'damage', tag: 'ironduke', frac: 0.79, count: 1, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Kapitänleutnant Prien', msg: 'We are through Kirk Sound. The Flow is lit by the northern lights. The anchorage should be to the west. Find what is here, fire, and get out the way we came.' }] },
        { when: { any: [{ hp: 'royaloak', below: 0.999 }, { hp: 'ironduke', below: 0.79 }] }, do: [{ flag: 'firsthit' }, { msg: 'A hit! The anchorage is waking up.' }, { alert: 'boom' }, { alert: 'royaloak' }] },
        { when: { lost: 'royaloak', count: 1 }, do: [{ from: 'Prien', msg: 'She is capsizing. Now get us out of here!' }] },
      ],
      timeLimit: 70,
      reward: 260,
    },
    // ------------------------------------------------------------------ 2
    {
      id: 'de2',
      title: 'Operation Juno',
      date: '1940-06-08',
      place: 'Norwegian Sea',
      geo: [4.0, 69.0],
      enemyNation: 'uk',
      news: [
        'October 1939: U-47 sinks Royal Oak inside Scapa Flow.',
        'April 1940: the invasion of Norway. Ten destroyers are lost at Narvik.',
        'June: the Allies evacuate northern Norway. Scharnhorst and Gneisenau sail to intercept.',
      ],
      brief:
        'The Allies are evacuating northern Norway, and Admiral Marschall has taken Scharnhorst and Gneisenau north to attack their shipping. In the afternoon lookouts sight smoke: a carrier, escorted by only two destroyers.\n\nShe is HMS Glorious, returning to Scapa Flow with RAF fighters aboard. None of her aircraft are in the air and she has no scout patrols out. If she can turn into the wind and fly off her Swordfish she will be dangerous; if she can outrun you she will be safe.\n\nOpen fire at long range before she can launch aircraft. Watch out for the destroyers: they will lay smoke and attack with torpedoes.',
      history:
        'Scharnhorst hit Glorious with her third salvo at 24 kilometres. The destroyers Ardent and Acasta fought to the end; Acasta\'s last torpedo hit Scharnhorst and killed 48 men. Glorious, Ardent and Acasta were sunk with the loss of more than 1,500 men, one of the Royal Navy\'s worst disasters of the war.',
      hints: [
        'Scharnhorst\'s 28 cm guns can reach the carrier before she can escape: open fire early.',
        'Destroyers making smoke will try to hide the carrier. Keep a gun on them.',
      ],
      env: { tod: 'day', wx: 'clear', sea: 1, biome: 'arctic' },
      map: { w: 100, h: 50, seed: 321, land: [] },
      zones: [{ id: 'scapa', name: 'Toward Scapa Flow', kind: 'exit', x: 99, y: 45, r: 6 }],
      player: {
        groups: [{ id: 'battlegroup', units: [U('scharnhorst', 'Gneisenau'), U('scharnhorst', 'Scharnhorst')], x: 14, y: 28, h: 90, spacing: 1.2, speed: 28 }],
        slots: 2,
        allowed: ['CA', 'DD'],
        spawn: { x: 16, y: 33, h: 90, formation: 'line', spacing: 1.4 },
      },
      enemy: [
        { id: 'glorious', units: [U('glorious', 'Glorious', ['glorious'])], x: 40, y: 18, h: 120, speed: 17, airReady: 25, behavior: { kind: 'flee', exit: 'scapa' } },
        { id: 'destroyers', units: [U('hclass', 'Ardent'), U('hclass', 'Acasta')], x: 38, y: 20, h: 120, formation: 'line', spacing: 2, speed: 17, behavior: { kind: 'escort', of: 'glorious', radius: 14 } },
      ],
      objectives: [
        { id: 'glorious', text: 'Sink HMS Glorious', kind: 'destroy', tag: 'glorious' },
        { id: 'escape', text: 'Do not let Glorious escape', kind: 'prevent', tag: 'glorious', zone: 'scapa' },
        { id: 'dd', text: 'Sink both destroyers', kind: 'destroy', tag: 'dd', count: 2, bonus: true },
        { id: 'hull', text: 'Keep both battleships above 70% hull', kind: 'hpAbove', tag: 'scharnhorst', frac: 0.7, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Admiral Marschall', msg: 'Smoke on the horizon: a carrier with two destroyers and no aircraft in the air. Open fire at long range before she can fly off her planes.' }, { reveal: 'glorious' }] },
        { when: { time: 25 }, do: [{ msg: 'Glorious is turning into the wind. She is trying to launch aircraft!' }] },
      ],
      timeLimit: 90,
      reward: 280,
    },
    // ------------------------------------------------------------------ 3
    {
      id: 'de3',
      title: 'The Happy Time',
      date: '1940-10-18',
      place: 'North Atlantic, west of the Hebrides',
      geo: [-12.0, 57.0],
      enemyNation: 'uk',
      news: [
        'June 1940: France falls. U-boats move to bases on the Biscay coast.',
        'The U-boat crews call the months that follow "die glückliche Zeit", the Happy Time.',
        'October: slow convoy SC 7 is sighted west of the Hebrides.',
      ],
      brief:
        'Slow convoy SC 7, some thirty old merchant ships from Sydney, Cape Breton, is plodding east at seven knots towards the North Channel. Its escort is a handful of sloops and corvettes with no radar and no experience of working together.\n\nA pack of U-boats has gathered ahead of it, including Otto Kretschmer\'s U-99 and Joachim Schepke\'s U-100. Kretschmer\'s method is simple and deadly: attack on the surface at night. A U-boat\'s low silhouette is almost invisible in the dark, and the escorts\' ASDIC cannot detect a boat on the surface.\n\nGet inside the columns and fire at close range.',
      history:
        'In one night the U-boats sank twenty ships of SC 7, more than half the convoy; U-99 alone sank seven. The next night they fell on convoy HX 79 and sank twelve more. Not a single U-boat was lost. It was the worst convoy disaster of the war so far.',
      hints: [
        'On the surface at night you are almost invisible. Escorts cannot hear a surfaced boat with ASDIC.',
        'Fire from close range and pick the biggest ships. Dive only if an escort comes straight at you.',
      ],
      env: { tod: 'night', wx: 'clear', sea: 2, biome: 'temperate' },
      map: { w: 56, h: 44, seed: 331, land: [] },
      zones: [{ id: 'east', name: 'North Channel', kind: 'exit', x: 55.5, y: 22, r: 4 }],
      player: {
        groups: [
          { id: 'pack', units: [U('type7b', 'U-99', [], { x: 44, y: 10 }), U('type7b', 'U-100', [], { x: 46, y: 34 }), U('type7b', 'U-46', [], { x: 50, y: 20 })], x: 46, y: 22, h: 270, speed: 8 },
        ],
        slots: 1,
        allowed: ['SS'],
        spawn: { x: 40, y: 16, h: 250 },
      },
      enemy: [
        {
          id: 'convoy', units: [...many('tramp', ['Empire Brigade', 'Fiscus', 'Assyrian', 'Beatus', 'Creekirk', 'Empire Miniver', 'Gunborg', 'Niritos', 'Clintonia', 'Boekolo', 'Sedgepool', 'Thalia', 'Languedoc', 'Scoresby']), U('tanker', 'Shekatika')],
          x: 8, y: 22, h: 90, formation: 'box', spacing: 0.8, speed: 7,
          behavior: { kind: 'route', pts: [[55.5, 22]], exit: 'east', speed: 7 },
        },
        {
          id: 'escort', units: [...many('sloop', ['Scarborough', 'Fowey', 'Leith'], [], { special: ['noRadar'] }), ...many('flower', ['Bluebell', 'Heartsease'], [], { special: ['noRadar'] })],
          x: 10, y: 22, h: 90, formation: 'screen', spacing: 3, speed: 8, behavior: { kind: 'escort', of: 'convoy', radius: 8 },
        },
      ],
      objectives: [
        { id: 'tons', text: 'Sink 30,000 tons of shipping', kind: 'tonnage', tons: 30000 },
        { id: 'more', text: 'Sink 50,000 tons', kind: 'tonnage', tons: 50000, bonus: true },
        { id: 'boats', text: 'Lose no U-boats', kind: 'protect', tag: 'ss', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Admiral Dönitz (BdU)', msg: 'Convoy SC 7 is steering east towards the North Channel, slow and weakly escorted. Attack on the surface at night. Get inside the columns.' }, { reveal: 'merchant' }] },
      ],
      timeLimit: 120,
      reward: 280,
    },
    // ------------------------------------------------------------------ 4
    {
      id: 'de4',
      title: 'The Denmark Strait',
      date: '1941-05-24',
      place: 'Denmark Strait, between Greenland and Iceland',
      geo: [-31.0, 63.3],
      enemyNation: 'uk',
      news: [
        'Autumn 1940: the Happy Time. U-boats sink hundreds of thousands of tons a month.',
        'March 1941: Kretschmer, Prien and Schepke are lost within ten days.',
        'May: the new battleship Bismarck sails with Prinz Eugen to raid the Atlantic convoys.',
      ],
      brief:
        'Operation Rheinübung: Bismarck and Prinz Eugen are breaking out into the Atlantic through the Denmark Strait, between the Greenland pack ice and the minefields off Iceland. The cruisers Norfolk and Suffolk have been shadowing them through the night with radar.\n\nAt dawn hydrophones and lookouts report two heavy ships closing fast from the south-east: the battlecruiser Hood, pride of the Royal Navy, and the brand-new battleship Prince of Wales, still with dockyard workers aboard.\n\nAdmiral Lütjens\' orders are to avoid action with capital ships. But they are coming bow-on, with only their forward turrets bearing, and they must be fought. Then continue into the Atlantic.',
      history:
        'At 05:52 the British opened fire. Prinz Eugen and Bismarck both straddled Hood quickly, and at 06:00 a shell from Bismarck\'s fifth salvo reached her magazines. Hood blew up and sank in three minutes; three of her 1,418 men survived. Prince of Wales, damaged and with her guns failing, broke off. But a hit had left Bismarck leaking fuel.',
      hints: [
        'Hood\'s deck armour is thin: long-range plunging fire is your best weapon.',
        'Keep moving south-west after the fight: the shadowing cruisers will follow you.',
      ],
      env: { tod: 'dawn', wx: 'clear', sea: 2, biome: 'ice' },
      map: { w: 70, h: 56, seed: 341, land: [{ k: 'coast', side: 'w', depth: 10, rough: 0.5 }, { k: 'island', x: 67, y: 54, r: 8, rough: 0.35 }] },
      zones: [{ id: 'atlantic', name: 'The Atlantic', kind: 'exit', x: 22, y: 55, r: 6 }],
      player: {
        groups: [{ id: 'rheinuebung', units: [U('hipper', 'Prinz Eugen'), U('bismarck', 'Bismarck', ['bismarck'])], x: 32, y: 12, h: 205, spacing: 1.2, speed: 28 }],
        slots: 0,
        spawn: { x: 34, y: 8, h: 205 },
        auto: { kind: 'raider', prefer: ['hood'], exit: 'atlantic', retreatHp: 0.45 },
      },
      enemy: [
        { id: 'hood', units: [U('hood', 'Hood', ['hood']), U('kgv', 'Prince of Wales', ['pow'], { special: ['unworked'] })], x: 58, y: 40, h: 300, spacing: 1.0, speed: 28, behavior: { kind: 'hunt', radius: 80 } },
        { id: 'shadowers', units: [U('county', 'Norfolk'), U('county', 'Suffolk')], x: 54, y: 2, h: 205, formation: 'line', spacing: 3, speed: 28, behavior: { kind: 'shadow', of: 'bismarck', range: 24 } },
      ],
      objectives: [
        { id: 'out', text: 'Break out into the Atlantic with Bismarck', kind: 'reach', tag: 'bismarck', zone: 'atlantic', count: 1 },
        { id: 'hood', text: 'Sink HMS Hood', kind: 'destroy', tag: 'hood', bonus: true },
        { id: 'pow', text: 'Force Prince of Wales to break off (60% hull or less)', kind: 'damage', tag: 'pow', frac: 0.6, bonus: true },
        { id: 'hull', text: 'Keep Bismarck above 75% hull', kind: 'hpAbove', tag: 'bismarck', frac: 0.75, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Admiral Lütjens', msg: 'Two heavy ships closing from the south-east. It can only be Hood. Open fire when in range, then continue south-west into the Atlantic.' }, { reveal: 'hood' }] },
        { when: { lost: 'hood', count: 1 }, do: [{ msg: 'Hood has blown up!' }] },
      ],
      timeLimit: 120,
      reward: 320,
    },
    // ------------------------------------------------------------------ 5
    {
      id: 'de5',
      title: 'The Channel Dash',
      date: '1942-02-12',
      place: 'The English Channel and the Strait of Dover',
      geo: [1.4, 51.0],
      enemyNation: 'uk',
      news: [
        'May 1941: Hood sunk. Bismarck is lost three days later.',
        'December 1941: the United States enters the war.',
        'February 1942: Scharnhorst, Gneisenau and Prinz Eugen, bombed for months at Brest, are ordered home.',
      ],
      brief:
        'Operation Cerberus. For ten months Scharnhorst, Gneisenau and Prinz Eugen have sat at Brest under constant RAF attack. Now they are ordered home to Germany, and Vice Admiral Ciliax has chosen the boldest route: straight up the English Channel, in daylight, under the noses of the British.\n\nThe squadron left Brest at night and the British have not noticed. Ahead lie the guns at Dover, motor torpedo boats, torpedo bombers and destroyers. The Luftwaffe will keep fighters overhead all day.\n\nKeep moving at full speed and beware of mines off the Dutch coast. All three heavy ships must get through.',
      history:
        'The British did not realise what was happening until the squadron was nearly at Dover. MTBs, Swordfish, Beauforts and destroyers attacked piecemeal and were beaten off; all six Swordfish of Esmonde\'s squadron were shot down. Scharnhorst struck two mines and Gneisenau one, but all three ships reached Germany. "Nothing more mortifying to the pride of sea power has happened since the 17th century," wrote The Times.',
      hints: [
        'Keep moving: the coastal guns and torpedo boats are most dangerous to slow ships.',
        'Your destroyers and torpedo boats should screen the heavy ships against MTBs.',
      ],
      env: { tod: 'day', wx: 'overcast', sea: 2, biome: 'temperate' },
      map: {
        w: 110, h: 42, seed: 351,
        land: [
          { k: 'coast', side: 'n', depth: 8, from: 36, rough: 0.3 },
          { k: 'coast', side: 's', depth: 8, rough: 0.3 },
          { k: 'island', x: 74, y: 1, r: 8, elong: 2, rough: 0.3 },
          { k: 'island', x: 72, y: 42, r: 8, elong: 2, rough: 0.3 },
        ],
      },
      zones: [
        { id: 'northsea', name: 'The North Sea', kind: 'exit', x: 109, y: 22, r: 6 },
        { id: 'mines1', name: 'Minefield', kind: 'mine', x: 90, y: 22, r: 4.5, density: 0.06 },
        { id: 'mines2', name: 'Minefield', kind: 'mine', x: 100, y: 16, r: 4, density: 0.06 },
      ],
      player: {
        groups: [
          { id: 'heavies', units: [U('scharnhorst', 'Scharnhorst', ['heavy']), U('scharnhorst', 'Gneisenau', ['heavy']), U('hipper', 'Prinz Eugen', ['heavy'])], x: 22, y: 24, h: 85, spacing: 1, speed: 27 },
          { id: 'destroyers', units: [U('z1936a', 'Z 29'), ...many('z1934', ['Richard Beitzen', 'Paul Jacobi', 'Friedrich Ihn'])], x: 24, y: 20.5, h: 85, formation: 'line', spacing: 1.4, speed: 27 },
          { id: 'tboats', units: many('t1935', ['T 2', 'T 4', 'T 5']), x: 25, y: 28.5, h: 85, formation: 'line', spacing: 1.4, speed: 27 },
        ],
        slots: 2,
        allowed: ['CA', 'DD', 'TB', 'PT'],
        spawn: { x: 18, y: 30, h: 85, formation: 'line', spacing: 1.4 },
        auto: { kind: 'route', pts: [[44, 22], [72, 24], [86, 28], [96, 28], [109, 22]], exit: 'northsea', speed: 28 },
      },
      enemy: [
        { id: 'dover', units: [U('battery_uk', 'Wanstone battery', [], { x: 71, y: 6.3 }), U('battery_uk', 'South Foreland battery', [], { x: 77, y: 6.6 })], x: 74, y: 6, h: 180, behavior: { kind: 'hold' } },
      ],
      objectives: [
        { id: 'through', text: 'Bring Scharnhorst, Gneisenau and Prinz Eugen through to the North Sea', kind: 'reach', tag: 'heavy', zone: 'northsea', count: 3 },
        { id: 'aa', text: 'Shoot down 12 aircraft', kind: 'shootdown', count: 12, bonus: true },
        { id: 'dd', text: 'Lose no destroyers', kind: 'protect', tag: 'dd', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Vice Admiral Ciliax', msg: 'The British have not seen us yet. Full speed for the Strait of Dover. The Luftwaffe will keep fighters overhead. Beware of mines off the Dutch coast.' }, { side: 0, air: { from: 's', cap: 'heavy', minutes: 40, sq: [{ a: 'bf109', n: 12 }] } }] },
        { when: { time: 28 }, do: [{ msg: 'British motor torpedo boats coming out of Dover!' }, { side: 1, spawn: { id: 'mtbs', units: anon('mtb', 5), x: 74, y: 9, h: 180, formation: 'line', spacing: 1, speed: 35, behavior: { kind: 'hunt', prefer: ['heavy'], radius: 40 } } }, { side: 0, air: { from: 's', cap: 'heavy', minutes: 40, sq: [{ a: 'fw190', n: 12 }] } }] },
        { when: { time: 34 }, do: [{ msg: 'Swordfish torpedo bombers approaching with a fighter escort!' }, { side: 1, air: { from: 'n', target: 'heavy', sq: [{ a: 'swordfish', n: 6 }, { a: 'spitfire', n: 10 }] } }] },
        { when: { time: 52 }, do: [{ msg: 'Destroyers from Harwich closing from the north-east!' }, { side: 1, spawn: { id: 'harwich', units: many('hclass', ['Campbell', 'Vivacious', 'Worcester', 'Mackay', 'Whitshed']), x: 108, y: 6, h: 220, formation: 'line', spacing: 1.2, speed: 28, behavior: { kind: 'hunt', prefer: ['heavy'], radius: 60 } } }] },
        { when: { time: 58 }, do: [{ side: 0, air: { from: 's', cap: 'heavy', minutes: 40, sq: [{ a: 'bf109', n: 12 }] } }] },
        { when: { time: 62 }, do: [{ msg: 'Beaufort torpedo bombers inbound!' }, { side: 1, air: { from: 'n', target: 'heavy', sq: [{ a: 'beaufort', n: 9 }, { a: 'spitfire', n: 8 }] } }] },
        { when: { time: 78 }, do: [{ side: 1, air: { from: 'n', target: 'heavy', sq: [{ a: 'hampden', n: 12 }] } }] },
      ],
      timeLimit: 170,
      reward: 320,
    },
    // ------------------------------------------------------------------ 6
    {
      id: 'de6',
      title: 'Battle of the Barents Sea',
      date: '1942-12-31',
      place: 'Barents Sea, north of North Cape',
      geo: [30.0, 73.5],
      enemyNation: 'uk',
      news: [
        'February 1942: the Channel Dash succeeds.',
        'July: convoy PQ 17 is destroyed after being ordered to scatter.',
        'December: convoy JW 51B sails for Murmansk with only destroyers for escort.',
      ],
      brief:
        'Convoy JW 51B is passing north of North Cape on its way to Russia, escorted only by destroyers. Vice Admiral Kummetz has sailed from Altafjord with the heavy cruisers Admiral Hipper and Lützow and six destroyers to destroy it.\n\nThe plan is a pincer: Hipper will draw off the escorts from the north while Lützow falls on the merchant ships from the south. It is the Arctic twilight, with snow showers, and the British destroyers will fight hard.\n\nOrders from Berlin are clear: take no unnecessary risks with the heavy ships.',
      history:
        'Captain Sherbrooke\'s destroyers bluffed and harried Hipper for hours, feinting torpedo attacks and laying smoke. Then the cruisers Sheffield and Jamaica appeared out of the gloom and hit Hipper. Under orders to avoid risk, Kummetz withdrew without sinking a single merchant ship. Hitler was so enraged that he ordered the big ships scrapped; Admiral Raeder resigned.',
      hints: [
        'British destroyers will feint torpedo attacks and lay smoke to protect the convoy.',
        'More enemy cruisers may be nearby. Don\'t get trapped.',
      ],
      env: { tod: 'dusk', wx: 'snow', sea: 2, biome: 'arctic' },
      map: { w: 70, h: 50, seed: 361, land: [] },
      zones: [{ id: 'kola', name: 'Kola Inlet', kind: 'exit', x: 69.5, y: 12, r: 4 }],
      player: {
        groups: [
          { id: 'lutzow', units: [U('deutschland', 'Lützow')], x: 30, y: 40, h: 10, speed: 24 },
          { id: 'destroyers', units: [...many('z1934', ['Friedrich Eckoldt', 'Richard Beitzen']), ...many('z1936a', ['Z 29', 'Z 30'])], x: 20, y: 36, h: 30, formation: 'line', spacing: 1.5, speed: 26 },
        ],
        slots: 2,
        allowed: ['CA', 'DD'],
        spawn: { x: 16, y: 41, h: 30, formation: 'line', spacing: 1.5 },
        auto: { kind: 'raider', prefer: ['merchant'], retreatHp: 0.6, quota: 3 },
      },
      enemy: [
        {
          id: 'convoy', units: anon('liberty', 10), x: 40, y: 15, h: 90, formation: 'box', spacing: 0.9, speed: 8,
          behavior: { kind: 'route', pts: [[69.5, 12]], exit: 'kola', speed: 8 },
        },
        {
          id: 'escort', units: [...many('sclass', ['Onslow', 'Orwell', 'Obedient', 'Obdurate']), U('hclass', 'Achates'), U('flower', 'Bramble')],
          x: 40, y: 19, h: 90, formation: 'line', spacing: 1.6, behavior: { kind: 'escort', of: 'convoy', radius: 12 },
        },
      ],
      objectives: [
        { id: 'merchants', text: 'Sink 3 merchant ships', kind: 'destroy', tag: 'merchant', count: 3 },
        { id: 'dd', text: 'Sink 2 destroyers', kind: 'destroy', tag: 'dd', count: 2, bonus: true },
        { id: 'hulls', text: 'Keep the heavy cruisers above 50% hull', kind: 'hpAbove', tag: 'ca', frac: 0.5, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Vice Admiral Kummetz', msg: 'U-354 reports the convoy to the north. Draw off the escorts and get at the merchant ships. Orders from Berlin: take no unnecessary risks with the heavy ships.' }, { reveal: 'merchant' }] },
        { when: { time: 25 }, do: [{ msg: 'Cruisers approaching from the north!' }, { side: 1, spawn: { id: 'forcer', units: [U('town', 'Sheffield'), U('town', 'Jamaica')], x: 35, y: 1, h: 180, spacing: 1, speed: 28, behavior: { kind: 'hunt', radius: 60 } } }] },
      ],
      timeLimit: 75,
      reward: 300,
    },
    // ------------------------------------------------------------------ 7
    {
      id: 'de7',
      title: 'Black May',
      date: '1943-05-19',
      place: 'North Atlantic, south of Greenland',
      geo: [-36.0, 57.0],
      enemyNation: 'uk',
      news: [
        'December 1942: failure in the Barents Sea. Admiral Raeder resigns; Dönitz takes command of the navy.',
        'March 1943: the U-boats\' greatest convoy battles. 120 ships sunk in a month.',
        'May: suddenly, boats are being lost faster than they can be replaced.',
      ],
      brief:
        'Convoy SC 130 is heading for your patrol line. Two months ago a convoy like this would have been a feast. Now everything has changed.\n\nThe escorts have centimetric radar that can see a U-boat on the surface at night, HF/DF that pinpoints every radio signal, and Hedgehog launchers that throw bombs ahead of the ship. Very long range Liberator bombers patrol overhead, and fresh support groups hunt the U-boats down.\n\nAttack submerged by day. Do not stay on the surface when aircraft are about. Sink what you can, and try to come home.',
      history:
        'No ship of SC 130 was sunk. Five U-boats were lost attacking it, among them U-954 with Dönitz\'s son Peter aboard. In May 1943 the U-boats lost 41 boats. On 24 May Dönitz withdrew them from the North Atlantic. The Battle of the Atlantic had been lost.',
      hints: [
        'Patrol aircraft see a surfaced U-boat from 15 km away. Stay at periscope depth in daylight.',
        'Escorts have radar and Hedgehog now. Fire from long range and go deep straight away.',
      ],
      env: { tod: 'day', wx: 'overcast', sea: 2, biome: 'temperate' },
      map: { w: 60, h: 44, seed: 371, land: [] },
      zones: [{ id: 'east', name: 'Toward the British Isles', kind: 'exit', x: 59, y: 22, r: 4 }],
      player: {
        groups: [
          { id: 'pack', units: [U('type7c', 'U-381', [], { x: 40, y: 10 }), U('type7c', 'U-954', [], { x: 46, y: 22 }), U('type7c', 'U-258', [], { x: 40, y: 34 })], x: 42, y: 22, h: 270, speed: 4, },
        ],
        slots: 1,
        allowed: ['SS'],
        spawn: { x: 48, y: 30, h: 270 },
      },
      enemy: [
        {
          id: 'convoy', units: anon('tramp', 12), x: 8, y: 22, h: 90, formation: 'box', spacing: 0.9, speed: 8,
          behavior: { kind: 'route', pts: [[59, 22]], exit: 'east', speed: 8, zigzag: true },
        },
        {
          id: 'b7', units: [...many('hclass', ['Duncan', 'Vidette']), U('river', 'Tay'), ...many('flower', ['Snowflake', 'Sunflower', 'Loosestrife'])],
          x: 12, y: 22, h: 90, formation: 'screen', spacing: 3, behavior: { kind: 'escort', of: 'convoy', radius: 10 },
        },
      ],
      objectives: [
        { id: 'tons', text: 'Sink 15,000 tons of shipping', kind: 'tonnage', tons: 15000 },
        { id: 'escort', text: 'Sink an escort', kind: 'destroy', tag: 'escort', count: 1, bonus: true },
        { id: 'losses', text: 'Lose no more than one U-boat', kind: 'protect', tag: 'ss', maxLoss: 1, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'BdU', msg: 'Convoy SC 130 is approaching your patrol line. Expect aircraft and escorts with radar. Attack submerged by day. Do not stay on the surface when aircraft are about.' }, { side: 1, air: { from: 'w', cap: 'merchant', minutes: 45, sq: [{ a: 'liberator', n: 2 }] } }] },
        { when: { time: 22 }, do: [{ msg: 'B-Dienst: a British support group is joining the convoy.' }, { side: 1, spawn: { id: 'support', units: [U('blackswan', 'Starling'), U('blackswan', 'Wild Goose'), U('river', 'Jed')], x: 2, y: 10, h: 90, formation: 'line', spacing: 1.5, speed: 18, behavior: { kind: 'hunt', radius: 60 } } }] },
        { when: { time: 45 }, do: [{ side: 1, air: { from: 'w', cap: 'merchant', minutes: 45, sq: [{ a: 'liberator', n: 2 }] } }] },
      ],
      timeLimit: 100,
      reward: 300,
    },
    // ------------------------------------------------------------------ 8
    {
      id: 'de8',
      title: 'Battle of the North Cape',
      date: '1943-12-26',
      place: 'Barents Sea, off North Cape',
      geo: [28.5, 72.3],
      enemyNation: 'uk',
      news: [
        'May 1943: "Black May". The U-boats withdraw from the North Atlantic.',
        'September: Tirpitz is crippled by British midget submarines in Kaafjord.',
        'Christmas 1943: convoy JW 55B is reported at sea, bound for Murmansk.',
      ],
      brief:
        'Scharnhorst is the last German battleship ready for sea. Rear Admiral Bey has been ordered to sail from Altafjord with five destroyers and destroy convoy JW 55B.\n\nIt is the polar night: there will be no daylight at all, and a gale is blowing. The destroyers can barely keep up in this sea. The British have radar that can see through the darkness, and somewhere out there there may be heavy units.\n\nFind the convoy, strike hard and fast, and turn for home before the trap closes.',
      history:
        'Bey detached his destroyers to search for the convoy and never found them again. Twice Scharnhorst ran into the British cruisers, and as she turned for home Duke of York caught her in the dark with radar-directed fire. Crippled by shells and destroyer torpedoes, she sank that evening. 36 of her 1,968 men survived.',
      hints: [
        'Keep the destroyers with Scharnhorst. Alone, she is vulnerable to torpedo attack in the dark.',
        'If a battleship appears, run for Altafjord at full speed.',
      ],
      env: { tod: 'night', wx: 'storm', sea: 3, biome: 'arctic', wind: 240 },
      map: { ...northCapeMap(), seed: 381 },
      zones: NORTH_CAPE_ZONES,
      player: {
        groups: [
          { id: 'scharnhorst', units: [U('scharnhorst', 'Scharnhorst', ['scharnhorst'])], x: 40, y: 42, h: 0, speed: 24 },
          { id: 'destroyers', units: many('z1936a', ['Z 29', 'Z 30', 'Z 33', 'Z 34', 'Z 38']), x: 36, y: 40, h: 0, formation: 'line', spacing: 2, speed: 24 },
        ],
        slots: 1,
        allowed: ['CA', 'DD'],
        spawn: { x: 45, y: 43, h: 0 },
        auto: { kind: 'raider', prefer: ['merchant'], exit: 'altafjord', retreatHp: 0.6, quota: 4 },
      },
      enemy: [
        {
          id: 'convoy', units: anon('liberty', 9), x: 30, y: 10, h: 80, formation: 'box', spacing: 0.9, speed: 8,
          behavior: { kind: 'route', pts: [[79, 8]], exit: 'east', speed: 8 },
        },
        { id: 'escort', units: many('sclass', ['Onslow', 'Onslaught', 'Orwell', 'Scourge']), x: 30, y: 13, h: 80, formation: 'line', spacing: 2, behavior: { kind: 'escort', of: 'convoy', radius: 12 } },
        { id: 'force1', units: [U('town', 'Belfast'), U('town', 'Sheffield'), U('county', 'Norfolk')], x: 52, y: 14, h: 160, spacing: 1, speed: 22, behavior: { kind: 'hunt', radius: 45 } },
      ],
      objectives: [
        { id: 'merchants', text: 'Sink 4 merchant ships', kind: 'destroy', tag: 'merchant', count: 4 },
        { id: 'home', text: 'Bring Scharnhorst home to Altafjord', kind: 'reach', tag: 'scharnhorst', zone: 'altafjord', count: 1 },
        { id: 'cruiser', text: 'Sink a British cruiser', kind: 'destroy', tag: 'cruiser', count: 1, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Rear Admiral Bey', msg: 'U-boats report the convoy north of us. Find it, strike hard and fast, and turn for home before the heavy units arrive.' }, { reveal: 'merchant' }] },
        { when: { time: 30 }, do: [{ msg: 'Radio intercept: a British battleship is at sea south-west of us!' }, { side: 1, spawn: { id: 'force2', units: [U('kgv', 'Duke of York'), U('town', 'Jamaica'), ...many('sclass', ['Savage', 'Saumarez', 'Scorpion', 'Stord'])], x: 3, y: 40, h: 60, formation: 'box', spacing: 1.2, speed: 26, behavior: { kind: 'hunt', radius: 80, prefer: ['scharnhorst'] } } }] },
      ],
      timeLimit: 120,
      reward: 340,
    },
  ],
};
