// Modal dialogs used outside battle: settings, how to play, confirmations.

import type { App } from './app';
import { el } from './dom';

function modal(parent: HTMLElement, body: HTMLElement, cls = ''): () => void {
  const back = el('div', { class: 'modal-back' });
  const box = el('div', { class: `modal ${cls}` }, body);
  back.append(box);
  const close = () => {
    back.remove();
    window.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
  };
  window.addEventListener('keydown', onKey, true);
  back.addEventListener('pointerdown', (e) => {
    if (e.target === back) close();
  });
  parent.append(back);
  return close;
}

export function confirmDialog(parent: HTMLElement, title: string, text: string, yes: string, onYes: () => void, danger = false) {
  const body = el('div', {});
  body.innerHTML = `<h2>${title}</h2><p>${text}</p>`;
  const row = el('div', { class: 'modal-btns' });
  let close = () => {};
  row.append(
    el('button', { class: 'btn ghost', onclick: () => close() }, 'Cancel'),
    el('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => (close(), onYes()) }, yes),
  );
  body.append(row);
  close = modal(parent, body, 'small');
}

export function settingsDialog(parent: HTMLElement, app: App, onClose?: () => void) {
  const s = app.settings;
  const body = el('div', { class: 'settings' });
  body.append(el('h2', {}, 'Settings'));
  const slider = (label: string, get: () => number, set: (v: number) => void) => {
    const input = el('input', { type: 'range', min: 0, max: 100, value: Math.round(get() * 100) }) as HTMLInputElement;
    input.addEventListener('input', () => {
      set(Number(input.value) / 100);
      app.saveSettings();
    });
    return el('label', { class: 'set-row' }, el('span', {}, label), input);
  };
  const toggle = (label: string, note: string, get: () => boolean, set: (v: boolean) => void) => {
    const input = el('input', { type: 'checkbox' }) as HTMLInputElement;
    input.checked = get();
    input.addEventListener('change', () => {
      set(input.checked);
      app.saveSettings();
    });
    return el('label', { class: 'set-row check' }, input, el('span', {}, label, el('em', {}, note)));
  };
  body.append(
    el('h3', {}, 'Sound'),
    slider('Effects volume', () => s.volume, (v) => (s.volume = v)),
    slider('Sea and wind', () => s.ambience, (v) => (s.ambience = v)),
    toggle('Mute', '', () => s.muted, (v) => (s.muted = v)),
    el('h3', {}, 'Battle'),
    toggle('Automatic evasion', 'Your ships turn to comb torpedo tracks, dodge bombers and submarines dive from aircraft without orders.', () => s.autoEvade, (v) => (s.autoEvade = v)),
    toggle('Slow time on alarms', 'Drop to normal speed when torpedoes, aircraft or new enemies appear.', () => s.autoSlow, (v) => (s.autoSlow = v)),
    toggle('Ship labels', '', () => s.labels, (v) => (s.labels = v)),
    toggle('Mission hints', 'Show hints at the start of each battle.', () => s.hints, (v) => (s.hints = v)),
    toggle('Scroll at screen edges', '', () => s.edgeScroll, (v) => (s.edgeScroll = v)),
  );
  const diff = el('div', { class: 'set-row' }, el('span', {}, 'Difficulty for historical battles'));
  const sel = el('select', {}) as HTMLSelectElement;
  for (const [v, t] of [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]) {
    const o = el('option', { value: v }, t);
    if (s.difficulty === v) o.setAttribute('selected', '');
    sel.append(o);
  }
  sel.addEventListener('change', () => {
    s.difficulty = sel.value as typeof s.difficulty;
    app.saveSettings();
  });
  diff.append(sel);
  body.append(diff);
  let close = () => {};
  body.append(el('div', { class: 'modal-btns' }, el('button', { class: 'btn primary', onclick: () => (close(), onClose?.()) }, 'Done')));
  close = modal(parent, body);
}

export function helpDialog(parent: HTMLElement) {
  const body = el('div', { class: 'help' });
  body.innerHTML = `<h2>How to play</h2>
  <div class="help-cols">
  <div>
    <h3>Commanding ships</h3>
    <p><b>Left-click</b> a ship to select it, or drag a box around several. <b>Right-click</b> the sea to steam there (hold <b>Shift</b> to add waypoints), or right-click an enemy to engage her.</p>
    <p>The ship panel sets <b>speed</b> (keys <b>1&ndash;5</b>, or Q and E), turns (Z and C), launches <b>torpedoes</b> (T, then click; Y changes the spread), makes <b>smoke</b> (M) and holds fire (H). Submarines surface with R and dive with F.</p>
    <p>Guns fire on their own at anything in range that you can see. Fire control improves with every salvo, and drops when you or your target turn hard.</p>
    <h3>Time</h3>
    <p><b>Space</b> pauses; <b>[</b> and <b>]</b> or the clock buttons change the time speed. Orders can be given while paused. <b>F1</b> shows the battle controls.</p>
  </div>
  <div>
    <h3>Seeing the enemy</h3>
    <p>You see only what your lookouts, radar, sonar and aircraft report. Hydrophones give <b>bearing lines</b>; two crossing lines give a position. Night, rain, fog and smoke cut the range of everyone without radar.</p>
    <h3>Aircraft</h3>
    <p>Select a carrier or airfield and use <b>Launch strike</b> (B) and click a target, <b>Scout</b> to search, or leave <b>Auto CAP</b> on to keep fighters overhead. Strikes fly to where the enemy was last reported: fresh scouting reports make for better strikes.</p>
    <h3>Submarines</h3>
    <p>On the surface a boat is fast but visible; submerged she is slow and her battery runs down. Escorts with sonar hunt you with depth charges: go deep and turn away.</p>
  </div>
  <div>
    <h3>The campaign</h3>
    <p>Each nation's campaign follows the war through eight battles. Your <b>core fleet</b> carries over between them: damage must be repaired in the dockyard, ships gain experience and lost ships are gone for good.</p>
    <p>Battles earn <b>prestige</b> for objectives and sinkings. Spend it on repairs and new ships as they come into service. A defeat may be retried, or accepted so that the war moves on.</p>
    <h3>Camera</h3>
    <p>Wheel or pinch to zoom, drag with the right or middle button (or one finger) to pan. <b>V</b> follows the selected ship, <b>G</b> centres on her and <b>Tab</b> steps through your ships.</p>
  </div>
  </div>`;
  let close = () => {};
  body.append(el('div', { class: 'modal-btns' }, el('button', { class: 'btn primary', onclick: () => close() }, 'Close')));
  close = modal(parent, body, 'wide');
}
