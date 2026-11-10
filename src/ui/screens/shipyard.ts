// The dockyard: repair damaged ships and commission new ones as they enter service.

import { CLASSES, TYPE_NAMES, purchasable } from '../../data/ships';
import { NATIONS } from '../../data/nations';
import { activeFleet, addShip, campaignYear, repairCost, type CoreShip } from '../../campaign/state';
import type { App, Screen } from '../app';
import { el, esc } from '../dom';
import { flagSvg } from '../flags';
import { classLine } from './briefing';
import { hpBar, vetStars } from './campaign';

export const FLEET_LIMIT = 10;

export function shipyardScreen(app: App): Screen {
  const st = app.state!;
  let root: HTMLElement;
  let body: HTMLElement;
  let msg = '';

  function render() {
    const year = campaignYear(st);
    const fleet = activeFleet(st);
    body.replaceChildren();
    const head = el('div', {
      class: 'sy-head',
      html: `${flagSvg(st.nation, 24)}<h1>Dockyard</h1><div class="sy-pres"><span>${st.prestige}</span> prestige</div>`,
    });
    const left = el('div', { class: 'sy-col' }, el('div', { class: 'ph' }, `Your fleet (${fleet.length} of ${FLEET_LIMIT})`));
    const damaged = fleet.filter((s) => s.hp < 0.999);
    const total = damaged.reduce((a, s) => a + repairCost(s), 0);
    if (damaged.length > 1) {
      left.append(
        el('button', {
          class: 'btn small',
          disabled: total > st.prestige,
          onclick: () => {
            for (const s of damaged) repair(s);
          },
        }, `Repair all (${total})`),
      );
    }
    for (const s of fleet) {
      const k = CLASSES[s.cls];
      const cost = repairCost(s);
      const row = el('div', { class: 'sy-row' });
      row.innerHTML = `<div class="sy-main"><span class="cf-type">${k.type}</span><b>${esc(s.name)}</b> ${vetStars(s.xp)}
          <div class="dim">${esc(k.name)} class &middot; ${s.missions} battle${s.missions === 1 ? '' : 's'}${s.kills.length ? ` &middot; ${s.kills.length} sunk` : ''}</div></div>
        <div class="sy-hp">${hpBar(s.hp)}<span>${Math.round(s.hp * 100)}%</span></div>`;
      if (s.hp < 0.999) row.append(el('button', { class: 'btn small', disabled: cost > st.prestige, onclick: () => repair(s) }, `Repair ${cost}`));
      else row.append(el('span', { class: 'sy-ok' }, 'Ready'));
      left.append(row);
    }
    const right = el('div', { class: 'sy-col' }, el('div', { class: 'ph' }, `New construction available in ${Math.floor(year)}`));
    const buy = purchasable(st.nation, year);
    for (const k of buy) {
      const row = el('div', { class: 'sy-row buy' });
      row.innerHTML = `<div class="sy-main"><span class="cf-type">${k.type}</span><b>${esc(k.name)}</b> class <span class="dim">${esc(TYPE_NAMES[k.type].toLowerCase())}</span>
        <div class="dim">${esc(classLine(k))}</div><div class="sy-note">${esc(k.notes)}</div></div>`;
      const full = fleet.length >= FLEET_LIMIT;
      row.append(
        el('button', {
          class: 'btn small',
          disabled: k.cost > st.prestige || full,
          title: full ? 'Your fleet is at full strength' : '',
          onclick: () => {
            if (k.cost > st.prestige || activeFleet(st).length >= FLEET_LIMIT) return;
            st.prestige -= k.cost;
            const s = addShip(st, k.id);
            msg = `${s.name} has joined the fleet.`;
            app.save();
            render();
          },
        }, `Commission ${k.cost}`),
      );
      right.append(row);
    }
    if (!buy.length) right.append(el('div', { class: 'dim' }, 'Nothing new this year.'));
    body.append(head, msg ? el('div', { class: 'sy-msg' }, msg) : '', el('div', { class: 'sy-cols' }, left, right));
  }

  function repair(s: CoreShip) {
    const cost = repairCost(s);
    if (cost > st.prestige) return;
    st.prestige -= cost;
    s.hp = 1;
    msg = `${s.name} repaired.`;
    app.save();
    render();
  }

  return {
    mount(parent) {
      body = el('div', { class: 'sy-body' });
      root = el(
        'div',
        { class: 'screen shipyard' },
        el('div', { class: 'scr-head' }, el('button', { class: 'btn ghost small', onclick: () => app.go('campaign') }, '← War room'), el('span', { class: 'dim' }, `${NATIONS[st.nation].navy}`)),
        body,
      );
      parent.append(root);
      render();
    },
    unmount() {},
    back() {
      app.go('campaign');
      return true;
    },
  };
}
