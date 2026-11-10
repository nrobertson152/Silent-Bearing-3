import './styles.css';
import './ui/screens.css';
import { App } from './ui/app';
import { battlesScreen } from './ui/screens/battles';
import { briefingScreen } from './ui/screens/briefing';
import { campaignScreen } from './ui/screens/campaign';
import { debriefScreen } from './ui/screens/debrief';
import { epilogueScreen } from './ui/screens/epilogue';
import { menuScreen } from './ui/screens/menu';
import { nationsScreen } from './ui/screens/nations';
import { shipyardScreen } from './ui/screens/shipyard';

const app = new App(document.getElementById('app')!);
app.setNav({
  menu: () => menuScreen(app),
  nations: () => nationsScreen(app),
  campaign: () => campaignScreen(app),
  briefing: (m, history) => briefingScreen(app, m, history),
  debrief: (ctx, w) => debriefScreen(app, ctx, w),
  shipyard: () => shipyardScreen(app),
  battles: () => battlesScreen(app),
  epilogue: () => epilogueScreen(app),
});
app.go('menu');

// handy in the browser console when testing
(window as unknown as { sb3: App }).sb3 = app;
