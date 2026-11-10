import { it } from 'vitest';
import { findMission } from '../src/data/campaigns';
import { buildWorld } from '../src/sim/build';
import { fmtClock } from '../src/core/math';
import { coreFor } from './helpers';

// A tracing harness for working on one mission, skipped unless MISSION is set:
//   MISSION=uk3 SEED=7 UNTIL=1800 EVERY=120 VERBOSE=1 npx vitest run tests/debug.test.ts
// NOCORE=1 leaves out the campaign fleet; SKIP is a regex of log lines to hide.
it.skipIf(!process.env.MISSION)('debug', () => {
  const id = process.env.MISSION!;
  const m = findMission(id)!;
  const w = buildWorld(m, { controllers: ['ai', 'ai'], core: process.env.NOCORE ? undefined : coreFor(m), seed: process.env.SEED ? Number(process.env.SEED) : undefined });
  const until = Number(process.env.UNTIL ?? 1200);
  const every = Number(process.env.EVERY ?? 300);
  const verbose = !!process.env.VERBOSE;
  let next = 0;
  while (!w.result && w.time < until) {
    w.advance(10);
    w.events.length = 0;
    if (verbose && w.time >= next) {
      next += every;
      const sq = w.squadrons.filter((s) => s.side === 0).map((s) => `${s.def.id}:${s.state}:${s.n}`).join(' ');
      console.log(fmtClock(w.time), 'SQ0', sq);
      const sq1 = w.squadrons.filter((s) => s.side === 1).map((s) => `${s.def.id}:${s.state}:${s.n}`).join(' ');
      if (sq1) console.log(fmtClock(w.time), 'SQ1', sq1);
      console.log(w.units.filter(u=>!u.sunk).map(u => `${u.name.slice(0,14)}[${u.side}] ${Math.round(u.x/100)/10},${Math.round(u.y/100)/10} hp${Math.round(u.hp/u.maxHp*100)} v${(u.v/0.5144).toFixed(0)} ${u.depth!=='surface'?u.depth:''}${u.alert?'':' zz'}`).join(' | '));
    }
  }
  const skip = new RegExp(process.env.SKIP ?? 'cannot launch');
  for (const l of w.log) if (!skip.test(l.text)) console.log(fmtClock(l.t), l.kind, l.text);
  console.log('result', w.result?.outcome, w.result?.reason, fmtClock(w.time));
  console.log('stats', JSON.stringify(w.stats));
  for (const o of w.objectives) console.log('obj', o.def.id, o.status, o.progress + '/' + o.needed, o.def.text);
});
