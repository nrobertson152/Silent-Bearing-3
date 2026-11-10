// Historical battles: any battle from the four campaigns, with the ships that fought it.

import { CAMPAIGNS, CAMPAIGN_ORDER } from '../../data/campaigns';
import { NATIONS } from '../../data/nations';
import { fmtDate } from '../../core/math';
import type { App, Screen } from '../app';
import { el, esc } from '../dom';
import { flagSvg } from '../flags';

export function battlesScreen(app: App): Screen {
  return {
    mount(parent) {
      const cols = el('div', { class: 'hb-cols' });
      for (const n of CAMPAIGN_ORDER) {
        const c = CAMPAIGNS[n];
        const col = el('div', { class: 'hb-col panel' });
        col.append(el('div', { class: 'hb-head', html: `${flagSvg(n, 20)}<div><b>${esc(c.title)}</b><div class="dim">${esc(NATIONS[n].navy)}</div></div>` }));
        for (const m of c.missions) {
          col.append(
            el('button', {
              class: 'hb-row',
              onclick: () => app.go('briefing', m, true),
              html: `<span class="hb-t">${esc(m.title)}</span><span class="hb-d dim">${esc(fmtDate(m.date))}</span>`,
            }),
          );
        }
        cols.append(col);
      }
      parent.append(
        el(
          'div',
          { class: 'screen battles' },
          el('div', { class: 'scr-head' }, el('button', { class: 'btn ghost small', onclick: () => app.go('menu') }, '← Menu'), el('h1', {}, 'Historical battles')),
          el('p', { class: 'hb-intro dim' }, 'Fight any battle from the campaigns with the ships that were really there. Nothing here affects your campaigns.'),
          cols,
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
