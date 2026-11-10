// Choosing a navy: the four campaigns, their progress and difficulty.

import { CAMPAIGNS, CAMPAIGN_ORDER } from '../../data/campaigns';
import { NATIONS } from '../../data/nations';
import { deleteCampaign, loadCampaign, newCampaign, saveCampaign } from '../../campaign/state';
import type { DifficultyId } from '../../campaign/settings';
import type { PlayableNation } from '../../data/types';
import type { App, Screen } from '../app';
import { confirmDialog } from '../dialogs';
import { el, esc, paras } from '../dom';
import { flagSvg } from '../flags';
import { warMapSvg, type MapMarker } from '../worldmap';

const DIFFS: { id: DifficultyId; name: string; note: string }[] = [
  { id: 'easy', name: 'Easy', note: 'Enemy gunnery is less accurate and your ships take less damage. More prestige to spend.' },
  { id: 'normal', name: 'Normal', note: 'The war as it was.' },
  { id: 'hard', name: 'Hard', note: 'Sharper enemy gunners and tougher losses. Less prestige.' },
];

export function nationsScreen(app: App): Screen {
  let root: HTMLElement;
  let sel: PlayableNation = app.state?.nation ?? 'uk';
  let diff: DifficultyId = app.settings.difficulty;
  const cards = new Map<PlayableNation, HTMLElement>();
  let detail: HTMLElement;
  let map: HTMLElement;

  function render() {
    for (const [n, c] of cards) c.classList.toggle('sel', n === sel);
    const c = CAMPAIGNS[sel];
    const st = loadCampaign(sel);
    const nat = NATIONS[sel];
    detail.replaceChildren();
    const head = el('div', { class: 'nd-head', html: `${flagSvg(sel, 30)}<div><h2>${esc(c.title)}</h2><div class="dim">${esc(nat.navy)} &middot; ${esc(c.years)}</div></div>` });
    const text = el('div', { class: 'nd-text', html: paras(c.intro) });
    const start = el('div', { class: 'nd-start' });
    if (st) {
      const done = st.finished;
      const m = c.missions[Math.min(st.index, c.missions.length - 1)];
      start.append(
        el('div', {
          class: 'nd-save',
          html: done
            ? `Campaign complete &middot; ${st.prestige} prestige`
            : `In progress: battle ${st.index + 1} of ${c.missions.length}, <b>${esc(m.title)}</b> &middot; ${st.prestige} prestige &middot; ${esc(st.difficulty)}`,
        }),
        el('button', {
          class: 'btn primary',
          onclick: () => {
            app.state = st;
            app.go(st.finished ? 'epilogue' : 'campaign');
          },
        }, done ? 'Review' : 'Continue'),
      );
    }
    const dsel = el('div', { class: 'nd-diff' });
    for (const d of DIFFS) {
      const b = el('button', { class: `seg ${d.id === diff ? 'on' : ''}`, title: d.note, onclick: () => ((diff = d.id), render()) }, d.name);
      dsel.append(b);
    }
    const note = el('div', { class: 'nd-note dim' }, DIFFS.find((d) => d.id === diff)!.note);
    const begin = () => {
      const s = newCampaign(sel, diff);
      saveCampaign(s);
      app.state = s;
      app.settings.difficulty = diff;
      app.saveSettings();
      app.go('campaign');
    };
    start.append(
      el('div', { class: 'nd-new' }, el('span', { class: 'lbl' }, 'New campaign'), dsel, note),
      el('button', {
        class: `btn ${st ? '' : 'primary'}`,
        onclick: () => {
          if (st) confirmDialog(root, 'Start again?', `This replaces your ${esc(nat.adj)} campaign in progress.`, 'Start again', () => (deleteCampaign(sel), begin()), true);
          else begin();
        },
      }, st ? 'Start a new campaign' : 'Begin the campaign'),
    );
    const fleet = el('div', { class: 'nd-fleet' });
    fleet.innerHTML = `<span class="lbl">First command</span> ${c.startFleet.map((s) => esc(s.n)).join(', ')}`;
    detail.append(head, text, fleet, start);
    // the war ahead: the theatre as it stood at the first battle, with the battles to come
    const plan: MapMarker[] = c.missions.map((m, i) => ({ id: m.id, lon: m.geo[0], lat: m.geo[1], label: m.title, state: 'plan', index: i }));
    map.innerHTML = `${warMapSvg(c.theater, c.missions[0].date, plan, sel, 900, 400)}<div class="cap">The war ahead &middot; ${esc(c.years)}</div>`;
  }

  return {
    mount(parent) {
      const grid = el('div', { class: 'nat-grid' });
      for (const n of CAMPAIGN_ORDER) {
        const c = CAMPAIGNS[n];
        const st = loadCampaign(n);
        const pct = st ? (st.finished ? 100 : Math.round((st.index / c.missions.length) * 100)) : 0;
        const card = el('button', { class: `nat-card nat-${n}`, onclick: () => ((sel = n), render()) });
        card.innerHTML = `<div class="nc-flag">${flagSvg(n, 40)}</div>
          <div class="nc-navy">${esc(NATIONS[n].navy)}</div>
          <div class="nc-title">${esc(c.title)}</div>
          <div class="nc-sub">${esc(c.subtitle)}</div>
          <div class="nc-years">${esc(c.years)} &middot; ${c.missions.length} battles</div>
          <div class="nc-prog"><i style="width:${pct}%"></i></div>
          <div class="nc-state">${st ? (st.finished ? 'Complete' : `Battle ${st.index + 1} of ${c.missions.length}`) : 'Not started'}</div>`;
        cards.set(n, card);
        grid.append(card);
      }
      detail = el('div', { class: 'nat-detail panel' });
      map = el('div', { class: 'nat-map' });
      root = el(
        'div',
        { class: 'screen nations' },
        el('div', { class: 'scr-head' }, el('button', { class: 'btn ghost small', onclick: () => app.go('menu') }, '← Menu'), el('h1', {}, 'Choose your navy')),
        el('div', { class: 'nat-body' }, el('div', { class: 'nat-left' }, grid, map), detail),
      );
      parent.append(root);
      render();
    },
    unmount() {},
    back() {
      app.go('menu');
      return true;
    },
  };
}
