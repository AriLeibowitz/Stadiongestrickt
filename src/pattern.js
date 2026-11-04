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
  // Text entlang eines Kreisbogens (für das Wappen). top: oben lesbar, sonst unten.
  arcText(color, str, cu, cv, radius, h, top) {
    this.paint(color, c => {
      const k = ST_PER_CM; c.scale(1 / k, 1 / k);          // isotrope Einheit: 1/6 cm
      c.font = `700 ${h / 0.7 * k}px ${SCARF_FONT}`;
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      const chars = [...str], ws = chars.map(ch => c.measureText(ch).width), track = h * 0.18 * k;
      const total = ws.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
      const R = radius * k;
      let a = (top ? -Math.PI / 2 : Math.PI / 2) + (top ? -1 : 1) * total / 2 / R;
      chars.forEach((ch, i) => {
        const half = ws[i] / 2 / R; a += (top ? 1 : -1) * half;
        c.save();
        c.translate(cu * k + Math.cos(a) * R, cv * k + Math.sin(a) * R);
        c.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2);
        c.fillText(ch, 0, h * k / 2);
        c.restore();
        a += (top ? 1 : -1) * (half + track / R);
      });
    }, cu - radius - 1, cu + radius + 1);
  }
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
function paintRauten(r, u0, u1, v0, v1, s = 1.1, clip = null) {
  const g = r.g, su = s * 0.62, sv = s * 0.95, shear = 0.42;
  const x0 = Math.max(0, Math.round(u0 * ROWS_PER_CM)), x1 = Math.min(g.L, Math.round(u1 * ROWS_PER_CM));
  const y0 = Math.max(0, Math.round(v0 * ST_PER_CM)), y1 = Math.min(g.W, Math.round(v1 * ST_PER_CM));
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) {
    const u = (x + 0.5) / ROWS_PER_CM, v = (y + 0.5) / ST_PER_CM, uu = u + v * shear;
    if (clip && !clip(u, v)) continue;
    const a = Math.floor(uu / su + v / sv), b = Math.floor(uu / su - v / sv);
    g.set(x, y, ((a + b) % 2 + 2) % 2 ? 'B' : 'W');
  }
}

/* ---- Vereinswappen (nachgezeichnet, eingestrickt) ---------------------- */
function paintCrest(r, cu, cv, R) {
  const circ = (rad) => c => { c.arc(cu, cv, rad, 0, 7); c.fill(); };
  r.paint('B', circ(R), cu - R, cu + R);
  r.paint('W', circ(R - 0.32), cu - R, cu + R);
  r.paint('R', circ(R - 0.62), cu - R, cu + R);
  r.paint('W', circ(R * 0.56), cu - R, cu + R);
  const ri = R * 0.5;
  paintRauten(r, cu - ri, cu + ri, cv - ri, cv + ri, 0.95, (u, v) => Math.hypot(u - cu, v - cv) <= ri);
  const rt = (R - 0.62 + R * 0.56) / 2, h = (R - 0.62 - R * 0.56) * 0.62;
  r.arcText('W', 'FC BAYERN', cu, cv, rt, h, true);
  r.arcText('W', 'MÜNCHEN', cu, cv, rt, h, false);
  // kleine Trennpunkte links und rechts
  r.paint('W', c => { c.arc(cu - rt, cv, h * 0.16, 0, 7); c.fill(); c.beginPath(); c.arc(cu + rt, cv, h * 0.16, 0, 7); c.fill(); }, cu - R, cu + R);
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
  const g = new Grid(L), r = new Raster(g), overlay = [];
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
      overlay.push(emb({ el: 'medal' }, 'W', String(stats.total), C, vn, icons.length ? 3.2 : 4.0, 9));
      overlay.push(emb({ el: 'medal' }, goldOn ? 'G' : 'W', 'SPIELE', C, vn + (icons.length ? 3.0 : 3.7), 0.9, 8));
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
    if (act.monthSeal) overlay.push(emb({ el: 'monthSeal' }, 'G', 'AUG – MAI', uc, 12.2, 1.0, 10));
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

  return finishModel(g, { L, lengthCm, motifs }, fringeColors(act), overlay);
}

function fringeColors(act) {
  if (act.tour) return ['G', 'R'];
  const base = act.fringeRW ? ['R', 'W'] : ['W'];
  return act.gold ? [...base, base[0], 'G'] : base;
}

/* ---- Stick- und Patch-Ebene --------------------------------------------
   Diese Elemente werden nicht gestrickt, sondern nach dem Stricken aufgestickt
   (Schrift) oder als gewebter Aufnäher aufgenäht (Highlight-Patches).        */
function emb(tag, color, text, u, v, h, maxW = 99) { return { kind: 'emb', tag, color, text: String(text).toUpperCase(), u, v, h, maxW }; }

const HL_LEN = 10.5, HEART_LEN = 13, HL_GAP = 1.2;

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
  const g = new Grid(L), r = new Raster(g), overlay = [];
  const bg = act.night ? 'N' : 'R';
  const accent = bg === 'R' ? 'N' : 'R';
  const gold = goldAvailable(act) ? 'G' : 'W';
  g.use(act.night ? { el: 'night' } : { type: 'backBase' });
  g.rect(0, L - 1, 0, STITCHES - 1, bg);
  const baseTag = g.pen;
  const ends = act.code ? 2.4 : 0.6;

  // Ende A: Wappen + gestickter Name (wie beim Mitgliederschal)
  let leftEnd = ends;
  if (act.crest) { g.use({ el: 'crest' }); paintCrest(r, ends + 7.4, WIDTH_CM / 2, 6.6); leftEnd = ends + 14.8; }

  // Highlights als Patches in der Mitte
  const hl = act.highlights ? highlights.slice(0, 5) : [];
  let hs = C, he = C;
  if (hl.length) {
    const side = hl.slice(1).sort((a, b) => a.date.localeCompare(b.date));
    const nA = Math.ceil(side.length / 2);
    const patch = (u0, len, m, heart) => overlay.push({ kind: 'patch', tag: { type: 'panel', game: m, heart }, u0, u1: u0 + len, v0: 1.3, v1: WIDTH_CM - 1.3, game: m, heart, round: shortRound(m), abbr: clubAbbr(m.opp).slice(0, 3) });
    hs = C - HEART_LEN / 2; he = C + HEART_LEN / 2;
    patch(hs, HEART_LEN, hl[0], true);
    for (const m of side.slice(0, nA).reverse()) { hs -= HL_LEN + HL_GAP; patch(hs, HL_LEN, m, false); }
    for (const m of side.slice(nA)) { patch(he + HL_GAP, HL_LEN, m, false); he += HL_LEN + HL_GAP; }
  }

  const left = [], right = [];
  const box = (list, w, fn) => list.push({ w, fn });
  if (act.backInfo) box(left, 18, u0 => {
    const t = { el: 'backInfo' }, uc = u0 + 9;
    overlay.push(emb(t, 'W', ctx.name || profile.name || 'FAN', uc, 6.2, 2.6, 17));
    overlay.push(emb(t, 'W', `SAISON ${seasonLabel(ctx.season)}`, uc, 10.2, 1.0, 16));
    overlay.push(emb(t, 'W', `${stats.total} ${stats.total === 1 ? 'SPIEL' : 'SPIELE'} · ${stats.W} S  ${stats.D} U  ${stats.L} N`, uc, 12.5, 0.8, 16));
    overlay.push(emb(t, 'W', profile.code, uc, 14.5, 0.7, 16));
  });
  if (act.travel) box(right, 11, u0 => {
    const t = { el: 'travel' }, uc = u0 + 5.5;
    overlay.push(emb(t, accent, 'AUSWÄRTS', uc, 3.6, 0.85, 10));
    overlay.push(emb(t, 'W', `${stats.km.toLocaleString('de-DE')} KM`, uc, 6.4, 1.7, 10.5));
    overlay.push(emb(t, 'W', `${stats.away} FAHRTEN`, uc, 8.9, 0.8, 10));
    const cs = [...stats.awayCountries];
    for (let i = 0; i < Math.min(3, Math.ceil(cs.length / 3)); i++) overlay.push(emb(t, 'W', cs.slice(i * 3, i * 3 + 3).join(' · '), uc, 11.6 + i * 1.7, 0.85, 10));
    if (!cs.length) overlay.push(emb(t, 'W', 'DEUTSCHLAND', uc, 11.6, 0.8, 10));
  });
  if (act.calendar) box(right, 11, u0 => {
    g.use({ el: 'calendar' });
    overlay.push(emb({ el: 'calendar' }, accent, 'KALENDER', u0 + 5.5, 3.6, 0.85, 10));
    const max = Math.max(1, ...stats.months.values());
    SEASON_MONTHS.forEach((mo, i) => {
      const n = stats.months.get(mo) || 0, u = u0 + 0.9 + i * 0.96, h = n ? 0.4 + 8 * n / max : 0.25;
      r.rect(n === max ? gold : 'W', u, u + 0.66, 14.0 - h, 14.0);
      overlay.push(emb({ el: 'calendar' }, 'W', MONTH_SHORT[mo][0], u + 0.33, 15.6, 0.65, 1));
    });
  });
  if (act.collection) box(right, 12.5, u0 => {
    g.use({ el: 'collection' });
    overlay.push(emb({ el: 'collection' }, accent, `GEGNER ${stats.blOpp.size}/17`, u0 + 6.25, 3.6, 0.85, 11));
    (ctx.blOpponents || CURRENT_BL).forEach((id, i) => {
      const row = i < 9 ? 0 : 1, col = row ? i - 9 : i;
      const u = u0 + 0.9 + col * 1.33 + (row ? 0.66 : 0), v = 7.2 + row * 3.4;
      r.paint(stats.blOpp.has(id) ? 'W' : accent === 'N' ? 'N' : 'B', c => SHAPES.shield(c, u, v, 1.0), u - 1, u + 1);
    });
    overlay.push(emb({ el: 'collection' }, 'W', 'GESEHEN', u0 + 6.25, 14.6, 0.8, 11));
  });

  const place = (list, a, b) => {
    const items = list.slice();
    while (items.length && items.reduce((s, it) => s + it.w, 0) + 1 * (items.length + 1) > b - a) items.pop();
    const gap = ((b - a) - items.reduce((s, it) => s + it.w, 0)) / (items.length + 1);
    let u = a + gap;
    for (const it of items) { it.fn(u); u += it.w + gap; }
    return list.length - items.length;
  };
  const dropped = place(left, leftEnd, hs) + place(right, he, lengthCm - ends);
  if (act.code) { drawCodeBand(g, 4, profile.raw, ctx.season, 'A'); drawCodeBand(g, L - 16, profile.raw, ctx.season, 'B'); }

  if (act.night) {
    // Sternenhimmel nur auf freier Fläche (nicht unter Stickerei, Patches oder Wappen)
    const free = (u, v) => !overlay.some(o => o.kind === 'patch' ? u > o.u0 - 0.4 && u < o.u1 + 0.4 : Math.abs(u - o.u) < Math.min(o.maxW, o.text.length * o.h * 0.6) / 2 + 0.5 && Math.abs(v - o.v) < o.h);
    const rnd = rng('night-' + profile.raw);
    g.use({ el: 'night' });
    for (let i = 0; i < lengthCm * 1.4; i++) {
      const x = Math.floor(rnd() * L), y = 4 + Math.floor(rnd() * (STITCHES - 8)), big = rnd() < 0.3;
      if (!free(x / ROWS_PER_CM, y / ST_PER_CM)) continue;
      const pts = big ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] : [[0, 0]];
      const ok = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].every(([dx, dy]) => x + dx >= 0 && x + dx < L && g.tags[(x + dx) * STITCHES + y + dy] === baseTag);
      if (ok) for (const [dx, dy] of pts) g.set(x + dx, y + dy, 'W');
    }
  }
  return finishModel(g, { L, lengthCm, back: true, dropped }, fringeColors(act), overlay);
}

function finishModel(g, info, fringe, overlay = []) {
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < g.cells.length; i++) counts[g.cells[i]]++;
  return { L: g.L, W: g.W, cells: g.cells, tags: g.tags, tagList: g.tagList, info, fringe, counts, overlay };
}

// Stickdatei (SVG, Maße in mm): Stickerei und Patch-Positionen für die Konfektion
function embroiderySVG(scarf, meta) {
  const Lmm = meta.lengthCm * 10, Wmm = WIDTH_CM * 10;
  const TH = { W: '#FFFFFF', G: '#D9AE45', N: '#0E2240', R: '#DC052D', B: '#0074C8' };
  const esc2 = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const side = (model, y0, label) => {
    let out = `<g transform="translate(0 ${y0})"><rect width="${Lmm}" height="${Wmm}" fill="none" stroke="#999" stroke-dasharray="4 3"/><text x="0" y="-4" font-size="8" font-family="sans-serif">${label}</text>`;
    for (const o of model.overlay) {
      if (o.kind === 'emb') out += `<text x="${(o.u * 10).toFixed(1)}" y="${((o.v + o.h / 2) * 10).toFixed(1)}" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="${(o.h / 0.7 * 10).toFixed(1)}" fill="${TH[o.color]}" stroke="#0004" stroke-width="0.2">${esc2(o.text)}</text>`;
      else out += `<rect x="${(o.u0 * 10).toFixed(1)}" y="${(o.v0 * 10).toFixed(1)}" width="${((o.u1 - o.u0) * 10).toFixed(1)}" height="${((o.v1 - o.v0) * 10).toFixed(1)}" rx="8" fill="none" stroke="#0E2240"/><text x="${((o.u0 + o.u1) * 5).toFixed(1)}" y="${((o.v0 + 1.2) * 10).toFixed(1)}" text-anchor="middle" font-size="7" font-family="sans-serif">PATCH ${o.heart ? '♥ ' : ''}#${o.game.nr} ${esc2(scoreLine(o.game))}</text>`;
    }
    return out + '</g>';
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Lmm}mm" height="${Wmm * 2 + 40}mm" viewBox="0 -12 ${Lmm} ${Wmm * 2 + 40}">
<!-- Stadion gestrickt · Stickdatei (Prototyp) · ${meta.code} · Saison ${seasonLabel(meta.season)} · Maße in mm -->
${side(scarf.front, 0, 'VORDERSEITE – Stickerei')}${side(scarf.back, Wmm + 24, 'RÜCKSEITE – Stickerei und Patches')}</svg>`;
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
