import { describe, expect, it } from 'vitest';
import { CAMPAIGNS, CAMPAIGN_ORDER, allMissions } from '../src/data/campaigns';
import { decimalYear, fmtClock } from '../src/core/math';
import { CLASSES, isStructureType } from '../src/data/ships';
import { AIRCRAFT } from '../src/data/aircraft';
import type { Action, Cond, GroupDef, MissionDef } from '../src/data/types';
import { buildWorld } from '../src/sim/build';
import { coreFor } from './helpers';

function groupsIn(m: MissionDef): GroupDef[] {
  const out: GroupDef[] = [...m.player.groups, ...(m.allies ?? []), ...m.enemy];
  for (const t of m.triggers ?? []) for (const a of t.do) if ('spawn' in a) out.push(a.spawn);
  return out;
}

function condTags(c: Cond, out: string[]) {
  if ('all' in c) c.all.forEach((x) => condTags(x, out));
  else if ('any' in c) c.any.forEach((x) => condTags(x, out));
  else if ('lost' in c) out.push(c.lost);
  else if ('hp' in c) out.push(c.hp);
  else if ('detected' in c) out.push(c.detected);
}

describe('campaign data', () => {
  for (const n of CAMPAIGN_ORDER) {
    it(`${n} missions are in date order with start fleets that exist`, () => {
      const c = CAMPAIGNS[n];
      expect(c.missions.length).toBe(8);
      let last = 0;
      for (const m of c.missions) {
        const y = decimalYear(m.date);
        expect(y).toBeGreaterThanOrEqual(last);
        last = y;
      }
      for (const s of c.startFleet) expect(CLASSES[s.c], s.c).toBeTruthy();
    });
  }

  for (const m of allMissions()) {
    it(`${m.id} references valid classes, aircraft, zones and tags`, () => {
      for (const g of groupsIn(m)) {
        for (const u of g.units) expect(CLASSES[u.c], `${m.id}: class ${u.c}`).toBeTruthy();
        for (const a of g.air ?? []) expect(AIRCRAFT[a.a], `${m.id}: aircraft ${a.a}`).toBeTruthy();
      }
      const zones = new Set((m.zones ?? []).map((z) => z.id));
      for (const o of m.objectives) if (o.zone) expect(zones.has(o.zone), `${m.id}: zone ${o.zone}`).toBe(true);
      for (const g of groupsIn(m)) {
        const b = g.behavior as { exit?: string; zone?: string } | undefined;
        if (b?.exit) expect(zones.has(b.exit), `${m.id}: exit ${b.exit}`).toBe(true);
        if (b?.zone) expect(zones.has(b.zone), `${m.id}: zone ${b.zone}`).toBe(true);
      }
      for (const t of m.triggers ?? []) {
        for (const a of t.do as Action[]) {
          if ('air' in a) for (const s of a.air.sq) expect(AIRCRAFT[s.a], `${m.id}: aircraft ${s.a}`).toBeTruthy();
          if ('behavior' in a) expect(groupsIn(m).some((g) => g.id === a.behavior), `${m.id}: group ${a.behavior}`).toBe(true);
        }
      }
      const w = buildWorld(m, { controllers: ['ai', 'ai'], core: coreFor(m) });
      // ships start in open water and inside the map
      for (const u of w.units) {
        if (isStructureType(u.cls.type)) continue;
        expect(w.terrain.isLand(u.x, u.y, 0), `${m.id}: ${u.name} starts on land`).toBe(false);
        expect(u.x > 0 && u.y > 0 && u.x < w.terrain.w && u.y < w.terrain.h).toBe(true);
      }
      // nobody starts inside an exit zone
      for (const u of w.units) for (const z of w.zones) if (z.kind === 'exit') expect(w.inZone(u, z), `${m.id}: ${u.name} starts in ${z.id}`).toBe(false);
      // objective tags refer to something
      const spawnTags = new Set<string>();
      for (const t of m.triggers ?? []) for (const a of t.do) if ('spawn' in a) for (const u of a.spawn.units) { (u.t ?? []).forEach((x) => spawnTags.add(x)); spawnTags.add(u.c); }
      for (const o of m.objectives) {
        if (!o.tag) continue;
        const side = o.kind === 'destroy' || o.kind === 'damage' || o.kind === 'prevent' ? 1 : 0;
        const ok = w.units.some((u) => u.side === side && u.tags.includes(o.tag!)) || spawnTags.has(o.tag);
        expect(ok, `${m.id}: objective ${o.id} tag ${o.tag} on side ${side}`).toBe(true);
      }
      const tags: string[] = [];
      for (const t of m.triggers ?? []) condTags(t.when, tags);
      for (const tag of tags) expect(w.units.some((u) => u.tags.includes(tag)), `${m.id}: trigger tag ${tag}`).toBe(true);
      expect(w.units.some((u) => u.side === 0 && u.controllable), `${m.id}: player has ships`).toBe(true);
    });
  }
});

describe('autoplay', () => {
  for (const m of allMissions()) {
    it(`${m.id} plays to an end without errors`, () => {
      const w = buildWorld(m, { controllers: ['ai', 'ai'], core: coreFor(m) });
      const t0 = performance.now();
      const limit = (m.timeLimit ?? 90) * 60 + 60;
      while (!w.result && w.time < limit) {
        w.advance(10);
        w.events.length = 0;
      }
      const ms = performance.now() - t0;
      for (const u of w.units) expect(Number.isFinite(u.x) && Number.isFinite(u.y) && Number.isFinite(u.hp), `${m.id}: ${u.name}`).toBe(true);
      for (const s of w.squadrons) expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
      expect(w.result).not.toBeNull();
      const lost0 = w.stats[0].lost.length;
      const lost1 = w.stats[1].lost.length;
      const objs = w.objectives.map((o) => `${o.def.id}:${o.status[0]}`).join(' ');
      console.log(`${m.id.padEnd(4)} ${w.result!.outcome.padEnd(9)} ${fmtClock(w.time)} lost ${lost0}/${lost1} planes ${w.stats[0].planesKilled}/${w.stats[1].planesKilled} ${objs} (${Math.round(ms)} ms)`);
    });
  }
});
