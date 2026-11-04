/* =========================================================================
   Stadion gestrickt – Canvas-Darstellung (Strickoptik, Lupe, Hit-Test)
   ========================================================================= */
'use strict';

const FRINGE = 6 * ROWS_PER_CM;   // 6 cm Fransen
const STITCH_ASPECT = ST_PER_CM / ROWS_PER_CM;  // Reihenhöhe / Maschenbreite

const HEX = CI_KEYS.map(k => YARN[k].hex);
const SHADE = CI_KEYS.map(k => YARN[k].shade);

function layoutCanvas(model, cssWidth, segs) {
  const segLen = Math.ceil(model.L / segs);
  const units = segLen + FRINGE * 2;
  const cx = cssWidth / units;            // px pro Reihe (entlang x)
  const cy = cx / STITCH_ASPECT;          // px pro Masche (quer)
  const labelH = 18, gap = 14;
  const segH = model.W * cy;
  const height = segs * (segH + labelH) + (segs - 1) * gap + 4;
  return { segs, segLen, cx, cy, labelH, gap, segH, width: cssWidth, height, ox: FRINGE * cx };
}

function segOrigin(lay, i) { return { x: lay.ox, y: i * (lay.segH + lay.labelH + lay.gap) + lay.labelH }; }

function drawScarf(canvas, model, opts) {
  const dpr = window.devicePixelRatio || 1;
  const lay = layoutCanvas(model, opts.width, opts.segs);
  canvas.width = Math.round(lay.width * dpr); canvas.height = Math.round(lay.height * dpr);
  canvas.style.width = lay.width + 'px'; canvas.style.height = lay.height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, lay.width, lay.height);
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
    ctx.textAlign = 'left';
    ctx.fillText(label, s === 0 ? 0 : o.x, o.y - 4);
    if (x1 === model.L) { ctx.textAlign = 'right'; ctx.fillText('Ende B', lay.width, o.y - 4); ctx.textAlign = 'left'; }
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
      localShape(ctx, k, P.shield, c => SHAPES.shield(c, -5.9, -0.35, 1.9));
      localText(ctx, k, o.abbr, -5.9, -0.7, 0.5, 1.6, P.abbr);
      localText(ctx, k, score, -3.0, -0.3, 2.3, 4.2, P.score);
      localText(ctx, k, o.title || o.round, 3.5, -1.75, 0.72, 7.4, P.score);
      localText(ctx, k, o.round, 3.5, -0.55, 0.62, 7.4, P.text);
      localText(ctx, k, fmtDateLong(m.date), 3.5, 0.45, 0.5, 7, P.dim);
      localText(ctx, k, m.city, 3.5, 1.5, 0.64, 7, P.text);
      localShape(ctx, k, '#C8102E', c => SHAPES.heart(c, -3.0, 2.15, 0.55));
    } else {
      localShape(ctx, k, P.shield, c => SHAPES.shield(c, -2.55, -0.45, 1.25));
      localText(ctx, k, o.abbr, -2.55, -0.68, 0.32, 1.05, P.abbr);
      localText(ctx, k, score, -0.75, -0.4, 1.3, 2.4, P.score);
      localText(ctx, k, o.round, 2.05, -0.95, 0.42, 2.9, P.text);
      localText(ctx, k, fmtDate(m.date), 2.05, -0.2, 0.36, 2.9, P.dim);
      localText(ctx, k, m.city, 2.05, 0.6, 0.42, 2.9, P.text);
      localText(ctx, k, `SPIEL NR. ${m.nr}`, 0, 1.45, 0.3, 5, P.dim);
    }
  });
}

// Gesticktes Moment-Zeichen: schlichtes Symbol + Schriftzug, Version 1–3
function drawMarkReal(ctx, o, ox, oy, k) {
  const th = o.version === 3 ? THREAD.G : THREAD.W, pip = o.version >= 2 ? THREAD.G.lo : THREAD.W.lo;
  withLocal(ctx, o, ox, oy, k, () => {
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = Math.max(0.8, k * 0.06); ctx.shadowOffsetY = Math.max(0.5, k * 0.04);
    localShape(ctx, k, th.hi, c => {
      c.lineWidth = 0.17; c.lineCap = 'round'; c.lineJoin = 'round';
      const y = -0.55;
      switch (o.icon) {
        case 'zigzag': c.moveTo(-1, y + 0.4); c.lineTo(-0.5, y - 0.4); c.lineTo(0, y + 0.4); c.lineTo(0.5, y - 0.4); c.lineTo(1, y + 0.4); break;
        case 'spark': for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4, d = i % 2 ? 0.45 : 0.7; c.moveTo(-Math.cos(a) * d, y - Math.sin(a) * d); c.lineTo(Math.cos(a) * d, y + Math.sin(a) * d); } break;
        case 'cross': c.moveTo(-0.55, y - 0.55); c.lineTo(0.55, y + 0.55); c.moveTo(0.55, y - 0.55); c.lineTo(-0.55, y + 0.55); break;
        case 'arrow': c.moveTo(0, y + 0.65); c.lineTo(0, y - 0.6); c.moveTo(-0.5, y - 0.1); c.lineTo(0, y - 0.65); c.lineTo(0.5, y - 0.1); break;
        case 'heart': c.moveTo(0, y + 0.55); c.bezierCurveTo(-0.95, y - 0.05, -0.5, y - 0.85, 0, y - 0.3); c.bezierCurveTo(0.5, y - 0.85, 0.95, y - 0.05, 0, y + 0.55); break;
        case 'rain': for (const d of [-0.5, 0, 0.5]) { c.moveTo(d + 0.2, y - 0.55); c.lineTo(d - 0.2, y + 0.55); } break;
        case 'home': c.moveTo(-0.7, y + 0.6); c.lineTo(-0.7, y - 0.1); c.lineTo(0, y - 0.7); c.lineTo(0.7, y - 0.1); c.lineTo(0.7, y + 0.6); c.closePath(); break;
        default: c.moveTo(0, y - 0.65); c.lineTo(0.6, y); c.lineTo(0, y + 0.65); c.lineTo(-0.6, y); c.closePath();
      }
      c.stroke();
    });
    ctx.shadowColor = 'transparent';
    localText(ctx, k, o.label, 0, 0.85, 0.42, 4.6, th.hi);
    localShape(ctx, k, pip, c => { for (let i = 0; i < o.version; i++) { c.moveTo((i - (o.version - 1) / 2) * 0.4 + 0.09, 1.55); c.arc((i - (o.version - 1) / 2) * 0.4, 1.55, 0.09, 0, 7); } c.fill(); });
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
    if (o.shape === 'cup') SHAPES.cup(ctx, 0, 0, s); else if (o.shape === 'plate') SHAPES.plate(ctx, 0, 0, s); else SHAPES.star(ctx, 0, 0, s);
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
  if (o.kind === 'mark') return box(5.0, 3.3);
  if (o.kind === 'shape') { const s = o.shape === 'plate' ? o.size * 2.1 : o.size * 1.3; return box(s, s); }
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
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(lay.width * dpr); canvas.height = Math.round(lay.height * dpr);
  canvas.style.width = lay.width + 'px'; canvas.style.height = lay.height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, lay.width, lay.height);
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

function drawLens(canvas, model, x, y, knit) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 260, h = canvas.clientHeight || 170;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#e9e5dc'; ctx.fillRect(0, 0, w, h);
  const cy = 9, cx = cy * STITCH_ASPECT;
  const nx = Math.ceil(w / cx), ny = Math.ceil(h / cy);
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
