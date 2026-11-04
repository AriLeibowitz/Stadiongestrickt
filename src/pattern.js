/* =========================================================================
   Stadion gestrickt – Muster-Generator
   Feines Maschenraster (6 Maschen/cm quer, 8 Reihen/cm längs). Schrift und
   Symbole werden als Vektoren in Zentimetern gezeichnet und auf das Raster
   übertragen (eine Garnfarbe pro Masche, keine Zwischentöne).
   Vorderseite: startet einfarbig rot, Meilensteine legen Ebenen darüber.
   Rückseite:   rot (oder nachtblau), KI-Highlights, Etikett, Statistik.
   x = Reihe entlang der Länge (0 = Ende A), y = Masche quer (0 = obere Kante).
   ========================================================================= */
'use strict';

const ROWS_PER_CM = 8, ST_PER_CM = 6, WIDTH_CM = 18;
const STITCHES = WIDTH_CM * ST_PER_CM;   // 108
const CI = { R: 0, W: 1, N: 2, B: 3, G: 4 };
const CI_KEYS = ['R', 'W', 'N', 'B', 'G'];
const SCARF_FONT = '"ScarfFont", "Barlow Condensed", Impact, "Arial Narrow", sans-serif';

/* ---- Lage der Vorderseiten-Ebenen (cm ab jedem Ende) ------------------- */
const FRONT = {
  rauten: [0.4, 2.6], stripeA: [3.0, 3.8], stripeB: [19.4, 20.2],
  zoneC: 11.6, starBand: [21.0, 24.2], bodyStart: 26, bandLen: 3, bandPeriod: 9,
  centerHalf: 15.5, medalR: 7.4, rautenHalf: 14,
};

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
}

/* ---- Rasterisierung: Vektorzeichnung in cm → Maschen -------------------- */
let _rasterCanvas = null;
class Raster {
  constructor(g) {
    this.g = g; this.Lcm = g.L / ROWS_PER_CM;
    if (!_rasterCanvas) _rasterCanvas = document.createElement('canvas');
    const cv = _rasterCanvas;
    if (cv.width !== g.L || cv.height !== g.W) { cv.width = g.L; cv.height = g.W; }
    this.ctx = cv.getContext('2d', { willReadFrequently: true });
  }
  // fn(ctx) zeichnet in cm (u entlang, v quer). [u0, u1] begrenzt den Bereich (schneller).
  paint(color, fn, u0 = 0, u1 = this.Lcm) {
    const { ctx, g } = this;
    const x0 = Math.max(0, Math.floor(u0 * ROWS_PER_CM) - 2), x1 = Math.min(g.L, Math.ceil(u1 * ROWS_PER_CM) + 2), w = x1 - x0;
    if (w <= 0) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(x0, 0, w, g.W);
    ctx.setTransform(ROWS_PER_CM, 0, 0, ST_PER_CM, 0, 0);
    ctx.fillStyle = ctx.strokeStyle = '#fff';
    ctx.save(); ctx.beginPath(); fn(ctx); ctx.restore();
    const d = ctx.getImageData(x0, 0, w, g.W).data;
    for (let y = 0; y < g.W; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] >= 128) g.set(x0 + x, y, color);
  }
  rect(color, u0, u1, v0, v1) { this.paint(color, c => c.fillRect(u0, v0, u1 - u0, v1 - v0), u0, u1); }
  // Text mit Großbuchstaben-Höhe h (cm), zentriert auf (u, v), höchstens maxW breit
  text(color, str, u, v, h, maxW = 99) {
    const s = String(str).toUpperCase();
    const fs = h / 0.7;
    let wCm = 0;
    this.paint(color, c => {
      c.scale(1 / ST_PER_CM, 1 / ST_PER_CM);
      c.font = `700 ${fs * ST_PER_CM}px ${SCARF_FONT}`;
      const m = c.measureText(s);
      // Schrift ist in Einheiten von 1/6 cm angelegt → Breite in cm = width / 6
      const natW = m.width / ST_PER_CM;
      const sx = Math.min(1, maxW / natW);
      wCm = natW * sx;
      c.translate(u * ST_PER_CM, v * ST_PER_CM);
      c.scale(sx, 1);
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
      c.fillText(s, 0, (asc - desc) / 2);
    }, u - maxW / 2 - 1, u + maxW / 2 + 1);
    return wCm;
  }
}

/* ---- Vektor-Symbole (Mittelpunkt u, v; Größe in cm) --------------------- */
const SHAPES = {
  star(c, u, v, r) {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
      const p = [u + Math.cos(a) * rr, v + Math.sin(a) * rr];
      i ? c.lineTo(...p) : c.moveTo(...p);
    }
    c.closePath(); c.fill();
  },
  heart(c, u, v, s) {
    c.moveTo(u, v + s * 0.45);
    c.bezierCurveTo(u - s * 0.9, v - s * 0.1, u - s * 0.45, v - s * 0.75, u, v - s * 0.3);
    c.bezierCurveTo(u + s * 0.45, v - s * 0.75, u + s * 0.9, v - s * 0.1, u, v + s * 0.45);
    c.fill();
  },
  cross(c, u, v, s) { c.lineWidth = s * 0.28; c.lineCap = 'square'; c.moveTo(u - s / 2, v - s / 2); c.lineTo(u + s / 2, v + s / 2); c.moveTo(u + s / 2, v - s / 2); c.lineTo(u - s / 2, v + s / 2); c.stroke(); },
  arrow(c, u, v, s) { c.moveTo(u, v - s / 2); c.lineTo(u + s * 0.45, v); c.lineTo(u + s * 0.17, v); c.lineTo(u + s * 0.17, v + s / 2); c.lineTo(u - s * 0.17, v + s / 2); c.lineTo(u - s * 0.17, v); c.lineTo(u - s * 0.45, v); c.closePath(); c.fill(); },
  diamond(c, u, v, s) { c.lineWidth = s * 0.2; c.moveTo(u, v - s / 2); c.lineTo(u + s / 2, v); c.lineTo(u, v + s / 2); c.lineTo(u - s / 2, v); c.closePath(); c.stroke(); c.beginPath(); c.arc(u, v, s * 0.1, 0, 7); c.fill(); },
  spark(c, u, v, s) {
    c.lineWidth = s * 0.14; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4, d = i % 2 ? s * 0.32 : s * 0.5; c.moveTo(u - Math.cos(a) * d, v - Math.sin(a) * d); c.lineTo(u + Math.cos(a) * d, v + Math.sin(a) * d); }
    c.stroke();
  },
  cup(c, u, v, h) { // Pokal, Höhe h
    const w = h * 0.62, t = v - h / 2;
    c.moveTo(u - w / 2, t); c.lineTo(u + w / 2, t);
    c.quadraticCurveTo(u + w / 2, t + h * 0.55, u + w * 0.1, t + h * 0.62);
    c.lineTo(u + w * 0.1, t + h * 0.8); c.lineTo(u + w * 0.32, t + h * 0.86); c.lineTo(u + w * 0.32, t + h); c.lineTo(u - w * 0.32, t + h); c.lineTo(u - w * 0.32, t + h * 0.86); c.lineTo(u - w * 0.1, t + h * 0.8); c.lineTo(u - w * 0.1, t + h * 0.62);
    c.quadraticCurveTo(u - w / 2, t + h * 0.55, u - w / 2, t); c.fill();
    c.beginPath(); c.lineWidth = h * 0.08;
    c.ellipse(u - w / 2, t + h * 0.2, w * 0.2, h * 0.14, 0, Math.PI * 0.5, Math.PI * 1.5);
    c.moveTo(u + w / 2, t + h * 0.06); c.ellipse(u + w / 2, t + h * 0.2, w * 0.2, h * 0.14, 0, -Math.PI * 0.5, Math.PI * 0.5); c.stroke();
  },
  plate(c, u, v, r) { c.lineWidth = r * 0.16; c.arc(u, v, r * 0.92, 0, 7); c.stroke(); c.beginPath(); c.arc(u, v, r * 0.55, 0, 7); c.stroke(); c.beginPath(); c.arc(u, v, r * 0.2, 0, 7); c.fill(); },
  crown(c, u, v, w) {
    const h = w * 0.6, l = u - w / 2, b = v + h / 2, t = v - h / 2;
    c.moveTo(l, b); c.lineTo(l, t + h * 0.1); c.lineTo(l + w * 0.25, t + h * 0.55); c.lineTo(u, t); c.lineTo(l + w * 0.75, t + h * 0.55); c.lineTo(l + w, t + h * 0.1); c.lineTo(l + w, b); c.closePath(); c.fill();
  },
  shield(c, u, v, w) {
    const h = w * 1.2, t = v - h / 2;
    c.moveTo(u - w / 2, t); c.lineTo(u + w / 2, t); c.lineTo(u + w / 2, t + h * 0.55);
    c.quadraticCurveTo(u + w / 2, t + h * 0.85, u, t + h); c.quadraticCurveTo(u - w / 2, t + h * 0.85, u - w / 2, t + h * 0.55); c.closePath(); c.fill();
  },
};

// Bayerische Rauten im Rechteck: schräges Schachbrett aus blauen und weißen Rauten,
// direkt im Maschenraster berechnet (gestochen scharf)
function paintRauten(r, u0, u1, v0, v1, s = 1.1) {
  const g = r.g, su = s * 0.62, sv = s * 0.95, shear = 0.42;
  const x0 = Math.max(0, Math.round(u0 * ROWS_PER_CM)), x1 = Math.min(g.L, Math.round(u1 * ROWS_PER_CM));
  const y0 = Math.max(0, Math.round(v0 * ST_PER_CM)), y1 = Math.min(g.W, Math.round(v1 * ST_PER_CM));
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) {
    const u = (x + 0.5) / ROWS_PER_CM, v = (y + 0.5) / ST_PER_CM, uu = u + v * shear;
    const a = Math.floor(uu / su + v / sv), b = Math.floor(uu / su - v / sv);
    g.set(x, y, ((a + b) % 2 + 2) % 2 ? 'B' : 'W');
  }
}

/* ---- Strickcode (direkt im Raster) -------------------------------------- */
const CODE_BITS = 53, CODE_Y = 1;
function seasonBits(season) { const v = season - FIRST_SEASON; return [4, 3, 2, 1, 0].map(b => (v >> b) & 1); }
function drawCodeBand(g, x0, raw, season, side) {
  // 12 Reihen: Start 1101 | 40 Bit Fan-Code | 5 Bit Saison | Ende 1011, je 2 Maschen
  g.use({ type: 'code', side });
  g.rect(x0, x0 + 11, 0, STITCHES - 1, 'N');
  const bits = [1, 1, 0, 1, ...codeBits(raw), ...seasonBits(season), 1, 0, 1, 1];
  for (let x = x0 + 2; x < x0 + 10; x++) bits.forEach((b, i) => { if (b) { g.set(x, CODE_Y + i * 2, 'W'); g.set(x, CODE_Y + i * 2 + 1, 'W'); } });
}
function decodeCodeBand(model) {
  for (let x = 0; x < model.L; x++) {
    const t = model.tagList[model.tags[x * STITCHES]];
    if (t && t.type === 'code') {
      const row = x + 5, bits = [];
      for (let i = 0; i < CODE_BITS; i++) bits.push(model.cells[row * STITCHES + CODE_Y + i * 2] === CI.W ? 1 : 0);
      if (bits.slice(0, 4).join('') !== '1101' || bits.slice(49).join('') !== '1011') return null;
      const p = parseCode(bitsToCode(bits.slice(4, 44)));
      const season = FIRST_SEASON + bits.slice(44, 49).reduce((v, b) => (v << 1) | b, 0);
      return p.ok ? { code: p.code, season } : null;
    }
  }
  return null;
}

/* ---- Motive der Streifenbänder ----------------------------------------- */
const MOTIFS = {
  mHearts: { color: 'R', shape: 'heart', size: 2.0 },
  mCross: { color: 'N', shape: 'cross', size: 1.4 },
  mSparks: { color: 'gold', shape: 'spark', size: 2.0 },
  mArrows: { color: 'R', shape: 'arrow', size: 1.9 },
  mDiamonds: { color: 'N', shape: 'diamond', size: 2.0 },
  mRain: { color: 'B', fn: (c, s, len) => { c.lineWidth = 0.22; c.rect(s, 0.9, len, 16.2); c.clip(); c.beginPath(); for (let k = -20; k < 20; k++) { c.moveTo(s + k * 0.9, 0.9); c.lineTo(s + k * 0.9 + 4, 17.1); } c.stroke(); } },
  mZigzag: { color: 'gold', fn: (c, s, len) => { c.lineWidth = 0.4; c.lineJoin = 'miter'; c.moveTo(s + 0.6, 1.2); for (let i = 1; i <= 10; i++) c.lineTo(i % 2 ? s + len - 0.6 : s + 0.6, 1.2 + i * 1.56); c.stroke(); } },
};

/* ---- Vorderseite ------------------------------------------------------- */
function goldAvailable(act) { return GOLD_ELEMENTS.some(k => act[k]); }

function buildFront(ctx) {
  const { act, stats, lengthCm, season } = ctx;
  const L = lengthCm * ROWS_PER_CM, C = lengthCm / 2;
  const g = new Grid(L), r = new Raster(g);
  const goldOn = goldAvailable(act);
  const el = (id, extra) => g.use({ el: id, ...extra });
  const uOf = (end, d) => end === 0 ? d : lengthCm - d;              // Position ab Ende
  const band = (end, a, b) => end === 0 ? [a, b] : [lengthCm - b, lengthCm - a];

  el('base', { layer: 'body' }); g.rect(0, L - 1, 0, STITCHES - 1, 'R');

  if (act.rautenField) {
    el('rautenField');
    paintRauten(r, C - FRONT.rautenHalf, C + FRONT.rautenHalf, 0, WIDTH_CM);
    r.rect('W', C - FRONT.rautenHalf - 0.6, C - FRONT.rautenHalf, 0, WIDTH_CM);
    r.rect('W', C + FRONT.rautenHalf, C + FRONT.rautenHalf + 0.6, 0, WIDTH_CM);
  }

  // Streifenbänder (symmetrisch)
  const motifs = MOTIF_ORDER.filter(id => act[id]);
  const bodyLen = C - FRONT.centerHalf - FRONT.bodyStart;
  const nb = Math.max(1, Math.round(bodyLen / FRONT.bandPeriod), Math.min(Math.ceil(motifs.length / 2), Math.floor(bodyLen / (FRONT.bandLen + 2))));
  if (act.blocks || motifs.length) {
    for (let k = 0; k < nb; k++) {
      const dMid = FRONT.bodyStart + (k + 0.5) * bodyLen / nb;
      for (const end of [0, 1]) {
        const s = uOf(end, dMid) - FRONT.bandLen / 2, e = s + FRONT.bandLen;
        const slot = end === 1 && motifs.length > nb ? k + nb : k;
        const motif = motifs.length ? motifs[slot % motifs.length] : null;
        el(act.blocks ? 'blocks' : motif, { layer: 'body' }); r.rect('W', s, e, 0, WIDTH_CM);
        if (motif) {
          const m = MOTIFS[motif], col = m.color === 'gold' ? (goldOn ? 'G' : 'R') : m.color;
          el(motif, { layer: 'body' });
          if (m.fn) r.paint(col, c => m.fn(c, s, FRONT.bandLen), s, e);
          else r.paint(col, c => { for (let i = 0; i < 5; i++) { c.beginPath(); SHAPES[m.shape](c, s + FRONT.bandLen / 2, 2.2 + i * 3.4, m.size); } }, s, e);
        }
        if (act.gold) { el('gold'); r.rect('G', s - 0.65, s - 0.35, 0, WIDTH_CM); r.rect('G', e + 0.35, e + 0.65, 0, WIDTH_CM); }
      }
    }
  }

  // Medaillon
  if (act.medal || act.cup || act.plate) {
    const R = FRONT.medalR, cv = WIDTH_CM / 2;
    el(act.medal ? 'medal' : act.plate ? 'plate' : 'cup');
    r.paint(goldOn ? 'G' : 'W', c => { c.arc(C, cv, R, 0, 7); c.fill(); }, C - R, C + R);
    r.paint('N', c => { c.arc(C, cv, R - 0.55, 0, 7); c.fill(); }, C - R, C + R);
    const icons = [act.plate && 'plate', act.cup && 'cup'].filter(Boolean);
    const vi = act.medal ? 4.6 : cv;
    icons.forEach((id, i) => {
      el(id);
      const u = C + (i - (icons.length - 1) / 2) * 3.4;
      r.paint('G', c => id === 'plate' ? SHAPES.plate(c, u, vi, act.medal ? 1.35 : 2.2) : SHAPES.cup(c, u, vi, act.medal ? 2.6 : 4.2), u - 3, u + 3);
    });
    if (act.medal) {
      el('medal');
      const vn = icons.length ? 9.6 : 8.4;
      r.text('W', String(stats.total), C, vn, icons.length ? 3.6 : 4.6, 9);
      r.text(goldOn ? 'G' : 'W', 'SPIELE', C, vn + (icons.length ? 3.4 : 4.1), 1.15, 8);
    }
  }

  // Enden
  for (const end of [0, 1]) {
    const uc = uOf(end, FRONT.zoneC);
    if (act.awayRauten) { el('awayRauten'); const [a, b] = band(end, ...FRONT.rauten); paintRauten(r, a, b, 0, WIDTH_CM, 1.0); }
    if (act.endStripes) { el('endStripes'); for (const st of [FRONT.stripeA, FRONT.stripeB]) { const [a, b] = band(end, ...st); r.rect('W', a, b, 0, WIDTH_CM); } }
    if (act.starBand) {
      el('starBand'); const [a, b] = band(end, ...FRONT.starBand);
      r.rect('N', a, b, 0, WIDTH_CM);
      r.paint('W', c => { for (let i = 0; i < 6; i++) { c.beginPath(); SHAPES.star(c, a + 1.0, 1.6 + i * 3.0, 0.62); c.beginPath(); SHAPES.star(c, a + 2.2, 3.1 + i * 3.0, 0.62); } }, a, b);
      if (act.gold) { el('gold'); r.rect('G', a - 0.5, a - 0.25, 0, WIDTH_CM); r.rect('G', b + 0.25, b + 0.5, 0, WIDTH_CM); }
    }
    if (act.fourStars) { el('fourStars'); r.paint('G', c => { for (let i = 0; i < 4; i++) { c.beginPath(); SHAPES.star(c, uc + (i - 1.5) * 2.3, 2.75, 0.9); } }, uc - 5, uc + 5); }
    if (act.season) { el(act.gold ? 'gold' : 'season'); r.text(act.gold ? 'G' : 'W', seasonLabel(season), uc, 7.9, 5.4, 13.4); }
    if (act.monthSeal) { el('monthSeal'); r.text('G', 'AUG – MAI', uc, 12.2, 1.15, 10); }
    const syms = [act.cupIcon && 'cupIcon', act.crown && 'crown'].filter(Boolean);
    syms.forEach((id, i) => {
      el(id);
      const u = uc + (i - (syms.length - 1) / 2) * 3.6;
      r.paint(id === 'crown' ? 'G' : 'W', c => id === 'crown' ? SHAPES.crown(c, u, 14.6, 2.6) : SHAPES.cup(c, u, 14.6, 2.3), u - 2, u + 2);
    });
    if (act.stadiumDots) {
      el('stadiumDots');
      const n = Math.min(stats.stadiums.size, 22), w = (n - 1) * 0.6;
      r.paint('W', c => { for (let i = 0; i < n; i++) { c.moveTo(uc - w / 2 + i * 0.6 + 0.22, 16.75); c.arc(uc - w / 2 + i * 0.6, 16.75, 0.22, 0, 7); } c.fill(); }, uc - 8, uc + 8);
    }
  }

  // Längskanten
  if (act.awaySeam || act.tour) {
    el(act.tour ? 'tour' : 'awaySeam');
    const dash = ROWS_PER_CM / 2;
    for (let x = 0; x < L; x++) {
      if (Math.floor(x / dash) % 2) continue;
      for (const y of [5, 6, 101, 102]) {
        const t = g.tagAt(x, y);
        if (!t || t.layer !== 'body') continue;
        g.set(x, y, act.tour ? 'G' : (g.get(x, y) === 'W' ? 'R' : 'W'));
      }
    }
  }
  if (act.border) { el('border'); g.rect(0, L - 1, 0, 2, 'W'); g.rect(0, L - 1, STITCHES - 3, STITCHES - 1, 'W'); }

  return finishModel(g, { L, lengthCm, motifs }, fringeColors(act));
}

function fringeColors(act) {
  if (act.tour) return ['G', 'R'];
  const base = act.fringeRW ? ['R', 'W'] : ['W'];
  return act.gold ? [...base, base[0], 'G'] : base;
}

/* ---- Rückseite --------------------------------------------------------- */
const HL_LEN = 10.5, HEART_LEN = 13, HL_GAP = 1;

function frame(r, color, u0, u1, t = 0.35) {
  r.paint(color, c => { c.rect(u0, 0.8, u1 - u0, WIDTH_CM - 1.6); c.rect(u0 + t, 0.8 + t, u1 - u0 - 2 * t, WIDTH_CM - 1.6 - 2 * t); c.fill('evenodd'); }, u0, u1);
}

function drawPanel(g, r, u0, len, m, isHeart, gold, bg) {
  g.use({ type: 'panel', game: m, heart: isHeart });
  const u1 = u0 + len, uc = u0 + len / 2;
  frame(r, isHeart ? gold : 'W', u0, u1, isHeart ? 0.5 : 0.35);
  if (isHeart) frame(r, 'W', u0 + 0.8, u1 - 0.8, 0.2);
  // Gegner-Schild (neutral, kein Vereinswappen) + Ergebnis
  const su = u0 + (isHeart ? 2.6 : 2.2);
  r.paint('W', c => SHAPES.shield(c, su, 3.1, 2.4), su - 2, su + 2);
  r.text(bg, clubAbbr(m.opp).slice(0, 3), su, 2.7, 0.75, 2.0);
  const score = m.venue === 'A' ? `${m.oppGoals}:${m.fcbGoals}` : `${m.fcbGoals}:${m.oppGoals}`;
  r.text('W', score, (su + 1.4 + u1 - 0.8) / 2, 3.1, 2.4, u1 - su - 2.4);
  r.text('W', shortRound(m), uc, 6.6, 1.25, len - 1.6);
  r.text('W', fmtDateLong(m.date), uc, 8.6, 1.1, len - 1.6);
  if (m.final) r.paint(gold, c => SHAPES.cup(c, uc, 11.1, 2.6), uc - 2, uc + 2);
  else if (m.titleClinch) r.paint(gold, c => SHAPES.plate(c, uc, 11.1, 1.3), uc - 2, uc + 2);
  else if (m.comp === 'CL') r.paint('W', c => SHAPES.star(c, uc, 11.1, 1.2), uc - 2, uc + 2);
  else r.text(bg === 'N' ? 'B' : 'N', m.venue === 'H' ? 'HEIM' : m.venue === 'A' ? 'AUSWÄRTS' : 'FINALE', uc, 11.1, 1.05, len - 1.6);
  r.text(gold, `NR. ${m.nr}`, uc, 13.4, 1.0, len - 2);
  r.text('W', m.city, uc, 15.3, 1.0, len - 1.6);
  if (isHeart) r.paint(bg === 'R' ? 'W' : 'R', c => SHAPES.heart(c, uc, 16.6, 1.1), uc - 1, uc + 1);
}

function shortRound(m) {
  if (m.final) return m.comp === 'DFB' ? 'POKALFINALE' : 'CL-FINALE';
  if (m.comp === 'SC') return 'SUPERCUP';
  if (m.comp === 'BL') return `${m.round.split('.')[0]}. SPIELTAG`;
  const c = m.comp === 'CL' ? 'CL' : 'POKAL';
  const map = { 'Achtelfinale': 'ACHTELFINALE', 'Viertelfinale': 'VIERTELFINALE', 'Halbfinale': 'HALBFINALE', '1. Runde': '1. RUNDE', '2. Runde': '2. RUNDE' };
  for (const [k, v] of Object.entries(map)) if (m.round.startsWith(k)) return `${c} ${v}`;
  return `${c} ${m.round.replace(/\D/g, '')}. SPIEL`;
}

function buildBack(ctx) {
  const { profile, act, lengthCm, stats, highlights } = ctx;
  const L = lengthCm * ROWS_PER_CM, C = lengthCm / 2;
  const g = new Grid(L), r = new Raster(g);
  const gold = goldAvailable(act) ? 'G' : 'W';
  const bg = act.night ? 'N' : 'R';
  g.use(act.night ? { el: 'night' } : { type: 'backBase' });
  g.rect(0, L - 1, 0, STITCHES - 1, bg);

  const left = [], right = [];
  const box = (list, w, id, fn) => list.push({ w, id, fn });
  if (act.backInfo) box(left, 17, 'backInfo', u0 => {
    frame(r, 'W', u0, u0 + 17);
    r.text('W', ctx.name || profile.name || 'FAN', u0 + 8.5, 4.6, 3.4, 14.5);
    r.text(bg === 'R' ? 'N' : 'R', `SAISON ${seasonLabel(ctx.season)}`, u0 + 8.5, 8.4, 1.25, 14);
    r.text('W', profile.code, u0 + 8.5, 10.6, 1.0, 14);
    r.text('W', `${stats.total} SPIELE`, u0 + 8.5, 13.0, 1.25, 14);
    r.text('W', `${stats.W} S · ${stats.D} U · ${stats.L} N`, u0 + 8.5, 15.2, 1.05, 14);
  });
  if (act.travel) box(left, 13, 'travel', u0 => {
    frame(r, 'W', u0, u0 + 13);
    r.text(bg === 'R' ? 'N' : 'R', 'AUSWÄRTS', u0 + 6.5, 3.0, 1.05, 11);
    r.text('W', `${stats.km.toLocaleString('de-DE')} KM`, u0 + 6.5, 5.9, 2.0, 11.6);
    r.text('W', `${stats.away} FAHRTEN`, u0 + 6.5, 8.6, 1.0, 11);
    const cs = [...stats.awayCountries];
    for (let i = 0; i < Math.min(3, Math.ceil(cs.length / 3)); i++) r.text('W', cs.slice(i * 3, i * 3 + 3).join(' '), u0 + 6.5, 11.4 + i * 2, 1.15, 11);
    if (!cs.length) r.text('W', 'DEUTSCHLAND', u0 + 6.5, 11.4, 1.0, 11);
  });
  if (act.calendar) box(right, 12.5, 'calendar', u0 => {
    frame(r, 'W', u0, u0 + 12.5);
    r.text(bg === 'R' ? 'N' : 'R', 'KALENDER', u0 + 6.25, 2.9, 1.05, 10);
    const max = Math.max(1, ...stats.months.values());
    SEASON_MONTHS.forEach((mo, i) => {
      const n = stats.months.get(mo) || 0, u = u0 + 1.3 + i * 1.03, h = n ? 0.4 + 8.6 * n / max : 0.2;
      r.rect(n === max ? gold : 'W', u, u + 0.72, 14.0 - h, 14.0);
      r.text('W', MONTH_SHORT[mo][0], u + 0.36, 15.5, 0.8, 1);
    });
  });
  if (act.collection) box(right, 14, 'collection', u0 => {
    frame(r, 'W', u0, u0 + 14);
    r.text(bg === 'R' ? 'N' : 'R', `GEGNER ${stats.blOpp.size}/17`, u0 + 7, 2.9, 1.05, 12);
    (ctx.blOpponents || CURRENT_BL).forEach((id, i) => {
      const row = i < 9 ? 0 : 1, col = row ? i - 9 : i;
      const u = u0 + 1.5 + col * 1.37 + (row ? 0.68 : 0), v = 6.6 + row * 3.6;
      r.paint(stats.blOpp.has(id) ? 'W' : (bg === 'R' ? 'N' : 'B'), c => SHAPES.shield(c, u, v, 1.05), u - 1, u + 1);
    });
    r.text('W', 'GESEHEN', u0 + 7, 14.8, 1.0, 12);
  });
  if (act.rautenField) box(right, 11, 'rautenField', u0 => {
    frame(r, 'W', u0, u0 + 11);
    paintRauten(r, u0 + 0.6, u0 + 10.4, 1.4, 4.6, 0.8); paintRauten(r, u0 + 0.6, u0 + 10.4, 13.4, 16.6, 0.8);
    r.text(gold, 'ALLESFAHRER', u0 + 5.5, 8.0, 1.2, 9.6);
    r.text('W', `${stats.total} SPIELE`, u0 + 5.5, 10.6, 1.0, 9);
  });

  // Highlights in der Mitte
  const hl = act.highlights ? highlights.slice(0, 5) : [];
  let hs = C, he = C;
  if (hl.length) {
    const side = hl.slice(1).sort((a, b) => a.date.localeCompare(b.date));
    const nA = Math.ceil(side.length / 2);
    hs = C - HEART_LEN / 2; he = C + HEART_LEN / 2;
    drawPanel(g, r, hs, HEART_LEN, hl[0], true, gold, bg);
    for (const m of side.slice(0, nA).reverse()) { hs -= HL_LEN + HL_GAP; drawPanel(g, r, hs, HL_LEN, m, false, gold, bg); }
    for (const m of side.slice(nA)) { drawPanel(g, r, he + HL_GAP, HL_LEN, m, false, gold, bg); he += HL_LEN + HL_GAP; }
  }
  const ends = act.code ? 2.4 : 0.5;
  const place = (list, a, b) => {
    const items = list.slice();
    while (items.length && items.reduce((s, it) => s + it.w, 0) + 1 * (items.length + 1) > b - a) items.pop();
    const gap = ((b - a) - items.reduce((s, it) => s + it.w, 0)) / (items.length + 1);
    let u = a + gap;
    for (const it of items) { g.use({ el: it.id }); it.fn(u); u += it.w + gap; }
    return list.length - items.length;
  };
  const dropped = place(left, ends, hs) + place(right, he, lengthCm - ends);
  if (act.night) {
    // Sternenhimmel nur auf freier Fläche (nicht in Feldern und Texten)
    const rnd = rng('night-' + profile.raw), baseTag = g.tags[0];
    g.use({ el: 'night' });
    for (let i = 0; i < lengthCm * 1.4; i++) {
      const x = Math.floor(rnd() * L), y = 4 + Math.floor(rnd() * (STITCHES - 8)), big = rnd() < 0.3;
      const pts = big ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] : [[0, 0]];
      const ok = pts.every(([dx, dy]) => x + dx >= 0 && x + dx < L && g.tags[(x + dx) * STITCHES + y + dy] === baseTag)
        && [[2, 0], [-2, 0], [0, 2], [0, -2]].every(([dx, dy]) => x + dx >= 0 && x + dx < L && g.tags[(x + dx) * STITCHES + y + dy] === baseTag);
      if (ok) for (const [dx, dy] of pts) g.set(x + dx, y + dy, 'W');
    }
  }
  if (act.code) { drawCodeBand(g, 4, profile.raw, ctx.season, 'A'); drawCodeBand(g, L - 16, profile.raw, ctx.season, 'B'); }
  return finishModel(g, { L, lengthCm, back: true, dropped }, fringeColors(act));
}

function finishModel(g, info, fringe) {
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < g.cells.length; i++) counts[g.cells[i]]++;
  return { L: g.L, W: g.W, cells: g.cells, tags: g.tags, tagList: g.tagList, info, fringe, counts };
}

function buildScarf(ctx) { return { front: buildFront(ctx), back: buildBack(ctx) }; }

function yarnUsage(scarf) {
  const used = new Set(), counts = [0, 0, 0, 0, 0];
  for (const side of [scarf.front, scarf.back]) side.counts.forEach((c, i) => { counts[i] += c; if (c) used.add(CI_KEYS[i]); });
  scarf.front.fringe.forEach(c => used.add(c));
  return { used: CI_KEYS.filter(k => used.has(k)), counts };
}

function knitFile(scarf, meta) {
  const lines = [
    '# Stadion gestrickt – Strickdatei (Prototyp)',
    `# Fan-Code: ${meta.code} · Saison ${seasonLabel(meta.season)}`,
    `# Maße: ${meta.lengthCm} x ${WIDTH_CM} cm · ${scarf.front.L} Reihen x ${STITCHES} Maschen (${ROWS_PER_CM} R/cm, ${ST_PER_CM} M/cm) · Doppeljacquard`,
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
