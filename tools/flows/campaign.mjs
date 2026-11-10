// A campaign round trip with real mouse input: nation, war room, briefing, deployment, battle
// (fought by the AI on autopilot), debrief, dockyard and back.
// node tools/play.mjs http://localhost:5173/ tools/flows/campaign.mjs shots
export default async function (page, shot, log) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await shot('flow-01-menu');
  await page.click('.menu-btns >> text=Campaigns');
  await page.waitForTimeout(500);
  await shot('flow-02-nations');
  await page.click('.nd-start .btn');
  await page.waitForTimeout(1200);
  await shot('flow-03-warroom');
  await page.click('.cs-next .btn');
  await page.waitForTimeout(600);
  await shot('flow-04-briefing');
  await page.click('.br-foot .btn.primary');
  await page.waitForTimeout(600);
  await shot('flow-05-deploy');
  await page.click('.br-foot .btn.primary');
  await page.waitForTimeout(1500);
  await shot('flow-06-battle');
  const outcome = await page.evaluate(() => {
    const w = window.sb3.screen.w;
    w.controllers[0] = 'ai';
    let n = 0;
    while (!w.result && n++ < 1000) {
      w.advance(10);
      w.events.length = 0;
    }
    return w.result?.outcome;
  });
  log('outcome', outcome);
  await page.waitForTimeout(1500);
  await shot('flow-07-result');
  await page.click('[data-act=debrief]');
  await page.waitForTimeout(800);
  await shot('flow-08-debrief');
  const moveOn = await page.$('.db-btns .btn.primary');
  log('debrief button:', await moveOn.textContent());
  await page.click('.db-btns .btn:has-text("Continue the war"), .db-btns .btn:has-text("Accept the defeat")');
  await page.waitForTimeout(1200);
  await shot('flow-09-warroom-2');
  await page.click('text=Dockyard');
  await page.waitForTimeout(600);
  await shot('flow-10-dockyard');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await shot('flow-11-back');
}
