import { CAMPAIGNS, CAMPAIGN_ORDER } from '../src/data/campaigns';
import type { MissionDef } from '../src/data/types';
import { defaultDeployment, loanerFor, newCampaign, toDeployed } from '../src/campaign/state';

/** The core ships a fresh campaign would bring to this mission. */
export function coreFor(m: MissionDef) {
  const nation = CAMPAIGN_ORDER.find((n) => CAMPAIGNS[n].missions.includes(m))!;
  const st = newCampaign(nation, 'normal');
  const dep = toDeployed(defaultDeployment(st, m));
  return dep.length ? dep : m.player.groups.length ? [] : loanerFor(m);
}
