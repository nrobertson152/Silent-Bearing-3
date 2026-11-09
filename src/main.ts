import './styles.css';
import { buildWorld } from './sim/build';
import { BattleScreen } from './ui/battle/battleScreen';
import { loadSettings } from './campaign/settings';
import type { MissionDef } from './data/types';

const plate: MissionDef = {
  id: 'test-plate', title: 'The River Plate', date: '1939-12-13', place: 'South Atlantic, off Uruguay', geo: [0, 0], news: [], brief: '', history: '',
  env: { tod: 'day', wx: 'clear', sea: 1 },
  map: { w: 60, h: 40, seed: 1, land: [{ k: 'coast', side: 'w', depth: 3, from: 0, to: 40 }, { k: 'island', x: 30, y: 30, r: 1.5 }] },
  zones: [{ id: 'montevideo', name: 'Montevideo', kind: 'exit', x: 2, y: 20, r: 3 }],
  player: {
    groups: [{ id: 'g', units: [{ c: 'york', n: 'Exeter' }, { c: 'leander', n: 'Ajax' }, { c: 'leander', n: 'Achilles' }], x: 42, y: 22, h: 300, formation: 'column' }],
    slots: 0, spawn: { x: 40, y: 20, h: 270 },
  },
  enemy: [{ id: 'spee', units: [{ c: 'deutschland', n: 'Admiral Graf Spee', t: ['spee'] }], x: 22, y: 18, h: 90, behavior: { kind: 'raider', exit: 'montevideo', retreatHp: 0.6 } }],
  objectives: [{ id: 'o1', text: 'Damage Graf Spee', kind: 'damage', tag: 'spee', frac: 0.6 }],
  enemyNation: 'de',
};

const settings = loadSettings();
const w = buildWorld(plate, {});
const app = document.getElementById('app')!;
const s = new BattleScreen(w, settings, { onFinish: () => location.reload(), onQuit: () => location.reload() });
s.mount(app);
(window as unknown as { __w: unknown }).__w = w;
(window as unknown as { __s: unknown }).__s = s;
