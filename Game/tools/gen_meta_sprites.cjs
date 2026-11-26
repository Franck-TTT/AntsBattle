// Placeholder sprites of the meta UI (home map, upgrades), drawn from the mockup's SVG shapes
// (design: Ant Battle Meta UI, 25/11). White glyphs tinted by the UI's `color`, except the coin.
// Not final art. Run: node tools/gen_meta_sprites.cjs <path to playwright>
const { chromium } = require(process.argv[2]);
const path = require('node:path');
const OUT = path.join(__dirname, '..', 'assets', 'ui', 'meta');

const HEX = '25,4 75,4 98,50 75,96 25,96 2,50';
const OCT = '30,3 70,3 97,30 97,70 70,97 30,97 3,70 3,30';
const ICON24 = (d, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${extra}<path d="${d}"/></svg>`;
const SHAPE = (inner, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${100 + 2 * pad} ${100 + 2 * pad}">${inner}</svg>`;
const STAR = 'M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z';

/** name → [svg, size px] */
const SPRITES = {
  hex_fill: [SHAPE(`<polygon points="${HEX}" fill="#fff"/>`), 256],
  hex_rim: [SHAPE(`<polygon points="${HEX}" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>`, 4), 256],
  hex_glow: [SHAPE(`<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs><polygon points="${HEX}" fill="none" stroke="#fff" stroke-width="8" filter="url(#b)"/>`, 20), 256],
  oct_fill: [SHAPE(`<polygon points="${OCT}" fill="#fff"/>`), 256],
  oct_rim: [SHAPE(`<polygon points="${OCT}" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>`, 4), 256],
  oct_glow: [SHAPE(`<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs><polygon points="${OCT}" fill="none" stroke="#fff" stroke-width="8" filter="url(#b)"/>`, 20), 256],
  coin: [SHAPE(`<polygon points="25,6 75,6 97,50 75,94 25,94 3,50" fill="#FFC51F"/><polygon points="38,30 62,30 72,50 62,70 38,70 28,50" fill="none" stroke="#8A5A00" stroke-width="7"/>`), 128],
  star: [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${STAR}" fill="#fff"/></svg>`, 96],
  star_empty: [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${STAR}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`, 96],
  lock: [ICON24('M8 11V8a4 4 0 0 1 8 0v3', '<rect x="5" y="11" width="14" height="10" rx="2"/>'), 96],
  // Cog: Feather Icons 'settings' (MIT).
  gear: [ICON24('M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z', '<circle cx="12" cy="12" r="3"/>'), 96],
  nav_up: [ICON24('M12 20V6M6 12l6-6 6 6M5 21h14'), 96],
  nav_map: [ICON24('M9 4v14M15 6v14', '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/>'), 96],
  close: [ICON24('M5 5l14 14M19 5L5 19'), 96],
  ic_dmg: [ICON24('M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8'), 96],
  ic_gold: [ICON24('M7 4h10l5 8-5 8H7l-5-8zM9 12h6'), 96],
  ic_rate: [ICON24('M13 2L4 14h7l-1 8 9-12h-7z'), 96],
  ic_range: [ICON24('M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6'), 96],
  ic_aoe: [ICON24('M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M5 19l3.5-3.5M15.5 8.5L19 5'), 96],
  ic_cell: [ICON24('M5 5h14v14H5zM5 12h14M12 5v14'), 96],
  ic_life: [ICON24('M7 3h10l5 9-5 9H7l-5-9zM12 8v8M8 12h8'), 96],
  ic_reroll: [ICON24('M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5'), 96],
  ic_tower: [ICON24('M8 3h8v6H8zM7 9h10l3 6-3 6H7l-3-6z'), 96],
  ic_slow: [ICON24('M6 3h12M6 21h12M7 3c0 6 10 6 10 9s-10 3-10 9M17 3c0 6-10 6-10 9'), 96],
};

(async () => {
  require('node:fs').mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage();
  for (const [name, [svg, size]] of Object.entries(SPRITES)) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  }
  await b.close();
  console.log(`${Object.keys(SPRITES).length} sprites in ${OUT}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
