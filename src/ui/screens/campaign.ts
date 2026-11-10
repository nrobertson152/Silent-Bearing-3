// The war room: the campaign map, war news, the next operation and the fleet.

import { CAMPAIGNS } from '../../data/campaigns';
import { NATIONS } from '../../data/nations';
import { CLASSES, TYPE_NAMES } from '../../data/ships';
import { fmtDate } from '../../core/math';
import { activeFleet, currentMission } from '../../campaign/state';
import { VET_NAMES, vetLevel } from '../../sim/build';
import type { App, Screen } from '../app';
import { el, esc } from '../dom';
import { flagSvg } from '../flags';
import { warMapSvg, type MapMarker } from '../worldmap';

const OUTCOME_NAME: Record<string, string> = { decisive: 'Decisive victory', victory: 'Victory', marginal: 'Marginal victory', defeat: 'Defeat' };

export function vetStars(xp: number): string {
  const v = vetLevel(xp);
  return `<span class="vet v${v}" title="${VET_NAMES[v]}">${'★'.repeat(v)}${'☆'.repeat(4 - v)}</span>`;
}

export function hpBar(hp: number): string {
  const c = hp > 0.7 ? 'ok' : hp > 0.35 ? 'mid' : 'low';
  return `<span class="hpbar ${c}"><i style="width:${Math.round(hp * 100)}%"></i></span>`;
}

export function campaignScreen(app: App): Screen {
  const st = app.state!;
  const c = CAMPAIGNS[st.nation];
  const next = currentMission(st);
  let ro: ResizeObserver | null = null;
  return {
    mount(parent) {
      const date = next?.date ?? c.missions[c.missions.length - 1].date;
      const markers: MapMarker[] = c.missions.map((m, i) => {
        const rec = st.records.find((r) => r.id === m.id);
        const state = i === st.index ? 'next' : rec ? rec.outcome : 'future';
        return { id: m.id, lon: m.geo[0], lat: m.geo[1], label: m.title, state, index: i };
      });
      const map = el('div', { class: 'cmp-map' });
      const chart = el('div', { class: 'cmp-chart' });
      // draw the map to the shape of its panel, and again when that changes
      let drawn = '';
      const draw = () => {
        const W = Math.max(400, map.clientWidth);
        const H = Math.max(300, map.clientHeight);
        const key = `${W}x${H}`;
        if (key === drawn) return;
        drawn = key;
        chart.innerHTML = warMapSvg(c.theater, date, markers, st.nation, W, H);
      };
      ro = new ResizeObserver(() => draw());
      ro.observe(map);
      map.append(chart);
      map.append(
        el('div', {
          class: 'cmp-legend',
          html: `<span><i class="al"></i>Allied</span><span><i class="ax"></i>Axis</span><span><i class="oc"></i>Occupied</span><span><i class="ne"></i>Neutral</span>`,
        }),
        el('div', { class: 'cmp-date', html: `<div class="d1">${esc(fmtDate(date))}</div><div class="d2">${esc(c.title)}</div>` }),
      );
      const tip = el('div', { class: 'cmp-tip hidden' });
      map.append(tip);
      map.addEventListener('pointermove', (e) => {
        const g = (e.target as Element).closest('[data-mission]');
        if (!g) {
          tip.classList.add('hidden');
          return;
        }
        const id = g.getAttribute('data-mission')!;
        const m = c.missions.find((x) => x.id === id)!;
        const rec = st.records.find((r) => r.id === id);
        tip.innerHTML = `<b>${esc(m.title)}</b><br><span class="dim">${esc(fmtDate(m.date))} &middot; ${esc(m.place)}</span>${
          rec ? `<br>${OUTCOME_NAME[rec.outcome]} &middot; ${rec.shipsSunk} sunk, ${rec.shipsLost} lost &middot; +${rec.prestige} prestige` : '<br>Next operation'
        }`;
        const r = map.getBoundingClientRect();
        tip.style.left = `${Math.min(r.width - 260, e.clientX - r.left + 14)}px`;
        tip.style.top = `${e.clientY - r.top + 14}px`;
        tip.classList.remove('hidden');
      });
      map.addEventListener('click', (e) => {
        const g = (e.target as Element).closest('[data-mission]');
        if (g && next && g.getAttribute('data-mission') === next.id) app.go('briefing', next);
      });

      const side = el('aside', { class: 'cmp-side' });
      side.append(
        el('div', {
          class: 'cs-head',
          html: `${flagSvg(st.nation, 26)}<div><div class="cs-title">${esc(c.title)}</div><div class="dim">${esc(NATIONS[st.nation].navy)} &middot; ${esc(st.difficulty)}</div></div>
            <div class="cs-prestige" title="Prestige: spend it in the dockyard"><span>${st.prestige}</span>prestige</div>`,
        }),
      );
      if (next) {
        const idx = st.index + 1;
        side.append(
          el('div', { class: 'cs-sec' }, el('div', { class: 'ph' }, 'War news'), el('ul', { class: 'cs-news', html: next.news.map((n) => `<li>${esc(n)}</li>`).join('') })),
          el(
            'div',
            { class: 'cs-sec cs-next' },
            el('div', { class: 'ph' }, `Next operation · ${idx} of ${c.missions.length}`),
            el('div', { class: 'cn-title' }, next.title),
            el('div', { class: 'cn-place dim' }, `${fmtDate(next.date)} · ${next.place}`),
            el('button', { class: 'btn primary', onclick: () => app.go('briefing', next) }, 'Briefing →'),
          ),
        );
      }
      const fleet = el('div', { class: 'cs-sec' }, el('div', { class: 'ph' }, 'Your fleet'));
      const list = el('div', { class: 'cs-fleet' });
      for (const s of activeFleet(st)) {
        const k = CLASSES[s.cls];
        list.append(
          el('div', {
            class: 'cf-row',
            title: `${k.name} class ${TYPE_NAMES[k.type].toLowerCase()} · ${s.missions} battles${s.kills.length ? ' · sank ' + s.kills.join(', ') : ''}`,
            html: `<span class="cf-type">${k.type}</span><span class="cf-name">${esc(s.name)}</span>${hpBar(s.hp)}${vetStars(s.xp)}`,
          }),
        );
      }
      const lost = st.fleet.filter((s) => s.lost);
      if (lost.length) list.append(el('div', { class: 'cf-lost dim' }, `Lost: ${lost.map((s) => s.name).join(', ')}`));
      fleet.append(list, el('button', { class: 'btn small', onclick: () => app.go('shipyard') }, 'Dockyard'));
      side.append(fleet);
      if (st.records.length) {
        const rows = c.missions
          .map((m) => ({ m, r: st.records.find((x) => x.id === m.id) }))
          .filter((x) => x.r)
          .map(({ m, r }) => `<div class="cr-row ${r!.outcome}"><span>${esc(m.title)}</span><span>${OUTCOME_NAME[r!.outcome]}</span></div>`)
          .join('');
        side.append(el('div', { class: 'cs-sec' }, el('div', { class: 'ph' }, 'Battle record'), el('div', { class: 'cs-record', html: rows })));
      }
      side.append(
        el('div', { class: 'cs-foot' }, el('button', { class: 'btn ghost small', onclick: () => (app.save(), app.go('menu')) }, 'Save and leave')),
      );
      parent.append(el('div', { class: 'screen campaign' }, map, side));
      draw();
    },
    unmount() {
      ro?.disconnect();
    },
    back() {
      app.save();
      app.go('menu');
      return true;
    },
  };
}
