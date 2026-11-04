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
  N: { hi: '#33507E', lo: '#0B1B35', edge: 'rgba(0,0,0,.6)' },
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
    ? { bg: '#0E2240', border: '#C9A13B', text: '#FFFFFF', score: '#EBC75F', shield: '#FFFFFF', abbr: '#0E2240', stitch: '#C9A13B', dim: 'rgba(255,255,255,.72)' }
    : { bg: '#F6F1E6', border: '#0E2240', text: '#0E2240', score: '#C8102E', shield: '#0E2240', abbr: '#FFFFFF', stitch: '#C8102E', dim: 'rgba(14,34,64,.68)' };
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

// Runder gestickter Moment-Patch (Stil: dunkelroter Grund, Bogentitel, Illustration, Akzent weiß/silber/gold)
const PATCH_ACCENT = {
  1: { hi: '#FFFDF8', lo: '#E4DED2', edge: '#6E0A18' },
  2: { hi: '#F2F5F7', lo: '#9EA7B1', edge: '#5A0712' },
  3: { hi: '#F6D57A', lo: '#C48F2C', edge: '#5A0712' },
};
const PATCH_RED = '#8A0F22', PATCH_DARK = '#5E0815';

function localArcText(ctx, k, str, radius, h, top, fill, outline) {
  const fs = h / 0.7 * k, R = radius * k;
  ctx.save();
  ctx.font = `700 ${fs}px ${SCARF_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = [...str], ws = chars.map(c => ctx.measureText(c).width), track = fs * 0.1;
  const total = ws.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let a = (top ? -Math.PI / 2 : Math.PI / 2) + (top ? -1 : 1) * total / 2 / R;
  chars.forEach((ch, i) => {
    const half = ws[i] / 2 / R; a += (top ? 1 : -1) * half;
    ctx.save(); ctx.translate(Math.cos(a) * R, Math.sin(a) * R); ctx.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2);
    if (outline) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, fs * 0.16); ctx.strokeStyle = outline; ctx.strokeText(ch, 0, 0); }
    ctx.fillStyle = fill; ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += (top ? 1 : -1) * (half + track / R);
  });
  ctx.restore();
}

const PATCH_ICONS = {
  // Torrausch: Ball im Netz mit Flammen
  spark(c, A) {
    c.lineWidth = 0.05; c.strokeStyle = A.lo;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(0.2 + i * 0.28, -1.0); c.quadraticCurveTo(0.6 + i * 0.25, 0.1, 0.2 + i * 0.3, 1.1); c.stroke(); }
    for (let j = -2; j <= 2; j++) { c.beginPath(); c.moveTo(-0.6, j * 0.4); c.quadraticCurveTo(0.4, j * 0.36 + 0.15, 1.3, j * 0.42); c.stroke(); }
    c.fillStyle = A.hi; c.strokeStyle = PATCH_DARK; c.lineWidth = 0.06;
    for (const [dx, dy, s] of [[-1.25, -0.25, 0.75], [-1.45, 0.3, 0.6], [-1.05, 0.6, 0.5]]) {
      c.beginPath(); c.moveTo(dx - s, dy); c.quadraticCurveTo(dx - s * 0.2, dy - s * 0.45, dx + s * 0.55, dy - s * 0.05); c.quadraticCurveTo(dx, dy + s * 0.35, dx - s, dy); c.fill(); c.stroke();
    }
    c.beginPath(); c.arc(0.35, 0.05, 0.72, 0, 7); c.fillStyle = A.hi; c.fill(); c.lineWidth = 0.07; c.strokeStyle = PATCH_DARK; c.stroke();
    c.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5, p = [0.35 + Math.cos(a) * 0.26, 0.05 + Math.sin(a) * 0.26]; i ? c.lineTo(...p) : c.moveTo(...p); } c.closePath(); c.fillStyle = PATCH_DARK; c.fill();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; c.beginPath(); c.moveTo(0.35 + Math.cos(a) * 0.26, 0.05 + Math.sin(a) * 0.26); c.lineTo(0.35 + Math.cos(a) * 0.68, 0.05 + Math.sin(a) * 0.68); c.stroke(); }
  },
  // Klassiker: doppelter Blitz mit Funken
  cross(c, A) {
    const bolt = (dx) => { c.beginPath(); c.moveTo(dx + 0.35, -1.25); c.lineTo(dx - 0.45, 0.1); c.lineTo(dx + 0.02, 0.1); c.lineTo(dx - 0.35, 1.25); c.lineTo(dx + 0.5, -0.2); c.lineTo(dx + 0.02, -0.2); c.lineTo(dx + 0.55, -1.25); c.closePath(); c.fillStyle = A.hi; c.fill(); c.lineWidth = 0.07; c.strokeStyle = PATCH_DARK; c.stroke(); };
    bolt(-0.3); bolt(0.3);
    c.strokeStyle = A.hi; c.lineWidth = 0.05; c.beginPath();
    for (const [x, y, dx, dy] of [[-1.05, 0.05, -0.3, 0], [1.05, -0.15, 0.3, 0], [0.9, -0.55, 0.22, -0.12], [-0.9, 0.45, -0.22, 0.12], [0.1, -1.4, 0, -0.2]]) { c.moveTo(x, y); c.lineTo(x + dx, y + dy); }
    c.stroke();
  },
  // Niemals aufgeben: Zickzack-Pfeil nach oben rechts
  arrow(c, A) {
    const path = (off) => { c.beginPath(); c.moveTo(-1.3 + off, 1.0 + off); c.lineTo(-0.45 + off, 0.05 + off); c.lineTo(-0.15 + off, 0.45 + off); c.lineTo(0.85 + off, -0.75 + off); };
    c.lineCap = 'butt'; c.lineJoin = 'miter';
    path(0); c.lineWidth = 0.34; c.strokeStyle = PATCH_DARK; c.stroke(); c.lineWidth = 0.22; c.strokeStyle = A.hi; c.stroke();
    path(0.3); c.lineWidth = 0.07; c.strokeStyle = A.lo; c.stroke();
    c.beginPath(); c.moveTo(1.25, -1.15); c.lineTo(0.45, -0.95); c.lineTo(1.05, -0.35); c.closePath(); c.fillStyle = A.hi; c.fill(); c.lineWidth = 0.06; c.strokeStyle = PATCH_DARK; c.stroke();
  },
  // Sturmerprobt: Wolken, Blitz, Regen, Stadion
  rain(c, A) {
    c.fillStyle = PATCH_DARK; c.strokeStyle = A.lo; c.lineWidth = 0.04;
    for (const [x, y, r] of [[-0.7, -0.75, 0.42], [-0.2, -0.95, 0.5], [0.4, -0.8, 0.45], [0.85, -0.7, 0.32]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    c.strokeStyle = A.lo; c.beginPath(); for (let i = 0; i < 12; i++) { const x = -1.0 + i * 0.18; c.moveTo(x, -0.35); c.lineTo(x - 0.12, 0.25); } c.stroke();
    c.beginPath(); c.moveTo(0.15, -0.8); c.lineTo(-0.15, -0.1); c.lineTo(0.08, -0.1); c.lineTo(-0.15, 0.55); c.lineWidth = 0.09; c.strokeStyle = A.hi; c.stroke();
    c.beginPath(); c.ellipse(0, 0.75, 1.15, 0.28, 0, 0, 7); c.lineWidth = 0.14; c.strokeStyle = A.hi; c.stroke();
    c.beginPath(); c.moveTo(-1.15, 0.75); c.lineTo(-1.1, 1.2); c.lineTo(1.1, 1.2); c.lineTo(1.15, 0.75); c.lineWidth = 0.07; c.stroke();
    c.beginPath(); for (let i = -4; i <= 4; i++) { c.moveTo(i * 0.25, 1.0); c.lineTo(i * 0.25, 1.2); } c.lineWidth = 0.04; c.stroke();
  },
  // Unbesiegbar: Schild mit Zinnen
  zigzag(c, A) {
    c.lineJoin = 'miter'; c.strokeStyle = A.hi;
    c.beginPath(); c.moveTo(-0.85, -1.2); c.lineTo(-0.85, -0.95); c.lineTo(-0.55, -0.95); c.lineTo(-0.55, -1.2); c.lineTo(-0.15, -1.2); c.lineTo(-0.15, -0.95); c.lineTo(0.15, -0.95); c.lineTo(0.15, -1.2); c.lineTo(0.55, -1.2); c.lineTo(0.55, -0.95); c.lineTo(0.85, -0.95); c.lineTo(0.85, -1.2);
    c.lineTo(0.85, 0.15); c.quadraticCurveTo(0.85, 0.85, 0, 1.25); c.quadraticCurveTo(-0.85, 0.85, -0.85, 0.15); c.closePath(); c.lineWidth = 0.16; c.stroke();
    c.beginPath(); c.moveTo(-0.55, -0.6); c.lineTo(0.55, -0.6); c.lineTo(0.55, 0.15); c.quadraticCurveTo(0.55, 0.65, 0, 0.92); c.quadraticCurveTo(-0.55, 0.65, -0.55, 0.15); c.closePath(); c.lineWidth = 0.09; c.stroke();
  },
  // Last Minute: Stoppuhr mit 90+
  heart(c, A) {
    c.strokeStyle = A.hi; c.fillStyle = A.hi;
    c.beginPath(); c.arc(0, 0.15, 1.0, 0, 7); c.lineWidth = 0.15; c.stroke();
    c.beginPath(); c.rect(-0.17, -1.17, 0.34, 0.25); c.fill(); c.beginPath(); c.rect(-0.3, -1.32, 0.6, 0.15); c.fill();
    c.beginPath(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.moveTo(Math.cos(a) * 0.78, 0.15 + Math.sin(a) * 0.78); c.lineTo(Math.cos(a) * 0.88, 0.15 + Math.sin(a) * 0.88); } c.lineWidth = 0.05; c.stroke();
    c.beginPath(); c.moveTo(0, 0.15); c.lineTo(-0.12, -0.6); c.lineWidth = 0.08; c.stroke();
  },
  // Trotzdem da: doppeltes Herz
  diamond(c, A) {
    const heart = (s) => { c.beginPath(); c.moveTo(0, 0.95 * s); c.bezierCurveTo(-1.7 * s, -0.1 * s, -0.85 * s, -1.4 * s, 0, -0.5 * s); c.bezierCurveTo(0.85 * s, -1.4 * s, 1.7 * s, -0.1 * s, 0, 0.95 * s); };
    c.translate(0, 0.15); heart(1.0); c.lineWidth = 0.15; c.strokeStyle = A.hi; c.stroke();
    heart(0.62); c.lineWidth = 0.06; c.setLineDash([0.12, 0.08]); c.strokeStyle = A.lo; c.stroke(); c.setLineDash([]);
  },
  // Dauerbrenner: Flamme
  home(c, A) {
    c.beginPath(); c.moveTo(0, -1.25); c.bezierCurveTo(0.75, -0.45, 0.95, 0.2, 0.7, 0.75); c.quadraticCurveTo(0.35, 1.25, 0, 1.25); c.quadraticCurveTo(-0.35, 1.25, -0.7, 0.75); c.bezierCurveTo(-0.95, 0.2, -0.45, -0.25, -0.2, -0.75); c.quadraticCurveTo(-0.05, -0.3, 0.1, -0.45); c.quadraticCurveTo(0.2, -0.85, 0, -1.25);
    c.fillStyle = A.hi; c.fill(); c.lineWidth = 0.06; c.strokeStyle = PATCH_DARK; c.stroke();
    c.beginPath(); c.moveTo(0, -0.1); c.bezierCurveTo(0.4, 0.3, 0.45, 0.75, 0.2, 1.0); c.quadraticCurveTo(0, 1.1, -0.2, 1.0); c.bezierCurveTo(-0.45, 0.75, -0.3, 0.35, 0, -0.1); c.fillStyle = PATCH_RED; c.fill();
  },
};

function drawMarkReal(ctx, o, ox, oy, k) {
  const A = PATCH_ACCENT[o.version] || PATCH_ACCENT[1], R = o.r || 2.75;
  withLocal(ctx, o, ox, oy, k, () => {
    // Grundkörper mit Schatten
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = Math.max(2, k * 0.3); ctx.shadowOffsetX = o.rot ? Math.sign(o.rot) * Math.max(1, k * 0.12) : 0;
    ctx.beginPath(); ctx.arc(0, 0, R * k, 0, 7); ctx.fillStyle = PATCH_RED; ctx.fill(); ctx.restore();
    ctx.save(); ctx.scale(k, k);
    // Stoffstruktur
    if (k >= 5) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 0.3, 0, 7); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 0.03; ctx.beginPath(); for (let t = -R; t < R; t += 0.09) { ctx.moveTo(t, -R); ctx.lineTo(t, R); } ctx.stroke(); ctx.restore(); }
    // gedrehter Overlock-Rand (Kordel)
    ctx.beginPath(); ctx.arc(0, 0, R - 0.14, 0, 7); ctx.lineWidth = 0.28; ctx.strokeStyle = A.lo; ctx.stroke();
    if (o.version === 3) { ctx.save(); ctx.setLineDash([0.07, 0.11]); ctx.strokeStyle = PATCH_RED; ctx.lineWidth = 0.28; ctx.stroke(); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(0, 0, R - 0.14, 0, 7); ctx.setLineDash([0.05, 0.08]); ctx.lineWidth = 0.28; ctx.strokeStyle = A.hi; ctx.stroke(); ctx.setLineDash([]); }
    ctx.beginPath(); ctx.arc(0, 0, R - 0.52, 0, 7); ctx.lineWidth = 0.07; ctx.strokeStyle = A.hi; ctx.stroke();
    const titleBottom = o.icon === 'zigzag';
    // Illustration
    ctx.save(); ctx.translate(0, titleBottom ? -0.35 : 0.42); ctx.scale(0.95, 0.95);
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 0.06; ctx.shadowOffsetY = 0.03;
    (PATCH_ICONS[o.icon] || PATCH_ICONS.diamond)(ctx, A);
    ctx.restore();
    ctx.restore();
    // Titel im Bogen (Unbesiegbar unten, sonst oben), mit dunkler Kontur
    localArcText(ctx, k, o.label, R - 1.0, o.label.length > 12 ? 0.5 : 0.6, !titleBottom, A.hi, PATCH_DARK);
    if (o.icon === 'heart') localText(ctx, k, '90+', 0, 0.62, 0.42, 1.2, A.hi);
    if (o.icon === 'home') localText(ctx, k, '17/17', 0, 2.05, 0.32, 1.2, A.hi);
    if (titleBottom) localShape(ctx, k, A.hi, c => SHAPES.star(c, 0, 1.12, 0.12));
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

function drawLens(canvas, model, x, y, knit, orient = null) {
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
  const cy = 9, cx = cy * STITCH_ASPECT;
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
