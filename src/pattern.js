/* =========================================================================
   Stadion gestrickt – Muster-Generator
   Erzeugt das Strickraster (Reihen x Maschen) für Vorder- und Rückseite.
   Koordinaten: x = Reihe entlang der Schallänge (0 = Ende A),
                y = Masche quer über die Breite (0 = obere Kante).
   ========================================================================= */
'use strict';

const STITCHES = 72;        // 18 cm Breite bei 4 Maschen/cm
const ROWS_PER_CM = 5;      // 5 Reihen pro cm (Maschen sind breiter als hoch)
const CI = { R: 0, W: 1, N: 2, B: 3, G: 4 };
const CI_KEYS = ['R', 'W', 'N', 'B', 'G'];
const PANEL_LEN = 42, HEART_LEN = 50;
const MAX_ROWS_PER_GAME = 14;

/* ---- Lanes quer über die Breite (y) ------------------------------------ */
const LANE = {
  border: [0, 71], seam: [2, 69], edgeGold: [[0, 3], [68, 71]],
  starL: 4, starR: 64, streak: [7, 8], goalsFor: 33, goalsAgainst: 38,
  klassiker: 53, moment: 57, pin: 62,
};

function transliterate(s) {
  return String(s).toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').replace(/É/g, 'E').replace(/[^A-Z0-9 :.\-\/+#·'×]/g, '');
}

class Grid {
  constructor(L) {
    this.L = L; this.W = STITCHES;
    this.cells = new Uint8Array(L * STITCHES).fill(CI.N);
    this.ghost = new Uint8Array(L * STITCHES);
    this.regions = new Array(L).fill(null);
  }
  set(x, y, c) { if (x >= 0 && x < this.L && y >= 0 && y < this.W) this.cells[x * this.W + y] = CI[c]; }
  get(x, y) { return CI_KEYS[this.cells[x * this.W + y]]; }
  rect(x0, x1, y0, y1, c) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) this.set(x, y, c); }
  rows(x0, len, c) { this.rect(x0, x0 + len - 1, 0, this.W - 1, c); }
  region(x0, len, info) { for (let x = x0; x < x0 + len && x < this.L; x++) this.regions[x] = info; }
  setGhost(x0, len) { for (let x = x0; x < x0 + len; x++) for (let y = 0; y < this.W; y++) this.ghost[x * this.W + y] = 1; }
}

/* ---- Text & Motive ----------------------------------------------------- */
function glyph(ch) { return FONT[ch] || FONT[' ']; }
function textWidth(str, scale = 1) {
  let w = 0; const s = transliterate(str);
  for (let i = 0; i < s.length; i++) w += glyph(s[i])[0].length * scale + (i < s.length - 1 ? scale : 0);
  return w;
}
function drawText(g, str, x, y, color, scale = 1) {
  const s = transliterate(str); let cx = x;
  for (const ch of s) {
    const gl = glyph(ch);
    for (let r = 0; r < 5; r++) for (let c = 0; c < gl[r].length; c++)
      if (gl[r][c] === '1') g.rect(cx + c * scale, cx + c * scale + scale - 1, y + r * scale, y + r * scale + scale - 1, color);
    cx += gl[0].length * scale + scale;
  }
  return cx - x - scale;
}
function drawTextCentered(g, str, x0, len, y, color, scale = 1) {
  const w = textWidth(str, scale);
  drawText(g, str, x0 + Math.floor((len - w) / 2), y, color, scale);
}
function drawIcon(g, icon, x, y, map = {}) {
  icon.forEach((row, r) => { for (let c = 0; c < row.length; c++) { const ch = row[c]; if (ch !== '.') g.set(x + c, y + r, map[ch] || ch); } });
}
function iconW(icon) { return icon[0].length; }
function iconH(icon) { return icon.length; }

/* ---- Bausteine --------------------------------------------------------- */
function contrast(base) { return base === 'W' ? 'R' : 'W'; }
function againstColor(base) { return base === 'N' ? 'B' : 'N'; }

function drawRauten(g, x0, len, y0 = 0, y1 = STITCHES - 1) {
  for (let x = x0; x < x0 + len; x++) for (let y = y0; y <= y1; y++) {
    const a = Math.floor((x + y) / 6), b = Math.floor((x - y + 600) / 6);
    g.set(x, y, (a + b) % 2 ? 'B' : 'W');
  }
}

const CODE_Y = 10, CODE_BITS = 53;
function seasonBits(season) { const v = season - FIRST_SEASON; return [4, 3, 2, 1, 0].map(b => (v >> b) & 1); }
function drawCodeBand(g, x0, raw, season, region) {
  // 12 Reihen: Nachtblau-Rahmen, 8 Reihen Bitmuster quer über die Breite.
  // Start-Wächter 1101 | 40 Bit Fan-Code | 5 Bit Saison | End-Wächter 1011  → Maschen 10..62
  g.rows(x0, 12, 'N');
  const bits = [1, 1, 0, 1, ...codeBits(raw), ...seasonBits(season), 1, 0, 1, 1];
  for (let x = x0 + 2; x < x0 + 10; x++) {
    bits.forEach((b, i) => g.set(x, CODE_Y + i, b ? 'W' : 'N'));
    g.set(x, CODE_Y - 2, 'R'); g.set(x, CODE_Y + CODE_BITS + 1, 'R');
  }
  g.region(x0, 12, region);
  return 12;
}

function decodeCodeBand(model) {
  for (let x = 0; x < model.L; x++) {
    const reg = model.regions[x];
    if (reg && reg.type === 'code') {
      const row = x + 5, bits = [];
      for (let i = 0; i < CODE_BITS; i++) bits.push(model.cells[row * STITCHES + CODE_Y + i] === CI.W ? 1 : 0);
      const guardOk = bits.slice(0, 4).join('') === '1101' && bits.slice(49).join('') === '1011';
      if (!guardOk) return null;
      const raw = bitsToCode(bits.slice(4, 44));
      const season = FIRST_SEASON + bits.slice(44, 49).reduce((v, b) => (v << 1) | b, 0);
      const p = parseCode(raw);
      return p.ok ? { code: p.code, season } : null;
    }
  }
  return null;
}

function hem(g, x0, len) { g.rows(x0, len, 'N'); g.region(x0, len, { type: 'hem' }); return len; }

/* ---- Vorderseite ------------------------------------------------------- */
function buildFront(ctx) {
  const { profile, games, highlights, act, lengthCm, futureGames = [] } = ctx;
  const L = lengthCm * ROWS_PER_CM;
  const g = new Grid(L);
  const goldOk = ['goldFringe', 'cup', 'plate', 'tour', 'streak', 'fest', 'floodlight', 'crown', 'centurion', 'decade', 'compBand'].some(k => act[k]);
  const gold = goldOk ? 'G' : 'W';
  const stats = ctx.stats;
  const all = games.concat(futureGames);

  // ---- feste Teile vorab planen ----
  const seasonText = seasonLabel(ctx.season);
  const hl = act.highlights ? highlights.slice(0, 5) : [];
  const heart = hl[0];
  const sideHl = hl.slice(1).sort((a, b) => a.date.localeCompare(b.date));
  const nA = Math.ceil(sideHl.length / 2);
  const hlA = sideHl.slice(0, nA), hlB = sideHl.slice(nA);

  const parts = { a: [], b: [] };
  const plan = (side, len, fn) => parts[side].push({ len, fn });

  plan('a', 2, x => hem(g, x, 2));
  if (act.code) plan('a', 12, x => drawCodeBand(g, x, profile.raw, ctx.season, { type: 'code', side: 'A' }));
  if (act.awayDiamond) plan('a', 12, x => { drawRauten(g, x, 12); g.region(x, 12, { type: 'element', el: 'awayDiamond' }); });
  if (act.head) {
    const len = 58;
    plan('a', len, x => drawHead(g, x, len, { seasonText, act, gold, stats }));
  }
  for (const m of hlA) plan('a', PANEL_LEN + 2, x => { g.rows(x, 2, 'R'); drawPanel(g, x + 2, PANEL_LEN, m, false, act, gold); g.region(x, 2, { type: 'gap' }); });

  for (const m of hlB) plan('b', PANEL_LEN + 2, x => { drawPanel(g, x, PANEL_LEN, m, false, act, gold); g.rows(x + PANEL_LEN, 2, 'R'); g.region(x + PANEL_LEN, 2, { type: 'gap' }); });
  if (act.centurion || act.plate) {
    const len = (act.centurion ? 30 : 0) + (act.plate ? 18 : 0) + 4;
    plan('b', len, x => drawEndB(g, x, len, { act, stats }));
  }
  if (act.awayDiamond) plan('b', 12, x => { drawRauten(g, x, 12); g.region(x, 12, { type: 'element', el: 'awayDiamond' }); });
  if (act.code) plan('b', 12, x => drawCodeBand(g, x, profile.raw, ctx.season, { type: 'code', side: 'B' }));
  plan('b', 2, x => hem(g, x, 2));

  const lenA = parts.a.reduce((s, p) => s + p.len, 0);
  const lenB = parts.b.reduce((s, p) => s + p.len, 0);
  const heartLen = heart ? HEART_LEN + 4 : 0;
  let body = L - lenA - lenB - heartLen;
  const info = { L, lengthCm, bodyRows: body, overflow: body < 20 };
  if (body < 20) body = Math.max(0, body);

  // ---- Ende A zeichnen ----
  let x = 0;
  for (const p of parts.a) { p.fn(x); x += p.len; }
  const bodyStart = x;

  // ---- Körper: Spiele ----
  const items = layoutBody(all, body, act, stats);
  info.level = items.level; info.rpg = items.rpg; info.filler = items.filler;
  // Herzstück in die Mitte des Körpers (an Spielgrenze)
  let insertAt = Math.floor(items.list.length / 2);
  if (heart) {
    // nächste Grenze zur Mitte der Reihen
    let acc = 0, best = 0, bestD = 1e9;
    for (let i = 0; i <= items.list.length; i++) {
      const d = Math.abs(acc - body / 2);
      if (d < bestD && (i === items.list.length || items.list[i].kind !== 'sep')) { bestD = d; best = i; }
      if (i < items.list.length) acc += items.list[i].len;
    }
    insertAt = best;
  }
  const streakIdx = act.streak && stats.longestUnbeaten.len >= 2 ? stats.longestUnbeaten : null;
  for (let i = 0; i <= items.list.length; i++) {
    if (heart && i === insertAt) {
      g.rows(x, 2, 'R'); g.region(x, 2, { type: 'gap' }); x += 2;
      drawPanel(g, x, HEART_LEN, heart, true, act, gold); x += HEART_LEN;
      g.rows(x, 2, 'R'); g.region(x, 2, { type: 'gap' }); x += 2;
    }
    if (i === items.list.length) break;
    const it = items.list[i];
    if (it.kind === 'game') drawStripe(g, x, it.len, it.game, items.level, act, stats, streakIdx);
    else if (it.kind === 'future') drawFuture(g, x, it.len, it.game);
    else if (it.kind === 'sep') drawSeparator(g, x, it.len, it, act);
    else if (it.kind === 'filler') drawFiller(g, x, it.len);
    x += it.len;
  }
  // ---- Ende B ----
  x = L - lenB;
  for (const p of parts.b) { p.fn(x); x += p.len; }

  if (act.border) {
    for (let xx = 0; xx < L; xx++) {
      const reg = g.regions[xx];
      if (reg && (reg.type === 'code' || reg.type === 'hem')) continue;
      g.set(xx, 0, 'W'); g.set(xx, STITCHES - 1, 'W');
    }
  }
  info.bodyStart = bodyStart;
  return finishModel(g, info, fringeColors(act));
}

function fringeColors(act) {
  if (act.goldFringe) return act.fringeRed ? ['G', 'R'] : ['G', 'W'];
  if (act.fringeRed) return ['R'];
  return ['W'];
}

function layoutBody(all, body, act, stats) {
  // Ein Saisonschal: Spiele chronologisch, Monatsnähte zwischen den Monaten,
  // Saison-Krone am Anfang, falls alle 17 Bundesliga-Heimspiele besucht wurden.
  const list = [];
  const n = all.length;
  const monthKey = m => m.date.slice(0, 7);
  const months = [...new Set(all.map(monthKey))];
  const sepLen = act.seasonLines ? 1 : 0;
  const crownLen = act.crown && stats.fullHomeSeason ? 8 : 0;
  if (n === 0) {
    list.push({ kind: 'filler', len: body });
    return { list, level: 'leer', rpg: 0, filler: body };
  }
  const fixed = crownLen + Math.max(0, months.length - 1) * sepLen;
  const avail = Math.max(n, body - fixed);
  const rpg = avail / n;
  const base = Math.min(MAX_ROWS_PER_GAME, Math.floor(rpg));
  const level = base >= 3 ? 'detail' : base >= 2 ? 'fein' : 'hauch';
  let lens, filler = 0;
  if (base === MAX_ROWS_PER_GAME) { lens = all.map(() => base); filler = avail - base * n; }
  else lens = all.map((_, i) => Math.floor(avail * (i + 1) / n) - Math.floor(avail * i / n)); // Bresenham
  if (crownLen) list.push({ kind: 'sep', crown: true, season: all[0].season, len: crownLen });
  let prev = null;
  all.forEach((m, i) => {
    const k = monthKey(m);
    if (prev !== null && k !== prev && sepLen) list.push({ kind: 'sep', month: Number(k.slice(5)), season: m.season, len: sepLen });
    prev = k;
    list.push({ kind: m.upcoming ? 'future' : 'game', game: m, len: lens[i] });
  });
  if (filler > 0) list.push({ kind: 'filler', len: filler });
  return { list, level, rpg: Math.min(rpg, MAX_ROWS_PER_GAME), filler };
}

function drawStripe(g, x0, r, m, level, act, stats, streak) {
  const base = act.results ? { W: 'R', D: 'W', L: 'N' }[m.result] : (m.nr % 2 ? 'R' : 'W');
  const con = contrast(base);
  g.rows(x0, r, base);
  g.region(x0, r, { type: 'game', game: m });
  const mid = x0 + Math.floor((r - 1) / 2);
  const detail = level === 'detail', fine = level !== 'hauch';

  // Texturen
  if (fine && act.cupTexture && m.comp === 'DFB')
    for (let x = x0; x < x0 + r; x++) for (let y = 4; y < 68; y++) if ((x + y) % 3 === 0 && y % 2 === 0) g.set(x, y, con);
  if (fine && act.weather && m.weather === 'rain')
    for (let x = x0; x < x0 + r; x++) for (let y = 4; y < 68; y++) if ((x * 2 + y) % 7 === 0) g.set(x, y, base === 'N' ? 'B' : con);
  if (act.loyal && m.result === 'L' && r >= 3) g.rect(mid, mid, 4, 67, 'W');
  if (act.plate && m.titleClinch) g.rect(mid, Math.min(mid + (r >= 4 ? 1 : 0), x0 + r - 1), 4, 67, 'G');
  if (detail && act.floodlight && m.comp === 'CL') g.rect(x0, x0, 3, 68, 'G');
  if (act.goldFringe && m.nr % 10 === 0) g.rect(x0, x0, 0, 71, 'G');

  // Motive (ab 3 Reihen)
  if (detail) {
    const iy = Math.max(x0, mid - 1);
    if (act.clStars && m.comp === 'CL') { drawIcon(g, ICONS.starSmall, iy, LANE.starL, { W: con }); drawIcon(g, ICONS.starSmall, iy, LANE.starR, { W: con }); }
    if (act.weather && m.weather === 'snow') { drawIcon(g, ICONS.snow, iy, LANE.starL, { W: base === 'W' ? 'B' : 'W' }); drawIcon(g, ICONS.snow, iy, LANE.starR, { W: base === 'W' ? 'B' : 'W' }); }
    if (act.klassiker && m.klassiker) drawIcon(g, ['W.W', '.W.', 'W.W'], iy, LANE.klassiker, { W: con });
    if (act.comeback && m.comeback) drawIcon(g, ['.W.', 'W.W', '.W.', 'W.W'], iy, LANE.moment, { W: con });
    else if (act.late && m.lateWinner) drawIcon(g, ['W.W', 'WWW', '.W.'], iy, LANE.moment, { W: con });
  }
  // Tore
  if (fine) {
    const dotW = r >= 5 ? 2 : 1, dotH = r >= 6 ? 2 : 1;
    const dx = mid - (dotH === 2 ? 0 : 0);
    if (act.goals) {
      const col = act.fest && m.fcbGoals >= 5 ? 'G' : con;
      for (let i = 0; i < Math.min(m.fcbGoals, 8); i++) { const y = LANE.goalsFor - 3 * i - (dotW - 1); g.rect(dx, dx + dotH - 1, y, y + dotW - 1, col); }
    }
    if (act.against) {
      const col = againstColor(base);
      for (let i = 0; i < Math.min(m.oppGoals, 5); i++) { const y = LANE.goalsAgainst + 3 * i; g.rect(dx, dx + dotH - 1, y, y + dotW - 1, col); }
    }
  }
  // Kanten
  if (act.cup && m.final) { for (const [a, b] of LANE.edgeGold) g.rect(x0, x0 + r - 1, a, b, 'G'); }
  else if (act.awaySeam && m.venue === 'A') {
    const sc = act.tour ? 'G' : con;
    for (let x = x0; x < x0 + r; x++) if (x % 2 === 0 || r === 1) { g.set(x, LANE.seam[0], sc); g.set(x, LANE.seam[1], sc); }
  }
  if (act.ground && stats.firstVisit.has(m.nr) && m.venue !== 'H') g.rect(x0, Math.min(x0 + 1, x0 + r - 1), LANE.pin, LANE.pin + 1, con);
  if (streak && m.result) {
    const idx = m.nr - 1;
    if (idx >= streak.from && idx <= streak.to) g.rect(x0, x0 + r - 1, LANE.streak[0], LANE.streak[1], 'G');
  }
}

function drawFuture(g, x0, r, m) {
  g.rows(x0, r, 'W');
  for (let x = x0; x < x0 + r; x++) for (let y = 0; y < 72; y++) if ((x + y) % 4 === 0) g.set(x, y, 'N');
  g.setGhost(x0, r);
  g.region(x0, r, { type: 'future', game: m });
}

function drawFiller(g, x0, len) {
  // Grundmuster: klassische Blockstreifen – wird durch neue Spiele ersetzt
  for (let x = x0; x < x0 + len; x++) {
    const k = Math.floor((x - x0) / 8) % 2;
    g.rows(x, 1, k ? 'W' : 'R');
  }
  g.setGhost(x0, len);
  g.region(x0, len, { type: 'filler' });
}

function drawSeparator(g, x0, len, it, act) {
  if (it.crown) {
    g.rows(x0, len, 'N');
    g.rows(x0, 1, 'G'); g.rows(x0 + len - 1, 1, 'G');
    drawIcon(g, ICONS.crown, x0 + 1, 34, {});
    drawIcon(g, ICONS.crown, x0 + 1, 10, {}); drawIcon(g, ICONS.crown, x0 + 1, 58, {});
    g.region(x0, len, { type: 'crown', season: it.season });
    return;
  }
  g.rows(x0, len, 'N');
  for (let y = 1; y < 72; y += 3) g.set(x0, y, 'W');
  g.region(x0, len, { type: 'sep', month: it.month, season: it.season });
}

function drawPanel(g, x0, len, m, isHeart, act, gold) {
  g.rows(x0, len, 'N');
  const frame = { W: 'R', D: 'W', L: 'B' }[m.result] || 'W';
  g.rows(x0, 2, frame); g.rows(x0 + len - 2, 2, frame);
  if (isHeart) {
    g.rows(x0 + 3, 1, gold); g.rows(x0 + len - 4, 1, gold);
  }
  const off = isHeart ? 6 : 4;
  // Schild mit Gegner-Kürzel (Platzhalter statt Vereinswappen)
  const sx = x0 + off, sy = 4;
  drawIcon(g, ICONS.shield, sx, sy, {});
  const abbr = clubAbbr(m.opp).slice(0, 3);
  drawTextCentered(g, abbr, sx + 1, 13, sy + 3, 'W', 1);
  // Ergebnis groß (Heimteam zuerst)
  const score = m.venue === 'A' ? `${m.oppGoals}:${m.fcbGoals}` : `${m.fcbGoals}:${m.oppGoals}`;
  const scx = sx + 17;
  const avail = x0 + len - off - scx;
  drawTextCentered(g, score, scx, avail, 6, 'W', 2);
  // Zeilen
  const inner0 = x0 + off, innerLen = len - 2 * off;
  const roundShort = shortRound(m);
  drawTextCentered(g, roundShort, inner0, innerLen, 22, 'W', 1);
  drawTextCentered(g, fmtDate(m.date), inner0, innerLen, 30, 'W', 1);
  // Motiv
  let icon = null;
  if (m.final && act.cup) icon = ICONS.cup;
  else if (m.titleClinch && act.plate) icon = ICONS.plate;
  else if (m.comp === 'CL') icon = ICONS.star;
  if (icon) drawIcon(g, icon, x0 + Math.floor((len - iconW(icon)) / 2), 38, { G: gold });
  else drawTextCentered(g, m.venue === 'H' ? 'HEIM' : m.venue === 'A' ? 'AUSWAERTS' : 'FINALE', inner0, innerLen, 40, 'R', 1);
  drawTextCentered(g, `NR ${m.nr}`, inner0, innerLen, 50, gold, 1);
  const city = transliterate(m.city).slice(0, 10);
  drawTextCentered(g, city, inner0, innerLen, 58, 'B', 1);
  if (isHeart) drawIcon(g, ICONS.heart, x0 + Math.floor((len - 5) / 2), 65, { R: 'R' });
  g.region(x0, len, { type: 'panel', game: m, heart: isHeart });
}

function shortRound(m) {
  const c = { BL: 'BL', DFB: 'DFB', CL: 'CL', SC: 'SUPERCUP' }[m.comp];
  if (m.final) return m.comp === 'DFB' ? 'POKALFINALE' : 'CL-FINALE';
  if (m.comp === 'SC') return 'SUPERCUP';
  if (m.comp === 'BL') return `BL ${m.round.split('.')[0]}`;
  const map = { 'Achtelfinale': 'AF', 'Viertelfinale': 'VF', 'Halbfinale': 'HF', '1. Runde': 'R1', '2. Runde': 'R2' };
  for (const [k, v] of Object.entries(map)) if (m.round.startsWith(k)) return `${c} ${v}`;
  return `${c} ${m.round.replace(/\D/g, '')}`.trim();
}

function drawHead(g, x0, len, { seasonText, act, gold, stats }) {
  g.rows(x0, len, 'N');
  g.rows(x0, 2, 'R'); g.rows(x0 + len - 2, 2, 'R');
  drawIcon(g, ICONS.roundel, x0 + 5, 29, {});
  const tx = x0 + 24, tl = len - 24 - 4;
  drawTextCentered(g, 'SAISON', tx, tl, 16, 'W', 1);
  drawTextCentered(g, seasonText, tx, tl, 24, act.decade ? 'G' : 'W', 2);
  if (act.decade) drawTextCentered(g, 'AUG-MAI', tx, tl, 38, 'G', 1);
  if (act.compBand) {
    const total = 4 * 5 + 3 * 2, sx = tx + Math.floor((tl - total) / 2);
    const has = stats.byComp;
    ['BL', 'DFB', 'CL', 'SC'].forEach((c, i) => drawIcon(g, ICONS.star, sx + i * 7, 48, { G: has[c] > 0 ? 'G' : 'B' }));
  }
  g.region(x0, len, { type: 'element', el: 'head' });
  return len;
}

function drawEndB(g, x0, len, { act, stats }) {
  g.rows(x0, len, 'N');
  g.rows(x0, 2, 'R'); g.rows(x0 + len - 2, 2, 'R');
  let x = x0 + 2;
  if (act.plate) {
    drawIcon(g, ICONS.plate, x + 4, 31, {});
    g.region(x0, len, { type: 'element', el: 'plate' });
    x += 18;
  }
  if (act.centurion) {
    const n = stats.total;
    const cx = x + 14, cy = 35, R = 12;
    for (let xx = x; xx < x + 29; xx++) for (let y = cy - R - 1; y <= cy + R + 1; y++) {
      const d = Math.hypot(xx - cx, y - cy);
      if (d <= R + 0.6 && d >= R - 1.6) g.set(xx, y, 'G');
    }
    drawTextCentered(g, String(n), x + 1, 27, 29, 'W', 1);
    drawTextCentered(g, 'SPIELE', x + 1, 27, 37, 'W', 1);
    g.region(x0, len, { type: 'element', el: 'centurion' });
  }
  return len;
}

/* ---- Rückseite --------------------------------------------------------- */
function buildBack(ctx) {
  const { profile, games, act, lengthCm, stats } = ctx;
  const L = lengthCm * ROWS_PER_CM;
  const g = new Grid(L);
  if (act.legend) drawRauten(g, 0, L);
  else { g.rows(0, L, 'N'); for (let x = 0; x < L; x += 14) g.rows(x, 1, 'R'); }
  g.region(0, L, { type: 'backBase' });

  const blocks = [];
  const box = (len, el, fn) => blocks.push({ len, el, fn });
  const name = transliterate(ctx.name || profile.name || 'FAN').slice(0, 10);

  if (act.backInfo) {
    const lines = [
      [name, 3], [`SAISON ${seasonLabel(ctx.season)}`, 1], [profile.code, 1],
      [`${stats.total} SPIELE`, 1], [`${stats.W} S  ${stats.D} U  ${stats.L} N`, 1],
    ];
    const w = Math.max(...lines.map(([t, s]) => textWidth(t, s))) + 10;
    box(w, 'backInfo', x => {
      textBox(g, x, w);
      drawTextCentered(g, lines[0][0], x, w, 8, 'W', 3);
      drawTextCentered(g, lines[1][0], x, w, 28, 'R', 1);
      drawTextCentered(g, lines[2][0], x, w, 36, 'B', 1);
      drawTextCentered(g, lines[3][0], x, w, 48, 'W', 1);
      drawTextCentered(g, lines[4][0], x, w, 56, 'W', 1);
    });
  }
  if (act.legend) {
    const w = textWidth('ALLESFAHRER', 2) + 12;
    box(w, 'legend', x => { textBox(g, x, w); drawTextCentered(g, 'ALLESFAHRER', x, w, 24, act.goldFringe ? 'G' : 'W', 2); drawTextCentered(g, `${stats.total} SPIELE`, x, w, 44, 'W', 1); });
  }
  if (act.km) {
    const km = stats.km.toLocaleString('de-DE').replace(/\./g, '.');
    const w = Math.max(textWidth(`${km} KM`, 2), textWidth('AUSWAERTS', 1)) + 10;
    box(w, 'km', x => { textBox(g, x, w); drawTextCentered(g, 'AUSWAERTS', x, w, 18, 'R', 1); drawTextCentered(g, `${km} KM`, x, w, 28, 'W', 2); drawTextCentered(g, `${stats.away} FAHRTEN`, x, w, 46, 'W', 1); });
  }
  if (act.countries) {
    const cs = [...stats.awayCountries];
    const rowsC = []; for (let i = 0; i < cs.length; i += 3) rowsC.push(cs.slice(i, i + 3).join(' '));
    const shown = rowsC.slice(0, 5);
    const w = Math.max(textWidth('LAENDER', 1), ...shown.map(t => textWidth(t, 1)), 20) + 10;
    box(w, 'countries', x => { textBox(g, x, w); drawTextCentered(g, 'LAENDER', x, w, 10, 'R', 1); shown.forEach((t, i) => drawTextCentered(g, t, x, w, 20 + i * 8, 'W', 1)); });
  }
  if (act.rings) {
    const max = Math.max(1, ...stats.months.values());
    const w = SEASON_MONTHS.length * 6 + 12;
    box(w, 'rings', x => {
      textBox(g, x, w);
      drawTextCentered(g, 'KALENDER', x, w, 8, 'R', 1);
      const sx = x + 7;
      SEASON_MONTHS.forEach((mo, i) => {
        const n = stats.months.get(mo) || 0;
        const h = n ? 2 + Math.round(34 * n / max) : 0;
        if (h) g.rect(sx + i * 6, sx + i * 6 + 3, 54 - h, 53, n === max ? 'G' : 'W');
        else g.rect(sx + i * 6, sx + i * 6 + 3, 53, 53, 'B');
        drawText(g, MONTH_SHORT[mo][0], sx + i * 6 + 1, 58, 'B', 1);
      });
    });
  }
  if (act.collection) {
    const w = 9 * 8 + 8;
    box(w, 'collection', x => {
      textBox(g, x, w);
      drawTextCentered(g, `GEGNER ${stats.blOpp.size}/17`, x, w, 10, 'R', 1);
      const opps = ctx.blOpponents || CURRENT_BL;
      opps.forEach((id, i) => {
        const row = i < 9 ? 0 : 1, col = i < 9 ? i : i - 9;
        const bx = x + 5 + col * 8 + (row ? 4 : 0), by = 22 + row * 14;
        const seen = stats.blOpp.has(id);
        g.rect(bx, bx + 5, by, by + 9, seen ? 'R' : 'N');
        g.rect(bx, bx + 5, by, by, 'W'); g.rect(bx, bx + 5, by + 9, by + 9, 'W'); g.rect(bx, bx, by, by + 9, 'W'); g.rect(bx + 5, bx + 5, by, by + 9, 'W');
      });
      drawTextCentered(g, 'GESEHEN', x, w, 52, 'W', 1);
    });
  }
  const ends = act.code ? 12 : 0;
  const sum = blocks.reduce((s, b) => s + b.len, 0);
  const free = L - 2 * ends - 4 - sum;
  const gap = Math.max(2, Math.floor(free / (blocks.length + 1)));
  let x = 2;
  hem(g, 0, 2);
  if (act.code) { drawCodeBand(g, x, profile.raw, ctx.season, { type: 'code', side: 'A' }); x += 12; }
  x += gap;
  for (const b of blocks) {
    if (x + b.len > L - ends - 2) break;
    b.fn(x); g.region(x, b.len, { type: 'element', el: b.el }); x += b.len + gap;
  }
  if (act.code) drawCodeBand(g, L - 14, profile.raw, ctx.season, { type: 'code', side: 'B' });
  hem(g, L - 2, 2);
  return finishModel(g, { L, lengthCm, back: true }, fringeColors(act));
}

function textBox(g, x, w) {
  g.rect(x, x + w - 1, 3, 68, 'N');
  g.rect(x, x + w - 1, 3, 3, 'W'); g.rect(x, x + w - 1, 68, 68, 'W');
  g.rect(x, x, 3, 68, 'W'); g.rect(x + w - 1, x + w - 1, 3, 68, 'W');
}

function finishModel(g, info, fringe) {
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < g.cells.length; i++) counts[g.cells[i]]++;
  return { L: g.L, W: g.W, cells: g.cells, ghost: g.ghost, regions: g.regions, info, fringe, counts };
}

function buildScarf(ctx) {
  return { front: buildFront(ctx), back: buildBack(ctx) };
}

// Garnfarben über beide Seiten + Fransen
function yarnUsage(scarf) {
  const used = new Set();
  const counts = [0, 0, 0, 0, 0];
  for (const side of [scarf.front, scarf.back]) side.counts.forEach((c, i) => { counts[i] += c; if (c) used.add(CI_KEYS[i]); });
  scarf.front.fringe.forEach(c => used.add(c));
  return { used: CI_KEYS.filter(k => used.has(k)), counts };
}

// Strickdatei: eine Zeile pro Reihe, ein Buchstabe pro Masche
function knitFile(scarf, meta) {
  const lines = [
    '# Stadion gestrickt – Strickdatei (Prototyp)',
    `# Fan-Code: ${meta.code} · Saison ${seasonLabel(meta.season)}`,
    `# Maße: ${meta.lengthCm} cm x 18 cm · ${scarf.front.L} Reihen x ${STITCHES} Maschen · Doppeljacquard`,
    `# Farben: ${Object.entries(YARN).map(([k, v]) => `${k}=${v.name} ${v.hex}`).join(', ')}`,
    `# Fransen: ${scarf.front.fringe.join('/')}`, '',
  ];
  for (const [label, side] of [['VORDERSEITE', scarf.front], ['RUECKSEITE', scarf.back]]) {
    lines.push(`## ${label}`);
    for (let x = 0; x < side.L; x++) {
      let row = '';
      for (let y = 0; y < STITCHES; y++) row += CI_KEYS[side.cells[x * STITCHES + y]];
      lines.push(`${String(x + 1).padStart(4, '0')} ${row}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
