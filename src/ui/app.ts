// The application shell: one screen at a time, plus the campaign in play.

import { sfx } from '../audio/sfx';
import { loadSettings, saveSettings, type Settings } from '../campaign/settings';
import { saveCampaign, type CampaignState } from '../campaign/state';
import type { MissionDef } from '../data/types';
import { buildWorld } from '../sim/build';
import type { DeployedCore } from '../sim/types';
import type { World } from '../sim/world';
import { BattleScreen } from './battle/battleScreen';

export interface Screen {
  mount(root: HTMLElement): void;
  unmount(): void;
  /** Escape key: return true if handled. */
  back?(): boolean;
}

/** How a battle was started, so the debrief knows what to offer. */
export interface BattleContext {
  mission: MissionDef;
  core: DeployedCore[];
  /** campaign state as it was before the battle, for a retry */
  snapshot: string | null;
  seed: number;
}

type Nav = {
  menu(): Screen;
  nations(): Screen;
  campaign(): Screen;
  briefing(m: MissionDef, history?: boolean): Screen;
  debrief(ctx: BattleContext, w: World): Screen;
  shipyard(): Screen;
  battles(): Screen;
  epilogue(): Screen;
};

export class App {
  settings: Settings = loadSettings();
  state: CampaignState | null = null;
  private screen: Screen | null = null;
  private nav!: Nav;

  constructor(readonly root: HTMLElement) {
    this.applyAudio();
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.screen?.back?.()) e.preventDefault();
    });
    // browsers only allow sound after a gesture
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
  }

  /** Screens are registered after construction to avoid import cycles. */
  setNav(nav: Nav) {
    this.nav = nav;
  }

  show(s: Screen) {
    this.screen?.unmount();
    this.root.replaceChildren();
    this.screen = s;
    s.mount(this.root);
  }

  go<K extends keyof Nav>(k: K, ...args: Parameters<Nav[K]>) {
    const make = this.nav[k] as (...a: Parameters<Nav[K]>) => Screen;
    this.show(make(...args));
  }

  saveSettings() {
    saveSettings(this.settings);
    this.applyAudio();
  }

  applyAudio() {
    sfx.setVolume(this.settings.volume);
    sfx.setAmbience(this.settings.ambience);
    sfx.setMuted(this.settings.muted);
  }

  save() {
    if (this.state) saveCampaign(this.state);
  }

  /** Start a battle: from the campaign (with a state snapshot) or a historical battle. */
  battle(ctx: BattleContext) {
    const difficulty = this.state && ctx.snapshot ? this.state.difficulty : this.settings.difficulty;
    const w = buildWorld(ctx.mission, { seed: ctx.seed, core: ctx.core, difficulty, autoEvade: this.settings.autoEvade });
    const screen = new BattleScreen(
      w,
      this.settings,
      {
        onFinish: (world) => this.go('debrief', ctx, world),
        onQuit: () => (ctx.snapshot ? this.go('campaign') : this.go('battles')),
        onRestart: () => this.battle({ ...ctx, seed: ctx.seed + 1 }),
      },
      ctx.mission.hints ?? [],
    );
    this.show(screen);
  }
}
