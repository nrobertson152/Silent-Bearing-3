// Briefing and deployment for one battle.

import { CAMPAIGNS, CAMPAIGN_ORDER } from '../../data/campaigns';
import { CLASSES, TYPE_NAMES, cls } from '../../data/ships';
import { GUNS } from '../../data/weapons';
import { NATIONS } from '../../data/nations';
import { fmtDate } from '../../core/math';
import { hashString } from '../../core/rng';
import { defaultDeployment, eligible, historicalCore, loanerFor, toDeployed, type CoreShip } from '../../campaign/state';
import type { MissionDef, ShipClass } from '../../data/types';
import type { DeployedCore } from '../../sim/types';
import type { App, Screen } from '../app';
import { el, esc, paras } from '../dom';
import { flagSvg } from '../flags';
import { drawPreview } from '../preview';
import { hpBar, vetStars } from './campaign';

const TOD: Record<string, string> = { day: 'Daylight', dawn: 'Dawn', dusk: 'Dusk', night: 'Night' };
const WX: Record<string, string> = { clear: 'clear', overcast: 'overcast', rain: 'rain squalls', fog: 'fog', snow: 'snow', storm: 'gale' };
const SEA = ['calm sea', 'slight sea', 'moderate sea', 'heavy sea'];

function nationOf(m: MissionDef) {
  return CAMPAIGN_ORDER.find((n) => CAMPAIGNS[n].missions.includes(m))!;
}

/** One line on a class: main guns, torpedoes, speed. */
export function classLine(c: ShipClass): string {
  const main = c.guns.filter((g) => !g.sec);
  const parts: string[] = [];
  if (main.length) {
    const n = main.reduce((a, g) => a + g.n, 0);
    const g = GUNS[main[0].g];
    parts.push(`${n} × ${g ? g.name.replace(/ Mark.*| SK.*| Type.*|\(.*\)/, '') : main[0].g}`);
  }
  if (c.torps) parts.push(`${c.torps.tubes} torpedo tubes`);
  if (c.air) parts.push(`${c.air.reduce((a, s) => a + s.n, 0)} aircraft`);
  parts.push(`${c.speed} kn`);
  return parts.join(' · ');
}

/** "Fletcher class", but an airfield or a battery is just its name. */
export function classLabel(c: ShipClass): string {
  return c.type === 'BASE' || c.type === 'BTY' ? c.name : `${c.name} class`;
}

export function briefingScreen(app: App, m: MissionDef, history = false): Screen {
  const nation = nationOf(m);
  // outside a campaign the battle is fought with the ships that were really there
  const inCampaign = !history && !!app.state && app.state.nation === nation && CAMPAIGNS[nation].missions[app.state.index] === m;
  const st = inCampaign ? app.state! : null;
  const pool = st ? eligible(st, m) : [];
  let chosen = new Set<string>(st ? defaultDeployment(st, m).map((s) => s.uid) : []);
  let step: 'brief' | 'deploy' = 'brief';
  let root: HTMLElement;
  let body: HTMLElement;

  const core = (): DeployedCore[] => {
    if (!st) return historicalCore(m);
    const dep = toDeployed(pool.filter((s) => chosen.has(s.uid)));
    return dep.length || m.player.groups.length ? dep : loanerFor(m);
  };

  const begin = () => {
    const snapshot = st ? JSON.stringify(st) : null;
    app.battle({ mission: m, core: core(), snapshot, seed: hashString(m.id) + (st ? st.attempts * 7919 : (Math.random() * 1e6) | 0) });
  };

  function renderBrief() {
    body.replaceChildren();
    const left = el('div', { class: 'br-text' });
    left.innerHTML = `
      <div class="br-news">${m.news.map((n) => `<div>${esc(n)}</div>`).join('')}</div>
      <div class="br-brief">${paras(m.brief)}</div>
      <h3>Objectives</h3>
      <ul class="br-obj">${m.objectives.map((o) => `<li class="${o.bonus ? 'bonus' : ''}">${esc(o.text)}${o.bonus ? ' <em>bonus</em>' : ''}</li>`).join('')}</ul>
      ${m.timeLimit ? `<div class="dim">Time limit: ${m.timeLimit} minutes.</div>` : ''}
      ${m.hints?.length ? `<h3>Advice</h3><ul class="br-hints">${m.hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}`;
    const canvas = el('canvas', { class: 'br-chart' });
    const env = m.env;
    const cond = `${TOD[env.tod]}, ${WX[env.wx]}, ${SEA[env.sea ?? 1]}${env.aurora ? ', northern lights' : ''}`;
    const forces = el('div', { class: 'br-forces' });
    const own = m.player.groups.flatMap((g) => g.units.map((u) => ({ c: u.c, n: u.n ?? cls(u.c).name })));
    if (!inCampaign) own.push(...core().map((d) => ({ c: d.cls, n: d.name })));
    forces.innerHTML = `<div class="ph">Conditions</div><div class="bf-cond">${esc(cond)}</div>
      <div class="ph">Under your command</div>
      <div class="bf-list">${
        own.length
          ? own.map((u) => `<div><span class="cf-type">${cls(u.c).type}</span> ${esc(u.n)} <span class="dim">${esc(classLabel(cls(u.c)))}</span></div>`).join('')
          : '<div class="dim">Your own ships only</div>'
      }${inCampaign && m.player.slots ? `<div class="dim">+ up to ${m.player.slots} ship${m.player.slots > 1 ? 's' : ''} of your fleet</div>` : ''}</div>`;
    const right = el('div', { class: 'br-side' }, canvas, forces);
    body.append(left, right);
    requestAnimationFrame(() => drawPreview(canvas, m, core()));
  }

  function renderDeploy() {
    body.replaceChildren();
    const wrap = el('div', { class: 'dep' });
    const slots = m.player.slots;
    const head = el('div', { class: 'dep-head' });
    const refresh = () => {
      head.innerHTML = `<h3>Choose up to ${slots} ship${slots > 1 ? 's' : ''} from your fleet</h3><div class="dim">${chosen.size} of ${slots} chosen${
        m.player.allowed ? ` &middot; this battle calls for: ${m.player.allowed.map((t) => TYPE_NAMES[t].toLowerCase() + 's').join(', ')}` : ''
      }</div>`;
      startBtn.toggleAttribute('disabled', !m.player.groups.length && !chosen.size && !m.player.loaner);
    };
    const startBtn = el('button', { class: 'btn primary', onclick: begin }, 'Begin battle') as HTMLButtonElement;
    const grid = el('div', { class: 'dep-grid' });
    for (const s of pool) grid.append(shipCard(s, () => {
      if (chosen.has(s.uid)) chosen.delete(s.uid);
      else if (chosen.size < slots) chosen.add(s.uid);
      else {
        // replace the oldest choice
        const first = [...chosen][0];
        chosen.delete(first);
        chosen.add(s.uid);
      }
      for (const c of grid.children) (c as HTMLElement).classList.toggle('on', chosen.has((c as HTMLElement).dataset.uid!));
      refresh();
    }));
    if (!pool.length) {
      grid.append(
        el('div', {
          class: 'dep-none',
          html: m.player.loaner
            ? `None of your ships suits this battle. You are lent <b>${esc(m.player.loaner.n ?? cls(m.player.loaner.c).name)}</b> (${esc(cls(m.player.loaner.c).name)} class).`
            : 'None of your ships suits this battle: you fight with the forces above.',
        }),
      );
    }
    const fixed = m.player.groups.flatMap((g) => g.units);
    const fixedBox = el('div', { class: 'dep-fixed' });
    if (fixed.length) {
      fixedBox.innerHTML = `<div class="ph">Already assigned</div>${fixed
        .map((u) => `<span class="chip">${cls(u.c).type} ${esc(u.n ?? cls(u.c).name)}</span>`)
        .join('')}`;
    }
    wrap.append(head, fixedBox, grid);
    body.append(wrap);
    foot.replaceChildren(
      el('button', { class: 'btn ghost', onclick: () => ((step = 'brief'), render()) }, '← Briefing'),
      startBtn,
    );
    refresh();
  }

  function shipCard(s: CoreShip, toggle: () => void): HTMLElement {
    const k = CLASSES[s.cls];
    const card = el('button', { class: `ship-card ${chosen.has(s.uid) ? 'on' : ''}`, onclick: toggle });
    card.dataset.uid = s.uid;
    const warn = s.hp < 0.6 ? `<div class="sc-warn">Damaged: ${Math.round(s.hp * 100)}% &middot; repair in the dockyard</div>` : '';
    card.innerHTML = `<div class="sc-top"><span class="cf-type">${k.type}</span><b>${esc(s.name)}</b>${vetStars(s.xp)}</div>
      <div class="sc-cls dim">${esc(k.name)} class ${esc(TYPE_NAMES[k.type].toLowerCase())}</div>
      <div class="sc-line">${esc(classLine(k))}</div>
      <div class="sc-hp">${hpBar(s.hp)}<span>${Math.round(s.hp * 100)}%</span></div>${warn}`;
    return card;
  }

  let foot: HTMLElement;
  function render() {
    if (step === 'brief') {
      renderBrief();
      const next = m.player.slots > 0 && pool.length ? 'Choose ships →' : 'Begin battle';
      foot.replaceChildren(
        el('button', { class: 'btn ghost', onclick: () => (inCampaign ? app.go('campaign') : app.go('battles')) }, inCampaign ? '← War room' : '← Battles'),
        el('button', {
          class: 'btn primary',
          onclick: () => {
            if (m.player.slots > 0 && pool.length && inCampaign) {
              step = 'deploy';
              render();
            } else begin();
          },
        }, inCampaign ? next : 'Begin battle'),
      );
    } else renderDeploy();
  }

  return {
    mount(parent) {
      body = el('div', { class: 'br-body' });
      foot = el('div', { class: 'br-foot' });
      root = el(
        'div',
        { class: 'screen briefing' },
        el('div', {
          class: 'br-head',
          html: `<div class="br-flags">${flagSvg(nation, 22)}<span class="vs">vs</span>${flagSvg(m.enemyNation, 22)}</div>
            <div><h1>${esc(m.title)}</h1><div class="br-sub">${esc(fmtDate(m.date))} &middot; ${esc(m.place)} &middot; ${esc(NATIONS[nation].navy)}</div></div>`,
        }),
        body,
        foot,
      );
      parent.append(root);
      render();
    },
    unmount() {},
    back() {
      if (step === 'deploy') {
        step = 'brief';
        render();
      } else if (inCampaign) app.go('campaign');
      else app.go('battles');
      return true;
    },
  };
}
