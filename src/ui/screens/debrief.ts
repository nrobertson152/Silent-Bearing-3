// After the battle: what happened, what it earned, and what comes next.

import { CAMPAIGNS } from '../../data/campaigns';
import { TYPE_NAMES } from '../../data/ships';
import { advance, applyResult, type CampaignState, type MissionReport } from '../../campaign/state';
import { VET_NAMES } from '../../sim/build';
import type { World } from '../../sim/world';
import type { App, BattleContext, Screen } from '../app';
import { el, esc, paras } from '../dom';

const TITLE: Record<string, string> = { decisive: 'Decisive Victory', victory: 'Victory', marginal: 'Marginal Victory', defeat: 'Defeat' };

export function debriefScreen(app: App, ctx: BattleContext, w: World): Screen {
  const m = ctx.mission;
  const r = w.result!;
  const inCampaign = !!ctx.snapshot && !!app.state;
  let report: MissionReport | null = null;
  if (inCampaign) report = applyResult(app.state!, m, w);
  const won = r.outcome !== 'defeat';

  const retry = () => {
    if (inCampaign) {
      const st = JSON.parse(ctx.snapshot!) as CampaignState;
      st.attempts++;
      app.state = st;
      app.save();
      app.battle({ ...ctx, snapshot: JSON.stringify(st), seed: ctx.seed + 7919 });
    } else app.battle({ ...ctx, seed: ctx.seed + 7919 });
  };

  const moveOn = () => {
    const st = app.state!;
    advance(st);
    app.save();
    app.go(st.finished ? 'epilogue' : 'campaign');
  };

  return {
    mount(parent) {
      const enemyLost = w.stats[0].sunk.map((id) => w.unit(id)!).filter(Boolean);
      const ownLost = w.stats[0].lost.map((id) => w.unit(id)!).filter(Boolean);
      const stats = el('div', { class: 'db-col' });
      stats.innerHTML = `<div class="ph">The battle</div>
        <div class="db-kv"><span>Enemy ships sunk</span><b>${enemyLost.length}</b></div>
        <div class="db-kv"><span>Tonnage sunk</span><b>${w.stats[0].tonsSunk.toLocaleString('en-GB')} t</b></div>
        <div class="db-kv"><span>Ships lost</span><b>${ownLost.length}</b></div>
        ${w.stats[0].planesKilled || w.stats[0].planesLost ? `<div class="db-kv"><span>Aircraft shot down / lost</span><b>${w.stats[0].planesKilled} / ${w.stats[0].planesLost}</b></div>` : ''}
        <div class="db-kv"><span>Shells fired / hits</span><b>${w.stats[0].shots} / ${w.stats[0].hits}</b></div>
        ${w.stats[0].torpsFired ? `<div class="db-kv"><span>Torpedoes fired / hits</span><b>${w.stats[0].torpsFired} / ${w.stats[0].torpHits}</b></div>` : ''}
        ${enemyLost.length ? `<div class="db-list"><div class="dim">Sunk</div>${enemyLost.map((u) => `<div>${esc(u.name)} <span class="dim">${esc(TYPE_NAMES[u.cls.type].toLowerCase())}</span></div>`).join('')}</div>` : ''}
        ${ownLost.length ? `<div class="db-list bad"><div class="dim">Lost</div>${ownLost.map((u) => `<div>${esc(u.name)}</div>`).join('')}</div>` : ''}
        <div class="ph">Objectives</div>
        <ul class="db-obj">${w.objectives.map((o) => `<li class="${o.status}">${esc(o.def.text)}${o.def.bonus ? ' <em>bonus</em>' : ''}</li>`).join('')}</ul>`;
      const cols = el('div', { class: 'db-cols' }, stats);
      if (report) {
        const pr = el('div', { class: 'db-col' });
        pr.innerHTML = `<div class="ph">Prestige</div>
          ${report.lines.map((l) => `<div class="db-kv"><span>${esc(l.text)}</span><b>${l.value >= 0 ? '+' : ''}${l.value}</b></div>`).join('')}
          <div class="db-kv total"><span>Total</span><b>+${report.total}</b></div>
          <div class="db-kv"><span>Prestige now</span><b>${app.state!.prestige}</b></div>
          ${report.promotions.length ? `<div class="ph">Promotions</div>${report.promotions.map((p) => `<div class="db-promo">${esc(p.name)} is now <b>${VET_NAMES[p.level]}</b></div>`).join('')}` : ''}
          ${report.losses.length ? `<div class="ph">Lost from your fleet</div>${report.losses.map((n) => `<div class="bad">${esc(n)}</div>`).join('')}` : ''}`;
        cols.append(pr);
      }
      cols.append(el('div', { class: 'db-col db-history' }, el('div', { class: 'ph' }, 'What really happened'), el('div', { html: paras(m.history) })));
      const btns = el('div', { class: 'db-btns' });
      if (inCampaign) {
        const c = CAMPAIGNS[app.state!.nation];
        const last = app.state!.index >= c.missions.length - 1;
        if (won) {
          btns.append(
            el('button', { class: 'btn ghost', onclick: retry }, 'Fight it again'),
            el('button', { class: 'btn primary', onclick: moveOn }, last ? 'End of the campaign →' : 'Continue the war →'),
          );
        } else {
          btns.append(
            el('button', { class: 'btn ghost', onclick: moveOn, title: 'Keep the result and losses and move on to the next battle' }, 'Accept the defeat and go on'),
            el('button', { class: 'btn primary', onclick: retry }, 'Try again'),
          );
        }
      } else {
        btns.append(
          el('button', { class: 'btn ghost', onclick: () => app.go('battles') }, '← Battles'),
          el('button', { class: 'btn primary', onclick: retry }, 'Fight it again'),
        );
      }
      parent.append(
        el(
          'div',
          { class: `screen debrief ${won ? 'win' : 'lose'}` },
          el('div', { class: 'db-head', html: `<div class="db-title">${TITLE[r.outcome]}</div><div class="db-sub">${esc(m.title)} &middot; ${esc(r.reason)}</div>` }),
          cols,
          btns,
        ),
      );
    },
    unmount() {},
  };
}
