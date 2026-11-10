import { describe, expect, it } from 'vitest';
import { findMission } from '../src/data/campaigns';
import { buildWorld } from '../src/sim/build';
import { coreFor } from './helpers';

/** Everything that matters about a world, as one string. */
function fingerprint(id: string, seed: number, seconds: number): string {
  const m = findMission(id)!;
  const w = buildWorld(m, { controllers: ['ai', 'ai'], core: coreFor(m), seed });
  while (!w.result && w.time < seconds) {
    w.advance(10);
    w.events.length = 0;
  }
  const units = w.units.map((u) => `${u.id}:${u.x.toFixed(3)},${u.y.toFixed(3)},${u.h.toFixed(4)},${u.hp.toFixed(3)},${u.sunk ? 1 : 0}`).join(';');
  const air = w.squadrons.map((s) => `${s.id}:${s.state}:${s.n}:${s.x.toFixed(2)},${s.y.toFixed(2)}`).join(';');
  return `${w.time}|${w.result?.outcome ?? '-'}|${units}|${air}|${w.log.length}`;
}

// The simulation advances on a fixed step and draws all its chance from the world's seeded
// generator, so a battle replays exactly from its seed. Replays, retries and these tests rely on it.
describe('determinism', () => {
  // a surface night action, a carrier battle and a submarine convoy attack
  for (const id of ['uk2', 'us3', 'de3']) {
    it(`${id} replays exactly from its seed`, () => {
      const a = fingerprint(id, 1234, 1500);
      const b = fingerprint(id, 1234, 1500);
      expect(a).toBe(b);
      expect(fingerprint(id, 4321, 1500)).not.toBe(a);
    });
  }
});
