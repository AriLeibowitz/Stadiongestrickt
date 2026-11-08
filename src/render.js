/* =========================================================================
   Stadion gestrickt – Canvas-Darstellung (Strickoptik, Lupe, Hit-Test)
   ========================================================================= */
'use strict';

const FRINGE = 6 * ROWS_PER_CM;   // 6 cm Fransen
const STITCH_ASPECT = ST_PER_CM / ROWS_PER_CM;  // Reihenhöhe / Maschenbreite

const HEX = CI_KEYS.map(k => YARN[k].hex);
const SHADE = CI_KEYS.map(k => YARN[k].shade);

function layoutCanvas(model, cssWidth, segs, orient = null) {
  const segLen = Math.ceil(model.L / segs);
  const units = segLen + FRINGE * 2;
  const cx = cssWidth / units;            // px pro Reihe (entlang x)
  const cy = cx / STITCH_ASPECT;          // px pro Masche (quer)
  const labelH = orient ? 8 : 18, gap = 14;
  const segH = model.W * cy;
  const height = segs * (segH + labelH) + (segs - 1) * gap + (orient ? 8 : 4);
  return { segs, segLen, cx, cy, labelH, gap, segH, width: cssWidth, height, ox: FRINGE * cx, orient };
}

// Hochkant-Ansicht: 'A' = Ende A unten (Drehung −90°), 'B' = Ende B unten (+90°)
function setupCanvas(canvas, lay) {
  const dpr = window.devicePixelRatio || 1, v = !!lay.orient;
  const sw = v ? lay.height : lay.width, sh = v ? lay.width : lay.height;
  canvas.width = Math.round(sw * dpr); canvas.height = Math.round(sh * dpr);
  canvas.style.width = sw + 'px'; canvas.style.height = sh + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, sw, sh);
  if (lay.orient === 'A') ctx.setTransform(0, -dpr, dpr, 0, 0, lay.width * dpr);
  if (lay.orient === 'B') ctx.setTransform(0, dpr, -dpr, 0, lay.height * dpr, 0);
  return ctx;
}
function toLayout(lay, px, py) {
  if (lay.orient === 'A') return [lay.width - py, px];
  if (lay.orient === 'B') return [py, lay.height - px];
  return [px, py];
}

function segOrigin(lay, i) { return { x: lay.ox, y: i * (lay.segH + lay.labelH + lay.gap) + lay.labelH }; }

function drawScarf(canvas, model, opts) {
  const dpr = window.devicePixelRatio || 1;
  const lay = layoutCanvas(model, opts.width, opts.segs, opts.orient);
  const ctx = setupCanvas(canvas, lay);
  void dpr;
  const cmPerRow = 1 / ROWS_PER_CM;
  for (let s = 0; s < lay.segs; s++) {
    const x0 = s * lay.segLen, x1 = Math.min(model.L, x0 + lay.segLen);
    if (x0 >= x1) break;
    const o = segOrigin(lay, s);
    // Beschriftung
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#667';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    const range = `${Math.round(x0 * cmPerRow)}–${Math.round(x1 * cmPerRow)} cm`;
    const label = opts.title && lay.segs === 1 ? `${opts.title}  ·  Ende A` : (s === 0 ? 'Ende A · ' : '') + (lay.segs > 1 ? `Bahn ${s + 1}/${lay.segs} · ${range}` : range);
    if (!lay.orient) {
      ctx.textAlign = 'left';
      ctx.fillText(label, s === 0 ? 0 : o.x, o.y - 4);
      if (x1 === model.L) { ctx.textAlign = 'right'; ctx.fillText('Ende B', lay.width, o.y - 4); ctx.textAlign = 'left'; }
    }
    // Schatten
    ctx.save();
    ctx.shadowColor = 'rgba(10,20,40,.22)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#000';
    ctx.fillRect(o.x, o.y, (x1 - x0) * lay.cx, lay.segH);
    ctx.restore();
    drawCells(ctx, model, x0, x1, 0, model.W, o.x - x0 * lay.cx, o.y, lay.cx, lay.cy, opts);
    ctx.save(); ctx.beginPath(); ctx.rect(o.x, o.y - 6, (x1 - x0) * lay.cx, lay.segH + 12); ctx.clip();
    if (opts.real) drawKnitTexture(ctx, o.x, o.y, (x1 - x0) * lay.cx, lay.segH, lay.cy, lay.cx);
    drawOverlay(ctx, model, o.x - x0 * lay.cx, o.y, lay.cx * ROWS_PER_CM, opts.real ? 'real' : 'raster');
    ctx.restore();
    if (s === 0) drawFringe(ctx, model.fringe, o.x, o.y, lay, -1);
    if (x1 === model.L) drawFringe(ctx, model.fringe, o.x + (x1 - x0) * lay.cx, o.y, lay, 1);
  }
  return lay;
}

function drawCells(ctx, model, x0, x1, y0, y1, ox, oy, cx, cy, opts) {
  const W = model.W;
  const knit = opts.knit && cx >= 2.2;
  // Grundfläche (Rasteransicht)
  for (let c = 0; c < 5 && !knit; c++) {
    ctx.fillStyle = HEX[c];
    ctx.beginPath();
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++)
      if (model.cells[x * W + y] === c) ctx.rect(ox + x * cx, oy + y * cy, cx + 0.35, cy + 0.35);
    ctx.fill();
  }
  if (knit) {
    // Vorgerenderte Masche pro Farbe (schnell: ein drawImage pro Masche)
    const sp = stitchSprites(cx, cy);
    for (let x = x0; x < x1; x++) {
      const px = ox + x * cx, base = x * W;
      for (let y = y0; y < y1; y++) ctx.drawImage(sp[model.cells[base + y]], px, oy + y * cy, cx + 0.35, cy + 0.35);
    }
  }
  // Markierung (z. B. neu freigeschaltete Elemente im Schalpotenzial)
  if (opts.markEls && opts.markEls.size) {
    ctx.fillStyle = 'rgba(255,216,77,.6)';
    ctx.beginPath();
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) {
      const t = model.tagList[model.tags[x * W + y]];
      if (t && t.el && opts.markEls.has(t.el)) ctx.rect(ox + x * cx, oy + y * cy, cx + 0.35, cy + 0.35);
    }
    ctx.fill();
  }
}

const _spriteCache = new Map();
function stitchSprites(cx, cy) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(2, Math.ceil(cx * dpr)), h = Math.max(2, Math.ceil(cy * dpr));
  const key = w + 'x' + h;
  if (_spriteCache.has(key)) return _spriteCache.get(key);
  const sprites = CI_KEYS.map((k, c) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = SHADE[c]; g.fillRect(0, 0, w, h);
    // Zwei Maschenschenkel – die V-Spitze zeigt in Strickrichtung (+x)
    const rx = w * 0.56, ry = h * 0.25, rot = 0.5, px = w / 2, py = h / 2;
    g.fillStyle = HEX[c];
    g.beginPath(); g.ellipse(px, py - h * 0.22, rx, ry, rot, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(px, py + h * 0.22, rx, ry, -rot, 0, Math.PI * 2); g.fill();
    if (w >= 10) {
      g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = Math.max(0.6, w * 0.06);
      g.beginPath();
      g.moveTo(w * 0.3, py - h * 0.32); g.lineTo(w * 0.65, py - h * 0.14);
      g.moveTo(w * 0.3, py + h * 0.32); g.lineTo(w * 0.65, py + h * 0.14);
      g.stroke();
    }
    return cv;
  });
  _spriteCache.set(key, sprites);
  return sprites;
}

function drawFringe(ctx, colors, xEdge, yTop, lay, dir) {
  const len = FRINGE * lay.cx * 0.92;
  for (let y = 1, k = 0; y < STITCHES - 1; y += 3, k++) {
    const col = YARN[colors[k % colors.length]];
    const py = yTop + (y + 0.5) * lay.cy;
    for (let s = -1; s <= 1; s++) {
      ctx.strokeStyle = s === 0 ? col.hex : col.shade;
      ctx.lineWidth = Math.max(1, lay.cy * 0.5);
      ctx.beginPath();
      ctx.moveTo(xEdge, py + s * lay.cy * 0.35);
      const wob = Math.sin(k * 1.7 + s) * lay.cy * 0.5;
      ctx.quadraticCurveTo(xEdge + dir * len * 0.5, py + s * lay.cy * 0.5 + wob, xEdge + dir * len * (0.9 + 0.1 * Math.sin(k * 2.3 + s)), py + s * lay.cy * 0.8 + wob);
      ctx.stroke();
    }
    ctx.fillStyle = col.shade;
    ctx.beginPath(); ctx.ellipse(xEdge + dir * lay.cx * 1.2, py, lay.cx * 1.1, lay.cy * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  }
}

/* ---- Realistische Optik ------------------------------------------------ */
function drawKnitTexture(ctx, x, y, w, h, cy, cx) {
  ctx.save();
  // Maschenstäbchen (Wales) entlang der Länge
  ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = Math.max(0.35, cy * 0.22);
  ctx.beginPath();
  for (let j = 1; j < STITCHES; j++) { const yy = y + j * cy; ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
  ctx.stroke();
  if (cx >= 1.6) {
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 0.5; ctx.beginPath();
    for (let xx = x; xx < x + w; xx += cx * 2) { ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); }
    ctx.stroke();
  }
  // Wölbung des Schals: Kanten dunkler, Mitte mit leichtem Glanz
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(0,0,0,.26)'); g.addColorStop(0.1, 'rgba(0,0,0,.04)'); g.addColorStop(0.38, 'rgba(255,255,255,.06)');
  g.addColorStop(0.62, 'rgba(255,255,255,0)'); g.addColorStop(0.9, 'rgba(0,0,0,.06)'); g.addColorStop(1, 'rgba(0,0,0,.30)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
}

const THREAD = {
  W: { hi: '#FFFFFF', lo: '#E2DDD3', edge: 'rgba(80,70,60,.55)' },
  G: { hi: '#F7DE8E', lo: '#B4862A', edge: 'rgba(90,60,10,.6)' },
  N: { hi: '#45454C', lo: '#141417', edge: 'rgba(0,0,0,.6)' },
  R: { hi: '#FF5570', lo: '#BE0329', edge: 'rgba(80,0,15,.6)' },
  B: { hi: '#3D9BE6', lo: '#005CA3', edge: 'rgba(0,30,70,.6)' },
  S: { hi: '#FFFFFF', lo: '#9CA5AF', edge: 'rgba(40,50,60,.55)' },
};

function overlayText(ctx, o, ox, oy, k, color, opts = {}) {
  const fs = o.h / 0.7 * k;
  ctx.font = `700 ${fs}px ${SCARF_FONT}`;
  const m = ctx.measureText(o.text);
  const sx = Math.min(1, (o.maxW * k) / Math.max(1, m.width));
  o.w = m.width * sx / k;
  ctx.save();
  ctx.translate(ox + o.u * k, oy + o.v * k); if (o.rot) ctx.rotate(o.rot); ctx.scale(sx, 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent, by = (asc - desc) / 2;
  if (opts.flat) { ctx.fillStyle = color; ctx.fillText(o.text, 0, by); ctx.restore(); return; }
  const th = THREAD[o.color] || THREAD.W;
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = Math.max(0.8, k * 0.07); ctx.shadowOffsetY = Math.max(0.5, k * 0.045);
  const gr = ctx.createLinearGradient(0, by - asc, 0, by);
  gr.addColorStop(0, th.hi); gr.addColorStop(0.55, th.lo); gr.addColorStop(1, th.hi);
  ctx.fillStyle = gr; ctx.fillText(o.text, 0, by);
  ctx.shadowColor = 'transparent';
  if (fs >= 9) { ctx.strokeStyle = th.edge; ctx.lineWidth = Math.max(0.3, fs * 0.022); ctx.strokeText(o.text, 0, by); }
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Lokales Koordinatensystem eines gedrehten Overlay-Objekts (cm, Ursprung = Mittelpunkt)
function withLocal(ctx, o, ox, oy, k, fn) {
  ctx.save(); ctx.translate(ox + o.u * k, oy + o.v * k); if (o.rot) ctx.rotate(o.rot);
  fn(); ctx.restore();
}
function localText(ctx, k, text, x, y, h, maxW, color, align = 'center') {
  const fs = h / 0.7 * k;
  ctx.font = `700 ${fs}px ${SCARF_FONT}`;
  const t = String(text).toUpperCase(), m = ctx.measureText(t);
  const sx = Math.min(1, maxW * k / Math.max(1, m.width));
  ctx.save(); ctx.translate(x * k, y * k); ctx.scale(sx, 1);
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color;
  ctx.fillText(t, 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  ctx.restore();
}
function localShape(ctx, k, color, fn) { ctx.save(); ctx.scale(k, k); ctx.beginPath(); ctx.fillStyle = ctx.strokeStyle = color; fn(ctx); ctx.restore(); }

function drawPatchReal(ctx, o, ox, oy, k) {
  const m = o.game, w = o.w, h = o.h;
  const P = o.heart
    ? { bg: '#17171A', border: '#C9A13B', text: '#FFFFFF', score: '#EBC75F', shield: '#FFFFFF', abbr: '#17171A', stitch: '#C9A13B', dim: 'rgba(255,255,255,.72)' }
    : { bg: '#F6F1E6', border: '#7E0B1D', text: '#1C1C1F', score: '#C8102E', shield: '#1C1C1F', abbr: '#FFFFFF', stitch: '#C8102E', dim: 'rgba(28,28,31,.65)' };
  withLocal(ctx, o, ox, oy, k, () => {
    const X = -w / 2 * k, Y = -h / 2 * k, W = w * k, H = h * k;
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = Math.max(2, k * 0.3); ctx.shadowOffsetX = o.rot ? Math.sign(o.rot) * Math.max(1, k * 0.12) : 0; ctx.shadowOffsetY = o.rot ? 0 : Math.max(1, k * 0.12);
    roundRectPath(ctx, X, Y, W, H, k * 0.55); ctx.fillStyle = P.bg; ctx.fill();
    ctx.shadowColor = 'transparent';
    roundRectPath(ctx, X + k * 0.13, Y + k * 0.13, W - k * 0.26, H - k * 0.26, k * 0.45);
    ctx.strokeStyle = P.border; ctx.lineWidth = Math.max(1, k * 0.26); ctx.stroke();
    roundRectPath(ctx, X + k * 0.5, Y + k * 0.5, W - k, H - k, k * 0.25);
    ctx.setLineDash([k * 0.22, k * 0.14]); ctx.strokeStyle = P.stitch; ctx.lineWidth = Math.max(0.5, k * 0.06); ctx.stroke(); ctx.setLineDash([]);
    const score = m.venue === 'A' ? `${m.oppGoals}:${m.fcbGoals}` : `${m.fcbGoals}:${m.oppGoals}`;
    if (o.heart) {
      localText(ctx, k, score, -4.0, -0.5, 2.5, 5.6, P.score);
      localText(ctx, k, clubName(m.opp), -4.0, 1.75, 0.5, 6.0, P.dim);
      localText(ctx, k, o.title || o.round, 3.5, -1.75, 0.72, 7.4, P.score);
      localText(ctx, k, o.round, 3.5, -0.55, 0.62, 7.4, P.text);
      localText(ctx, k, fmtDateLong(m.date), 3.5, 0.45, 0.5, 7, P.dim);
      localText(ctx, k, m.city, 3.5, 1.5, 0.64, 7, P.text);
      localShape(ctx, k, '#C8102E', c => SHAPES.heart(c, -4.0, -2.35, 0.5));
    } else {
      localText(ctx, k, score, -1.65, -0.35, 1.4, 3.0, P.score);
      localText(ctx, k, o.round, 1.8, -0.95, 0.4, 2.5, P.text);
      localText(ctx, k, fmtDate(m.date), 1.8, -0.2, 0.36, 2.5, P.dim);
      localText(ctx, k, m.city, 1.8, 0.6, 0.42, 2.5, P.text);
      localText(ctx, k, `SPIEL NR. ${m.nr}`, 0, 1.45, 0.3, 5, P.dim);
    }
  });
}

// Runder Moment-Patch nach Regeln echter Stick-Patches:
// 2 Farben (Grundstoff + Akzent), Linien ≥ 1 mm, Satinstich-Struktur statt Verläufen,
// Kordelrand, Innenring, Titel oben im Bogen, Saison unten im Bogen, ein kräftiges Motiv.
const PATCH_ACCENT = {
  1: { hi: '#F4F0E7', lo: '#C9C1B2' },   // weiß: 1× erlebt
  2: { hi: '#E4E8EC', lo: '#8D97A2' },   // silber: 2×
  3: { hi: '#EBBB4C', lo: '#A8771D' },   // gold: 3×
};
const PATCH_BASE = '#7A0A1C', PATCH_BASE_DARK = '#4E0610';

function localArcText(ctx, k, str, radius, h, top, fill) {
  const fs = h / 0.7 * k, R = radius * k;
  ctx.save();
  ctx.font = `700 ${fs}px ${SCARF_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = fill;
  const chars = [...str], ws = chars.map(c => ctx.measureText(c).width), track = fs * 0.12;
  const total = ws.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let a = (top ? -Math.PI / 2 : Math.PI / 2) + (top ? -1 : 1) * total / 2 / R;
  chars.forEach((ch, i) => {
    const half = ws[i] / 2 / R; a += (top ? 1 : -1) * half;
    ctx.save(); ctx.translate(Math.cos(a) * R, Math.sin(a) * R); ctx.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2);
    ctx.fillText(ch, 0, 0); ctx.restore();
    a += (top ? 1 : -1) * (half + track / R);
  });
  ctx.restore();
}

// Fläche im Satinstich: füllen, dann feine Stichlinien in einer Richtung, leichte Kante
function stitchFill(c, k, path, color, angle, edge = true) {
  c.save(); c.beginPath(); path(c); c.fillStyle = color; c.fill();
  c.clip();
  const sp = Math.max(0.055, 1.25 / k);
  c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = Math.max(0.012, 0.35 / k);
  c.rotate(angle); c.beginPath();
  for (let t = -3; t < 3; t += sp) { c.moveTo(t, -3); c.lineTo(t, 3); }
  c.stroke(); c.restore();
  if (!edge) return;
  c.save(); c.beginPath(); path(c); c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = Math.max(0.02, 0.6 / k); c.stroke(); c.restore();
}
function stitchStroke(c, k, path, color, width) {
  c.save(); c.beginPath(); path(c); c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = width + Math.max(0.03, 0.8 / k); c.stroke();
  c.strokeStyle = color; c.lineWidth = width; c.stroke(); c.restore();
}

const BOLT = [[0.33, -1.2], [-0.42, 0.1], [0.02, 0.1], [-0.3, 1.2], [0.5, -0.16], [0.07, -0.16], [0.58, -1.2]];
const polyPath = (pts, dx = 0, dy = 0) => c => { pts.forEach(([x, y], i) => i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy)); c.closePath(); };
const heartPath = (s, dy = 0) => c => { c.moveTo(0, 0.95 * s + dy); c.bezierCurveTo(-1.6 * s, -0.05 * s + dy, -0.85 * s, -1.35 * s + dy, 0, -0.48 * s + dy); c.bezierCurveTo(0.85 * s, -1.35 * s + dy, 1.6 * s, -0.05 * s + dy, 0, 0.95 * s + dy); c.closePath(); };

const PATCH_ICONS = {
  // TORRAUSCH: Ball mit drei Tempo-Flammen
  spark(c, k, A) {
    for (const [y, len] of [[-0.42, 0.7], [0, 0.95], [0.42, 0.7]]) stitchFill(c, k, polyPath([[-0.48 - len, y], [-0.42, y - 0.13], [-0.42, y + 0.13]]), A.hi, 0);
    stitchFill(c, k, cc => cc.arc(0.32, 0, 0.8, 0, 7), A.hi, 0.6);
    c.save(); c.beginPath(); c.arc(0.32, 0, 0.8, 0, 7); c.clip();
    const pent = []; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; pent.push([0.32 + Math.cos(a) * 0.27, Math.sin(a) * 0.27]); }
    c.beginPath(); polyPath(pent)(c); c.fillStyle = PATCH_BASE; c.fill();
    c.strokeStyle = PATCH_BASE; c.lineWidth = 0.06; c.beginPath();
    pent.forEach(([x, y]) => { c.moveTo(x, y); c.lineTo(0.32 + (x - 0.32) * 2.1, y * 2.1); }); c.stroke();
    c.beginPath(); c.arc(0.32, 0, 0.8, 0, 7); c.lineWidth = 0.08; c.stroke();
    c.restore();
  },
  // KLASSIKER: Doppelblitz
  cross(c, k, A) {
    stitchFill(c, k, polyPath(BOLT, -0.3, 0), A.hi, 1.05);
    c.save(); c.beginPath(); polyPath(BOLT, 0.3, 0)(c); c.lineWidth = 0.16; c.strokeStyle = PATCH_BASE; c.lineJoin = 'miter'; c.stroke(); c.restore();
    stitchFill(c, k, polyPath(BOLT, 0.3, 0), A.hi, 1.05);
  },
  // NIEMALS AUFGEBEN: Zickzack-Pfeil nach oben
  arrow(c, k, A) {
    const line = cc => { cc.moveTo(-1.15, 0.95); cc.lineTo(-0.42, 0.12); cc.lineTo(-0.08, 0.5); cc.lineTo(0.72, -0.52); };
    c.save(); c.lineJoin = 'miter'; c.lineCap = 'butt';
    c.beginPath(); line(c); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 0.4; c.stroke();
    c.beginPath(); line(c); c.strokeStyle = A.hi; c.lineWidth = 0.34; c.stroke();
    c.beginPath(); line(c); c.strokeStyle = PATCH_BASE; c.lineWidth = 0.07; c.stroke();
    c.restore();
    stitchFill(c, k, polyPath([[1.2, -1.0], [0.38, -0.92], [1.08, -0.2]]), A.hi, 0.8);
  },
  // STURMERPROBT: Wolke, Blitz, Regen
  rain(c, k, A) {
    stitchFill(c, k, cc => { cc.arc(-0.5, -0.38, 0.42, 0, 7); cc.moveTo(0.48, -0.62); cc.arc(-0.02, -0.62, 0.5, 0, 7); cc.moveTo(0.92, -0.4); cc.arc(0.5, -0.4, 0.42, 0, 7); cc.rect(-0.92, -0.4, 1.84, 0.4); }, A.hi, 0, false);
    stitchFill(c, k, polyPath([[0.12, 0.02], [-0.28, 0.6], [-0.04, 0.6], [-0.22, 1.15], [0.32, 0.42], [0.08, 0.42], [0.3, 0.02]]), A.hi, 1.1);
    for (const x of [-0.75, -0.5, 0.62, 0.87]) stitchStroke(c, k, cc => { cc.moveTo(x, 0.22); cc.lineTo(x - 0.16, 0.66); }, A.hi, 0.1);
  },
  // UNBESIEGBAR: Schild mit Zinnen
  zigzag(c, k, A) {
    const shield = (s, dy) => cc => {
      const p = [[-0.85, -1.15], [-0.5, -1.15], [-0.5, -0.9], [-0.17, -0.9], [-0.17, -1.15], [0.17, -1.15], [0.17, -0.9], [0.5, -0.9], [0.5, -1.15], [0.85, -1.15], [0.85, 0.1]];
      p.forEach(([x, y], i) => i ? cc.lineTo(x * s, y * s + dy) : cc.moveTo(x * s, y * s + dy));
      cc.quadraticCurveTo(0.85 * s, 0.85 * s + dy, 0, 1.22 * s + dy); cc.quadraticCurveTo(-0.85 * s, 0.85 * s + dy, -0.85 * s, 0.1 * s + dy); cc.closePath();
    };
    stitchFill(c, k, shield(1, 0), A.hi, 1.57);
    c.save(); c.beginPath();
    c.moveTo(-0.52, -0.62); c.lineTo(0.52, -0.62); c.lineTo(0.52, 0.12); c.quadraticCurveTo(0.52, 0.62, 0, 0.9); c.quadraticCurveTo(-0.52, 0.62, -0.52, 0.12); c.closePath();
    c.lineWidth = 0.1; c.strokeStyle = PATCH_BASE; c.lineJoin = 'miter'; c.stroke(); c.restore();
  },
  // LAST MINUTE: Stoppuhr mit 90+
  heart(c, k, A) {
    stitchStroke(c, k, cc => cc.arc(0, 0.12, 0.9, 0, 7), A.hi, 0.22);
    stitchFill(c, k, cc => { cc.rect(-0.16, -1.02, 0.32, 0.2); cc.rect(-0.32, -1.22, 0.64, 0.17); }, A.hi, 0);
    stitchFill(c, k, cc => { cc.save(); cc.translate(0.78, -0.62); cc.rotate(0.8); cc.rect(-0.1, -0.13, 0.2, 0.26); cc.restore(); }, A.hi, 0);
    c.save(); c.scale(1 / k, 1 / k); c.font = `700 ${0.62 / 0.7 * k}px ${SCARF_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = A.hi;
    c.fillText('90+', 0, 0.16 * k); c.restore();
  },
  // TROTZDEM DA: Herz mit Steppnaht
  diamond(c, k, A) {
    stitchFill(c, k, heartPath(1.05, 0.05), A.hi, 0.75);
    c.save(); c.beginPath(); heartPath(0.68, 0.05)(c); c.setLineDash([0.13, 0.09]); c.lineWidth = 0.075; c.strokeStyle = PATCH_BASE; c.stroke(); c.restore();
  },
  // DAUERBRENNER: Flamme
  home(c, k, A) {
    const flame = (s, dy) => cc => {
      cc.moveTo(0, -1.25 * s + dy); cc.bezierCurveTo(0.78 * s, -0.45 * s + dy, 0.95 * s, 0.25 * s + dy, 0.68 * s, 0.78 * s + dy);
      cc.quadraticCurveTo(0.36 * s, 1.22 * s + dy, 0, 1.22 * s + dy); cc.quadraticCurveTo(-0.36 * s, 1.22 * s + dy, -0.68 * s, 0.78 * s + dy);
      cc.bezierCurveTo(-0.95 * s, 0.22 * s + dy, -0.5 * s, -0.2 * s + dy, -0.22 * s, -0.72 * s + dy); cc.quadraticCurveTo(-0.08 * s, -0.3 * s + dy, 0.1 * s, -0.42 * s + dy); cc.quadraticCurveTo(0.22 * s, -0.85 * s + dy, 0, -1.25 * s + dy); cc.closePath();
    };
    stitchFill(c, k, flame(1, 0), A.hi, 1.45);
    c.save(); c.beginPath(); c.moveTo(0, -0.08); c.bezierCurveTo(0.42, 0.3, 0.46, 0.78, 0.2, 1.0); c.quadraticCurveTo(0, 1.08, -0.2, 1.0); c.bezierCurveTo(-0.46, 0.78, -0.32, 0.34, 0, -0.08); c.closePath(); c.fillStyle = PATCH_BASE; c.fill(); c.restore();
  },
};

function drawMarkReal(ctx, o, ox, oy, k) {
  const A = PATCH_ACCENT[o.version] || PATCH_ACCENT[1], R = o.r || 2.75;
  withLocal(ctx, o, ox, oy, k, () => {
    // aufgenäht: flacher Schatten
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = Math.max(1.5, k * 0.12); ctx.shadowOffsetY = Math.max(0.6, k * 0.05);
    ctx.beginPath(); ctx.arc(0, 0, R * k, 0, 7); ctx.fillStyle = PATCH_BASE; ctx.fill(); ctx.restore();
    ctx.save(); ctx.scale(k, k);
    // Köperbindung des Grundstoffs
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 0.3, 0, 7); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = Math.max(0.012, 0.3 / k); ctx.beginPath();
    const sp = Math.max(0.08, 1.5 / k); for (let t = -2 * R; t < 2 * R; t += sp) { ctx.moveTo(t, -R); ctx.lineTo(t + R, R); } ctx.stroke(); ctx.restore();
    // Kordelrand: Grundring + schräge Stiche
    ctx.beginPath(); ctx.arc(0, 0, R - 0.16, 0, 7); ctx.lineWidth = 0.32; ctx.strokeStyle = A.lo; ctx.stroke();
    const n = Math.round(2 * Math.PI * R / Math.max(0.09, 1.6 / k));
    ctx.strokeStyle = A.hi; ctx.lineWidth = Math.max(0.025, 0.5 / k); ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI, b = a + 0.035; ctx.moveTo(Math.cos(a) * (R - 0.3), Math.sin(a) * (R - 0.3)); ctx.lineTo(Math.cos(b) * (R - 0.02), Math.sin(b) * (R - 0.02)); }
    ctx.stroke();
    // Innenring
    ctx.beginPath(); ctx.arc(0, 0, R - 0.55, 0, 7); ctx.lineWidth = 0.07; ctx.strokeStyle = A.hi; ctx.stroke();
    // Motiv
    ctx.save(); ctx.translate(0, 0.02); ctx.scale(0.92, 0.92);
    (PATCH_ICONS[o.icon] || PATCH_ICONS.diamond)(ctx, k * 0.92, A);
    ctx.restore();
    // Trennrauten zwischen Ober- und Unterschrift
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * (R - 0.98), 0); ctx.rotate(Math.PI / 4); ctx.fillStyle = A.hi; ctx.fillRect(-0.07, -0.07, 0.14, 0.14); ctx.restore(); }
    ctx.restore();
    const long = o.label.length > 12;
    localArcText(ctx, k, o.label, R - 0.98, long ? 0.4 : 0.48, true, A.hi);
    localArcText(ctx, k, o.season || '', R - 0.98, 0.3, false, A.hi);
  });
}

// Eingestickte Trophäe oder Stern
function drawShapeReal(ctx, o, ox, oy, k) {
  const th = THREAD[o.color] || THREAD.W;
  withLocal(ctx, o, ox, oy, k, () => {
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = Math.max(0.8, k * 0.07); ctx.shadowOffsetY = Math.max(0.5, k * 0.045);
    const s = o.size, gr = ctx.createLinearGradient(0, -s * k / 2, 0, s * k / 2);
    gr.addColorStop(0, th.hi); gr.addColorStop(0.6, th.lo); gr.addColorStop(1, th.hi);
    ctx.save(); ctx.scale(k, k); ctx.beginPath(); ctx.fillStyle = ctx.strokeStyle = gr;
    ctx.setTransform(ctx.getTransform()); // Verlauf in cm-Koordinaten
    const g2 = ctx.createLinearGradient(0, -s / 2, 0, s / 2); g2.addColorStop(0, th.hi); g2.addColorStop(0.6, th.lo); g2.addColorStop(1, th.hi);
    ctx.fillStyle = ctx.strokeStyle = g2;
    if (SHAPES[o.shape]) SHAPES[o.shape](ctx, 0, 0, s); else SHAPES.star(ctx, 0, 0, s);
    ctx.restore();
  });
}

// Aufgestickte Silberkordel
function drawBarReal(ctx, o, ox, oy, k) {
  const x = ox + o.u0 * k, y = oy + o.v0 * k, w = (o.u1 - o.u0) * k, h = (o.v1 - o.v0) * k;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = Math.max(1, k * 0.08); ctx.shadowOffsetY = Math.max(0.5, k * 0.04);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#8D96A0'); g.addColorStop(0.45, '#F4F6F8'); g.addColorStop(1, '#A4ADB6');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.shadowColor = 'transparent';
  if (k >= 4) { ctx.strokeStyle = 'rgba(70,80,90,.35)'; ctx.lineWidth = Math.max(0.4, k * 0.03); ctx.beginPath(); for (let yy = y; yy < y + h; yy += Math.max(1.5, k * 0.22)) { ctx.moveTo(x, yy + w * 0.6); ctx.lineTo(x + w, yy); } ctx.stroke(); }
  ctx.restore();
}

function overlayBox(o) {
  const rotated = o.rot && Math.abs(Math.abs(o.rot) - Math.PI / 2) < 0.01;
  const box = (w, h) => rotated ? [o.u - h / 2, o.u + h / 2, o.v - w / 2, o.v + w / 2] : [o.u - w / 2, o.u + w / 2, o.v - h / 2, o.v + h / 2];
  if (o.kind === 'bar') return [o.u0, o.u1, o.v0, o.v1];
  if (o.kind === 'patch') return box(o.w, o.h);
  if (o.kind === 'mark') return box(2 * (o.r || 2.75), 2 * (o.r || 2.75));
  if (o.kind === 'shape') { const s = o.shape === 'plate' ? o.size * 2.1 : o.shape === 'bigEars' ? o.size * 1.6 : o.size * 1.3; return box(s, s); }
  const w = o.w != null ? o.w : Math.min(o.maxW, o.text.length * o.h * 0.55);
  return box(w + 0.3, o.h + 0.4);
}

function drawOverlay(ctx, model, ox, oy, k, mode) {
  for (const o of model.overlay || []) {
    if (mode === 'real') {
      if (o.kind === 'patch') drawPatchReal(ctx, o, ox, oy, k);
      else if (o.kind === 'mark') drawMarkReal(ctx, o, ox, oy, k);
      else if (o.kind === 'shape') drawShapeReal(ctx, o, ox, oy, k);
      else if (o.kind === 'bar') drawBarReal(ctx, o, ox, oy, k);
      else overlayText(ctx, o, ox, oy, k);
      continue;
    }
    // Produktionsansicht: nur Umrisse der Stick- und Patch-Flächen
    if (o.kind === 'emb') overlayText(ctx, o, ox, oy, k, 'rgba(255,216,77,.9)', { flat: true });
    const [u0, u1, v0, v1] = overlayBox(o);
    ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = o.kind === 'emb' ? 'rgba(255,216,77,.7)' : '#FFD84D'; ctx.lineWidth = 1;
    ctx.strokeRect(ox + u0 * k, oy + v0 * k, (u1 - u0) * k, (v1 - v0) * k);
    if (o.kind !== 'emb') { ctx.fillStyle = '#FFD84D'; ctx.font = `700 ${Math.max(7, k * 0.55)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(o.kind === 'patch' ? 'PATCH' : o.kind === 'bar' ? 'KORDEL' : 'STICK', ox + (u0 + u1) / 2 * k, oy + (v0 + v1) / 2 * k + 3); }
    ctx.restore();
  }
}

function itemAt(model, x, y) {
  const u = (x + 0.5) / ROWS_PER_CM, v = (y + 0.5) / ST_PER_CM;
  const list = model.overlay || [];
  for (let i = list.length - 1; i >= 0; i--) { const [a, b, c, d] = overlayBox(list[i]); if (u >= a && u <= b && v >= c && v <= d) return list[i]; }
  return null;
}

function hitTest(lay, model, px, py) {
  for (let s = 0; s < lay.segs; s++) {
    const o = segOrigin(lay, s);
    if (py < o.y || py >= o.y + lay.segH) continue;
    const x = s * lay.segLen + Math.floor((px - o.x) / lay.cx);
    const y = Math.floor((py - o.y) / lay.cy);
    if (px < o.x || x < s * lay.segLen || x >= Math.min(model.L, (s + 1) * lay.segLen)) return null;
    return { x, y, seg: s };
  }
  return null;
}

function groupKey(t) {
  if (!t) return null;
  if (t.el) return 'el:' + t.el;
  if (t.type === 'panel') return 'panel:' + t.game.nr;
  return t.type;
}
function tagAtCell(model, x, y) { return model.tagList[model.tags[x * model.W + y]]; }

// Hebt alle Maschen hervor, die zum selben Element gehören wie die Masche (x, y)
function drawHover(canvas, lay, model, hit) {
  const ctx = setupCanvas(canvas, lay);
  if (!hit) return;
  if (hit.item) {
    const [u0, u1, v0, v1] = overlayBox(hit.item), k = lay.cx * ROWS_PER_CM, o = segOrigin(lay, 0);
    ctx.strokeStyle = '#FFD84D'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 4;
    roundRectPath(ctx, o.x + u0 * k - 2, o.y + v0 * k - 2, (u1 - u0) * k + 4, (v1 - v0) * k + 4, 4); ctx.stroke();
    return;
  }
  const key = groupKey(tagAtCell(model, hit.x, hit.y));
  if (!key || key === 'el:base' || key === 'backBase') return;
  const W = model.W, keys = new Array(model.tagList.length);
  model.tagList.forEach((t, i) => { keys[i] = groupKey(t) === key; });
  const match = (x, y) => x >= 0 && x < model.L && y >= 0 && y < W && keys[model.tags[x * W + y]];
  for (let s = 0; s < lay.segs; s++) {
    const sx0 = s * lay.segLen, sx1 = Math.min(model.L, sx0 + lay.segLen);
    const o = segOrigin(lay, s);
    ctx.fillStyle = 'rgba(255,216,77,.35)';
    ctx.beginPath();
    const edges = [];
    for (let x = sx0; x < sx1; x++) for (let y = 0; y < W; y++) {
      if (!match(x, y)) continue;
      const px = o.x + (x - sx0) * lay.cx, py = o.y + y * lay.cy;
      ctx.rect(px, py, lay.cx + 0.3, lay.cy + 0.3);
      if (!match(x - 1, y)) edges.push([px, py, px, py + lay.cy]);
      if (!match(x + 1, y)) edges.push([px + lay.cx, py, px + lay.cx, py + lay.cy]);
      if (!match(x, y - 1)) edges.push([px, py, px + lay.cx, py]);
      if (!match(x, y + 1)) edges.push([px, py + lay.cy, px + lay.cx, py + lay.cy]);
    }
    ctx.fill();
    ctx.strokeStyle = '#FFD84D'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const [a, b, c, d] of edges) { ctx.moveTo(a, b); ctx.lineTo(c, d); }
    ctx.stroke();
  }
}

function drawLens(canvas, model, x, y, knit, orient = null, zoomCy = 9) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 260, h = canvas.clientHeight || 170;
  // In der Hochkant-Ansicht wird die Lupe genauso gedreht wie der Schal
  const hw = orient ? h : w, hh = orient ? w : h;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#e9e5dc'; ctx.fillRect(0, 0, w, h);
  if (orient === 'A') ctx.setTransform(0, -dpr, dpr, 0, 0, hw * dpr);
  if (orient === 'B') ctx.setTransform(0, dpr, -dpr, 0, hh * dpr, 0);
  const cy = zoomCy, cx = cy * STITCH_ASPECT;
  const nx = Math.ceil(hw / cx), ny = Math.ceil(hh / cy);
  const x0 = Math.max(0, Math.min(model.L - nx, x - Math.floor(nx / 2)));
  const y0 = Math.max(0, Math.min(model.W - ny, y - Math.floor(ny / 2)));
  drawCells(ctx, model, x0, Math.min(model.L, x0 + nx), y0, Math.min(model.W, y0 + ny), -x0 * cx, -y0 * cy, cx, cy, { knit });
  drawOverlay(ctx, model, -x0 * cx, -y0 * cy, cx * ROWS_PER_CM, 'real');
}

function drawThumb(canvas, model, width, markEls) {
  const dpr = window.devicePixelRatio || 1;
  const cx = width / model.L, cy = cx / STITCH_ASPECT * 1.6;
  const h = model.W * cy;
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = width + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCells(ctx, model, 0, model.L, 0, model.W, 0, 0, cx, cy, { knit: false, markEls });
}

function patternPNG(model) {
  const c = document.createElement('canvas');
  const cx = 4, cy = 5;
  c.width = model.L * cx; c.height = model.W * cy;
  const ctx = c.getContext('2d');
  drawCells(ctx, model, 0, model.L, 0, model.W, 0, 0, cx, cy, { knit: false });
  return c.toDataURL('image/png');
}

/* ---- Hängeansicht: der Schal in der Mitte gefaltet, beide Enden hängen nach unten ----
   Hälfte A (Reihen 0 … L/2) mit Ende A unten, Hälfte B (L/2 … L) mit Ende B unten.
   So steht die Schrift an beiden Enden richtig herum und der Schal ist doppelt so groß. */
const FOLD_CM = 1.2;
function layoutHalf(model, lengthPx, half) {
  const mid = Math.ceil(model.L / 2);
  const x0 = half === 'A' ? 0 : mid, x1 = half === 'A' ? mid : model.L;
  const fold = FOLD_CM * ROWS_PER_CM;
  const units = (x1 - x0) + FRINGE + fold;
  const cx = lengthPx / units, cy = cx / STITCH_ASPECT;
  const segH = model.W * cy, pad = 6;
  // horizontaler Rahmen: Hälfte A hat die Fransen links, Hälfte B rechts
  const ox = half === 'A' ? FRINGE * cx : fold * cx;
  return { half, x0, x1, cx, cy, ox, oy: pad, segH, width: lengthPx, height: segH + 2 * pad, orient: half, fold };
}

function drawHalf(canvas, model, lay, opts) {
  const ctx = setupCanvas(canvas, lay);
  const { x0, x1, cx, cy, ox, oy, segH } = lay, w = (x1 - x0) * cx;
  ctx.save(); ctx.shadowColor = 'rgba(10,10,20,.28)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#000'; ctx.fillRect(ox, oy, w, segH); ctx.restore();
  drawCells(ctx, model, x0, x1, 0, model.W, ox - x0 * cx, oy, cx, cy, opts);
  ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, w, segH); ctx.clip();
  if (opts.real) drawKnitTexture(ctx, ox, oy, w, segH, cy, cx);
  drawOverlay(ctx, model, ox - x0 * cx, oy, cx * ROWS_PER_CM, opts.real ? 'real' : 'raster');
  // Falte an der Oberkante (zur Schalmitte): Schatten wie über einer Stange
  const fx = lay.half === 'A' ? ox + w : ox, dir = lay.half === 'A' ? -1 : 1, fw = 3 * ROWS_PER_CM * cx;
  const g = ctx.createLinearGradient(fx, 0, fx + dir * fw, 0);
  g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(0.35, 'rgba(0,0,0,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(Math.min(fx, fx + dir * fw), oy, fw, segH);
  ctx.restore();
  // gerundete Falte
  ctx.save(); ctx.fillStyle = HEX[model.cells[(lay.half === 'A' ? x1 - 1 : x0) * model.W + 54]];
  const capW = lay.fold * cx;
  ctx.beginPath();
  if (lay.half === 'A') { ctx.moveTo(fx, oy); ctx.quadraticCurveTo(fx + capW * 1.6, oy + segH / 2, fx, oy + segH); }
  else { ctx.moveTo(fx, oy); ctx.quadraticCurveTo(fx - capW * 1.6, oy + segH / 2, fx, oy + segH); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill(); ctx.restore();
  if (lay.half === 'A') drawFringe(ctx, model.fringe, ox, oy, { cx, cy, segH }, -1);
  else drawFringe(ctx, model.fringe, ox + w, oy, { cx, cy, segH }, 1);
}

function hitHalf(lay, model, px, py) {
  const [X, Y] = toLayout(lay, px, py);
  const x = lay.x0 + Math.floor((X - lay.ox) / lay.cx), y = Math.floor((Y - lay.oy) / lay.cy);
  if (x < lay.x0 || x >= lay.x1 || y < 0 || y >= model.W) return null;
  return { x, y };
}

function drawHoverHalf(canvas, lay, model, hit) {
  const ctx = setupCanvas(canvas, lay);
  if (!hit) return;
  const k = lay.cx * ROWS_PER_CM, ox = lay.ox - lay.x0 * lay.cx;
  ctx.save(); ctx.beginPath(); ctx.rect(lay.ox, lay.oy - 4, (lay.x1 - lay.x0) * lay.cx, lay.segH + 8); ctx.clip();
  ctx.strokeStyle = '#FFD84D'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
  if (hit.item) {
    const [u0, u1, v0, v1] = overlayBox(hit.item);
    roundRectPath(ctx, ox + u0 * k - 2, lay.oy + v0 * k - 2, (u1 - u0) * k + 4, (v1 - v0) * k + 4, 4); ctx.stroke();
    ctx.restore(); return;
  }
  const key = groupKey(tagAtCell(model, hit.x, hit.y));
  if (!key || key === 'el:base' || key === 'backBase' || key === 'el:night') { ctx.restore(); return; }
  const W = model.W, keys = model.tagList.map(t => groupKey(t) === key);
  const match = (x, y) => x >= lay.x0 && x < lay.x1 && y >= 0 && y < W && keys[model.tags[x * W + y]];
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,216,77,.38)'; ctx.beginPath();
  const edges = [];
  for (let x = lay.x0; x < lay.x1; x++) for (let y = 0; y < W; y++) {
    if (!match(x, y)) continue;
    const px = lay.ox + (x - lay.x0) * lay.cx, py = lay.oy + y * lay.cy;
    ctx.rect(px, py, lay.cx + 0.3, lay.cy + 0.3);
    if (!match(x - 1, y)) edges.push([px, py, px, py + lay.cy]);
    if (!match(x + 1, y)) edges.push([px + lay.cx, py, px + lay.cx, py + lay.cy]);
    if (!match(x, y - 1)) edges.push([px, py, px + lay.cx, py]);
    if (!match(x, y + 1)) edges.push([px, py + lay.cy, px + lay.cx, py + lay.cy]);
  }
  ctx.fill(); ctx.beginPath(); for (const [a, b, c, d] of edges) { ctx.moveTo(a, b); ctx.lineTo(c, d); } ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
}
