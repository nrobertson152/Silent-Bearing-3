// The screens off the main path: historical battles, a historical briefing, the dialogs, and the
// epilogue of a campaign played to the end (records faked in the page).
// node tools/play.mjs http://localhost:5173/ tools/flows/screens.mjs shots  (dev server only: it imports from /src)
export default async function (page, shot, log) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.click('.menu-btns >> text=Historical battles');
  await page.waitForTimeout(500);
  await shot('scr-01-battles');
  await page.click('.hb-row:has-text("Midway")');
  await page.waitForTimeout(800);
  await shot('scr-02-history-briefing');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await page.click('.menu-btns >> text=Settings');
  await page.waitForTimeout(400);
  await shot('scr-03-settings');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('.menu-btns >> text=How to play');
  await page.waitForTimeout(400);
  await shot('scr-04-help');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // a finished Japanese campaign
  await page.evaluate(async () => {
    const app = window.sb3;
    app.go('nations');
    const { CAMPAIGNS } = await import('/src/data/campaigns/index.ts');
    const { newCampaign } = await import('/src/campaign/state.ts');
    const st = newCampaign('jp', 'normal');
    const c = CAMPAIGNS.jp;
    const outs = ['decisive', 'victory', 'victory', 'marginal', 'defeat', 'victory', 'defeat', 'marginal'];
    st.records = c.missions.map((m, i) => ({ id: m.id, outcome: outs[i % outs.length], shipsSunk: 3 + i, shipsLost: i % 3, tonsSunk: 12000 * (i + 1), prestige: 200, attempts: 1 }));
    st.index = c.missions.length;
    st.finished = true;
    st.prestige = 1840;
    st.fleet[0].xp = 900;
    app.state = st;
    app.go('epilogue');
  });
  await page.waitForTimeout(800);
  await shot('scr-05-epilogue');
}
