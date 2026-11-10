// The end of a campaign: how the war went on, and how this navy fared.

import { CAMPAIGNS } from '../../data/campaigns';
import { NATIONS } from '../../data/nations';
import { fmtDate } from '../../core/math';
import type { App, Screen } from '../app';
import { el, esc, paras } from '../dom';
import { flagSvg } from '../flags';
import { warMapSvg, type MapMarker } from '../worldmap';
import { vetStars } from './campaign';

const NAME: Record<string, string> = { decisive: 'Decisive victory', victory: 'Victory', marginal: 'Marginal victory', defeat: 'Defeat' };

export function epilogueScreen(app: App): Screen {
  const st = app.state!;
  const c = CAMPAIGNS[st.nation];
  return {
    mount(parent) {
      const wins = st.records.filter((r) => r.outcome !== 'defeat').length;
      const tons = st.records.reduce((a, r) => a + r.tonsSunk, 0);
      const sunk = st.records.reduce((a, r) => a + r.shipsSunk, 0);
      const lost = st.fleet.filter((s) => s.lost).length;
      const verdict = wins >= 7 ? 'A command remembered for generations.' : wins >= 5 ? 'A hard-fought war, honourably won.' : wins >= 3 ? 'A war of hard knocks.' : 'The sea was a cruel master.';
      const rows = c.missions
        .map((m) => {
          const r = st.records.find((x) => x.id === m.id);
          return `<div class="ep-row ${r?.outcome ?? ''}"><span>${esc(fmtDate(m.date))}</span><span>${esc(m.title)}</span><span>${r ? NAME[r.outcome] : '&mdash;'}</span></div>`;
        })
        .join('');
      const best = [...st.fleet].filter((s) => !s.lost).sort((a, b) => b.xp - a.xp)[0];
      // the war map as the campaign left it, every battle marked with its result
      const last = c.missions[c.missions.length - 1];
      const markers: MapMarker[] = c.missions.map((m, i) => {
        const r = st.records.find((x) => x.id === m.id);
        return { id: m.id, lon: m.geo[0], lat: m.geo[1], label: m.title, state: r ? r.outcome : 'future', index: i };
      });
      const body = el('div', { class: 'ep-body' });
      body.innerHTML = `
        <div class="ep-left">
          <div class="ep-flag">${flagSvg(st.nation, 48)}</div>
          <h1>${esc(c.title)}</h1>
          <div class="ep-verdict">${esc(verdict)}</div>
          <div class="ep-text">${paras(c.epilogue)}</div>
          <div class="ep-map">${warMapSvg(c.theater, last.date, markers, st.nation, 900, 470)}</div>
        </div>
        <div class="ep-right panel">
          <div class="ph">Service record &middot; ${esc(NATIONS[st.nation].navy)}</div>
          ${rows}
          <div class="ep-stats">
            <div><b>${wins}</b> of ${c.missions.length} battles won</div>
            <div><b>${sunk}</b> enemy ships sunk, <b>${tons.toLocaleString('en-GB')}</b> tons</div>
            <div><b>${lost}</b> ships lost</div>
            <div><b>${st.prestige}</b> prestige</div>
            ${best ? `<div>Finest ship: <b>${esc(best.name)}</b> ${vetStars(best.xp)}</div>` : ''}
          </div>
        </div>`;
      parent.append(
        el(
          'div',
          { class: 'screen epilogue' },
          body,
          el('div', { class: 'ep-btns' }, el('button', { class: 'btn primary', onclick: () => app.go('menu') }, 'Return to the menu')),
        ),
      );
    },
    unmount() {},
    back() {
      app.go('menu');
      return true;
    },
  };
}
