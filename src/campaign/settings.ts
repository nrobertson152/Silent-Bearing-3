// Player settings, stored in localStorage.

export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface Settings {
  volume: number;
  ambience: number;
  muted: boolean;
  difficulty: DifficultyId;
  autoEvade: boolean;
  edgeScroll: boolean;
  labels: boolean;
  autoSlow: boolean;
  hints: boolean;
}

const KEY = 'sb3:settings';

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.7,
  ambience: 0.5,
  muted: false,
  difficulty: 'normal',
  autoEvade: true,
  edgeScroll: false,
  labels: true,
  autoSlow: true,
  hints: true,
};

export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { ...DEFAULT_SETTINGS, ...s };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}
