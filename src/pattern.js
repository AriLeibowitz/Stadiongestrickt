/* =========================================================================
   Stadion gestrickt – Muster-Generator
   Feines Maschenraster (6 Maschen/cm quer, 8 Reihen/cm längs). Schrift und
   Symbole werden als Vektoren in Zentimetern gezeichnet und auf das Raster
   übertragen (eine Garnfarbe pro Masche, keine Zwischentöne).
   Vorderseite: startet einfarbig rot, Meilensteine legen Ebenen darüber.
   Rückseite:   rot (oder schwarz), KI-Highlights, Etikett, Statistik.
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
  rauten: [0.4, 2.6],
  stripe1: [10.4, 13.4],                                 // 1 breiter Streifen
  stripes3: [[5.35, 6.65], [11.25, 12.55], [17.15, 18.45]], // 3 schmale Streifen
  gapA: 8.7, gapB: 15.1,                                 // rote Felder für Symbole
  zoneC: 11.9, starBand: [21.0, 24.2], bodyStart: 26,
  blockLen: 4, centerHalf: 15.5, medalR: 7.4, rautenHalf: 14,
  threads: [[4.5, 13.5], [6.2, 11.8], [7.6, 10.4]],     // Goldfäden (v in cm), je Stufe ein Paar
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
  arcText(color, str, cu, cv, radius, h, top, rot = 0) {
    this.paint(color, c => {
      const k = ST_PER_CM; c.scale(1 / k, 1 / k);          // isotrope Einheit: 1/6 cm
      c.font = `700 ${h / 0.7 * k}px ${SCARF_FONT}`;
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      const chars = [...str], ws = chars.map(ch => c.measureText(ch).width), track = h * 0.18 * k;
      const total = ws.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
      const R = radius * k;
      let a = (top ? -Math.PI / 2 : Math.PI / 2) + rot + (top ? -1 : 1) * total / 2 / R;
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
  // Text in echten Proportionen, gedreht um rot (für Monogramme)
  textIso(color, str, u, v, h, rot = 0) {
    this.paint(color, c => {
      const k = ST_PER_CM; c.scale(1 / k, 1 / k);
      c.font = `700 ${h / 0.7 * k}px ${SCARF_FONT}`;
      c.translate(u * k, v * k); c.rotate(rot);
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      const m = c.measureText(str);
      c.fillText(str, 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    }, u - h * 3, u + h * 3);
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
  bigEars(c, u, v, h) { // Henkelpott: Pokal mit großen Henkeln
    const w = h * 0.5, t = v - h / 2;
    c.moveTo(u - w / 2, t); c.lineTo(u + w / 2, t);
    c.quadraticCurveTo(u + w / 2, t + h * 0.55, u + w * 0.12, t + h * 0.64);
    c.lineTo(u + w * 0.12, t + h * 0.82); c.lineTo(u + w * 0.38, t + h * 0.88); c.lineTo(u + w * 0.38, t + h); c.lineTo(u - w * 0.38, t + h); c.lineTo(u - w * 0.38, t + h * 0.88); c.lineTo(u - w * 0.12, t + h * 0.82); c.lineTo(u - w * 0.12, t + h * 0.64);
    c.quadraticCurveTo(u - w / 2, t + h * 0.55, u - w / 2, t); c.fill();
    c.beginPath(); c.lineWidth = h * 0.075;
    c.ellipse(u - w * 0.78, t + h * 0.33, w * 0.34, h * 0.3, 0, 0, 7);
    c.moveTo(u + w * 1.12, t + h * 0.33); c.ellipse(u + w * 0.78, t + h * 0.33, w * 0.34, h * 0.3, 0, 0, 7); c.stroke();
  },
  scCup(c, u, v, h) { // Supercup: schlanker Pokal mit Deckel
    const w = h * 0.42, t = v - h / 2;
    c.moveTo(u, t); c.lineTo(u + w * 0.18, t + h * 0.12); c.lineTo(u + w / 2, t + h * 0.16);
    c.lineTo(u + w * 0.42, t + h * 0.5); c.lineTo(u + w * 0.12, t + h * 0.62); c.lineTo(u + w * 0.12, t + h * 0.84);
    c.lineTo(u + w * 0.4, t + h); c.lineTo(u - w * 0.4, t + h); c.lineTo(u - w * 0.12, t + h * 0.84); c.lineTo(u - w * 0.12, t + h * 0.62);
    c.lineTo(u - w * 0.42, t + h * 0.5); c.lineTo(u - w / 2, t + h * 0.16); c.lineTo(u - w * 0.18, t + h * 0.12); c.closePath(); c.fill();
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
// variant: 'modern' | 'tradition' (≥ 5 Jahre) | 'retro' (≥ 10 Jahre). rot: Ausrichtung (oben → Schalmitte)
function paintCrest(r, cu, cv, R, variant = 'modern', rot = 0) {
  const circ = (rad) => c => { c.arc(cu, cv, rad, 0, 7); c.fill(); };
  const within = (rad) => (u, v) => Math.hypot(u - cu, v - cv) <= rad;
  if (variant === 'retro') {
    r.paint('G', circ(R), cu - R, cu + R);
    r.paint('R', circ(R - 0.4), cu - R, cu + R);
    r.paint('W', circ(R * 0.6), cu - R, cu + R);
    const ri = R * 0.55;
    paintRauten(r, cu - ri, cu + ri, cv - ri, cv + ri, 0.8, within(ri));
    const rt = (R - 0.4 + R * 0.6) / 2, h = (R - 0.4 - R * 0.6) * 0.55;
    r.arcText('W', 'F.C. BAYERN', cu, cv, rt, h, true, rot);
    r.arcText('W', 'MÜNCHEN', cu, cv, rt, h, false, rot);
    // FCB-Monogramm über den Rauten
    r.textIso('W', 'FCB', cu, cv, R * 0.42, rot);
    r.textIso('R', 'FCB', cu, cv, R * 0.34, rot);
    return;
  }
  let Ro = R;
  if (variant === 'tradition') { r.paint('G', circ(R + 0.1), cu - R - 1, cu + R + 1); Ro = R - 0.35; }
  r.paint('B', circ(Ro), cu - R, cu + R);
  r.paint('W', circ(Ro - 0.32), cu - R, cu + R);
  r.paint('R', circ(Ro - 0.62), cu - R, cu + R);
  r.paint('W', circ(Ro * 0.56), cu - R, cu + R);
  const ri = Ro * 0.5;
  paintRauten(r, cu - ri, cu + ri, cv - ri, cv + ri, 0.95, within(ri));
  const rt = (Ro - 0.62 + Ro * 0.56) / 2, h = (Ro - 0.62 - Ro * 0.56) * 0.62;
  r.arcText('W', 'FC BAYERN', cu, cv, rt, h, true, rot);
  r.arcText('W', variant === 'tradition' ? 'MÜNCHEN E.V.' : 'MÜNCHEN', cu, cv, rt, h, false, rot);
  const dx = Math.cos(rot) * rt, dy = Math.sin(rot) * rt;
  r.paint('W', c => { c.arc(cu - dx, cv - dy, h * 0.16, 0, 7); c.fill(); c.beginPath(); c.arc(cu + dx, cv + dy, h * 0.16, 0, 7); c.fill(); }, cu - R, cu + R);
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

/* ---- Vorderseite ------------------------------------------------------- */
const TREUE_IDS = ['stripe1', 'stripe3', 'blocks', 'bigBlocks', 'gold', 'centerStripe', 'rautenField'];
function treueLevel(act) { return TREUE_IDS.reduce((lv, id, i) => act[id] ? i + 1 : lv, 0); }
function goldAvailable(act) { return GOLD_ELEMENTS.some(k => act[k]); }

function buildFront(ctx) {
  const { act, stats, lengthCm } = ctx;
  const L = lengthCm * ROWS_PER_CM, C = lengthCm / 2;
  const g = new Grid(L), r = new Raster(g), overlay = [];
  const lv = treueLevel(act), lvId = TREUE_IDS[lv - 1];
  const el = (id, extra) => g.use({ el: id, ...extra });
  const uOf = (end, d) => end === 0 ? d : lengthCm - d;
  const band = (end, a, b) => end === 0 ? [a, b] : [lengthCm - b, lengthCm - a];
  const stripe = (a, b, goldEdge) => {
    el(lvId, { layer: 'body' }); r.rect('W', a, b, 0, WIDTH_CM);
    if (goldEdge) r.rect('G', a - 0.55, a - 0.3, 0, WIDTH_CM), r.rect('G', b + 0.3, b + 0.55, 0, WIDTH_CM);
  };

  el('base', { layer: 'body' }); g.rect(0, L - 1, 0, STITCHES - 1, 'R');

  // Treue: genau eine Stufe. Jede Stufe ersetzt die vorige; nur die Goldstreifen (ab Stufe 5) bleiben.
  const bodyLen = C - FRONT.centerHalf - FRONT.bodyStart;
  const nBlocks = Math.max(2, Math.round(bodyLen / 18));
  const blockD = k => FRONT.bodyStart + (k + 0.5) * bodyLen / nBlocks;
  const bigA = blockD(0) - FRONT.blockLen / 2, bigB = blockD(nBlocks - 1) + FRONT.blockLen / 2;   // große Blöcke (ab Ende)
  const goldLine = (a, b) => { el('gold', { layer: 'body' }); r.rect('G', a, b, 0, WIDTH_CM); };
  for (const end of [0, 1]) {
    if (lv === 1) { const [a, b] = band(end, ...FRONT.stripe1); stripe(a, b, false); }
    if (lv === 2) for (const st of FRONT.stripes3) { const [a, b] = band(end, ...st); stripe(a, b, false); }
    if (lv === 3) for (let k = 0; k < nBlocks; k++) { const [a, b] = band(end, blockD(k) - FRONT.blockLen / 2, blockD(k) + FRONT.blockLen / 2); stripe(a, b, false); }
    if (lv >= 4) { const [a, b] = band(end, bigA, bigB); stripe(a, b, false); }   // zwei große Blöcke bleiben ab Stufe 4
    if (lv >= 5) { // Goldstreifen an den Kanten der großen Blöcke, bleiben in Stufe 6 und 7
      for (const d of [bigA - 0.7, bigB + 0.3]) { const [a, b] = band(end, d, d + 0.4); goldLine(a, b); }
    }
  }
  if (lv === 6) { stripe(C - 3, C + 3, false); goldLine(C - 3.7, C - 3.3); goldLine(C + 3.3, C + 3.7); }
  if (lv === 7) {
    el('rautenField');
    paintRauten(r, C - FRONT.rautenHalf, C + FRONT.rautenHalf, 0, WIDTH_CM);
    for (const [a, b] of [[C - FRONT.rautenHalf - 0.9, C - FRONT.rautenHalf], [C + FRONT.rautenHalf, C + FRONT.rautenHalf + 0.9]]) { r.rect('W', a, b, 0, WIDTH_CM); r.rect('G', a + 0.3, b - 0.3, 0, WIDTH_CM); }
  }
  for (const end of [0, 1]) {
    if (act.awayRauten) { el('awayRauten'); const [a, b] = band(end, ...FRONT.rauten); paintRauten(r, a, b, 0, WIDTH_CM, 1.0); }
    if (act.silverBar) { const [a, b] = band(end, 21.3, 21.75); overlay.push({ kind: 'bar', tag: { el: 'silverBar' }, u0: a, u1: b, v0: 0.5, v1: WIDTH_CM - 0.5 }); }
    if (act.stadiumDots) {
      el('stadiumDots');
      const inStripe = lv === 1 || lv === 2;
      const [a, b] = band(end, ...(lv === 2 ? FRONT.stripes3[1] : FRONT.stripe1)), uc = (a + b) / 2;
      const n = Math.min(stats.stadiums.size, 24), h = (n - 1) * 0.65;
      r.paint(inStripe ? 'R' : 'W', c => { for (let i = 0; i < n; i++) { const v = 9 - h / 2 + i * 0.65; c.moveTo(uc + 0.2, v); c.arc(uc, v, 0.2, 0, 7); } c.fill(); }, uc - 1, uc + 1);
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
  return finishModel(g, { L, lengthCm, level: lv }, fringeColors(act), overlay);
}

function fringeColors(act) {
  if (act.tour) return ['G', 'R'];
  const base = act.fringeRW ? ['R', 'W'] : ['W'];
  return treueLevel(act) >= 5 ? [...base, base[0], 'G'] : base;
}

/* ---- Stick- und Patch-Ebene --------------------------------------------
   Diese Elemente werden nicht gestrickt, sondern nach dem Stricken aufgestickt
   (Schrift) oder als gewebter Aufnäher aufgenäht (Highlight-Patches).        */
function emb(tag, color, text, u, v, h, maxW = 99, rot = 0) { return { kind: 'emb', tag, color, text: String(text).toUpperCase(), u, v, h, maxW, rot }; }

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
  const L = lengthCm * ROWS_PER_CM, C = lengthCm / 2, vc = WIDTH_CM / 2;
  const g = new Grid(L), r = new Raster(g), overlay = [];
  const bg = act.night ? 'N' : 'R';
  g.use(act.night ? { el: 'night' } : { type: 'backBase' });
  g.rect(0, L - 1, 0, STITCHES - 1, bg);
  const baseTag = g.pen;
  const ends = act.code ? 2.4 : 0.6;
  // Ende A liest sich hängend mit Oberkante zur Mitte (+u): Drehung +90°; Ende B: −90°
  const ROT_A = Math.PI / 2, ROT_B = -Math.PI / 2;

  /* --- Ende A: Reise-Zeile, Name, Wappen, Trophäen darüber (alles hängend lesbar) --- */
  let aEnd = ends, crestU = null;
  if (act.travel) {
    const t = { el: 'travel' }, cs = [...stats.awayCountries];
    overlay.push(emb(t, 'W', `${stats.km.toLocaleString('de-DE')} KM AUSWÄRTS · ${stats.away} ${stats.away === 1 ? 'FAHRT' : 'FAHRTEN'}`, aEnd + 1.6, vc, 0.62, 15, ROT_A));
    overlay.push(emb(t, 'W', cs.length ? cs.join(' · ') : 'DEUTSCHLAND', aEnd + 0.6, vc, 0.5, 14, ROT_A));
    aEnd += 2.4;
  }
  if (act.backInfo) {
    const t = { el: 'backInfo' }, since = Math.min(profile.start || ctx.season, ctx.season);
    overlay.push(emb(t, 'W', `${stats.total} ${stats.total === 1 ? 'SPIEL' : 'SPIELE'} · ${stats.W} S  ${stats.D} U  ${stats.L} N`, aEnd + 0.6, vc, 0.66, 14, ROT_A));
    overlay.push(emb(t, 'W', `MITGLIED SEIT ${since}`, aEnd + 1.85, vc, 0.72, 14, ROT_A));
    overlay.push(emb(t, 'W', `SAISON ${seasonLabel(ctx.season)}`, aEnd + 3.3, vc, 0.95, 14, ROT_A));
    overlay.push(emb(t, 'W', ctx.name || profile.name || 'FAN', aEnd + 5.7, vc, 2.4, 15, ROT_A));
    aEnd += 7.4;
  }
  if (act.crest) {
    const variant = act.crestRetro ? 'retro' : act.crestTradition ? 'tradition' : 'modern';
    g.use({ el: act.crestRetro ? 'crestRetro' : act.crestTradition ? 'crestTradition' : 'crest' });
    paintCrest(r, aEnd + 7.0, vc, 6.5, variant, ROT_A);
    crestU = aEnd + 7.0;
    aEnd += 14.2;
  }
  // Trophäen: nur wenn man beim entscheidenden Spiel dabei war, eingestickt über dem Wappen
  const trophies = [act.trophyMeister && ['trophyMeister', 'plate', 1.25], act.trophyDFB && ['trophyDFB', 'cup', 2.6], act.trophyCL && ['trophyCL', 'bigEars', 2.6], act.trophySC && ['trophySC', 'scCup', 2.2]].filter(Boolean);
  if (trophies.length) {
    trophies.forEach(([id, shape, size], i) => overlay.push({ kind: 'shape', tag: { el: id }, shape, color: 'G', size, u: aEnd + 1.9, v: vc + (i - (trophies.length - 1) / 2) * 3.7, rot: ROT_A }));
    aEnd += 3.8;
  }

  /* --- Ende B: Herzstück allein, darüber Spiele zu zweit, darüber Momente --- */
  let bEnd = ends;  // Abstand ab Ende B
  const uB = d => lengthCm - d;
  const hl = act.highlights ? highlights.slice(0, 5) : [];
  if (hl.length) {
    const hh = 6.6;
    overlay.push({ kind: 'patch', tag: { type: 'panel', game: hl[0], heart: true }, game: hl[0], heart: true, title: (ctx.hlTitles || {})[hl[0].nr], u: uB(bEnd + 0.6 + hh / 2), v: vc, w: 15.4, h: hh, rot: ROT_B, round: shortRound(hl[0]), abbr: clubAbbr(hl[0].opp).slice(0, 3) });
    bEnd += 0.6 + hh;
    const rest = hl.slice(1).sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < rest.length; i += 2) {
      const ph = 4.6;
      const pair = rest.slice(i, i + 2);
      pair.forEach((m, j) => {
        // hängend gelesen: links/rechts entspricht v (Ende B: rechts = kleines v)
        const v = pair.length === 1 ? vc : (j === 0 ? vc + 3.95 : vc - 3.95);
        overlay.push({ kind: 'patch', tag: { type: 'panel', game: m, heart: false }, game: m, heart: false, u: uB(bEnd + 0.6 + ph / 2), v, w: 7.5, h: ph, rot: ROT_B, round: shortRound(m), abbr: clubAbbr(m.opp).slice(0, 3) });
      });
      bEnd += 0.6 + ph;
    }
  }
  const marks = ELEMENTS.filter(e => e.mark && act[e.id]);
  if (marks.length) {
    bEnd += 0.8;
    const per = 3, mh = 5.9;
    marks.forEach((e, i) => {
      const row = Math.floor(i / per), col = i % per, inRow = Math.min(per, marks.length - row * per);
      const ms = (ctx.milestones || []).find(m => m.element === e.id);
      overlay.push({ kind: 'mark', tag: { el: e.id }, icon: e.mark.icon, label: e.mark.label, season: seasonLabel(ctx.season), version: markVersion(ms), u: uB(bEnd + row * mh + mh / 2), v: vc - (col - (inRow - 1) / 2) * 5.75, rot: ROT_B, r: 2.75 });
    });
    bEnd += Math.ceil(marks.length / per) * mh;
  }

  /* --- Mitte: Goldfäden --- */
  const travelBox = null;
  const tiers = ['threads1', 'threads2', 'threads3'].filter(id => act[id]).length ? ['threads1', 'threads2', 'threads3'].findIndex(id => act[id]) + 1 : 0;
  if (tiers) {
    g.use({ el: ['threads1', 'threads2', 'threads3'][tiers - 1] });
    const x0 = Math.ceil((aEnd + 1.5) * ROWS_PER_CM), x1 = Math.floor((lengthCm - bEnd - 1.5) * ROWS_PER_CM);
    for (let t = 0; t < tiers; t++) for (const v of FRONT.threads[t]) {
      const y = Math.round(v * ST_PER_CM);
      for (let x = x0; x < x1; x++) { const u = x / ROWS_PER_CM; if (travelBox && u > travelBox[0] && u < travelBox[1]) continue; g.set(x, y, 'G'); }
    }
  }

  if (act.code) { drawCodeBand(g, 4, profile.raw, ctx.season, 'A'); drawCodeBand(g, L - 16, profile.raw, ctx.season, 'B'); }

  if (act.night) {
    const free = (u, v) => !overlay.some(o => { const [a, b, c, d] = overlayBox(o); return u > a - 0.4 && u < b + 0.4 && v > c - 0.4 && v < d + 0.4; }) && !(crestU && Math.hypot(u - crestU, v - vc) < 7.1) && u > ends && u < lengthCm - ends;
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
  return finishModel(g, { L, lengthCm, back: true, dropped: 0 }, fringeColors(act), overlay);
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
      const deg = ((o.rot || 0) * 180 / Math.PI).toFixed(0);
      if (o.kind === 'emb') out += `<text transform="rotate(${deg} ${(o.u * 10).toFixed(1)} ${(o.v * 10).toFixed(1)})" x="${(o.u * 10).toFixed(1)}" y="${((o.v + o.h / 2) * 10).toFixed(1)}" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="${(o.h / 0.7 * 10).toFixed(1)}" fill="${TH[o.color]}" stroke="#0004" stroke-width="0.2">${esc2(o.text)}</text>`;
      else {
        const [u0, u1, v0, v1] = overlayBox(o);
        const label = o.kind === 'patch' ? `PATCH ${o.heart ? '♥ ' : ''}#${o.game.nr} ${scoreLine(o.game)}` : o.kind === 'mark' ? `STICK: ${o.label} V${o.version}` : o.kind === 'bar' ? 'SILBERKORDEL' : `STICK: ${o.shape}`;
        out += `<rect x="${(u0 * 10).toFixed(1)}" y="${(v0 * 10).toFixed(1)}" width="${((u1 - u0) * 10).toFixed(1)}" height="${((v1 - v0) * 10).toFixed(1)}" rx="4" fill="none" stroke="#0E2240"/><text x="${((u0 + u1) * 5).toFixed(1)}" y="${((v0 + v1) * 5).toFixed(1)}" text-anchor="middle" font-size="5" font-family="sans-serif">${esc2(label)}</text>`;
      }
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
