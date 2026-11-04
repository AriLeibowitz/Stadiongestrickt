/* =========================================================================
   Stadion gestrickt – Muster-Generator (Ebenen-Design)
   Vorderseite: startet einfarbig rot. Jeder Meilenstein legt eine Ebene
                darüber (Streifen, Symbole, Musterbänder, Rauten, Gold).
   Rückseite:   persönliche Geschichte (KI-Highlights, Etikett, Statistik).
   Koordinaten: x = Reihe entlang der Schallänge (0 = Ende A),
                y = Masche quer über die Breite (0 = obere Kante).
   Jede Masche trägt ein Etikett (tag), damit „Schal lesen“ weiß,
   welches Element an dieser Stelle sitzt.
   ========================================================================= */
'use strict';

const STITCHES = 72;        // 18 cm Breite bei 4 Maschen/cm
const ROWS_PER_CM = 5;      // 5 Reihen pro cm (Maschen sind breiter als hoch)
const CI = { R: 0, W: 1, N: 2, B: 3, G: 4 };
const CI_KEYS = ['R', 'W', 'N', 'B', 'G'];
const PANEL_LEN = 42, HEART_LEN = 50;

/* ---- Feste Maße der Vorderseite (in Reihen ab jedem Ende) -------------- */
const FRONT = {
  rauten: [2, 13],          // Auswärts-Rauten
  stripeA: [16, 21],        // Endstreifen außen
  zone: [24, 115],          // Endfeld (Schriftzug, Symbole)
  stripeB: [118, 123],      // Endstreifen innen
  flood: [[125, 126], [145, 146]],
  starBand: [128, 143],
  bodyStart: 152,           // Beginn des Mittelteils
  bandLen: 16, bandPeriod: 48,
  medalR: 27,               // Medaillon-Radius in Maschen
  rautenHalf: 76,           // halbe Länge des Rauten-Mittelfelds
};
const ASPECT = 1.25;        // Reihen pro Masche für runde Formen (5 R/cm : 4 M/cm)

function transliterate(s) {
  return String(s).toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').replace(/É/g, 'E').replace(/[^A-Z0-9 :.\-\/+#·'×]/g, '');
}

class Grid {
  constructor(L) {
    this.L = L; this.W = STITCHES;
    this.cells = new Uint8Array(L * STITCHES);
    this.tags = new Uint16Array(L * STITCHES);
    this.tagList = [null]; this.pen = 0;
  }
  use(info) { this.tagList.push(info); this.pen = this.tagList.length - 1; return this.pen; }
  set(x, y, c) { if (x >= 0 && x < this.L && y >= 0 && y < this.W) { const i = x * this.W + y; this.cells[i] = CI[c]; this.tags[i] = this.pen; } }
  get(x, y) { return CI_KEYS[this.cells[x * this.W + y]]; }
  tagAt(x, y) { return this.tagList[this.tags[x * this.W + y]]; }
  rect(x0, x1, y0, y1, c) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) this.set(x, y, c); }
  rows(x0, len, c) { this.rect(x0, x0 + len - 1, 0, this.W - 1, c); }
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

function drawRauten(g, x0, len, y0 = 0, y1 = STITCHES - 1) {
  for (let x = x0; x < x0 + len; x++) for (let y = y0; y <= y1; y++) {
    const a = Math.floor((x + y) / 6), b = Math.floor((x - y + 600) / 6);
    g.set(x, y, (a + b) % 2 ? 'B' : 'W');
  }
}

/* Motive für die Streifenbänder ('1' = Motivfarbe) */
const MOTIFS = {
  mHearts: { color: 'R', icon: ['.11.11.', '1111111', '1111111', '.11111.', '..111..', '...1...'] },
  mCross: { color: 'N', icon: ['1...1', '.1.1.', '..1..', '.1.1.', '1...1'] },
  mSparks: { color: 'gold', icon: ['...1...', '.1.1.1.', '..111..', '1111111', '..111..', '.1.1.1.', '...1...'] },
  mArrows: { color: 'R', icon: ['..1..', '.111.', '11111', '..1..', '..1..'] },
  mDiamonds: { color: 'N', icon: ['...1...', '..1.1..', '.1...1.', '1..1..1', '.1...1.', '..1.1..', '...1...'] },
  mRain: { color: 'B', fn: (g, s, len, c) => { for (let x = s; x < s + len; x++) for (let y = 6; y < 66; y++) if ((x - s + y) % 5 === 0) g.set(x, y, c); } },
  mZigzag: { color: 'gold', fn: (g, s, len, c) => { for (let y = 5; y < 67; y++) { const t = y % 12, off = t < 6 ? t : 12 - t; g.rect(s + 4 + off, s + 5 + off, y, y, c); } } },
};

/* ---- Strickcode -------------------------------------------------------- */
const CODE_Y = 10, CODE_BITS = 53;
function seasonBits(season) { const v = season - FIRST_SEASON; return [4, 3, 2, 1, 0].map(b => (v >> b) & 1); }
function drawCodeBand(g, x0, raw, season, side) {
  // 12 Reihen: Start-Wächter 1101 | 40 Bit Fan-Code | 5 Bit Saison | End-Wächter 1011
  g.use({ type: 'code', side });
  g.rows(x0, 12, 'N');
  const bits = [1, 1, 0, 1, ...codeBits(raw), ...seasonBits(season), 1, 0, 1, 1];
  for (let x = x0 + 2; x < x0 + 10; x++) {
    bits.forEach((b, i) => g.set(x, CODE_Y + i, b ? 'W' : 'N'));
    g.set(x, CODE_Y - 2, 'R'); g.set(x, CODE_Y + CODE_BITS + 1, 'R');
  }
}
function decodeCodeBand(model) {
  for (let x = 0; x < model.L; x++) {
    const t = model.tagList[model.tags[x * STITCHES]];
    if (t && t.type === 'code') {
      const row = x + 5, bits = [];
      for (let i = 0; i < CODE_BITS; i++) bits.push(model.cells[row * STITCHES + CODE_Y + i] === CI.W ? 1 : 0);
      if (bits.slice(0, 4).join('') !== '1101' || bits.slice(49).join('') !== '1011') return null;
      const p = parseCode(bitsToCode(bits.slice(4, 44)));
      const season = FIRST_SEASON + bits.slice(44, 49).reduce((v, b) => (v << 1) | b, 0);
      return p.ok ? { code: p.code, season } : null;
    }
  }
  return null;
}

/* ---- Vorderseite ------------------------------------------------------- */
function goldAvailable(act) { return GOLD_ELEMENTS.some(k => act[k]); }

function buildFront(ctx) {
  const { act, stats, lengthCm, season } = ctx;
  const L = lengthCm * ROWS_PER_CM, C = Math.floor(L / 2);
  const g = new Grid(L);
  const goldOn = goldAvailable(act);
  const el = (id, extra) => g.use({ el: id, ...extra });
  // Spiegelung: d = Abstand vom jeweiligen Ende
  const span = (end, d0, d1) => end === 0 ? [d0, d1] : [L - 1 - d1, L - 1 - d0];
  const at = (end, d, w) => end === 0 ? d : L - d - w;   // Startreihe eines Objekts der Breite w
  const endRows = (end, d0, d1, c) => { const [a, b] = span(end, d0, d1); g.rect(a, b, 0, STITCHES - 1, c); };

  // Ebene 0: Vereinsrot
  el('base', { layer: 'body' }); g.rows(0, L, 'R');

  // Rauten-Mittelfeld
  if (act.rautenField) {
    el('rautenField');
    const h = Math.min(FRONT.rautenHalf, C - FRONT.bodyStart - 10);
    drawRauten(g, C - h, 2 * h);
    g.rect(C - h - 2, C - h - 1, 0, STITCHES - 1, 'W'); g.rect(C + h, C + h + 1, 0, STITCHES - 1, 'W');
  }

  // Streifenbänder im Mittelteil (symmetrisch zu beiden Enden)
  const motifs = MOTIF_ORDER.filter(id => act[id]);
  const bodyEnd = C - (act.rautenField ? FRONT.rautenHalf + 6 : FRONT.medalR * ASPECT + 8);
  const bodyLen = Math.max(0, bodyEnd - FRONT.bodyStart);
  // Mehr Muster als Bänder: Ende B bekommt die übrigen Muster (sonst symmetrisch)
  const nb = Math.max(1, Math.round(bodyLen / FRONT.bandPeriod), Math.min(Math.ceil(motifs.length / 2), Math.floor(bodyLen / (FRONT.bandLen + 10))));
  const bands = [];
  if (bodyLen > FRONT.bandLen + 4 && (act.blocks || motifs.length)) {
    for (let k = 0; k < nb; k++) {
      const c = FRONT.bodyStart + (k + 0.5) * bodyLen / nb;
      bands.push({ k, d: Math.round(c - FRONT.bandLen / 2) });
    }
  }
  for (const end of [0, 1]) for (const b of bands) {
    const s = at(end, b.d, FRONT.bandLen);
    const slot = end === 1 && motifs.length > nb ? b.k + nb : b.k;
    const motif = motifs.length ? motifs[slot % motifs.length] : null;
    el(act.blocks ? 'blocks' : motif, { layer: 'body' });
    g.rows(s, FRONT.bandLen, 'W');
    if (motif) {
      const m = MOTIFS[motif];
      const col = m.color === 'gold' ? (goldOn ? 'G' : 'R') : m.color;
      el(motif, { layer: 'body' });
      if (m.fn) m.fn(g, s, FRONT.bandLen, col);
      else {
        const w = m.icon[0].length, h = m.icon.length, step = h + 3;
        const n = Math.floor((60 + 3) / step), y0 = 6 + Math.floor((60 - (n * step - 3)) / 2);
        for (let i = 0; i < n; i++) drawIcon(g, m.icon, s + Math.floor((FRONT.bandLen - w) / 2), y0 + i * step, { 1: col });
      }
    }
    if (act.gold) { el('gold'); g.rows(s - 2, 1, 'G'); g.rows(s + FRONT.bandLen + 1, 1, 'G'); }
  }

  // Medaillon in der Mitte
  if (act.medal || act.cup || act.plate) {
    el(act.medal ? 'medal' : act.plate ? 'plate' : 'cup');
    const R = FRONT.medalR, cy = (STITCHES - 1) / 2, rx = Math.ceil(R * ASPECT) + 1;
    for (let x = C - rx; x <= C + rx; x++) for (let y = 0; y < STITCHES; y++) {
      const d = Math.hypot((x - C) / ASPECT, y - cy);
      if (d <= R - 3) g.set(x, y, 'N');
      else if (d <= R) g.set(x, y, goldOn ? 'G' : 'W');
    }
    const icons = [];
    if (act.plate) icons.push(['plate', ICONS.plate]);
    if (act.cup) icons.push(['cup', ICONS.cup]);
    const iw = icons.length * 9 + (icons.length - 1) * 3;
    const yIcon = act.medal ? 14 : 31;
    icons.forEach(([id, ic], i) => { el(id); drawIcon(g, ic, C - Math.floor(iw / 2) + i * 12, yIcon, { G: 'G' }); });
    if (act.medal) {
      el('medal');
      const yN = icons.length ? 26 : 23;
      drawTextCentered(g, String(stats.total), C - 20, 41, yN, 'W', 2);
      drawTextCentered(g, 'SPIELE', C - 20, 41, yN + 13, goldOn ? 'G' : 'W', 1);
    }
  }

  // Enden
  const dc = Math.round((FRONT.zone[0] + FRONT.zone[1]) / 2);
  for (const end of [0, 1]) {
    if (act.awayRauten) { el('awayRauten'); const [a, b] = span(end, ...FRONT.rauten); drawRauten(g, a, b - a + 1); }
    if (act.endStripes) { el('endStripes'); endRows(end, ...FRONT.stripeA, 'W'); endRows(end, ...FRONT.stripeB, 'W'); }
    if (act.starBand) {
      el('starBand'); endRows(end, ...FRONT.starBand, 'N');
      const [a] = span(end, ...FRONT.starBand);
      for (let y = 6; y < 64; y += 9) { drawIcon(g, ICONS.starSmall, a + 3, y, { W: 'W' }); drawIcon(g, ICONS.starSmall, a + 10, y + 4, { W: 'W' }); }
    }
    if (act.floodlight) { el('floodlight'); for (const f of FRONT.flood) endRows(end, ...f, 'G'); }
    if (act.fourStars) {
      el('fourStars');
      const w = 4 * 5 + 3 * 5;
      for (let i = 0; i < 4; i++) drawIcon(g, ICONS.star, at(end, dc - Math.floor(w / 2), w) + i * 10, 13, { G: 'G' });
    }
    if (act.season) {
      el(act.monthSeal ? 'monthSeal' : 'season');
      const t = seasonLabel(season), w = textWidth(t, 3);
      drawText(g, t, at(end, dc - Math.floor(w / 2), w), 21, act.monthSeal ? 'G' : 'W', 3);
    }
    if (act.monthSeal) {
      el('monthSeal');
      const t = 'AUG-MAI', w = textWidth(t, 1);
      drawText(g, t, at(end, dc - Math.floor(w / 2), w), 41, 'G', 1);
    }
    const syms = [];
    if (act.cupIcon) syms.push(['cupIcon', ICONS.cup, { G: 'W' }]);
    if (act.crown) syms.push(['crown', ICONS.crown, { G: 'G' }]);
    const sw = syms.reduce((s, x) => s + iconW(x[1]), 0) + Math.max(0, syms.length - 1) * 6;
    let sx = at(end, dc - Math.floor(sw / 2), sw);
    for (const [id, ic, map] of syms) { el(id); drawIcon(g, ic, sx, id === 'crown' ? 53 : 50, map); sx += iconW(ic) + 6; }
    if (act.stadiumDots) {
      el('stadiumDots');
      const n = Math.min(stats.stadiums.size, 22), w = n * 4 - 2;
      const x0 = at(end, dc - Math.floor(w / 2), w);
      for (let i = 0; i < n; i++) g.rect(x0 + i * 4, x0 + i * 4 + 1, 61, 62, 'W');
    }
  }

  // Längskanten
  if (act.awaySeam || act.tour) {
    el(act.tour ? 'tour' : 'awaySeam');
    for (let x = 0; x < L; x++) {
      if (x % 4 >= 2) continue;
      for (const y of [4, 67]) {
        const t = g.tagAt(x, y);
        if (!t || t.layer !== 'body') continue;
        g.set(x, y, act.tour ? 'G' : (g.get(x, y) === 'W' ? 'R' : 'W'));
      }
    }
  }
  if (act.border) { el('border'); g.rect(0, L - 1, 0, 1, 'W'); g.rect(0, L - 1, 70, 71, 'W'); }

  return finishModel(g, { L, lengthCm, bands: bands.length * 2, motifs }, fringeColors(act));
}

function fringeColors(act) {
  if (act.gold) return act.endStripes ? ['G', 'R'] : ['G', 'W'];
  if (act.endStripes) return ['R', 'W'];
  return ['W'];
}

/* ---- Highlight-Felder (Rückseite) ------------------------------------ */
function drawPanel(g, x0, len, m, isHeart, act, gold) {
  g.use({ type: 'panel', game: m, heart: isHeart });
  g.rows(x0, len, 'N');
  const frame = { W: 'R', D: 'W', L: 'B' }[m.result] || 'W';
  g.rows(x0, 2, frame); g.rows(x0 + len - 2, 2, frame);
  if (isHeart) { g.rows(x0 + 3, 1, gold); g.rows(x0 + len - 4, 1, gold); }
  const off = isHeart ? 6 : 4;
  const sx = x0 + off, sy = 4;
  drawIcon(g, ICONS.shield, sx, sy, {});
  drawTextCentered(g, clubAbbr(m.opp).slice(0, 3), sx + 1, 13, sy + 3, 'W', 1);
  const score = m.venue === 'A' ? `${m.oppGoals}:${m.fcbGoals}` : `${m.fcbGoals}:${m.oppGoals}`;
  const scx = sx + 17;
  drawTextCentered(g, score, scx, x0 + len - off - scx, 6, 'W', 2);
  const inner0 = x0 + off, innerLen = len - 2 * off;
  drawTextCentered(g, shortRound(m), inner0, innerLen, 22, 'W', 1);
  drawTextCentered(g, fmtDate(m.date), inner0, innerLen, 30, 'W', 1);
  let icon = null;
  if (m.final) icon = ICONS.cup;
  else if (m.titleClinch) icon = ICONS.plate;
  else if (m.comp === 'CL') icon = ICONS.star;
  if (icon) drawIcon(g, icon, x0 + Math.floor((len - iconW(icon)) / 2), 38, { G: gold });
  else drawTextCentered(g, m.venue === 'H' ? 'HEIM' : m.venue === 'A' ? 'AUSWAERTS' : 'FINALE', inner0, innerLen, 40, 'R', 1);
  drawTextCentered(g, `NR ${m.nr}`, inner0, innerLen, 50, gold, 1);
  drawTextCentered(g, transliterate(m.city).slice(0, 10), inner0, innerLen, 58, 'B', 1);
  if (isHeart) drawIcon(g, ICONS.heart, x0 + Math.floor((len - 5) / 2), 65, { R: 'R' });
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

function textBox(g, x, w) {
  g.rect(x, x + w - 1, 3, 68, 'N');
  g.rect(x, x + w - 1, 3, 3, 'W'); g.rect(x, x + w - 1, 68, 68, 'W');
  g.rect(x, x, 3, 68, 'W'); g.rect(x + w - 1, x + w - 1, 3, 68, 'W');
}

/* ---- Rückseite --------------------------------------------------------- */
function buildBack(ctx) {
  const { profile, act, lengthCm, stats, highlights } = ctx;
  const L = lengthCm * ROWS_PER_CM, C = Math.floor(L / 2);
  const g = new Grid(L);
  const goldOn = goldAvailable(act);
  const gold = goldOn ? 'G' : 'W';
  g.use({ type: 'backBase' });
  g.rows(0, L, 'N'); for (let x = 7; x < L; x += 14) g.rows(x, 1, 'R');

  // Info-Boxen: links und rechts der Highlights
  const left = [], right = [];
  const box = (list, w, el, fn) => list.push({ w, el, fn });
  const name = transliterate(ctx.name || profile.name || 'FAN').slice(0, 10);
  if (act.backInfo) {
    const lines = [[name, 3], [`SAISON ${seasonLabel(ctx.season)}`, 1], [profile.code, 1], [`${stats.total} SPIELE`, 1], [`${stats.W} S  ${stats.D} U  ${stats.L} N`, 1]];
    const w = Math.max(...lines.map(([t, s]) => textWidth(t, s))) + 10;
    box(left, w, 'backInfo', x => {
      textBox(g, x, w);
      drawTextCentered(g, lines[0][0], x, w, 8, 'W', 3);
      drawTextCentered(g, lines[1][0], x, w, 28, 'R', 1);
      drawTextCentered(g, lines[2][0], x, w, 36, 'B', 1);
      drawTextCentered(g, lines[3][0], x, w, 48, 'W', 1);
      drawTextCentered(g, lines[4][0], x, w, 56, 'W', 1);
    });
  }
  if (act.km) {
    const km = stats.km.toLocaleString('de-DE');
    const w = Math.max(textWidth(`${km} KM`, 2), textWidth('AUSWAERTS', 1)) + 10;
    box(left, w, 'km', x => { textBox(g, x, w); drawTextCentered(g, 'AUSWAERTS', x, w, 18, 'R', 1); drawTextCentered(g, `${km} KM`, x, w, 28, 'W', 2); drawTextCentered(g, `${stats.away} FAHRTEN`, x, w, 46, 'W', 1); });
  }
  if (act.countries) {
    const cs = [...stats.awayCountries];
    const rowsC = []; for (let i = 0; i < cs.length; i += 3) rowsC.push(cs.slice(i, i + 3).join(' '));
    const shown = rowsC.slice(0, 5);
    const w = Math.max(textWidth('LAENDER', 1), ...shown.map(t => textWidth(t, 1)), 20) + 10;
    box(left, w, 'countries', x => { textBox(g, x, w); drawTextCentered(g, 'LAENDER', x, w, 10, 'R', 1); shown.forEach((t, i) => drawTextCentered(g, t, x, w, 20 + i * 8, 'W', 1)); });
  }
  if (act.calendar) {
    const max = Math.max(1, ...stats.months.values());
    const w = SEASON_MONTHS.length * 6 + 12;
    box(right, w, 'calendar', x => {
      textBox(g, x, w);
      drawTextCentered(g, 'KALENDER', x, w, 8, 'R', 1);
      const sx = x + 7;
      SEASON_MONTHS.forEach((mo, i) => {
        const n = stats.months.get(mo) || 0;
        const h = n ? 2 + Math.round(34 * n / max) : 0;
        if (h) g.rect(sx + i * 6, sx + i * 6 + 3, 54 - h, 53, n === max ? gold : 'W');
        else g.rect(sx + i * 6, sx + i * 6 + 3, 53, 53, 'B');
        drawText(g, MONTH_SHORT[mo][0], sx + i * 6 + 1, 58, 'B', 1);
      });
    });
  }
  if (act.collection) {
    const w = 9 * 8 + 8;
    const opps = ctx.blOpponents || CURRENT_BL;
    box(right, w, 'collection', x => {
      textBox(g, x, w);
      drawTextCentered(g, `GEGNER ${stats.blOpp.size}/17`, x, w, 10, 'R', 1);
      opps.forEach((id, i) => {
        const row = i < 9 ? 0 : 1, col = i < 9 ? i : i - 9;
        const bx = x + 5 + col * 8 + (row ? 4 : 0), by = 22 + row * 14;
        g.rect(bx, bx + 5, by, by + 9, stats.blOpp.has(id) ? 'R' : 'N');
        g.rect(bx, bx + 5, by, by, 'W'); g.rect(bx, bx + 5, by + 9, by + 9, 'W'); g.rect(bx, bx, by, by + 9, 'W'); g.rect(bx + 5, bx + 5, by, by + 9, 'W');
      });
      drawTextCentered(g, 'GESEHEN', x, w, 52, 'W', 1);
    });
  }
  if (act.rautenField) {
    const w = textWidth('ALLESFAHRER', 1) + 14;
    box(right, w, 'rautenField', x => { textBox(g, x, w); drawRauten(g, x + 2, w - 4, 5, 18); drawRauten(g, x + 2, w - 4, 53, 66); drawTextCentered(g, 'ALLESFAHRER', x, w, 28, gold, 1); drawTextCentered(g, `${stats.total}`, x, w, 37, 'W', 1); });
  }

  // Highlights: Herzstück in der Mitte, die übrigen chronologisch links/rechts
  const hl = act.highlights ? highlights.slice(0, 5) : [];
  let hlStart = C, hlEnd = C;
  if (hl.length) {
    const heart = hl[0];
    const side = hl.slice(1).sort((a, b) => a.date.localeCompare(b.date));
    const nA = Math.ceil(side.length / 2);
    const hA = side.slice(0, nA), hB = side.slice(nA);
    const h0 = C - Math.floor(HEART_LEN / 2);
    drawPanel(g, h0, HEART_LEN, heart, true, act, gold);
    hlStart = h0; hlEnd = h0 + HEART_LEN;
    for (let i = hA.length - 1; i >= 0; i--) { hlStart -= PANEL_LEN + 3; drawPanel(g, hlStart, PANEL_LEN, hA[i], false, act, gold); }
    for (const m of hB) { hlEnd += 3; drawPanel(g, hlEnd, PANEL_LEN, m, false, act, gold); hlEnd += PANEL_LEN; }
  }

  const ends = act.code ? 14 : 2;
  const place = (list, a, b) => {
    const items = list.slice();
    while (items.length && items.reduce((s, it) => s + it.w, 0) + 4 * (items.length + 1) > b - a) items.pop();
    const free = (b - a) - items.reduce((s, it) => s + it.w, 0);
    const gap = Math.floor(free / (items.length + 1));
    let x = a + gap;
    for (const it of items) { g.use({ el: it.el }); it.fn(x); x += it.w + gap; }
    return list.length - items.length;
  };
  const dropped = place(left, ends, hlStart) + place(right, hlEnd, L - ends);
  if (act.code) { drawCodeBand(g, 2, profile.raw, ctx.season, 'A'); drawCodeBand(g, L - 14, profile.raw, ctx.season, 'B'); }
  return finishModel(g, { L, lengthCm, back: true, dropped }, fringeColors(act));
}

function finishModel(g, info, fringe) {
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < g.cells.length; i++) counts[g.cells[i]]++;
  return { L: g.L, W: g.W, cells: g.cells, tags: g.tags, tagList: g.tagList, info, fringe, counts };
}

function buildScarf(ctx) { return { front: buildFront(ctx), back: buildBack(ctx) }; }

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
