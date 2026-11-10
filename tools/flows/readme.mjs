// The README screenshots, written to docs/ as JPEGs.
// node tools/play.mjs http://localhost:5173/ tools/flows/readme.mjs shots 1600 900  (dev server only: it imports from /src)
const jpeg = async (page, name) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `docs/${name}.jpg`, type: 'jpeg', quality: 80 });
  console.log(`docs/${name}.jpg`);
};

export default async function (page, shot, log) {
  // the war room part-way through the Royal Navy's war
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const { CAMPAIGNS } = await import('/src/data/campaigns/index.ts');
    const { newCampaign, addShip } = await import('/src/campaign/state.ts');
    const st = newCampaign('uk', 'normal');
    const outs = ['victory', 'decisive', 'victory', 'decisive', 'victory'];
    st.records = CAMPAIGNS.uk.missions.slice(0, 5).map((m, i) => ({ id: m.id, outcome: outs[i], shipsSunk: 2 + i, shipsLost: i % 2, tonsSunk: 9000 * (i + 1), prestige: 250, attempts: 1 }));
    st.index = 5;
    st.prestige = 1260;
    st.fleet[0].xp = 420;
    st.fleet[1].xp = 260;
    st.fleet[1].hp = 0.62;
    st.fleet[2].xp = 140;
    addShip(st, 'town', 'Edinburgh');
    addShip(st, 'jclass', 'Jervis');
    window.sb3.state = st;
    window.sb3.go('campaign');
  });
  await page.waitForTimeout(1200);
  await jpeg(page, 'warroom');

  // a battle in progress
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('.menu-btns >> text=Historical battles');
  await page.waitForTimeout(300);
  await page.click(`.hb-row:has-text("${process.env.BATTLE ?? 'The River Plate'}")`);
  await page.waitForTimeout(400);
  await page.click('.br-foot .btn.primary');
  await page.waitForTimeout(1200);
  const info = await page.evaluate((want) => {
    const bs = window.sb3.screen;
    const w = bs.w;
    w.controllers[0] = 'ai';
    let n = 0;
    while (!w.result && n++ < 4000 && w.stats[0].shots < want) {
      w.advance(5);
      w.events.length = 0;
    }
    return { t: Math.round(w.time), shots: w.stats[0].shots, hits: w.stats[0].hits };
  }, Number(process.env.WANT ?? 200));
  log('battle', JSON.stringify(info));
  await page.click('.hud-top [data-act=speed][data-v="1"]');
  await page.waitForTimeout(Number(process.env.RUN ?? 4000));
  await page.keyboard.press('Space');
  // frame the closest fight: the nearest pair of enemies and everything within a few kilometres
  await page.evaluate((radius) => {
    const bs = window.sb3.screen;
    const w = bs.w;
    const own = w.units.filter((u) => u.side === 0 && !u.sunk);
    const foe = w.units.filter((u) => u.side === 1 && !u.sunk);
    let best = null;
    for (const a of own) for (const b of foe) {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!best || d < best.d) best = { a, b, d };
    }
    const cx = (best.a.x + best.b.x) / 2;
    const cy = (best.a.y + best.b.y) / 2;
    const near = w.units.filter((u) => !u.sunk && Math.hypot(u.x - cx, u.y - cy) < Math.max(radius, best.d * 0.6));
    const xs = near.map((u) => u.x);
    const ys = near.map((u) => u.y);
    bs.cam.fit(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 1.3, { l: 260, t: 60, r: 340, b: 200 });
    bs.select([best.a.id]);
  }, Number(process.env.RADIUS ?? 5000));
  await page.waitForTimeout(600);
  await jpeg(page, 'battle');
}
