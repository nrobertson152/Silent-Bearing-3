import type { CampaignDef } from '../types';
import { IRONBOTTOM_ZONES, U, anon, ironbottomSound, many, midwayMap, samarMap } from './common';

export const US: CampaignDef = {
  nation: 'us',
  title: 'Pacific Thunder',
  subtitle: 'The United States Navy in the Pacific',
  years: '1942–1945',
  theater: 'pacific',
  intro:
    'On 7 December 1941 Japanese carrier aircraft wrecked the battle line of the Pacific Fleet at Pearl Harbor. In the weeks that followed, Japan swept through the Philippines, Malaya and the Dutch East Indies faster than anyone had thought possible.\n\nWhat the United States Navy has left is a handful of carriers, cruisers and old destroyers, and the industrial power that will, in time, build the largest fleet the world has ever seen. Your campaign follows it from the first desperate counter-attacks to the waters off Okinawa.',
  epilogue:
    'Japan surrendered on 15 August 1945, and the formal surrender was signed aboard the battleship Missouri in Tokyo Bay on 2 September. In less than four years the US Navy had grown from the wreckage of Pearl Harbor into a fleet of more than a hundred aircraft carriers. The war in the Pacific had been decided, above all, at sea.',
  startFleet: [
    { c: 'brooklyn', n: 'Boise' },
    { c: 'clemson', n: 'John D. Ford' },
    { c: 'clemson', n: 'Pope' },
  ],
  startPrestige: 400,
  missions: [
    // ------------------------------------------------------------------ 1
    {
      id: 'us1',
      title: 'Balikpapan',
      date: '1942-01-24',
      place: 'Makassar Strait, Borneo',
      geo: [117.0, -1.3],
      enemyNation: 'jp',
      news: [
        '7 December 1941: Japan attacks Pearl Harbor. The United States enters the war.',
        'December: the Philippines, Malaya and Hong Kong are invaded.',
        'January 1942: a Japanese invasion force anchors off the oil port of Balikpapan.',
      ],
      brief:
        'A Japanese invasion convoy is anchored off Balikpapan on the east coast of Borneo, its transports lit up against the burning oil installations that the Dutch set on fire before they withdrew.\n\nFour old destroyers of Destroyer Division 59, veterans of the First World War, have been sent to attack. They have twelve torpedo tubes each and no radar. The Japanese escorts are off to the north, chasing a Dutch submarine.\n\nGo in fast in the dark, fire torpedoes at the transports at close range, then use the guns. Get out before the escorts come back.',
      history:
        'In the US Navy\'s first surface action since 1898, the four-pipers sank four transports and a patrol boat. Many torpedoes missed or failed to explode, a problem that would haunt the Navy for two years. Balikpapan fell anyway, but the raid was a boost to morale when there was little else.',
      hints: [
        'Select a destroyer, press T (or "Fire…"), then click a target. Bigger spreads hit more often.',
        'US torpedoes in 1942 often fail to explode. Get close.',
        'Use the time buttons at the top to speed up the approach.',
      ],
      env: { tod: 'night', wx: 'clear', sea: 0, biome: 'tropical' },
      map: { w: 44, h: 32, seed: 111, land: [{ k: 'coast', side: 'w', depth: 6, rough: 0.4 }, { k: 'island', x: 9, y: 26, r: 1.1 }] },
      player: {
        groups: [{ id: 'desdiv59', units: many('clemson', ['Parrott', 'Paul Jones']), x: 40, y: 20, h: 270, spacing: 0.6, speed: 27 }],
        slots: 3,
        history: [U('clemson', 'John D. Ford'), U('clemson', 'Pope')],
        allowed: ['DD', 'CL'],
        spawn: { x: 41, y: 22.5, h: 270, spacing: 0.6 },
      },
      enemy: [
        {
          id: 'transports', units: [...many('marutransport', ['Tatsukami Maru', 'Kuretake Maru', 'Sumanoura Maru', 'Nana Maru'], ['transport']), ...anon('marutransport', 8, ['transport'])],
          x: 14, y: 16, h: 0, formation: 'anchored', spacing: 0.75, alert: false, alertDelay: 60, illuminated: true, behavior: { kind: 'hold' },
        },
        {
          id: 'escort', units: [U('sendai', 'Naka'), U('kagero', 'Minegumo'), U('kagero', 'Natsugumo'), U('kagero', 'Murasame'), U('kagero', 'Yudachi')],
          x: 24, y: 4, h: 60, spacing: 0.7, speed: 14, behavior: { kind: 'patrol', pts: [[24, 5], [30, 3], [24, 1.5], [18, 4]], engage: 6 },
        },
        {
          id: 'patrolboats', units: [U('subchaser', 'Patrol Boat No. 37'), U('subchaser', 'Patrol Boat No. 36')],
          x: 18, y: 20, h: 0, formation: 'line', spacing: 3, speed: 10, behavior: { kind: 'patrol', pts: [[19, 21], [19, 12], [21, 16]], engage: 4 },
        },
      ],
      objectives: [
        { id: 'four', text: 'Sink 4 transports', kind: 'destroy', tag: 'transport', count: 4 },
        { id: 'seven', text: 'Sink 7 transports', kind: 'destroy', tag: 'transport', count: 7, bonus: true },
        { id: 'nolosses', text: 'Lose no destroyers', kind: 'protect', tag: 'dd', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Commander Talbot', msg: 'The transports are anchored off the beach, lit up by the burning oil fields. The escorts are away to the north. Go in fast, torpedoes at close range, then guns.' }] },
      ],
      timeLimit: 60,
      reward: 220,
    },
    // ------------------------------------------------------------------ 2
    {
      id: 'us2',
      title: 'The Coral Sea',
      date: '1942-05-07',
      place: 'Coral Sea, south of New Guinea',
      geo: [155.5, -15.5],
      enemyNation: 'jp',
      news: [
        'February 1942: Singapore falls. The Allied fleet is destroyed in the Java Sea.',
        'April: the Doolittle raiders bomb Tokyo from the carrier Hornet.',
        'May: codebreakers learn that Japan will invade Port Moresby by sea.',
      ],
      brief:
        'Japan is sending an invasion force round the tip of New Guinea to take Port Moresby, the last Allied base between the Japanese and Australia. A light carrier covers the transports, and the two big carriers that struck Pearl Harbor, Shokaku and Zuikaku, are somewhere to the east.\n\nRear Admiral Fletcher has Lexington and Yorktown. This will be the first battle in history in which the opposing ships never see each other. Whoever finds the other first, and strikes first, will win.\n\nA scout has found the light carrier group. Hit it, keep fighters over your own carriers, and send scouts to find the big carriers before they find you.',
      history:
        'Dive bombers from Lexington and Yorktown sank Shoho in minutes: "Scratch one flattop!" Next day the carriers struck each other. Shokaku was badly damaged and Lexington was lost to fires and explosions. Tactically a draw, the battle turned back the invasion of Port Moresby, and kept Shokaku and Zuikaku away from Midway.',
      hints: [
        'Select a carrier to see its air group. "Launch strike" sends every ready bomber at a target you click.',
        'Leave "Auto CAP" on so fighters stay over your carriers.',
        'Send a squadron out on "Scout" to find the enemy carriers.',
      ],
      env: { tod: 'day', wx: 'overcast', sea: 1, biome: 'tropical' },
      map: {
        w: 340, h: 230, seed: 121,
        land: [{ k: 'island', x: 40, y: 26, r: 3 }, { k: 'island', x: 62, y: 14, r: 2 }, { k: 'island', x: 24, y: 48, r: 2.5 }, { k: 'island', x: 84, y: 10, r: 1.5 }],
      },
      zones: [{ id: 'moresby', name: 'Toward Port Moresby', kind: 'exit', x: 3, y: 120, r: 8 }],
      player: {
        groups: [
          {
            id: 'tf17', units: [U('lexington', 'Lexington', ['lex']), U('yorktown', 'Yorktown'), U('neworleans', 'Minneapolis'), U('neworleans', 'New Orleans'), U('northampton', 'Chester'), ...many('benson', ['Phelps', 'Dewey', 'Farragut', 'Aylwin'])],
            x: 290, y: 175, h: 300, formation: 'screen', spacing: 3, speed: 20,
          },
        ],
        slots: 3,
        history: [U('neworleans', 'Astoria'), U('neworleans', 'Portland')],
        allowed: ['CA', 'CL', 'DD', 'CV', 'CVL', 'BB'],
        spawn: { x: 297, y: 181, h: 300, formation: 'line', spacing: 1.5 },
      },
      enemy: [
        {
          id: 'mo', units: [U('shoho', 'Shoho', ['shoho']), U('aoba', 'Aoba'), U('aoba', 'Kinugasa'), U('aoba', 'Furutaka'), U('aoba', 'Kako'), U('fubuki', 'Sazanami')],
          x: 112, y: 70, h: 230, formation: 'screen', spacing: 3, speed: 18, behavior: { kind: 'carrier', pts: [[85, 95], [105, 80]] },
        },
        {
          id: 'invasion', units: anon('marutransport', 5, ['transport']), x: 92, y: 86, h: 240, formation: 'box', spacing: 1, speed: 10,
          behavior: { kind: 'route', pts: [[3, 120]], exit: 'moresby', speed: 10 },
        },
        {
          id: 'kidobutai', units: [U('shokaku', 'Shokaku'), U('shokaku', 'Zuikaku'), U('myoko', 'Myoko'), U('myoko', 'Haguro'), U('fubuki', 'Ushio'), U('fubuki', 'Akebono'), U('kagero', 'Ariake'), U('kagero', 'Yugure')],
          x: 270, y: 25, h: 200, formation: 'screen', spacing: 3, speed: 22, behavior: { kind: 'carrier', pts: [[250, 50], [275, 32]] },
        },
      ],
      objectives: [
        { id: 'shoho', text: 'Sink the light carrier Shoho', kind: 'destroy', tag: 'shoho' },
        { id: 'carriers', text: 'Keep at least one of your carriers afloat', kind: 'protect', tag: 'carrier', maxLoss: 1 },
        { id: 'shokaku', text: 'Cripple Shokaku or Zuikaku (50% hull or less)', kind: 'damage', tag: 'shokaku', frac: 0.5, count: 1, bonus: true },
        { id: 'transports', text: 'Sink 2 invasion transports', kind: 'destroy', tag: 'transport', count: 2, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Rear Admiral Fletcher', msg: 'A scout has found an enemy carrier group to the north-west, covering the invasion convoy. The big carriers are somewhere to the north-east. Strike the first target, keep fighters overhead, and find the others.' }, { reveal: 'shoho' }] },
        { when: { lost: 'shoho', count: 1 }, do: [{ from: 'Lt Cdr Dixon', msg: 'Scratch one flattop!' }] },
      ],
      timeLimit: 300,
      reward: 320,
    },
    // ------------------------------------------------------------------ 3
    {
      id: 'us3',
      title: 'Midway',
      date: '1942-06-04',
      place: 'North of Midway Atoll',
      geo: [-177.4, 28.2],
      enemyNation: 'jp',
      news: [
        'May 1942: Port Moresby saved at the Coral Sea, at the cost of Lexington.',
        'Codebreakers at Pearl Harbor learn that the next target, "AF", is Midway.',
        'Yorktown, patched up in 72 hours, sails with Enterprise and Hornet.',
      ],
      brief:
        'Admiral Yamamoto means to take Midway and draw out the last American carriers for destruction. Thanks to the codebreakers, those carriers are waiting for him northeast of the atoll.\n\nAt dawn a PBY reports Japanese carriers north-west of Midway. Their first strike will go for the island. The moment to hit them is while their planes are away, or being refuelled and rearmed on deck.\n\nYou have Enterprise, Hornet and Yorktown, and Midway\'s mixed bag of Marine and Army aircraft. The Japanese have four of the six carriers that attacked Pearl Harbor.',
      history:
        'Midway\'s aircraft and the torpedo squadrons were cut to pieces, but they pulled the Japanese fighters down to sea level. At 10:22 dive bombers from Enterprise and Yorktown found Akagi, Kaga and Soryu with their decks full of armed aircraft and set all three ablaze. Hiryu struck back and crippled Yorktown, then was sunk herself. Japan never recovered the initiative.',
      hints: [
        'Midway airfield is yours to command: select it to launch its aircraft.',
        'Japanese carriers are most vulnerable just after their own strike has landed.',
      ],
      env: { tod: 'day', wx: 'clear', sea: 1, biome: 'tropical' },
      map: { ...midwayMap(), seed: 131 },
      player: {
        groups: [
          {
            id: 'tf16', units: [U('yorktown', 'Enterprise'), U('yorktown', 'Hornet'), U('northampton', 'Northampton'), U('neworleans', 'Vincennes'), U('neworleans', 'Minneapolis'), U('atlanta', 'Atlanta'), ...many('benson', ['Balch', 'Benham', 'Monaghan', 'Phelps'])],
            x: 190, y: 72, h: 240, formation: 'screen', spacing: 3, speed: 20,
          },
          {
            id: 'tf17', units: [U('yorktown', 'Yorktown', ['yorktown']), U('neworleans', 'Astoria'), U('neworleans', 'Portland'), ...many('benson', ['Hammann', 'Hughes'])],
            x: 205, y: 50, h: 240, formation: 'screen', spacing: 3, speed: 20,
          },
          {
            id: 'midway', units: [U('airfield_us', 'Midway', ['midway'], { x: 71.6, y: 110.6 })], x: 71.6, y: 110.6, h: 0,
            air: [{ a: 'f2a', n: 14 }, { a: 'sbd', n: 16 }, { a: 'sb2u', n: 11 }, { a: 'tbf', n: 6 }, { a: 'b17', n: 9 }, { a: 'pby', n: 6 }],
          },
        ],
        slots: 3,
        allowed: ['CA', 'CL', 'DD', 'CV', 'CVL', 'BB'],
        spawn: { x: 196, y: 80, h: 240, formation: 'line', spacing: 1.5 },
      },
      enemy: [
        {
          id: 'kidobutai',
          units: [U('akagi', 'Akagi', ['cv']), U('kaga', 'Kaga', ['cv']), U('soryu', 'Soryu', ['cv']), U('soryu', 'Hiryu', ['cv']), U('kongo', 'Haruna'), U('kongo', 'Kirishima'), U('mogami', 'Tone'), U('mogami', 'Chikuma'), U('sendai', 'Nagara'), ...many('kagero', ['Nowaki', 'Arashi', 'Hagikaze', 'Maikaze'])],
          x: 42, y: 40, h: 135, formation: 'screen', spacing: 3.5, speed: 24, behavior: { kind: 'carrier', pts: [[60, 66], [72, 58]] },
        },
      ],
      objectives: [
        { id: 'three', text: 'Sink 3 Japanese carriers', kind: 'destroy', tag: 'cv', count: 3 },
        { id: 'flattops', text: 'Keep at least one of your carriers afloat', kind: 'protect', tag: 'carrier', maxLoss: 2 },
        { id: 'four', text: 'Sink all four carriers', kind: 'destroy', tag: 'cv', count: 4, bonus: true },
        { id: 'island', text: 'Midway airfield survives', kind: 'protect', tag: 'midway', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Rear Admiral Spruance', msg: 'PBY reports two carriers bearing 320 from Midway, about 280 kilometres out. They will strike Midway first. Launch everything at them while their planes are away.' }, { reveal: 'cv' }, { reveal: 'midway', side: 0 }] },
        { when: { lost: 'cv', count: 3 }, do: [{ msg: 'Three Japanese carriers are burning. Find the fourth!' }] },
      ],
      timeLimit: 360,
      reward: 400,
    },
    // ------------------------------------------------------------------ 4
    {
      id: 'us4',
      title: 'Naval Battle of Guadalcanal',
      date: '1942-11-15',
      place: 'Ironbottom Sound, Guadalcanal',
      geo: [159.8, -9.2],
      enemyNation: 'jp',
      news: [
        'June 1942: four Japanese carriers sunk at Midway.',
        'August: US Marines land on Guadalcanal and seize the airfield, Henderson Field.',
        'For months the "Tokyo Express" runs troops in by night and shells the airfield.',
      ],
      brief:
        'Two nights ago, cruisers and destroyers threw themselves at a Japanese bombardment force in a point-blank brawl that cost two admirals their lives and crippled the battleship Hiei. Tonight the Japanese are coming again: the battleship Kirishima and two heavy cruisers, screened by destroyers, steaming down past Savo Island to shell Henderson Field.\n\nRear Admiral Willis Lee has the new battleships Washington and South Dakota and four destroyers, scraped together from the carrier screens. They have radar; the Japanese do not. The Japanese have the Long Lance torpedo, and years of training for exactly this kind of night fight.\n\nYou are the only thing between the bombardment force and the airfield.',
      history:
        'Japanese torpedoes and gunfire wrecked Lee\'s destroyers, and an electrical failure left South Dakota blind and burning in the searchlights. Unseen in the dark, Washington closed to 7,700 metres and hit Kirishima with some twenty 16-inch shells. She sank in the early hours. Henderson Field was never seriously threatened again.',
      hints: [
        'Your radar sees them long before they see you. Their torpedoes outrange your guns at night: watch for tracks.',
        'Keep the battleships between the bombardment force and Henderson Field.',
      ],
      env: { tod: 'night', wx: 'clear', sea: 0, biome: 'tropical' },
      map: { ...ironbottomSound(), seed: 141 },
      zones: [...IRONBOTTOM_ZONES, { id: 'henderson', name: 'Henderson Field', kind: 'bombard', x: 31, y: 27, r: 3.5 }],
      player: {
        groups: [
          { id: 'battleships', units: [U('northcarolina', 'Washington', ['washington']), U('southdakota', 'South Dakota')], x: 33, y: 18, h: 270, spacing: 1.0, speed: 18 },
          { id: 'van', units: many('benson', ['Walke', 'Benham', 'Preston', 'Gwin']), x: 29, y: 17.5, h: 270, spacing: 0.6, speed: 18 },
        ],
        slots: 2,
        allowed: ['CA', 'CL', 'DD'],
        spawn: { x: 37, y: 19, h: 270 },
      },
      enemy: [
        {
          id: 'bombardment', units: [U('takao', 'Atago', ['bombard']), U('takao', 'Takao', ['bombard']), U('kongo', 'Kirishima', ['bombard', 'kirishima'])],
          x: 3, y: 4, h: 120, spacing: 1, speed: 18, behavior: { kind: 'bombard', zone: 'henderson', exit: 'west' },
        },
        {
          id: 'sweep', units: [U('sendai', 'Sendai'), ...many('fubuki', ['Shikinami', 'Uranami', 'Ayanami'])],
          x: 8, y: 2, h: 110, spacing: 0.7, speed: 22, behavior: { kind: 'route', pts: [[20, 4], [30, 12], [36, 18]], engage: true },
        },
        {
          id: 'screen', units: [U('sendai', 'Nagara'), ...many('fubuki', ['Shirayuki', 'Hatsuyuki']), ...many('kagero', ['Samidare', 'Inazuma'])],
          x: 4, y: 9, h: 120, spacing: 0.7, speed: 20, behavior: { kind: 'route', pts: [[10, 15], [22, 20], [30, 22]], engage: true },
        },
      ],
      objectives: [
        { id: 'stop', text: 'No enemy heavy ship may reach Henderson Field', kind: 'prevent', tag: 'bombard', zone: 'henderson' },
        { id: 'kirishima', text: 'Sink the battleship Kirishima', kind: 'destroy', tag: 'kirishima' },
        { id: 'cruisers', text: 'Sink both heavy cruisers', kind: 'destroy', tag: 'takao', count: 2, bonus: true },
        { id: 'washington', text: 'Keep Washington afloat', kind: 'protect', tag: 'washington', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Rear Admiral Lee', msg: 'A bombardment force with a battleship is coming down past Savo to shell the airfield. We are the only thing in the way. Our radar sees them long before they see us. Watch out for their torpedoes.' }] },
      ],
      timeLimit: 90,
      reward: 340,
    },
    // ------------------------------------------------------------------ 5
    {
      id: 'us5',
      title: 'Convoy College',
      date: '1944-07-31',
      place: 'Luzon Strait',
      geo: [121.0, 20.5],
      enemyNation: 'jp',
      news: [
        'November 1942: Kirishima sunk off Guadalcanal. Japan abandons the island in February.',
        '1943: the torpedo problems are finally fixed. American submarines start to strangle Japan.',
        'Wolf packs hunt the convoys in the Luzon Strait, the area the submariners call "Convoy College".',
      ],
      brief:
        'Japan\'s war depends on oil from the Indies, and every barrel must pass through the Luzon Strait between Formosa and the Philippines. American submarines now hunt there in packs.\n\nCommander Lawson Ramage\'s pack, "Parks\' Pirates", has found convoy MI-11 in the dark: tankers and freighters with an escort of frigates, sub-chasers and a destroyer. Steelhead has them on radar.\n\nIt is a moonless night. Go in on the surface like a torpedo boat, pick the tankers, and dive if the escorts come for you.',
      history:
        'In the early hours of 31 July, Ramage took Parche on the surface into the middle of the convoy, firing nineteen torpedoes in 46 minutes while escorts fired at him from every side. Parche and Steelhead sank or damaged several ships, and Ramage received the Medal of Honor. US submarines sank more than half of Japan\'s merchant fleet during the war.',
      hints: [
        'On a dark night a surfaced submarine is very hard to see. Diving makes you slow.',
        'Escorts carry depth charges: if one heads straight for you, dive deep and turn away.',
      ],
      env: { tod: 'night', wx: 'clear', sea: 2, biome: 'tropical' },
      map: { w: 64, h: 46, seed: 151, land: [{ k: 'island', x: 10, y: 6, r: 2 }, { k: 'island', x: 54, y: 41, r: 2.5 }, { k: 'island', x: 58, y: 4, r: 1.5 }] },
      zones: [{ id: 'west', name: 'South China Sea', kind: 'exit', x: 1, y: 20, r: 4 }],
      player: {
        groups: [{ id: 'pack', units: [U('balao', 'Parche'), U('gato', 'Steelhead')], x: 30, y: 21, h: 80, formation: 'line', spacing: 9, speed: 15 }],
        slots: 1,
        history: [U('gato', 'Hammerhead')],
        allowed: ['SS'],
        spawn: { x: 34, y: 28, h: 60 },
      },
      enemy: [
        {
          id: 'convoy', units: [...many('marutanker', ['Koei Maru', 'Manko Maru', 'Taketoyo Maru'], ['tanker']), ...anon('marutanker', 1, ['tanker']), ...anon('maru', 6)],
          x: 52, y: 18, h: 270, formation: 'box', spacing: 1, speed: 9,
          behavior: { kind: 'route', pts: [[1, 20]], exit: 'west', speed: 9, zigzag: true },
        },
        {
          id: 'escorts', units: [U('fubuki', 'Hokaze'), ...anon('kaibokan', 3), ...anon('subchaser', 2)],
          x: 50, y: 18, h: 270, formation: 'screen', spacing: 3, behavior: { kind: 'escort', of: 'convoy', radius: 7 },
        },
      ],
      objectives: [
        { id: 'tons', text: 'Sink 15,000 tons of shipping', kind: 'tonnage', tons: 15000 },
        { id: 'more', text: 'Sink 35,000 tons', kind: 'tonnage', tons: 35000, bonus: true },
        { id: 'boats', text: 'Lose no submarines', kind: 'protect', tag: 'ss', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Commander Ramage', msg: 'Steelhead has the convoy on radar to the east, coming our way. Tankers and freighters, with escorts. It is a dark night: we go in on the surface. Dive if the escorts come for you.' }, { reveal: 'tanker' }] },
      ],
      timeLimit: 120,
      reward: 300,
    },
    // ------------------------------------------------------------------ 6
    {
      id: 'us6',
      title: 'Surigao Strait',
      date: '1944-10-25',
      place: 'Surigao Strait, Philippines',
      geo: [125.4, 10.3],
      enemyNation: 'jp',
      news: [
        'June 1944: the "Great Marianas Turkey Shoot". Japanese naval aviation is destroyed.',
        '20 October: American troops land on Leyte in the Philippines.',
        'Japan commits everything it has left to break up the landings.',
      ],
      brief:
        'Japan\'s plan to destroy the Leyte landings sends three forces at the beachhead at once. The southern one, under Vice Admiral Nishimura, is coming up Surigao Strait tonight: the old battleships Yamashiro and Fuso, the heavy cruiser Mogami and four destroyers.\n\nRear Admiral Jesse Oldendorf is waiting at the northern end with six battleships, eight cruisers and twenty-eight destroyers. Many of the battleships were sunk or damaged at Pearl Harbor and rebuilt; now they have fire-control radar.\n\nPT boats will report and attack first, then the destroyers with torpedoes. Then the battle line will cross the T.',
      history:
        'Destroyer torpedoes sank Fuso and crippled Yamashiro. When the survivors came on, the battle line and cruisers opened fire at 21,000 metres with radar control and smothered them. Yamashiro sank with nearly all her crew. It was the last battleship-against-battleship action in history.',
      hints: [
        'Destroyers should attack down the sides of the strait and fire torpedoes from the beam.',
        'Keep the battle line steaming across the head of the strait so every turret bears: crossing the T.',
      ],
      env: { tod: 'night', wx: 'clear', sea: 0, biome: 'tropical' },
      map: {
        w: 34, h: 64, seed: 161,
        land: [{ k: 'coast', side: 'w', depth: 9, rough: 0.3 }, { k: 'coast', side: 'e', depth: 9, rough: 0.3 }, { k: 'island', x: 18, y: 40, r: 1.2 }],
      },
      zones: [{ id: 'gulf', name: 'Leyte Gulf', kind: 'exit', x: 17, y: 2, r: 4 }],
      player: {
        groups: [
          { id: 'battleline', units: [U('colorado', 'West Virginia', ['main']), U('colorado', 'Maryland', ['main']), U('tennessee', 'Tennessee', ['main']), U('tennessee', 'California', ['main'])], x: 21, y: 8, h: 270, spacing: 0.9, speed: 12 },
          { id: 'cruisers', units: [U('northampton', 'Louisville', ['main']), U('neworleans', 'Portland', ['main']), U('cleveland', 'Denver', ['main']), U('cleveland', 'Columbia', ['main'])], x: 20, y: 12, h: 270, spacing: 0.8, speed: 12 },
          { id: 'desron54', units: many('fletcher', ['Remey', 'McGowan', 'Melvin']), x: 24, y: 28, h: 180, spacing: 0.6, speed: 20 },
          { id: 'desron24', units: many('fletcher', ['Hutchins', 'Daly', 'Bache']), x: 11, y: 24, h: 180, spacing: 0.6, speed: 20 },
          { id: 'pt', units: many('pt', ['PT-131', 'PT-130', 'PT-152']), x: 17, y: 50, h: 180, formation: 'line', spacing: 2.5, speed: 15 },
        ],
        slots: 2,
        allowed: ['BB', 'CA', 'CL', 'DD', 'PT'],
        spawn: { x: 15, y: 16, h: 180, formation: 'line', spacing: 1.5 },
      },
      enemy: [
        {
          id: 'forcec',
          units: [...many('kagero', ['Michishio', 'Asagumo', 'Yamagumo']), U('fuso', 'Yamashiro', ['fusoclass']), U('fuso', 'Fuso', ['fusoclass']), U('mogami', 'Mogami'), U('kagero', 'Shigure')],
          x: 17, y: 60, h: 0, spacing: 0.8, speed: 18, behavior: { kind: 'route', pts: [[17, 32], [17, 2]], exit: 'gulf', engage: true },
        },
      ],
      objectives: [
        { id: 'bbs', text: 'Sink both battleships, Yamashiro and Fuso', kind: 'destroy', tag: 'fusoclass', count: 2 },
        { id: 'gulf', text: 'No battleship may break through into Leyte Gulf', kind: 'prevent', tag: 'fusoclass', zone: 'gulf' },
        { id: 'dd', text: 'Sink 3 destroyers', kind: 'destroy', tag: 'dd', count: 3, bonus: true },
        { id: 'losses', text: 'Lose no battleships or cruisers', kind: 'protect', tag: 'main', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Rear Admiral Oldendorf', msg: 'Two battleships coming up the strait. PT boats report and attack first, then the destroyers. Then the battle line crosses their T. Every ship we have is here.' }] },
      ],
      timeLimit: 100,
      reward: 360,
    },
    // ------------------------------------------------------------------ 7
    {
      id: 'us7',
      title: 'Battle off Samar',
      date: '1944-10-25',
      place: 'Off Samar, Philippines',
      geo: [126.5, 11.6],
      enemyNation: 'jp',
      news: [
        '25 October, 03:00: Nishimura\'s force destroyed in Surigao Strait.',
        'Halsey\'s fast carriers race north after a Japanese decoy force.',
        'Nobody is guarding the San Bernardino Strait.',
      ],
      brief:
        'At 06:45 lookouts on the escort carriers of "Taffy 3" see pagoda masts on the horizon. Admiral Kurita\'s Centre Force, with Yamato, three more battleships and six heavy cruisers, has come through the San Bernardino Strait unseen. Between it and the Leyte beachhead there is nothing but six small escort carriers, three destroyers and four destroyer escorts.\n\nThe carriers are slow and their aircraft carry bombs for ground support, not ships. Turn away into the rain squalls, make smoke, launch everything. Then send the "small boys" in with torpedoes to break up the Japanese formation.\n\nHold out until help arrives.',
      history:
        '"Small boys on my starboard quarter, intercept enemy." Johnston, Hoel, Heermann and Samuel B. Roberts charged battleships and cruisers. Johnston, Hoel, Roberts and the carrier Gambier Bay were sunk, but three Japanese heavy cruisers were lost to torpedoes and air attacks. Confused and believing he faced fleet carriers, Kurita turned away.',
      hints: [
        'Rain squalls block sight: hide the carriers in them and make smoke.',
        'Carrier aircraft and destroyer torpedo attacks force the enemy to turn away. Every minute counts.',
      ],
      env: { tod: 'day', wx: 'rain', sea: 1, squalls: 6, biome: 'tropical', wind: 60 },
      map: { ...samarMap(), seed: 171 },
      zones: [{ id: 'north', name: 'San Bernardino Strait', kind: 'exit', x: 11, y: 1, r: 3.5 }],
      player: {
        groups: [
          { id: 'taffy3', units: many('casablanca', ['Fanshaw Bay', 'St. Lo', 'White Plains', 'Kalinin Bay', 'Kitkun Bay', 'Gambier Bay'], ['cve']), x: 40, y: 28, h: 90, formation: 'box', spacing: 1.8, speed: 17 },
          { id: 'screen', units: [...many('fletcher', ['Johnston', 'Hoel', 'Heermann']), ...many('butler', ['Samuel B. Roberts', 'Dennis', 'Raymond', 'John C. Butler'])], x: 36, y: 23, h: 90, formation: 'line', spacing: 1.3, speed: 17 },
        ],
        slots: 2,
        allowed: ['DD', 'DE'],
        spawn: { x: 42, y: 21, h: 90, formation: 'line', spacing: 1.3 },
      },
      enemy: [
        {
          id: 'centre',
          units: [U('yamato', 'Yamato'), U('nagato', 'Nagato'), U('kongo', 'Kongo'), U('kongo', 'Haruna'), U('myoko', 'Haguro'), U('takao', 'Chokai'), ...many('mogami', ['Kumano', 'Suzuya', 'Tone', 'Chikuma']), U('sendai', 'Noshiro'), ...many('kagero', ['Yukikaze', 'Isokaze', 'Nowaki', 'Urakaze', 'Hamakaze', 'Kishinami'])],
          x: 22, y: 4, h: 140, formation: 'box', spacing: 1.6, speed: 24, behavior: { kind: 'hunt', prefer: ['cve'], radius: 120 },
        },
      ],
      objectives: [
        { id: 'hold', text: 'Hold out for 60 minutes', kind: 'survive', time: 60 },
        { id: 'cves', text: 'Keep at least 3 escort carriers afloat', kind: 'protect', tag: 'cve', maxLoss: 3 },
        { id: 'cruisers', text: 'Sink 2 Japanese cruisers', kind: 'destroy', tag: 'cruiser', count: 2, bonus: true },
        { id: 'few', text: 'Lose no more than one escort carrier', kind: 'protect', tag: 'cve', maxLoss: 1, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Rear Admiral Sprague', msg: 'Battleships! Turn the carriers away into the squalls, launch every plane and make smoke. Small boys, intercept the enemy and break up his formation with torpedoes.' }] },
        { when: { time: 14 }, do: [{ msg: 'Taffy 2 aircraft joining the attack from the south.' }, { side: 0, air: { from: 's', target: 'battleship', sq: [{ a: 'tbf', n: 12 }, { a: 'fm2', n: 8 }] } }] },
        { when: { time: 32 }, do: [{ msg: 'Another strike from Taffy 2 inbound.' }, { side: 0, air: { from: 's', target: 'cruiser', sq: [{ a: 'tbf', n: 10 }, { a: 'fm2', n: 8 }] } }] },
        { when: { time: 50 }, do: [{ side: 0, air: { from: 's', target: 'cruiser', sq: [{ a: 'tbf', n: 12 }, { a: 'fm2', n: 6 }] } }] },
        { when: { time: 60 }, do: [{ msg: 'The enemy is turning away! Kurita is breaking off.' }, { behavior: 'centre', set: { kind: 'flee', exit: 'north' } }] },
      ],
      timeLimit: 75,
      reward: 360,
    },
    // ------------------------------------------------------------------ 8
    {
      id: 'us8',
      title: 'Radar Picket Station One',
      date: '1945-04-16',
      place: 'North of Okinawa',
      geo: [127.9, 27.2],
      enemyNation: 'jp',
      news: [
        'October 1944: the Japanese fleet is shattered at Leyte Gulf. The first kamikaze attacks.',
        'February 1945: Iwo Jima.',
        'April: the invasion of Okinawa. Destroyers on radar picket stations face the kamikazes first.',
      ],
      brief:
        'Around Okinawa a ring of destroyers stands on radar picket stations, seventy miles out, to warn the fleet of incoming air raids. That makes them the first thing the kamikazes find.\n\nUSS Laffey, a new Sumner-class destroyer, has the most exposed station of all. This morning the raids are coming in waves: dive bombers, torpedo planes and suicide attackers. Two landing-craft gunboats and, later, a few Corsairs are all the help you will get.\n\nKeep the guns manned, keep moving at speed, and give them a target that turns.',
      history:
        'In 80 minutes Laffey was attacked by 22 aircraft. Six kamikazes and four bombs hit her and her rudder jammed, but her crew shot down nine attackers and kept her afloat. "I\'ll never abandon ship as long as a gun will fire," said Commander Becton. She survives today as a museum ship in South Carolina.',
      hints: [
        'Keep moving at full speed: fast, turning ships are harder to hit.',
        'Keep the gunboats close. Anti-aircraft fire is strongest when ships support each other.',
      ],
      env: { tod: 'day', wx: 'clear', sea: 1, biome: 'tropical' },
      map: { w: 50, h: 40, seed: 181, land: [{ k: 'island', x: 4, y: 37, r: 6, rough: 0.35 }, { k: 'island', x: 20, y: 38.5, r: 1.2 }] },
      player: {
        groups: [
          { id: 'picket', units: [U('sumner', 'Laffey', ['laffey'])], x: 25, y: 20, h: 0, speed: 20 },
          { id: 'lcs', units: many('lcs', ['LCS-51', 'LCS-116']), x: 27, y: 22, h: 0, formation: 'line', spacing: 1, speed: 12 },
        ],
        slots: 2,
        allowed: ['DD', 'CL', 'CA', 'DE'],
        spawn: { x: 22, y: 23, h: 0, formation: 'line', spacing: 1.5 },
      },
      enemy: [],
      objectives: [
        { id: 'hold', text: 'Hold the picket station for 35 minutes', kind: 'survive', time: 35 },
        { id: 'laffey', text: 'Keep Laffey afloat', kind: 'protect', tag: 'laffey' },
        { id: 'aa', text: 'Shoot down 30 aircraft', kind: 'shootdown', count: 30, bonus: true },
        { id: 'losses', text: 'Lose no ships', kind: 'protect', tag: 'warship', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Commander Becton', msg: 'Radar Picket Station One. We see the raids first, and they see us first. Keep moving, keep the guns manned, and make them work for it.' }] },
        { when: { time: 1 }, do: [{ msg: 'Radar: bogeys from the north!' }, { side: 1, air: { from: 'n', target: 'warship', sq: [{ a: 'kamikaze', n: 4 }, { a: 'd3a', n: 4 }] } }] },
        { when: { time: 5 }, do: [{ msg: 'Radar: raid from the west.' }, { side: 1, air: { from: 'w', target: 'laffey', sq: [{ a: 'kamikaze', n: 8 }] } }] },
        { when: { time: 9 }, do: [{ side: 1, air: { from: 'n', target: 'warship', sq: [{ a: 'kamikaze', n: 6 }, { a: 'b6n', n: 4 }] } }] },
        { when: { time: 12 }, do: [{ msg: 'Corsairs on station overhead.' }, { side: 0, air: { from: 's', cap: 'laffey', minutes: 25, sq: [{ a: 'f4u', n: 8 }] } }] },
        { when: { time: 14 }, do: [{ msg: 'Radar: large raid from the east!' }, { side: 1, air: { from: 'e', target: 'laffey', sq: [{ a: 'kamikaze', n: 10 }] } }] },
        { when: { time: 20 }, do: [{ side: 1, air: { from: 'n', target: 'warship', sq: [{ a: 'kamikaze', n: 8 }, { a: 'd3a', n: 6 }] } }] },
        { when: { time: 27 }, do: [{ msg: 'Radar: another wave from the west.' }, { side: 1, air: { from: 'w', target: 'laffey', sq: [{ a: 'kamikaze', n: 8 }] } }] },
      ],
      timeLimit: 40,
      reward: 340,
    },
  ],
};
