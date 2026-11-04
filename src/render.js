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

function drawPatchReal(ctx, o, ox, oy, k) {
  const x = ox + o.u0 * k, y = oy + o.v0 * k, w = (o.u1 - o.u0) * k, h = (o.v1 - o.v0) * k, m = o.game;
  const P = o.heart
    ? { bg: '#0E2240', border: '#C9A13B', text: '#FFFFFF', score: '#EBC75F', shield: '#FFFFFF', abbr: '#0E2240', stitch: '#C9A13B', dim: 'rgba(255,255,255,.75)' }
    : { bg: '#F6F1E6', border: '#0E2240', text: '#0E2240', score: '#C8102E', shield: '#0E2240', abbr: '#FFFFFF', stitch: '#C8102E', dim: 'rgba(14,34,64,.7)' };
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = Math.max(2, k * 0.35); ctx.shadowOffsetY = Math.max(1, k * 0.14);
  roundRectPath(ctx, x, y, w, h, k * 0.75); ctx.fillStyle = P.bg; ctx.fill();
  ctx.shadowColor = 'transparent';
  if (k >= 5) { // Webstruktur
    ctx.save(); roundRectPath(ctx, x, y, w, h, k * 0.75); ctx.clip();
    ctx.strokeStyle = o.heart ? 'rgba(255,255,255,.035)' : 'rgba(14,34,64,.035)'; ctx.lineWidth = 0.6; ctx.beginPath();
    for (let yy = y; yy < y + h; yy += Math.max(1.5, k * 0.12)) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
    ctx.stroke(); ctx.restore();
  }
  // Overlock-Rand und Ziernaht
  roundRectPath(ctx, x + k * 0.15, y + k * 0.15, w - k * 0.3, h - k * 0.3, k * 0.62);
  ctx.strokeStyle = P.border; ctx.lineWidth = Math.max(1, k * 0.3); ctx.stroke();
  roundRectPath(ctx, x + k * 0.62, y + k * 0.62, w - k * 1.24, h - k * 1.24, k * 0.35);
  ctx.setLineDash([k * 0.26, k * 0.17]); ctx.strokeStyle = P.stitch; ctx.lineWidth = Math.max(0.5, k * 0.07); ctx.stroke(); ctx.setLineDash([]);
  // Inhalt (in cm)
  const T = (text, u, v, hh, maxW, color) => overlayText(ctx, { text: String(text).toUpperCase(), u, v, h: hh, maxW }, ox, oy, k, color, { flat: true });
  const S = (fn, color) => { ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k); ctx.beginPath(); ctx.fillStyle = ctx.strokeStyle = color; fn(ctx); ctx.restore(); };
  const uc = (o.u0 + o.u1) / 2, v0 = o.v0, len = o.u1 - o.u0;
  const su = o.u0 + (o.heart ? 2.4 : 2.1);
  S(c => SHAPES.shield(c, su, v0 + 2.4, 1.9), P.shield);
  T(o.abbr, su, v0 + 2.05, 0.5, 1.6, P.abbr);
  const score = m.venue === 'A' ? `${m.oppGoals}:${m.fcbGoals}` : `${m.fcbGoals}:${m.oppGoals}`;
  T(score, (su + 1.2 + o.u1 - 0.9) / 2, v0 + 2.4, 2.0, o.u1 - su - 2.3, P.score);
  T(o.round, uc, v0 + 5.0, 0.85, len - 1.8, P.text);
  T(fmtDateLong(m.date), uc, v0 + 6.5, 0.72, len - 2, P.dim);
  S(c => { c.lineWidth = 0.05; c.moveTo(o.u0 + 1.4, v0 + 7.6); c.lineTo(o.u1 - 1.4, v0 + 7.6); c.stroke(); }, P.dim);
  const iconCol = o.heart ? P.score : '#B4862A';
  if (m.final) S(c => SHAPES.cup(c, uc, v0 + 9.8, 2.5), iconCol);
  else if (m.titleClinch) S(c => SHAPES.plate(c, uc, v0 + 9.8, 1.25), iconCol);
  else if (m.comp === 'CL') S(c => SHAPES.star(c, uc, v0 + 9.8, 1.15), o.heart ? P.score : P.text);
  else T(m.venue === 'H' ? 'HEIMSPIEL' : m.venue === 'A' ? 'AUSWÄRTS' : 'FINALE', uc, v0 + 9.8, 0.8, len - 2, P.score);
  T(`SPIEL NR. ${m.nr}`, uc, v0 + 12.1, 0.68, len - 2, P.dim);
  T(m.city, uc, v0 + 13.5, 0.85, len - 2, P.text);
  if (o.heart) for (const d of [-1, 1]) S(c => SHAPES.heart(c, uc + d * (len / 2 - 1.6), v0 + 12.0, 0.7), '#C8102E');
  ctx.restore();
}

function overlayBox(o) {
  if (o.kind === 'patch') return [o.u0, o.u1, o.v0, o.v1];
  if (o.kind === 'badge') return [o.u - o.r, o.u + o.r, o.v - o.r, o.v + o.r];
  const w = o.w != null ? o.w : Math.min(o.maxW, o.text.length * o.h * 0.55);
  if (o.rot) return [o.u - o.h / 2 - 0.2, o.u + o.h / 2 + 0.2, o.v - w / 2 - 0.15, o.v + w / 2 + 0.15];
  return [o.u - w / 2 - 0.15, o.u + w / 2 + 0.15, o.v - o.h / 2 - 0.2, o.v + o.h / 2 + 0.2];
}

// Rundes Abzeichen (Momente)
function drawBadgeReal(ctx, o, ox, oy, k) {
  const x = ox + o.u * k, y = oy + o.v * k, R = o.r * k;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = Math.max(2, k * 0.3); ctx.shadowOffsetY = Math.max(1, k * 0.12);
  ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fillStyle = '#F6F1E6'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.arc(x, y, R - k * 0.15, 0, 7); ctx.strokeStyle = '#C8102E'; ctx.lineWidth = Math.max(1, k * 0.3); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, R - k * 0.55, 0, 7); ctx.setLineDash([k * 0.22, k * 0.15]); ctx.strokeStyle = '#0E2240'; ctx.lineWidth = Math.max(0.5, k * 0.06); ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k); ctx.fillStyle = ctx.strokeStyle = '#0E2240'; ctx.beginPath();
  const u = o.u, v = o.v - 0.45;
  switch (o.icon) {
    case 'zigzag': ctx.lineWidth = 0.28; ctx.lineJoin = 'round'; ctx.moveTo(u - 1.2, v + 0.5); ctx.lineTo(u - 0.6, v - 0.5); ctx.lineTo(u, v + 0.5); ctx.lineTo(u + 0.6, v - 0.5); ctx.lineTo(u + 1.2, v + 0.5); ctx.stroke(); break;
    case 'spark': ctx.fillStyle = ctx.strokeStyle = '#B4862A'; SHAPES.spark(ctx, u, v, 1.9); break;
    case 'cross': SHAPES.cross(ctx, u, v, 1.3); break;
    case 'arrow': ctx.fillStyle = '#C8102E'; SHAPES.arrow(ctx, u, v, 1.8); break;
    case 'heart': ctx.fillStyle = '#C8102E'; SHAPES.heart(ctx, u, v + 0.1, 1.7); break;
    case 'rain': ctx.fillStyle = '#0074C8'; ctx.arc(u - 0.4, v - 0.2, 0.5, 0, 7); ctx.arc(u + 0.3, v - 0.35, 0.6, 0, 7); ctx.arc(u + 0.8, v - 0.05, 0.4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.strokeStyle = '#0074C8'; ctx.lineWidth = 0.14; for (const d of [-0.5, 0, 0.5]) { ctx.moveTo(u + d, v + 0.35); ctx.lineTo(u + d - 0.2, v + 0.85); } ctx.stroke(); break;
    default: SHAPES.diamond(ctx, u, v, 1.7);
  }
  ctx.restore();
  overlayText(ctx, { text: o.label, u: o.u, v: o.v + 1.15, h: 0.42, maxW: o.r * 1.5 }, ox, oy, k, '#0E2240', { flat: true });
  ctx.restore();
}

function drawOverlay(ctx, model, ox, oy, k, mode) {
  for (const o of model.overlay || []) {
    if (mode === 'real') { if (o.kind === 'patch') drawPatchReal(ctx, o, ox, oy, k); else if (o.kind === 'badge') drawBadgeReal(ctx, o, ox, oy, k); else overlayText(ctx, o, ox, oy, k); continue; }
    // Produktionsansicht: nur Umrisse der Stick- und Patch-Flächen
    if (o.kind === 'emb') overlayText(ctx, o, ox, oy, k, 'rgba(255,216,77,.9)', { flat: true });
    const [u0, u1, v0, v1] = overlayBox(o);
    ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = o.kind === 'emb' ? 'rgba(255,216,77,.7)' : '#FFD84D'; ctx.lineWidth = 1;
    ctx.strokeRect(ox + u0 * k, oy + v0 * k, (u1 - u0) * k, (v1 - v0) * k);
    if (o.kind !== 'emb') { ctx.fillStyle = '#FFD84D'; ctx.font = `700 ${Math.max(8, k * 0.9)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('PATCH', ox + (u0 + u1) / 2 * k, oy + (v0 + v1) / 2 * k); }
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
