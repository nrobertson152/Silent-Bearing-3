import type { CampaignDef } from '../types';
import { IRONBOTTOM_ZONES, U, anon, ironbottomSound, many, midwayMap, samarMap } from './common';

export const JP: CampaignDef = {
  nation: 'jp',
  title: 'The Long Lance',
  subtitle: 'The Imperial Japanese Navy',
  years: '1942–1945',
  theater: 'pacific',
  intro:
    'For twenty years the Imperial Japanese Navy has trained for one battle: the decisive clash with the American fleet. Outnumbered by treaty, it has built for quality instead. Its pilots are the best in the world, its night-fighting tactics are unmatched, and its destroyers carry a secret weapon, the oxygen-fuelled Type 93 torpedo, which the Americans will later call the "Long Lance".\n\nYour campaign follows the Navy from the triumphs of early 1942 into a war that Japan\'s own admirals knew it could not win if it went on for long.',
  epilogue:
    'On 15 August 1945 Japan announced its surrender. Of the great fleet that had swept across the Pacific in 1942, almost nothing remained afloat. The destroyer Yukikaze, which fought from the Java Sea to Operation Ten-Go, was one of the very few warships to survive the war undamaged; she was handed over to China in 1947.',
  startFleet: [
    { c: 'myoko', n: 'Haguro' },
    { c: 'kagero', n: 'Yukikaze' },
    { c: 'kagero', n: 'Amatsukaze' },
  ],
  startPrestige: 400,
  missions: [
    // ------------------------------------------------------------------ 1
    {
      id: 'jp1',
      title: 'Battle of the Java Sea',
      date: '1942-02-27',
      place: 'Java Sea, north of Surabaya',
      geo: [112.5, -6.0],
      enemyNation: 'nl',
      news: [
        'December 1941: the attack on Pearl Harbor. Prince of Wales and Repulse sunk off Malaya.',
        'February 1942: Singapore surrenders.',
        'The invasion convoys close on Java, the last Allied stronghold in the Indies.',
      ],
      brief:
        'Our invasion convoys are closing on Java. Standing between them and the beaches is the last Allied fleet in the Indies: Dutch, American, British and Australian cruisers and destroyers under the Dutch Rear Admiral Karel Doorman. They have no air cover, no common signal book and no time to train together.\n\nRear Admiral Takagi has the heavy cruisers Nachi and Haguro and two destroyer squadrons led by the light cruisers Naka and Jintsu.\n\nEngage at long range with the guns, and when the enemy is committed, smother them with Type 93 torpedoes fired from beyond the range of their guns. Above all, protect the convoy.',
      history:
        'In a battle lasting seven hours, Doorman tried again and again to reach the convoy. A Long Lance sank the Dutch destroyer Kortenaer, shellfire crippled Exeter, and that night torpedoes sank De Ruyter and Java. Doorman went down with his flagship. Within days Exeter, Houston and Perth were also lost, and Java surrendered.',
      hints: [
        'Your Type 93 "Long Lance" torpedoes run 20 km and leave no wake. Fire from beyond the enemy\'s gun range.',
        'Destroyers carry a full reload and can attack twice.',
      ],
      env: { tod: 'day', wx: 'clear', sea: 1, biome: 'tropical' },
      map: { w: 80, h: 50, seed: 211, land: [{ k: 'coast', side: 's', depth: 6, rough: 0.35 }, { k: 'island', x: 55, y: 4, r: 2 }] },
      player: {
        groups: [
          { id: 'nachi', units: [U('myoko', 'Nachi')], x: 40, y: 12, h: 190, speed: 24 },
          { id: 'desron2', units: [U('sendai', 'Jintsu'), ...many('kagero', ['Kuroshio', 'Oyashio'])], x: 30, y: 13, h: 190, formation: 'line', spacing: 1.2, speed: 24 },
          { id: 'desron4', units: [U('sendai', 'Naka'), ...many('kagero', ['Asagumo', 'Minegumo'])], x: 50, y: 13, h: 190, formation: 'line', spacing: 1.2, speed: 24 },
        ],
        slots: 3,
        history: [U('myoko', 'Haguro'), U('kagero', 'Yukikaze'), U('kagero', 'Amatsukaze')],
        allowed: ['CA', 'CL', 'DD'],
        spawn: { x: 42, y: 9, h: 190, formation: 'line', spacing: 1.4 },
      },
      allies: [
        {
          id: 'convoy', units: anon('marutransport', 8, ['transport']), x: 40, y: 3, h: 180, formation: 'box', spacing: 1, speed: 8,
          behavior: { kind: 'route', pts: [[38, 9], [36, 15]], speed: 8 },
        },
      ],
      enemy: [
        {
          id: 'abda',
          units: [U('deruyter', 'De Ruyter', ['deruyter']), U('york', 'HMS Exeter'), U('northampton', 'USS Houston'), U('leander', 'HMAS Perth'), U('javacl', 'Java'), U('jclass', 'HMS Electra'), U('jclass', 'HMS Encounter'), U('jclass', 'HMS Jupiter'), U('admiralen', 'Kortenaer'), U('clemson', 'USS Alden'), U('clemson', 'USS Edwards')],
          x: 40, y: 40, h: 15, spacing: 0.8, speed: 24, behavior: { kind: 'hunt', prefer: ['transport'], radius: 90 },
        },
      ],
      objectives: [
        { id: 'cruisers', text: 'Sink 2 Allied cruisers', kind: 'destroy', tag: 'cruiser', count: 2 },
        { id: 'convoy', text: 'Lose no more than 2 transports', kind: 'protect', tag: 'transport', maxLoss: 2 },
        { id: 'flagship', text: 'Sink De Ruyter, Doorman\'s flagship', kind: 'destroy', tag: 'deruyter', bonus: true },
        { id: 'dd', text: 'Sink 3 destroyers', kind: 'destroy', tag: 'dd', count: 3, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Rear Admiral Takagi', msg: 'Enemy cruisers to the south, coming for the convoy. Engage at long range. When they are committed, all destroyers will attack with torpedoes.' }] },
      ],
      timeLimit: 90,
      reward: 280,
    },
    // ------------------------------------------------------------------ 2
    {
      id: 'jp2',
      title: 'Indian Ocean Raid',
      date: '1942-04-05',
      place: 'Bay of Bengal, east of Ceylon',
      geo: [81.5, 7.0],
      enemyNation: 'uk',
      news: [
        'February 1942: victory in the Java Sea. The Dutch East Indies fall.',
        'The British Eastern Fleet gathers at Ceylon to protect India.',
        'Admiral Nagumo\'s carriers sortie into the Indian Ocean.',
      ],
      brief:
        'The Kido Butai, the carrier striking force that attacked Pearl Harbor, has come into the Indian Ocean to break British naval power in the east. The British Eastern Fleet is somewhere south of Ceylon.\n\nA floatplane from Tone has found two heavy cruisers, Dorsetshire and Cornwall, racing south to rejoin the fleet. The old carrier Hermes has been reported off the coast. Her aircraft have been flown ashore.\n\nStrike them before they reach safety. The British have a few bombers on Ceylon; keep fighters over the carriers.',
      history:
        'On Easter Sunday Nagumo\'s dive bombers sank Dorsetshire and Cornwall in under twenty minutes. Four days later Hermes went down off Batticaloa with the destroyer Vampire. The raid drove the British Eastern Fleet back to East Africa, but it was the high-water mark: two months later, four of these carriers were lost at Midway.',
      hints: [
        'Select a carrier and use "Launch strike" (B), then click a target.',
        'The cruisers are fast and heading south: strike before they get away.',
      ],
      env: { tod: 'day', wx: 'clear', sea: 1, biome: 'tropical' },
      map: { w: 180, h: 120, seed: 221, land: [{ k: 'coast', side: 'w', depth: 22, from: 10, rough: 0.3 }] },
      zones: [
        { id: 'south', name: 'Addu Atoll', kind: 'exit', x: 95, y: 119, r: 6 },
        { id: 'north', name: 'Trincomalee', kind: 'exit', x: 40, y: 1, r: 5 },
      ],
      player: {
        groups: [
          {
            id: 'kidobutai', units: [U('akagi', 'Akagi'), U('soryu', 'Soryu'), U('soryu', 'Hiryu'), U('kongo', 'Kongo'), U('kongo', 'Haruna'), U('mogami', 'Tone'), ...many('kagero', ['Isokaze', 'Urakaze'])],
            x: 150, y: 60, h: 270, formation: 'screen', spacing: 3, speed: 22,
          },
        ],
        slots: 2,
        history: [U('kongo', 'Kirishima'), U('mogami', 'Chikuma')],
        allowed: ['CA', 'CL', 'DD', 'BB', 'CV', 'CVL'],
        spawn: { x: 156, y: 66, h: 270, formation: 'line', spacing: 1.5 },
      },
      enemy: [
        { id: 'cruisers', units: [U('county', 'Dorsetshire'), U('county', 'Cornwall')], x: 92, y: 14, h: 180, spacing: 1, speed: 26, behavior: { kind: 'route', pts: [[95, 119]], exit: 'south', speed: 26 } },
        { id: 'hermes', units: [U('hermes', 'Hermes', ['hermes']), U('hclass', 'HMAS Vampire')], x: 48, y: 72, h: 0, spacing: 1, speed: 18, behavior: { kind: 'route', pts: [[40, 1]], exit: 'north', speed: 18 } },
      ],
      objectives: [
        { id: 'cruisers', text: 'Sink Dorsetshire and Cornwall', kind: 'destroy', tag: 'county', count: 2 },
        { id: 'hermes', text: 'Sink the carrier Hermes', kind: 'destroy', tag: 'hermes' },
        { id: 'planes', text: 'Lose no more than 10 aircraft', kind: 'airLosses', maxLoss: 10, bonus: true },
        { id: 'carriers', text: 'Lose no carriers', kind: 'protect', tag: 'carrier', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Vice Admiral Nagumo', msg: 'Tone\'s scout reports two British cruisers heading south at high speed. The carrier Hermes is reported off the coast. Strike them before they reach their main fleet.' }, { reveal: 'county' }, { reveal: 'hermes' }] },
        { when: { time: 40 }, do: [{ msg: 'Enemy bombers approaching from Ceylon!' }, { side: 1, air: { from: 'w', target: 'carrier', sq: [{ a: 'blenheim', n: 9 }] } }] },
      ],
      timeLimit: 240,
      reward: 300,
    },
    // ------------------------------------------------------------------ 3
    {
      id: 'jp3',
      title: 'Midway',
      date: '1942-06-04',
      place: 'North-west of Midway Atoll',
      geo: [-177.4, 28.2],
      enemyNation: 'us',
      news: [
        'April 1942: the British Eastern Fleet driven out of the Indian Ocean.',
        'The Doolittle raid on Tokyo shocks the high command.',
        'Admiral Yamamoto plans to take Midway and lure out the American carriers.',
      ],
      brief:
        'Admiral Yamamoto\'s plan is to seize Midway, the westernmost American outpost, and draw the surviving American carriers into a battle where they can be destroyed.\n\nThe Kido Butai will strike first: Akagi, Kaga, Soryu and Hiryu, with more than 200 aircraft and the best pilots in the world. Intelligence believes the American carriers are far away at Pearl Harbor.\n\nIntelligence may be wrong. Neutralise Midway\'s airfield, but keep scouts out to the east, and keep a strike force ready to deal with any carriers they find.',
      history:
        'Midway\'s airfield survived the first strike. While Nagumo hesitated between bombs and torpedoes, American dive bombers found Akagi, Kaga and Soryu with their decks full of armed aircraft and set all three ablaze in six minutes. Hiryu crippled Yorktown before she too was sunk. Japan lost four carriers and many of its finest aircrew.',
      hints: [
        'Keep fighters overhead and scouts out. Whoever finds the enemy carriers first usually wins.',
        'Kate torpedo bombers attack airfields with bombs.',
      ],
      env: { tod: 'day', wx: 'clear', sea: 1, biome: 'tropical' },
      map: { ...midwayMap(), seed: 231 },
      player: {
        groups: [
          {
            id: 'kidobutai',
            units: [U('akagi', 'Akagi', ['cv']), U('kaga', 'Kaga', ['cv']), U('soryu', 'Soryu', ['cv']), U('soryu', 'Hiryu', ['cv']), U('kongo', 'Haruna'), U('kongo', 'Kirishima'), U('mogami', 'Tone'), U('mogami', 'Chikuma'), U('sendai', 'Nagara'), ...many('kagero', ['Nowaki', 'Arashi', 'Hagikaze', 'Maikaze'])],
            x: 42, y: 40, h: 135, formation: 'screen', spacing: 3.5, speed: 24,
          },
        ],
        slots: 2,
        allowed: ['CA', 'CL', 'DD', 'BB'],
        spawn: { x: 36, y: 46, h: 135, formation: 'line', spacing: 1.5 },
      },
      enemy: [
        {
          id: 'midway', units: [U('airfield_us', 'Midway', ['midway'], { x: 71.6, y: 110.6 })], x: 71.6, y: 110.6, h: 0,
          air: [{ a: 'f2a', n: 14 }, { a: 'sbd', n: 16 }, { a: 'sb2u', n: 11 }, { a: 'tbf', n: 6 }, { a: 'b17', n: 9 }, { a: 'pby', n: 6 }],
          behavior: { kind: 'airfield' },
        },
        {
          id: 'tf16', units: [U('yorktown', 'Enterprise'), U('yorktown', 'Hornet'), U('northampton', 'Northampton'), U('neworleans', 'Vincennes'), U('atlanta', 'Atlanta'), ...many('benson', ['Balch', 'Benham', 'Phelps'])],
          x: 190, y: 72, h: 240, formation: 'screen', spacing: 3, speed: 20, behavior: { kind: 'carrier' },
        },
        {
          id: 'tf17', units: [U('yorktown', 'Yorktown'), U('neworleans', 'Astoria'), U('neworleans', 'Portland'), ...many('benson', ['Hammann', 'Hughes'])],
          x: 205, y: 50, h: 240, formation: 'screen', spacing: 3, speed: 20, behavior: { kind: 'carrier' },
        },
      ],
      objectives: [
        { id: 'midway', text: 'Neutralise Midway airfield', kind: 'destroy', tag: 'midway' },
        { id: 'carriers', text: 'Sink 2 American carriers', kind: 'destroy', tag: 'carrier', count: 2 },
        { id: 'own', text: 'Lose no more than 2 of your carriers', kind: 'protect', tag: 'cv', maxLoss: 2 },
        { id: 'none', text: 'Lose no carriers', kind: 'protect', tag: 'cv', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Vice Admiral Nagumo', msg: 'First strike: neutralise Midway airfield. Intelligence says there are no enemy carriers nearby, but send the scouts out to the east.' }, { reveal: 'midway' }] },
        { when: { detected: 'carrier' }, do: [{ from: 'Scout plane', msg: 'Enemy carriers sighted to the north-east!' }] },
      ],
      timeLimit: 360,
      reward: 400,
    },
    // ------------------------------------------------------------------ 4
    {
      id: 'jp4',
      title: 'Battle of Savo Island',
      date: '1942-08-09',
      place: 'Ironbottom Sound, Guadalcanal',
      geo: [159.8, -9.1],
      enemyNation: 'us',
      news: [
        'June 1942: four carriers lost at Midway.',
        '7 August: American Marines land on Guadalcanal and seize the airfield.',
        'Vice Admiral Mikawa gathers every cruiser at Rabaul and sails south at once.',
      ],
      brief:
        'The Americans have landed on Guadalcanal. Their transports are unloading off Lunga Point, guarded by cruisers patrolling either side of Savo Island.\n\nVice Admiral Mikawa has scraped together his flagship Chokai, four older heavy cruisers, two light cruisers and a destroyer. He will come down the Slot in single line ahead, pass south of Savo Island and attack the guards in the dark. Japanese lookouts have trained for years for exactly this kind of night.\n\nThe enemy crews are exhausted after two days at action stations. Torpedoes first, then guns and searchlights. Then the transports, if there is time before dawn brings their aircraft.',
      history:
        'In 32 minutes Mikawa\'s cruisers sank Quincy, Vincennes and Astoria and crippled Canberra, which sank next morning, while losing no ships. It was the worst defeat at sea in US Navy history. But fearing dawn air attacks, Mikawa withdrew without touching the transports, and the Marines kept Guadalcanal.',
      hints: [
        'The enemy is not at battle stations. Get close before you open fire.',
        'Japanese lookouts see far at night. Radar on the picket destroyers is unreliable this close to land.',
      ],
      env: { tod: 'night', wx: 'clear', sea: 0, biome: 'tropical' },
      map: { ...ironbottomSound(), seed: 241 },
      zones: IRONBOTTOM_ZONES,
      player: {
        groups: [
          {
            id: 'mikawa', units: [U('takao', 'Chokai', ['chokai']), U('aoba', 'Aoba'), U('aoba', 'Kako'), U('aoba', 'Kinugasa'), U('aoba', 'Furutaka'), U('yubari', 'Tenryu'), U('yubari', 'Yubari'), U('fubuki', 'Yunagi')],
            x: 4, y: 4.5, h: 120, spacing: 0.8, speed: 24,
          },
        ],
        slots: 2,
        allowed: ['CA', 'CL', 'DD'],
        spawn: { x: 2.5, y: 7, h: 120 },
        auto: { kind: 'raider', prefer: ['cruiser'], exit: 'west', retreatHp: 0.4 },
      },
      enemy: [
        {
          id: 'southern', units: [U('county', 'HMAS Canberra'), U('northampton', 'Chicago'), ...many('benson', ['Bagley', 'Patterson'])],
          x: 16, y: 15, h: 110, spacing: 0.8, speed: 12, alert: false, alertDelay: 75,
          behavior: { kind: 'patrol', pts: [[14, 14], [25, 17]], engage: 8, speed: 12 },
        },
        {
          id: 'northern', units: [...many('neworleans', ['Vincennes', 'Quincy', 'Astoria']), ...many('benson', ['Helm', 'Wilson'])],
          x: 20, y: 6, h: 60, spacing: 0.8, speed: 10, alert: false, alertDelay: 90,
          behavior: { kind: 'patrol', pts: [[20, 5], [26, 9], [21, 12], [16, 8]], engage: 8, speed: 10 },
        },
        { id: 'blue', units: [U('benson', 'Blue')], x: 7, y: 2, h: 90, crew: 0.8, behavior: { kind: 'patrol', pts: [[6, 2], [14, 0.8]], engage: 6, speed: 12 } },
        { id: 'talbot', units: [U('benson', 'Ralph Talbot')], x: 5, y: 13, h: 180, crew: 0.8, behavior: { kind: 'patrol', pts: [[5, 13], [8, 19]], engage: 6, speed: 12 } },
        {
          id: 'transports', units: anon('transport', 8, ['transport']), x: 38, y: 26, h: 270, formation: 'anchored', spacing: 0.7, alert: false, alertDelay: 120,
          behavior: { kind: 'hold' },
        },
      ],
      objectives: [
        { id: 'cruisers', text: 'Sink 3 Allied cruisers', kind: 'destroy', tag: 'cruiser', count: 3 },
        { id: 'transports', text: 'Sink 4 transports off Lunga Point', kind: 'destroy', tag: 'transport', count: 4, bonus: true },
        { id: 'losses', text: 'Lose no cruisers', kind: 'protect', tag: 'cruiser', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Vice Admiral Mikawa', msg: 'We pass south of Savo in single line and attack the cruisers guarding the anchorage. Torpedoes first, then searchlights and guns. Then the transports, if there is time.' }] },
      ],
      timeLimit: 75,
      reward: 320,
    },
    // ------------------------------------------------------------------ 5
    {
      id: 'jp5',
      title: 'I-19\'s Salvo',
      date: '1942-09-15',
      place: 'Coral Sea, south-east of San Cristobal',
      geo: [164.3, -12.4],
      enemyNation: 'us',
      news: [
        'August 1942: a crushing night victory at Savo Island.',
        'The struggle for Guadalcanal becomes a battle of attrition.',
        'American carriers cover the convoys to the island. Our submarines hunt them.',
      ],
      brief:
        'The submarine I-19 has found the American carrier Wasp operating south-east of Guadalcanal, steaming into the wind to fly off and recover aircraft. A second carrier group, with Hornet and the battleship North Carolina, is some ten kilometres beyond.\n\nCommander Takaichi Kinashi has six Type 95 torpedoes in the bow tubes. Their range is long, and they leave no wake. Destroyers with sonar screen the carriers, and patrol aircraft watch for periscopes.\n\nApproach slowly at periscope depth, choose your moment, and make every torpedo count. Then get away.',
      history:
        'At 14:44 I-19 fired a full salvo of six torpedoes at Wasp. Three hit her and she burned and sank. The others ran on into the second group, ten kilometres away, and hit North Carolina and the destroyer O\'Brien, which later sank. It was perhaps the most destructive single torpedo salvo in history.',
      hints: [
        'Move slowly at periscope depth: fast submarines are noisy and leave a visible feather.',
        'A big spread at long range may hit more than one target. Then dive deep and turn away.',
      ],
      env: { tod: 'day', wx: 'clear', sea: 2, biome: 'tropical' },
      map: { w: 50, h: 40, seed: 251, land: [] },
      player: {
        groups: [{ id: 'i19', units: [U('iboat', 'I-19', ['i19'], { special: ['submerged'] })], x: 15, y: 29, h: 50, speed: 4 }],
        slots: 1,
        history: [U('iboat', 'I-15')],
        allowed: ['SS'],
        spawn: { x: 12, y: 32, h: 50 },
      },
      enemy: [
        {
          id: 'wasp', units: [U('wasp', 'Wasp', ['wasp']), U('neworleans', 'San Francisco'), U('northampton', 'Salt Lake City'), ...many('benson', ['Farenholt', 'Aaron Ward', 'Buchanan', 'Lang'])],
          x: 27, y: 18, h: 220, formation: 'screen', spacing: 2.2, speed: 16, behavior: { kind: 'carrier', pts: [[20, 24], [30, 27], [33, 16], [24, 16]] },
        },
        {
          id: 'hornet', units: [U('yorktown', 'Hornet', ['capital2']), U('northcarolina', 'North Carolina', ['capital2']), U('brooklyn', 'Helena'), ...many('benson', ['O\'Brien', 'Mustin', 'Russell', 'Anderson'])],
          x: 38, y: 10, h: 120, formation: 'screen', spacing: 2.2, speed: 16, behavior: { kind: 'carrier', pts: [[46, 14], [42, 4]] },
        },
      ],
      objectives: [
        { id: 'wasp', text: 'Torpedo and sink USS Wasp', kind: 'destroy', tag: 'wasp' },
        { id: 'second', text: 'Hit a second capital ship', kind: 'damage', tag: 'capital2', frac: 0.97, count: 1, bonus: true },
        { id: 'escape', text: 'I-19 survives', kind: 'protect', tag: 'i19', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Commander Kinashi', msg: 'Heavy screws to the north-east: a carrier at flight operations. Periscope depth, slow speed. Six torpedoes in the bow tubes. Make them count.' }, { side: 1, air: { from: [25, 20], cap: 'wasp', minutes: 60, sq: [{ a: 'pby', n: 2 }] } }] },
      ],
      timeLimit: 60,
      reward: 300,
    },
    // ------------------------------------------------------------------ 6
    {
      id: 'jp6',
      title: 'Battle of Tassafaronga',
      date: '1942-11-30',
      place: 'Ironbottom Sound, Guadalcanal',
      geo: [159.9, -9.3],
      enemyNation: 'us',
      news: [
        'September 1942: I-19 sinks Wasp.',
        'November: two battleships lost in night battles off Guadalcanal.',
        'The army on the island is starving. Destroyers run in drums of food by night.',
      ],
      brief:
        'The army on Guadalcanal is starving. Rear Admiral Raizo Tanaka\'s destroyers will run in tonight and drop drums of food and medicine off Tassafaronga for the troops to haul ashore.\n\nSix of the eight destroyers have their decks crammed with drums and carry no torpedo reloads. An American force of cruisers and destroyers, with radar, has been reported heading for the sound.\n\nIf the enemy appears, every ship will attack with torpedoes at once, without waiting for orders.',
      history:
        'The Americans saw Tanaka\'s ships on radar first but hesitated to fire torpedoes. When the shooting began, Tanaka\'s destroyers turned away and launched some forty Long Lances. Northampton was sunk and Minneapolis, New Orleans and Pensacola were wrecked, for the loss of the destroyer Takanami. The drums were never delivered.',
      hints: [
        'Six destroyers carry supply drums and have no torpedo reloads: make the first salvo count.',
        'American radar will see you first. Fire torpedoes at the gun flashes and turn away.',
      ],
      env: { tod: 'night', wx: 'clear', sea: 0, biome: 'tropical' },
      map: { ...ironbottomSound(), seed: 261 },
      zones: [...IRONBOTTOM_ZONES, { id: 'drop', name: 'Tassafaronga (supply drop)', kind: 'drop', x: 16, y: 27, r: 2.5 }],
      player: {
        groups: [
          {
            id: 'tanaka',
            units: [U('kagero', 'Naganami'), U('kagero', 'Takanami'), ...many('kagero', ['Makinami', 'Kuroshio', 'Oyashio', 'Kagero', 'Kawakaze', 'Suzukaze'], ['supply'], { special: ['noReloads'] })],
            x: 6, y: 5, h: 140, spacing: 0.6, speed: 24,
          },
        ],
        slots: 2,
        allowed: ['DD'],
        spawn: { x: 4, y: 7, h: 140, spacing: 0.6 },
      },
      enemy: [
        {
          id: 'tf67',
          units: [...many('fletcher', ['Fletcher', 'Drayton', 'Perkins']), U('benson', 'Maury'), ...many('neworleans', ['Minneapolis', 'New Orleans', 'Pensacola']), U('brooklyn', 'Honolulu'), U('northampton', 'Northampton'), ...many('benson', ['Lamson', 'Lardner'])],
          // radar, but little training in night fighting and a slow decision to fire torpedoes
          x: 42, y: 18, h: 270, spacing: 0.8, speed: 20, crew: 0.8, behavior: { kind: 'hunt', radius: 60 },
        },
      ],
      objectives: [
        { id: 'cruisers', text: 'Cripple or sink 2 cruisers (50% hull or less)', kind: 'damage', tag: 'cruiser', frac: 0.5, count: 2 },
        { id: 'drums', text: 'Get 3 drum-carrying destroyers to Tassafaronga', kind: 'reach', tag: 'supply', zone: 'drop', count: 3, bonus: true },
        { id: 'losses', text: 'Lose no more than 1 destroyer', kind: 'protect', tag: 'dd', maxLoss: 1, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Rear Admiral Tanaka', msg: 'Tokyo Express to Tassafaronga. If the enemy appears, all ships attack with torpedoes at once, without waiting for orders.' }] },
      ],
      timeLimit: 75,
      reward: 300,
    },
    // ------------------------------------------------------------------ 7
    {
      id: 'jp7',
      title: 'Battle off Samar',
      date: '1944-10-25',
      place: 'Off Samar, Philippines',
      geo: [126.5, 11.6],
      enemyNation: 'us',
      news: [
        'February 1943: Guadalcanal abandoned.',
        'June 1944: the carrier air groups are destroyed in the Philippine Sea.',
        'October: the Americans land on Leyte. The whole fleet sails to break up the landings.',
      ],
      brief:
        'The plan has worked. Admiral Halsey\'s fast carriers have chased the decoy force to the north, and Vice Admiral Kurita\'s Centre Force has come through the San Bernardino Strait in the night unseen.\n\nAt dawn, carriers are sighted to the south-east. Kurita believes he has caught the American fleet carriers at last. Yamato, Nagato, Kongo and Haruna, with six heavy cruisers and their destroyers, can destroy them, and then the transports at Leyte.\n\nThe enemy is fleeing into rain squalls behind smoke, and his destroyers are attacking. General attack!',
      history:
        'Kurita\'s ships sank the escort carrier Gambier Bay, the destroyers Johnston and Hoel and the destroyer escort Samuel B. Roberts, but lost the heavy cruisers Chokai, Chikuma and Suzuya to torpedoes and aircraft. After two hours of confused fighting, with his formation scattered, Kurita broke off and turned back, never reaching Leyte Gulf.',
      hints: [
        'The enemy hides in rain squalls and smoke. Radar and aircraft cannot do it all: close the range.',
        'Comb the tracks when destroyers fire torpedoes at you. Turn towards or away from them.',
      ],
      env: { tod: 'day', wx: 'rain', sea: 1, squalls: 6, biome: 'tropical', wind: 60 },
      map: { ...samarMap(), seed: 271 },
      player: {
        groups: [
          { id: 'battleships', units: [U('yamato', 'Yamato'), U('nagato', 'Nagato'), U('kongo', 'Kongo'), U('kongo', 'Haruna')], x: 22, y: 6, h: 140, spacing: 1.2, speed: 24 },
          { id: 'cruisers', units: [U('myoko', 'Haguro'), U('takao', 'Chokai'), U('mogami', 'Kumano'), U('mogami', 'Suzuya')], x: 26, y: 4, h: 140, formation: 'line', spacing: 1.4, speed: 26 },
          { id: 'destroyers', units: [U('sendai', 'Yahagi'), ...many('kagero', ['Isokaze', 'Nowaki', 'Urakaze', 'Hamakaze'])], x: 18, y: 8, h: 140, formation: 'line', spacing: 1.2, speed: 26 },
        ],
        slots: 2,
        history: [U('mogami', 'Tone'), U('mogami', 'Chikuma')],
        allowed: ['CA', 'CL', 'DD', 'BB'],
        spawn: { x: 30, y: 6, h: 140, formation: 'line', spacing: 1.4 },
        auto: { kind: 'hunt', prefer: ['cve'] },
      },
      enemy: [
        {
          id: 'taffy3', units: many('casablanca', ['Fanshaw Bay', 'St. Lo', 'White Plains', 'Kalinin Bay', 'Kitkun Bay', 'Gambier Bay'], ['cve']),
          x: 46, y: 32, h: 90, formation: 'box', spacing: 1.8, speed: 17, behavior: { kind: 'carrier', keepAway: 40, pts: [[70, 50], [80, 60]] },
        },
        {
          id: 'screen', units: [...many('fletcher', ['Johnston', 'Hoel', 'Heermann']), ...many('butler', ['Samuel B. Roberts', 'Dennis', 'Raymond', 'John C. Butler'])],
          x: 42, y: 27, h: 90, formation: 'line', spacing: 1.3, speed: 17, behavior: { kind: 'escort', of: 'taffy3', radius: 16 },
        },
      ],
      objectives: [
        { id: 'cves', text: 'Sink 3 escort carriers', kind: 'destroy', tag: 'cve', count: 3 },
        { id: 'dds', text: 'Sink Johnston, Hoel and Heermann', kind: 'destroy', tag: 'fletcher', count: 3, bonus: true },
        { id: 'losses', text: 'Lose no heavy cruisers', kind: 'protect', tag: 'ca', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Vice Admiral Kurita', msg: 'Enemy carriers to the south-east! This is the chance we have waited for since Midway. All ships, general attack!' }] },
        { when: { time: 12 }, do: [{ msg: 'Enemy aircraft from other carriers approaching from the south!' }, { side: 1, air: { from: 's', target: 'battleship', sq: [{ a: 'tbf', n: 12 }, { a: 'fm2', n: 8 }] } }] },
        { when: { time: 30 }, do: [{ side: 1, air: { from: 's', target: 'cruiser', sq: [{ a: 'tbf', n: 12 }, { a: 'fm2', n: 8 }] } }] },
        { when: { time: 48 }, do: [{ side: 1, air: { from: 's', target: 'cruiser', sq: [{ a: 'tbf', n: 12 }, { a: 'fm2', n: 6 }] } }] },
      ],
      timeLimit: 80,
      reward: 360,
    },
    // ------------------------------------------------------------------ 8
    {
      id: 'jp8',
      title: 'Operation Ten-Go',
      date: '1945-04-07',
      place: 'East China Sea, south-west of Kyushu',
      geo: [128.1, 30.4],
      enemyNation: 'us',
      news: [
        'October 1944: the fleet is shattered at Leyte Gulf. Musashi is sunk by aircraft.',
        'March 1945: Iwo Jima falls.',
        '1 April: the Americans land on Okinawa.',
      ],
      brief:
        'The Americans have landed on Okinawa. Operation Ten-Go will send Yamato, the light cruiser Yahagi and eight destroyers to break through to the island, beach the battleship and fight on as a shore battery until she is destroyed.\n\nThere is no air cover. There is fuel for a one-way voyage. Somewhere to the east are the fast carriers of Task Force 58, with hundreds of aircraft.\n\nKeep the formation tight so the anti-aircraft guns support each other, and turn hard into every torpedo attack. Make the voyage cost them.',
      history:
        'In two hours on 7 April, some 380 American carrier aircraft sank Yamato, Yahagi and four destroyers. Yamato took at least ten torpedoes and seven bombs before her magazines exploded. More than 3,700 Japanese sailors died; the Americans lost ten aircraft and twelve men. It was the last sortie of the Imperial Japanese Navy.',
      hints: [
        'Keep the destroyers close around Yamato: anti-aircraft fire is strongest when ships support each other.',
        'Ships at speed and turning hard are harder to hit with bombs and torpedoes.',
      ],
      env: { tod: 'day', wx: 'overcast', sea: 1, biome: 'temperate' },
      map: { w: 60, h: 90, seed: 281, land: [{ k: 'coast', side: 'n', depth: 5, to: 30, rough: 0.35 }] },
      zones: [{ id: 'okinawa', name: 'Okinawa', kind: 'exit', x: 32, y: 88, r: 6 }],
      player: {
        groups: [
          {
            id: 'tengo', units: [U('yamato', 'Yamato', ['yamato']), U('sendai', 'Yahagi'), U('akizuki', 'Fuyuzuki'), U('akizuki', 'Suzutsuki'), ...many('kagero', ['Isokaze', 'Hamakaze', 'Kasumi', 'Asashimo'])],
            x: 32, y: 12, h: 180, formation: 'screen', spacing: 1.5, speed: 22,
          },
        ],
        slots: 2,
        history: [U('kagero', 'Yukikaze')],
        allowed: ['CA', 'CL', 'DD', 'BB'],
        spawn: { x: 28, y: 9, h: 180, formation: 'line', spacing: 1.4 },
      },
      enemy: [],
      objectives: [
        { id: 'hold', text: 'Keep Yamato afloat for 50 minutes', kind: 'survive', time: 50 },
        { id: 'yamato', text: 'Yamato must not be sunk', kind: 'protect', tag: 'yamato' },
        { id: 'okinawa', text: 'Reach Okinawa with Yamato', kind: 'reach', tag: 'yamato', zone: 'okinawa', count: 1, bonus: true },
        { id: 'aa', text: 'Shoot down 40 aircraft', kind: 'shootdown', count: 40, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Vice Admiral Ito', msg: 'We sail for Okinawa with fuel for one way. There is no air cover. Keep the formation tight and turn hard into every torpedo attack.' }] },
        { when: { time: 6 }, do: [{ msg: 'Radar: a large formation of aircraft approaching from the east!' }, { side: 1, air: { from: 'e', target: 'yamato', sq: [{ a: 'sb2c', n: 12 }, { a: 'tbf', n: 12 }, { a: 'f6f', n: 10 }] } }] },
        { when: { time: 14 }, do: [{ msg: 'Second wave approaching from the south.' }, { side: 1, air: { from: 's', target: 'yamato', sq: [{ a: 'sb2c', n: 12 }, { a: 'tbf', n: 12 }, { a: 'f6f', n: 8 }] } }] },
        { when: { time: 23 }, do: [{ side: 1, air: { from: 'e', target: 'cruiser', sq: [{ a: 'sb2c', n: 10 }, { a: 'tbf', n: 10 }, { a: 'f6f', n: 8 }] } }] },
        { when: { time: 31 }, do: [{ msg: 'More aircraft coming in from the south.' }, { side: 1, air: { from: 's', target: 'yamato', sq: [{ a: 'tbf', n: 14 }, { a: 'f6f', n: 8 }] } }] },
        { when: { time: 40 }, do: [{ side: 1, air: { from: 'e', target: 'warship', sq: [{ a: 'sb2c', n: 12 }, { a: 'tbf', n: 10 }] } }] },
        { when: { time: 48 }, do: [{ side: 1, air: { from: 's', target: 'yamato', sq: [{ a: 'tbf', n: 12 }, { a: 'sb2c', n: 8 }] } }] },
      ],
      timeLimit: 100,
      reward: 360,
    },
  ],
};
