import type { CampaignDef, MissionDef, PlayableNation } from '../types';
import { DE } from './de';
import { JP } from './jp';
import { UK } from './uk';
import { US } from './us';

export const CAMPAIGNS: Record<PlayableNation, CampaignDef> = { uk: UK, us: US, de: DE, jp: JP };
export const CAMPAIGN_ORDER: PlayableNation[] = ['uk', 'us', 'de', 'jp'];

export function allMissions(): MissionDef[] {
  return CAMPAIGN_ORDER.flatMap((n) => CAMPAIGNS[n].missions);
}

export function findMission(id: string): MissionDef | undefined {
  return allMissions().find((m) => m.id === id);
}
