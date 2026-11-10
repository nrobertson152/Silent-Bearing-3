import type { CampaignDef } from '../types';
import { NORTH_CAPE_ZONES, U, anon, many, northCapeMap } from './common';

export const UK: CampaignDef = {
  nation: 'uk',
  title: 'Ruler of the Waves',
  subtitle: 'The Royal Navy at war',
  years: '1939–1943',
  theater: 'atlantic',
  intro:
    'In September 1939 the Royal Navy is still the largest fleet in the world, and Britain cannot survive without it. Every ton of food, oil and steel must come by sea, past U-boats, surface raiders and, soon, the aircraft and battleships of two enemies at once.\n\nYour campaign follows the Navy from the hunt for the first German raider to the last battleship action fought in European waters.',
  epilogue:
    'Scharnhorst was the last German capital ship to threaten the Arctic convoys. From 1944 the Royal Navy turned to the invasion of Europe and, in 1945, sent a fleet to fight alongside the Americans in the Pacific. The Battle of the Atlantic had been won: the longest campaign of the war, and the one Churchill said was the only thing that ever really frightened him.',
  startFleet: [
    { c: 'leander', n: 'Ajax' },
    { c: 'hclass', n: 'Hotspur' },
    { c: 'hclass', n: 'Havock' },
  ],
  startPrestige: 400,
  missions: [
    // ------------------------------------------------------------------ 1
    {
      id: 'uk1',
      title: 'The River Plate',
      date: '1939-12-13',
      place: 'South Atlantic, off the River Plate',
      geo: [-53.5, -35.0],
      enemyNation: 'de',
      news: [
        '3 September 1939: Britain and France declare war on Germany.',
        'October: a German raider is sinking merchant ships in the South Atlantic and vanishing.',
        'Commodore Harwood takes Force G to guard the approaches to the River Plate.',
      ],
      brief:
        'Since September the pocket battleship Admiral Graf Spee has sunk nine merchant ships in the South Atlantic and vanished after each one. Commodore Henry Harwood has guessed that she will come for the rich shipping off the River Plate, and he has guessed right: at dawn on 13 December smoke is sighted to the west.\n\nHarwood has the heavy cruiser Exeter and the light cruisers Ajax and Achilles. Graf Spee\'s six 11-inch guns outrange and outweigh anything he has, but she cannot fight everyone at once. Split up, attack from two sides and keep her guessing.\n\nYou do not have to sink her. A raider far from home cannot afford damage: hurt her badly enough and she will have to break off.',
      history:
        'Exeter was battered into a wreck, but Harwood\'s cruisers hit Graf Spee some twenty times. Captain Langsdorff ran for neutral Montevideo and, on 17 December, believing a far larger British force was waiting outside, scuttled his ship in the estuary.',
      hints: [
        'Right-click an enemy ship to engage her. Guns fire on their own at anything in range.',
        'Keep your cruisers apart so Graf Spee has to split her fire.',
        'Use the time buttons at the top to speed up the approach.',
      ],
      env: { tod: 'day', wx: 'clear', sea: 1, biome: 'temperate', wind: 120 },
      map: { w: 70, h: 45, seed: 11, land: [{ k: 'coast', side: 'w', depth: 4, to: 30, rough: 0.3 }] },
      zones: [{ id: 'montevideo', name: 'Montevideo', kind: 'exit', x: 4, y: 20, r: 3.5 }],
      player: {
        groups: [
          { id: 'exeter', units: [U('york', 'Exeter', ['exeter'])], x: 50, y: 30, h: 300, speed: 25 },
          { id: 'achilles', units: [U('leander', 'Achilles')], x: 53, y: 13, h: 285, speed: 25 },
        ],
        slots: 1,
        history: [U('leander', 'Ajax')],
        allowed: ['CA', 'CL', 'DD'],
        spawn: { x: 55.5, y: 12.4, h: 285 },
      },
      enemy: [
        {
          id: 'spee', units: [U('deutschland', 'Admiral Graf Spee', ['spee'], { hp: 0.95 })],
          x: 22, y: 20, h: 85, speed: 24,
          behavior: { kind: 'raider', exit: 'montevideo', retreatHp: 0.62, prefer: ['warship'] },
        },
      ],
      objectives: [
        { id: 'cripple', text: 'Cripple Admiral Graf Spee (60% hull or less)', kind: 'damage', tag: 'spee', frac: 0.6 },
        { id: 'sink', text: 'Sink Admiral Graf Spee', kind: 'destroy', tag: 'spee', bonus: true },
        { id: 'exeter', text: 'Keep HMS Exeter afloat', kind: 'protect', tag: 'exeter', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Commodore Harwood', msg: 'Smoke bearing west-north-west. Exeter, engage from the south. Ajax and Achilles will work round to the north and split her fire.' }] },
        { when: { hp: 'spee', below: 0.62 }, do: [{ from: 'Harwood', msg: 'She is turning away and running for Montevideo. Keep after her!' }] },
      ],
      timeLimit: 120,
      reward: 250,
    },
    // ------------------------------------------------------------------ 2
    {
      id: 'uk2',
      title: 'First Battle of Narvik',
      date: '1940-04-10',
      place: 'Ofotfjord, Norway',
      geo: [17.4, 68.43],
      enemyNation: 'de',
      news: [
        'December 1939: Graf Spee scuttled off Montevideo.',
        '9 April 1940: Germany invades Denmark and Norway.',
        'German destroyers land mountain troops at Narvik, the port for Swedish iron ore.',
      ],
      brief:
        'Ten German destroyers have landed troops at Narvik, the ice-free port that ships Swedish iron ore to Germany. Captain Bernard Warburton-Lee has been ordered up Ofotfjord to attack. His signal to the Admiralty: "Intend attacking at dawn, high water."\n\nYou have five H-class destroyers. Snow squalls cut visibility to a few kilometres, and the enemy does not believe any British ship could reach the harbour unseen. Destroyers and supply ships lie at anchor in Narvik harbour. More destroyers are in the side fjords, and they will come out when they hear the guns.\n\nTorpedo the harbour, sink what you can, and get back down the fjord before the trap closes.',
      history:
        'Warburton-Lee\'s flotilla sank two destroyers and six merchant ships in the harbour. On the way out five German destroyers caught them: Hardy was beached and Hunter sunk, and Warburton-Lee was killed, earning the first Victoria Cross of the war. Three days later Warspite came up the fjord and finished off the rest.',
      hints: [
        'Snow limits visibility to a few kilometres. Use it to get close.',
        'Torpedo the anchored ships before they raise steam: select a destroyer, press T and click a target.',
        'Ships at anchor need a few minutes to get under way after they spot you.',
      ],
      env: { tod: 'dawn', wx: 'snow', sea: 0, biome: 'arctic' },
      map: {
        w: 44, h: 26, seed: 21, baseLand: true,
        land: [
          { k: 'channel', pts: [[0, 14], [8, 13], [16, 12], [24, 12.5], [31, 12.5], [36, 12]], w: 3.2, rough: 0.35 },
          { k: 'water', x: 37.5, y: 12.6, r: 2.3, rough: 0.3 },
          { k: 'channel', pts: [[25, 12], [27, 7], [28, 2]], w: 2.2 },
          { k: 'channel', pts: [[37, 12], [41, 10], [44, 9.5]], w: 1.1 },
          { k: 'channel', pts: [[11, 13], [12, 18], [12.5, 22]], w: 2.0 },
          { k: 'channel', pts: [[33, 13], [34, 18], [35, 23]], w: 1.3 },
        ],
      },
      zones: [{ id: 'sea', name: 'Vestfjord', kind: 'exit', x: 0.5, y: 14, r: 2.2 }],
      player: {
        groups: [
          { id: 'flotilla', units: [U('hclass', 'Hardy', ['hardy']), U('hclass', 'Hunter'), U('hclass', 'Hostile')], x: 15.5, y: 12.2, h: 85, spacing: 0.5, speed: 15 },
        ],
        slots: 2,
        history: [U('hclass', 'Hotspur'), U('hclass', 'Havock')],
        allowed: ['DD'],
        spawn: { x: 13.8, y: 12.6, h: 85, spacing: 0.5 },
        auto: { kind: 'hunt', pts: [[24, 12.4], [31, 12.5], [36.5, 12.4]], prefer: ['supply'], speed: 15 },
      },
      enemy: [
        {
          id: 'harbour', units: many('z1934', ['Wilhelm Heidkamp', 'Anton Schmitt', 'Diether von Roeder', 'Hans Lüdemann', 'Hermann Künne']),
          x: 37.6, y: 12.4, h: 270, formation: 'anchored', spacing: 0.45, alert: false, alertDelay: 150,
          behavior: { kind: 'hold', onAlert: { kind: 'hunt', radius: 40 } },
        },
        {
          id: 'supply', units: many('freighter_de', ['Jan Wellem', 'Bockenheim', 'Frielinghaus', 'Hein Hoyer', 'Martha Hendrik Fisser', 'Neuenfels'], ['supply']),
          x: 37.6, y: 13.4, h: 200, formation: 'anchored', spacing: 0.45, alert: false, alertDelay: 60, behavior: { kind: 'hold' },
        },
        {
          id: 'herjangs', units: many('z1934', ['Wolfgang Zenker', 'Erich Giese', 'Erich Koellner']),
          x: 27.4, y: 5, h: 180, formation: 'anchored', spacing: 0.5, alert: false, alertDelay: 420,
          behavior: { kind: 'hold', onAlert: { kind: 'hunt', radius: 40 } },
        },
        {
          id: 'ballangen', units: many('z1934', ['Georg Thiele', 'Bernd von Arnim']),
          x: 12.1, y: 19.5, h: 0, formation: 'anchored', spacing: 0.5, alert: false, alertDelay: 420,
          behavior: { kind: 'hold', onAlert: { kind: 'hunt', radius: 40 } },
        },
      ],
      objectives: [
        { id: 'dd', text: 'Sink 2 German destroyers', kind: 'destroy', tag: 'dd', count: 2 },
        { id: 'supply', text: 'Sink 3 supply ships in Narvik harbour', kind: 'destroy', tag: 'supply', count: 3 },
        { id: 'out', text: 'Bring 3 destroyers back out to Vestfjord', kind: 'reach', tag: 'dd', zone: 'sea', count: 3, bonus: true },
        { id: 'losses', text: 'Lose no more than 2 destroyers', kind: 'protect', tag: 'dd', maxLoss: 2, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Captain Warburton-Lee', msg: 'Narvik harbour lies at the head of the fjord, twenty kilometres ahead. The snow will hide us until we are close. Torpedoes first.' }] },
        { when: { lost: 'dd', count: 2 }, do: [{ from: 'Warburton-Lee', msg: 'Well done. Now get out before the others come down on us.' }] },
      ],
      timeLimit: 80,
      reward: 260,
    },
    // ------------------------------------------------------------------ 3
    {
      id: 'uk3',
      title: 'Taranto',
      date: '1940-11-11',
      place: 'Gulf of Taranto, Italy',
      geo: [17.2, 40.47],
      enemyNation: 'it',
      news: [
        'June 1940: France falls. Italy enters the war on Germany\'s side.',
        'The Mediterranean fleet faces the Italian battle fleet with no French help.',
        'Admiral Cunningham revives an old plan: a carrier strike on the fleet in harbour.',
      ],
      brief:
        'The Italian battle fleet sits in the great harbour at Taranto, a constant threat to every British convoy in the Mediterranean. Tonight, by the light of the moon, the carrier Illustrious will try what no navy has ever done: cripple a battle fleet at its moorings with aircraft alone.\n\nIllustrious carries twenty-one Fairey Swordfish, slow fabric-covered biplanes armed with one torpedo each. Reconnaissance photographs show six battleships in the Mar Grande, protected by barrage balloons, nets and some two hundred anti-aircraft guns.\n\nThe Fulmar fighters cannot fly at night. The Swordfish can.',
      history:
        'In two waves the Swordfish put Conte di Cavour on the bottom and badly damaged Littorio and Caio Duilio, for the loss of two aircraft. Half the Italian battle fleet was out of action in one night. The Japanese naval attaché in Rome studied the raid closely.',
      hints: [
        'Select Illustrious and use "Launch strike" (B), then click a battleship.',
        'Only the Swordfish can operate at night. Harbour guns will take a toll.',
        'Torpedo bombers drop about a kilometre from their target: approach over open water.',
      ],
      env: { tod: 'night', wx: 'clear', sea: 0, biome: 'temperate' },
      map: {
        w: 70, h: 50, seed: 31,
        land: [
          { k: 'coast', side: 'n', depth: 12, from: 32, rough: 0.3 },
          { k: 'coast', side: 'e', depth: 12, to: 32, rough: 0.3 },
          { k: 'water', x: 53, y: 12.5, r: 4.4, elong: 1.35, rot: 20, rough: 0.15 },
          { k: 'water', x: 60.5, y: 6, r: 1.9, rough: 0.2 },
          { k: 'channel', pts: [[57, 9.5], [59.6, 7]], w: 0.4, rough: 0.1 },
          { k: 'island', x: 47.5, y: 17.5, r: 0.7, rough: 0.3 },
        ],
      },
      player: {
        groups: [
          {
            id: 'force', units: [U('illustrious', 'Illustrious', ['illustrious'], { special: ['noAir'] }), U('town', 'Gloucester'), U('county', 'Berwick'), U('hclass', 'Hyperion'), U('hclass', 'Hasty')],
            x: 10, y: 40, h: 45, formation: 'screen', spacing: 2, speed: 22,
            // The two waves of the raid, split into the flights that attacked.
            air: [
              { a: 'fulmar', n: 12, name: '806 Squadron' },
              { a: 'swordfish', n: 6, name: '815 Squadron' },
              { a: 'swordfish', n: 6, name: '813 Squadron' },
              { a: 'swordfish', n: 5, name: '819 Squadron' },
              { a: 'swordfish', n: 4, name: '824 Squadron' },
            ],
          },
        ],
        slots: 2,
        history: [U('town', 'Glasgow'), U('hclass', 'Havock')],
        allowed: ['CA', 'CL', 'DD'],
        spawn: { x: 14, y: 43, h: 45 },
      },
      enemy: [
        {
          id: 'battlefleet', units: [U('littorio', 'Littorio', ['bb']), U('littorio', 'Vittorio Veneto', ['bb']), U('cavour', 'Conte di Cavour', ['bb']), U('cavour', 'Giulio Cesare', ['bb']), U('cavour', 'Caio Duilio', ['bb']), U('cavour', 'Andrea Doria', ['bb'])],
          x: 53, y: 12, h: 300, formation: 'anchored', spacing: 1.1, behavior: { kind: 'hold' },
        },
        {
          id: 'cruisers', units: [U('trento', 'Trento'), U('trento', 'Trieste'), U('zara', 'Zara'), U('zara', 'Gorizia')],
          x: 60.5, y: 6, h: 270, formation: 'anchored', spacing: 0.5, behavior: { kind: 'hold' },
        },
        {
          id: 'aa', units: [U('aasite_it', 'Batteria San Vito', [], { x: 49.5, y: 9.4 }), U('aasite_it', 'Batteria Rondinella', [], { x: 52.5, y: 7.6 }), U('aasite_it', 'Batteria Mar Piccolo', [], { x: 57, y: 8.2 }), U('aasite_it', 'Batteria Lido', [], { x: 58.3, y: 13.2 }), U('aasite_it', 'Diga di Tarantola', [], { x: 50.5, y: 15.6 })],
          x: 53, y: 12, h: 0, behavior: { kind: 'hold' },
        },
        {
          id: 'patrol', units: [U('soldati', 'Fulmine'), U('soldati', 'Baleno')],
          x: 40, y: 28, h: 240, speed: 14, behavior: { kind: 'patrol', pts: [[40, 26], [30, 32], [40, 38], [50, 28]], engage: 7 },
        },
      ],
      objectives: [
        { id: 'cripple', text: 'Cripple 3 Italian battleships (70% hull or less)', kind: 'damage', tag: 'bb', frac: 0.7, count: 3 },
        { id: 'carrier', text: 'Keep HMS Illustrious safe', kind: 'protect', tag: 'illustrious' },
        { id: 'sink', text: 'Sink a battleship at her moorings', kind: 'destroy', tag: 'bb', count: 1, bonus: true },
        { id: 'planes', text: 'Lose no more than 4 aircraft', kind: 'airLosses', maxLoss: 4, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Rear Admiral Lyster', msg: 'All six battleships are at anchor in the Mar Grande. Fly off the Swordfish. Go for the battleships and mind the balloons.' }, { reveal: 'bb' }, { reveal: 'cruiser' }] },
        { when: { obj: 'cripple', state: 'done' }, do: [{ from: 'Lyster', msg: 'Splendid. The Italian fleet has been dealt with. Recover the aircraft.' }] },
      ],
      timeLimit: 120,
      reward: 260,
    },
    // ------------------------------------------------------------------ 4
    {
      id: 'uk4',
      title: 'Cape Matapan',
      date: '1941-03-28',
      place: 'Off Cape Matapan, Greece',
      geo: [21.2, 35.3],
      enemyNation: 'it',
      news: [
        'November 1940: the Fleet Air Arm cripples the Italian fleet at Taranto.',
        'March 1941: British troops are shipped to Greece. The Italian fleet sails to intercept.',
        'Aircraft from Formidable torpedo Vittorio Veneto and the cruiser Pola.',
      ],
      brief:
        'Through the afternoon Admiral Cunningham chased the damaged Vittorio Veneto. She has escaped, but a torpedo bomber has left the heavy cruiser Pola dead in the water, and the Italians have sent her sisters Zara and Fiume back with four destroyers to help her.\n\nThey do not know you are here, and they have no radar. Valiant\'s set has found Pola, stopped in the dark ahead. Bring the battle line in close, and open fire at point-blank range.',
      history:
        'At 22:28 Warspite, Valiant and Barham opened fire at 3,500 metres. Zara and Fiume were wrecked in minutes, their guns still trained fore and aft. Pola and two destroyers were sunk later that night. Some 2,300 Italian sailors died; the British lost one aircraft.',
      hints: [
        'It is a dark night. The Italians cannot see you until you fire, but your radar can see them.',
        'Hold fire (H) until you are close, then let them have it.',
      ],
      env: { tod: 'night', wx: 'clear', sea: 1, biome: 'temperate' },
      map: { w: 50, h: 38, seed: 41, land: [{ k: 'coast', side: 'n', depth: 4, from: 22, rough: 0.35 }] },
      player: {
        groups: [
          { id: 'battleline', units: [U('qe', 'Warspite', ['battleline']), U('qe', 'Valiant', ['battleline']), U('qe', 'Barham', ['battleline'])], x: 42, y: 30, h: 300, spacing: 0.8, speed: 18 },
          { id: 'screen', units: [U('hclass', 'Greyhound'), U('hclass', 'Griffin')], x: 40, y: 26.5, h: 300, formation: 'line', spacing: 1.2, speed: 18 },
        ],
        slots: 2,
        history: [U('jclass', 'Jervis'), U('hclass', 'Havock')],
        allowed: ['CA', 'CL', 'DD'],
        spawn: { x: 45, y: 32, h: 300 },
      },
      enemy: [
        { id: 'pola', units: [U('zara', 'Pola', ['pola'], { hp: 0.6, special: ['disabled'] })], x: 24, y: 18, h: 120, behavior: { kind: 'hold' } },
        {
          id: 'relief', units: [U('soldati', 'Alfieri'), U('zara', 'Zara', ['target']), U('zara', 'Fiume', ['target']), U('soldati', 'Gioberti'), U('soldati', 'Carducci'), U('soldati', 'Oriani')],
          x: 9, y: 7, h: 120, spacing: 0.7, speed: 16, alert: false, alertDelay: 50,
          behavior: { kind: 'route', pts: [[23, 17.4]], engage: true },
        },
      ],
      objectives: [
        { id: 'cruisers', text: 'Sink the heavy cruisers Zara and Fiume', kind: 'destroy', tag: 'target', count: 2 },
        { id: 'line', text: 'Lose no battleships', kind: 'protect', tag: 'battleline' },
        { id: 'pola', text: 'Sink the crippled Pola', kind: 'destroy', tag: 'pola', bonus: true },
        { id: 'dd', text: 'Sink 2 Italian destroyers', kind: 'destroy', tag: 'dd', count: 2, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Admiral Cunningham', msg: 'Valiant\'s radar has a large ship stopped in the water ahead. Close in quietly. The battle line will open fire at point-blank range.' }, { reveal: 'pola' }] },
      ],
      timeLimit: 60,
      reward: 280,
    },
    // ------------------------------------------------------------------ 5
    {
      id: 'uk5',
      title: 'Sink the Bismarck',
      date: '1941-05-26',
      place: 'North Atlantic, west of Brest',
      geo: [-16.2, 48.2],
      enemyNation: 'de',
      news: [
        'March 1941: victory at Cape Matapan.',
        '24 May: Bismarck sinks HMS Hood in the Denmark Strait. Three of 1,418 men survive.',
        '"Sink the Bismarck!" Every available ship is ordered to join the hunt.',
      ],
      brief:
        'Two days after sinking Hood, Bismarck has shaken off her shadowers and is running for the safety of occupied France. By tomorrow she will be under the umbrella of the Luftwaffe, and safe.\n\nAdmiral Tovey\'s King George V and Rodney are coming up astern, but they are too far behind to catch her. Only the Swordfish of Ark Royal, steaming up from Gibraltar with Force H, can slow her down. Then the battleships can finish the job.\n\nThe sea is rough and the cloud is low. One lucky torpedo is all it takes.',
      history:
        'At dusk on 26 May a Swordfish torpedo jammed Bismarck\'s rudders, leaving her steaming in circles. Next morning King George V and Rodney pounded her into a wreck, and she sank after torpedoes from the cruiser Dorsetshire. Of more than 2,200 men aboard, 114 survived.',
      hints: [
        'Only Ark Royal\'s Swordfish can slow Bismarck down: launch them early.',
        'Heavy seas spoil gunnery and slow small ships.',
      ],
      env: { tod: 'day', wx: 'overcast', sea: 3, biome: 'temperate', wind: 120 },
      map: { w: 130, h: 80, seed: 51, land: [] },
      zones: [{ id: 'brest', name: 'Luftwaffe air cover (Brest)', kind: 'exit', x: 127, y: 70, r: 10 }],
      player: {
        groups: [
          { id: 'homefleet', units: [U('kgv', 'King George V', ['kgv']), U('nelson', 'Rodney', ['rodney'])], x: 12, y: 22, h: 110, spacing: 1.0, speed: 22 },
          { id: 'forceh', units: [U('arkroyal', 'Ark Royal', ['ark']), U('town', 'Sheffield')], x: 80, y: 70, h: 20, formation: 'line', spacing: 2.5, speed: 20 },
          { id: 'vian', units: many('tribal', ['Cossack', 'Maori', 'Sikh', 'Zulu']), x: 62, y: 18, h: 150, formation: 'line', spacing: 1.5, speed: 25 },
        ],
        slots: 3,
        history: [U('county', 'Dorsetshire'), U('county', 'Norfolk')],
        allowed: ['BB', 'BC', 'CA', 'CL', 'DD', 'CV', 'CVL'],
        spawn: { x: 15, y: 30, h: 110 },
      },
      enemy: [
        {
          id: 'bismarck', units: [U('bismarck', 'Bismarck', ['bismarck'], { hp: 0.9, special: ['rudderJam'] })],
          x: 44, y: 38, h: 112, speed: 22,
          behavior: { kind: 'route', pts: [[127, 70]], exit: 'brest', engage: false },
        },
      ],
      objectives: [
        { id: 'sink', text: 'Sink Bismarck', kind: 'destroy', tag: 'bismarck' },
        { id: 'stop', text: 'Stop Bismarck reaching air cover off Brest', kind: 'prevent', tag: 'bismarck', zone: 'brest' },
        { id: 'capital', text: 'Lose no capital ship', kind: 'protect', tag: 'capital', bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Admiral Tovey', msg: 'Bismarck is ahead of us and making for France. We cannot catch her unless she is slowed. Ark Royal must stop her with a torpedo strike.' }, { reveal: 'bismarck' }] },
        { when: { torpHit: 'bismarck' }, do: [{ from: 'Shadowing aircraft', msg: 'Bismarck has turned north-west and is steaming in circles. Her steering is gone!' }, { behavior: 'bismarck', set: { kind: 'hunt', radius: 60 } }] },
        { when: { time: 45 }, do: [{ from: 'Sheffield', msg: 'Bismarck in sight. Shadowing.' }, { reveal: 'bismarck' }] },
      ],
      timeLimit: 180,
      reward: 320,
    },
    // ------------------------------------------------------------------ 6
    {
      id: 'uk6',
      title: 'Operation Pedestal',
      date: '1942-08-12',
      place: 'The Sicilian Narrows',
      geo: [11.8, 37.0],
      enemyNation: 'it',
      news: [
        'May 1941: Bismarck sunk.',
        'Malta, bombed day and night, is down to its last weeks of food and fuel.',
        'August 1942: fourteen merchant ships sail from Gibraltar with the strongest escort ever given to a convoy.',
      ],
      brief:
        'Malta is starving. Its aircraft and submarines strangle Rommel\'s supply lines, but without fuel and food the island will have to surrender within weeks. Operation Pedestal is the last chance.\n\nThe battleships and carriers have turned back at the Narrows. From here Rear Admiral Burrough\'s cruisers and destroyers must take the convoy through the Sicilian Channel alone: submarines lie in wait, German and Italian bombers fly from Sicily, and motor torpedo boats lurk off Cape Bon.\n\nAbove all, get the tanker Ohio through. Without her fuel, Malta is finished.',
      history:
        'Nine of the fourteen merchant ships were sunk, along with the carrier Eagle, two cruisers and a destroyer. Five ships reached Grand Harbour; the last was Ohio, her back broken, lashed between two destroyers. Her fuel kept Malta fighting, and the island held.',
      hints: [
        'Spread your escorts round the convoy: anti-aircraft fire is strongest when ships support each other.',
        'Escorts with sonar will find submarines lying ahead of the convoy.',
      ],
      env: { tod: 'day', wx: 'clear', sea: 1, biome: 'desert', wind: 90 },
      map: {
        w: 80, h: 50, seed: 61,
        land: [
          { k: 'coast', side: 's', depth: 9, to: 34, rough: 0.35 },
          { k: 'coast', side: 'n', depth: 8, from: 42, rough: 0.35 },
          { k: 'island', x: 44, y: 30, r: 2.2, rough: 0.35 },
          { k: 'island', x: 79, y: 42, r: 2.2, rough: 0.3 },
        ],
      },
      zones: [{ id: 'malta', name: 'Malta (Grand Harbour)', kind: 'exit', x: 76, y: 37, r: 4.5 }],
      player: {
        groups: [
          { id: 'cruisers', units: [U('town', 'Nigeria'), U('town', 'Kenya'), U('dido', 'Cairo')], x: 14, y: 21, h: 90, formation: 'line', spacing: 2, speed: 14 },
          { id: 'destroyers', units: [U('tribal', 'Ashanti'), U('jclass', 'Pathfinder'), U('jclass', 'Penn'), U('hunt', 'Ledbury'), U('hunt', 'Bramham')], x: 15, y: 30, h: 90, formation: 'line', spacing: 1.8, speed: 14 },
        ],
        slots: 3,
        history: [U('town', 'Manchester'), U('hunt', 'Derwent'), U('hunt', 'Wilton')],
        allowed: ['CA', 'CL', 'DD', 'DE'],
        spawn: { x: 9, y: 22, h: 90, formation: 'line', spacing: 1.6 },
      },
      allies: [
        {
          id: 'convoy',
          units: [U('ohio', 'Ohio', ['ohio']), ...many('cargo', ['Melbourne Star', 'Brisbane Star', 'Rochester Castle', 'Port Chalmers', 'Waimarama', 'Dorset', 'Clan Ferguson'], ['cargoship'])],
          x: 10, y: 26, h: 90, formation: 'box', spacing: 0.9, speed: 13,
          behavior: { kind: 'route', pts: [[28, 25], [48, 24], [64, 32], [76, 37]], exit: 'malta', speed: 13, zigzag: true },
        },
      ],
      enemy: [
        { id: 'axum', units: [U('italsub', 'Axum')], x: 33, y: 26, h: 270, behavior: { kind: 'sub', area: [33, 26, 6], prefer: ['ohio'] } },
        { id: 'dessie', units: [U('italsub', 'Dessiè')], x: 57, y: 29, h: 270, behavior: { kind: 'sub', area: [57, 29, 6], prefer: ['merchant'] } },
      ],
      objectives: [
        { id: 'ohio', text: 'Get the tanker Ohio to Malta', kind: 'reach', tag: 'ohio', zone: 'malta', count: 1 },
        { id: 'three', text: 'Get at least 3 more merchant ships to Malta', kind: 'reach', tag: 'cargoship', zone: 'malta', count: 3 },
        { id: 'five', text: 'Get 5 of the cargo ships through', kind: 'reach', tag: 'cargoship', zone: 'malta', count: 5, bonus: true },
        { id: 'aa', text: 'Shoot down 25 aircraft', kind: 'shootdown', count: 25, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Rear Admiral Burrough', msg: 'The heavy ships have turned back. From here it is up to us. Keep the convoy closed up and get Ohio through.' }] },
        { when: { time: 6 }, do: [{ msg: 'Radar: large formation of aircraft approaching from Sicily!' }, { side: 1, air: { from: 'n', target: 'merchant', sq: [{ a: 'ju87it', n: 10 }, { a: 'sm79', n: 8 }, { a: 'mc202', n: 8 }] } }] },
        { when: { time: 25 }, do: [{ msg: 'Radar: second raid inbound from the north.' }, { side: 1, air: { from: 'n', target: 'merchant', sq: [{ a: 'ju88', n: 12 }, { a: 'sm79', n: 10 }, { a: 'mc202', n: 6 }] } }] },
        { when: { time: 45 }, do: [{ msg: 'Radar: Stukas approaching.' }, { side: 1, air: { from: 'n', target: 'ohio', sq: [{ a: 'ju87', n: 12 }, { a: 'bf109', n: 8 }] } }] },
        { when: { time: 52 }, do: [{ msg: 'Motor torpedo boats closing from the direction of Cape Bon!' }, { side: 1, spawn: { id: 'mas', units: [...anon('mas', 4), ...anon('sboot', 2)], x: 30, y: 47, h: 20, formation: 'line', spacing: 1.2, speed: 38, behavior: { kind: 'hunt', prefer: ['merchant'], radius: 60 } } }] },
        { when: { time: 75 }, do: [{ msg: 'Radar: Ju 88s inbound, going for the tanker.' }, { side: 1, air: { from: 'n', target: 'ohio', sq: [{ a: 'ju88', n: 10 }] } }] },
      ],
      timeLimit: 200,
      reward: 320,
    },
    // ------------------------------------------------------------------ 7
    {
      id: 'uk7',
      title: 'Convoy ONS 5',
      date: '1943-05-05',
      place: 'North Atlantic, south of Greenland',
      geo: [-42.0, 55.0],
      enemyNation: 'de',
      news: [
        'August 1942: Ohio reaches Malta. The island is saved.',
        'March 1943: the worst month of the Battle of the Atlantic. U-boats sink 120 ships.',
        'New escorts arrive: frigates, support groups, Hedgehog, centimetric radar and HF/DF.',
      ],
      brief:
        'Convoy ONS 5 is westbound, empty, and surrounded. B-Dienst has broken the convoy codes and more than forty U-boats have been gathered across its path. For three days they have attacked, and the escorts are tired and short of fuel.\n\nTonight a thick fog is coming down. It will blind the U-boats, but not your new Type 271 radar, which can see a surfaced U-boat long before her lookouts can see you. HF/DF sets will catch the bearings of their radio signals.\n\nHold the convoy together until dawn and make them pay.',
      history:
        'In the fog of 5 to 6 May the escorts of ONS 5 drove off some twenty-five attacks and sank six U-boats; thirteen merchant ships had been lost over the whole battle. In the following weeks the U-boats lost 41 boats in a month. Dönitz withdrew from the North Atlantic: "Black May" had turned the battle.',
      hints: [
        'U-boats attack on the surface at night. Your radar sees them before they see you.',
        'Cyan hydrophone lines and purple HF/DF lines point at U-boats: send an escort down the line.',
        'Escorts drop depth charges automatically over a submerged contact. Sonar only works below about 18 knots.',
      ],
      env: { tod: 'night', wx: 'fog', sea: 2, biome: 'temperate' },
      map: { w: 60, h: 44, seed: 71, land: [] },
      zones: [{ id: 'west', name: 'Westward (Newfoundland)', kind: 'exit', x: 1, y: 22, r: 4 }],
      player: {
        groups: [
          { id: 'b7', units: [U('hclass', 'Duncan'), U('hclass', 'Vidette'), U('river', 'Tay'), U('flower', 'Sunflower'), U('flower', 'Snowflake'), U('flower', 'Loosestrife')], x: 41, y: 22, h: 270, formation: 'line', spacing: 2.4, speed: 9 },
        ],
        slots: 2,
        history: [U('flower', 'Pink'), U('river', 'Jed')],
        allowed: ['DD', 'DE'],
        spawn: { x: 48, y: 16, h: 270, formation: 'line', spacing: 1.5 },
      },
      allies: [
        {
          id: 'convoy', units: [...anon('tramp', 10), ...anon('tanker', 2)],
          x: 45, y: 22, h: 270, formation: 'box', spacing: 0.9, speed: 9,
          behavior: { kind: 'route', pts: [[25, 22], [1, 22]], exit: 'west', speed: 8.5, zigzag: true },
        },
      ],
      enemy: [
        { id: 'u1', units: [U('type7c', 'U-264')], x: 30, y: 12, h: 90, behavior: { kind: 'sub', area: [30, 12, 8], prefer: ['merchant'] } },
        { id: 'u2', units: [U('type7c', 'U-707')], x: 25, y: 20, h: 90, behavior: { kind: 'sub', area: [25, 20, 8], prefer: ['merchant'] } },
        { id: 'u3', units: [U('type7c', 'U-381')], x: 27, y: 31, h: 90, behavior: { kind: 'sub', area: [27, 31, 8], prefer: ['merchant'] } },
        { id: 'u4', units: [U('type7c', 'U-954')], x: 36, y: 37, h: 0, behavior: { kind: 'sub', area: [36, 37, 8], prefer: ['merchant'] } },
        { id: 'u5', units: [U('type7c', 'U-258')], x: 16, y: 25, h: 90, behavior: { kind: 'sub', area: [16, 25, 8], prefer: ['merchant'] } },
        { id: 'u6', units: [U('type7c', 'U-638')], x: 38, y: 7, h: 180, behavior: { kind: 'sub', area: [38, 7, 8], prefer: ['merchant'] } },
        { id: 'u7', units: [U('type9', 'U-125')], x: 52, y: 35, h: 300, behavior: { kind: 'sub', area: [52, 35, 8], prefer: ['merchant'] } },
        { id: 'u8', units: [U('type9', 'U-192')], x: 12, y: 14, h: 90, behavior: { kind: 'sub', area: [12, 14, 8], prefer: ['merchant'] } },
      ],
      objectives: [
        { id: 'dawn', text: 'Hold the convoy together until dawn', kind: 'survive', time: 100 },
        { id: 'losses', text: 'Lose no more than 3 merchant ships', kind: 'protect', tag: 'merchant', maxLoss: 3 },
        { id: 'kills', text: 'Sink 3 U-boats', kind: 'destroy', tag: 'ss', count: 3, bonus: true },
        { id: 'few', text: 'Lose no more than 1 merchant ship', kind: 'protect', tag: 'merchant', maxLoss: 1, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Lt Cdr Sherwood', msg: 'Fog is closing in. HF/DF has a dozen U-boats round us. Our radar can see them on the surface and they cannot see us. Keep them down and keep them away from the columns.' }] },
        { when: { time: 35 }, do: [{ from: 'Captain Brewer', msg: 'First Escort Group joining from the east. We are yours to hunt with.' }, { side: 0, spawn: { id: 'eg1', units: [U('blackswan', 'Pelican'), U('river', 'Jed'), U('river', 'Spey')], x: 58, y: 12, h: 250, formation: 'line', spacing: 1.5, speed: 18 } }] },
      ],
      timeLimit: 110,
      reward: 300,
    },
    // ------------------------------------------------------------------ 8
    {
      id: 'uk8',
      title: 'Battle of the North Cape',
      date: '1943-12-26',
      place: 'Barents Sea, off North Cape',
      geo: [28.5, 72.3],
      enemyNation: 'de',
      news: [
        'May 1943: the U-boats are beaten in the North Atlantic.',
        'September: Italy surrenders. Midget submarines cripple Tirpitz in her Norwegian fjord.',
        'Christmas 1943: convoy JW 55B sails for Murmansk. Scharnhorst puts to sea.',
      ],
      brief:
        'Scharnhorst, the last German battleship fit for sea, has sailed from Altafjord to attack convoy JW 55B on its way to Russia. It is the polar night: the sun will not rise at all, and a gale is blowing.\n\nVice Admiral Burnett\'s cruisers Belfast, Sheffield and Norfolk are close to the convoy. Admiral Fraser in Duke of York, with Jamaica and four destroyers, is coming up from the south-west to cut Scharnhorst off from home.\n\nShe is faster than anything you have except the destroyers, and her guns outrange your cruisers. Trust your radar, protect the convoy and do not let her get back to Altafjord.',
      history:
        'Burnett\'s cruisers drove Scharnhorst off twice. Turning for home, she ran into Duke of York, whose radar-directed 14-inch shells wrecked a boiler room. Destroyer torpedoes slowed her further and she sank that evening. Of 1,968 men aboard, 36 were saved.',
      hints: [
        'In the polar night only radar can find the enemy at long range.',
        'Scharnhorst will try to slip back to Altafjord in the south. Keep Duke of York between her and home.',
      ],
      env: { tod: 'night', wx: 'storm', sea: 3, biome: 'arctic', wind: 240 },
      map: { ...northCapeMap(), seed: 81 },
      zones: NORTH_CAPE_ZONES,
      player: {
        groups: [
          { id: 'force1', units: [U('town', 'Belfast', ['belfast']), U('town', 'Sheffield'), U('county', 'Norfolk')], x: 50, y: 14, h: 160, spacing: 1, speed: 20 },
          { id: 'force2', units: [U('kgv', 'Duke of York', ['doy']), U('town', 'Jamaica')], x: 7, y: 40, h: 60, spacing: 1, speed: 24 },
          { id: 'destroyers', units: many('sclass', ['Savage', 'Saumarez', 'Scorpion', 'Stord']), x: 10, y: 37, h: 60, formation: 'line', spacing: 1.2, speed: 24 },
        ],
        slots: 2,
        allowed: ['BB', 'CA', 'CL', 'DD'],
        spawn: { x: 47, y: 10, h: 160 },
      },
      allies: [
        {
          id: 'convoy', units: anon('liberty', 9), x: 30, y: 10, h: 80, formation: 'box', spacing: 0.9, speed: 8,
          behavior: { kind: 'route', pts: [[79, 8]], exit: 'east', speed: 8 },
        },
        { id: 'jwescort', units: [U('sclass', 'Onslow'), U('sclass', 'Onslaught'), U('sclass', 'Orwell'), U('sclass', 'Scourge')], x: 30, y: 12, h: 80, formation: 'line', spacing: 2, behavior: { kind: 'escort', of: 'convoy', radius: 10 } },
      ],
      enemy: [
        { id: 'scharnhorst', units: [U('scharnhorst', 'Scharnhorst', ['scharnhorst'])], x: 40, y: 44, h: 0, speed: 26, behavior: { kind: 'raider', prefer: ['merchant'], exit: 'altafjord', retreatHp: 0.55 } },
      ],
      objectives: [
        { id: 'sink', text: 'Sink Scharnhorst', kind: 'destroy', tag: 'scharnhorst' },
        { id: 'home', text: 'Do not let Scharnhorst reach Altafjord', kind: 'prevent', tag: 'scharnhorst', zone: 'altafjord' },
        { id: 'convoy', text: 'Lose no more than 1 merchant ship', kind: 'protect', tag: 'merchant', maxLoss: 1, bonus: true },
        { id: 'doy', text: 'Keep Duke of York above 70% hull', kind: 'hpAbove', tag: 'doy', frac: 0.7, bonus: true },
      ],
      triggers: [
        { when: { time: 0 }, do: [{ from: 'Admiral Fraser', msg: 'Scharnhorst is out. Burnett, cover the convoy. Duke of York is coming up from the south-west to cut her off. Trust your radar.' }] },
        { when: { spotted: 'doy' }, do: [{ msg: 'Scharnhorst has sighted Duke of York and is turning for home!' }, { behavior: 'scharnhorst', set: { kind: 'flee', exit: 'altafjord' } }] },
      ],
      timeLimit: 120,
      reward: 340,
    },
  ],
};
