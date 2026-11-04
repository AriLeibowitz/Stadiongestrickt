/* =========================================================================
   Stadion gestrickt – Canvas-Darstellung (Strickoptik, Lupe, Hit-Test)
   ========================================================================= */
'use strict';

const FRINGE = 14;          // Fransenlänge in Reihen-Einheiten
const STITCH_ASPECT = 0.8;  // Masche: Höhe (entlang der Länge) / Breite

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
    const label = (s === 0 ? 'Ende A · ' : '') + (lay.segs > 1 ? `Bahn ${s + 1}/${lay.segs} · ${range}` : range);
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
  // Geister: kommende (simulierte) Spiele und – in der Potenzial-Ansicht – offene Fläche
  for (let x = x0; x < x1; x++) {
    const reg = model.regions[x];
    const isFuture = reg && (reg.type === 'future' || (reg.type === 'season' && reg.s && reg.s.future));
    const isOpen = reg && reg.type === 'filler' && opts.potential;
    if (!isFuture && !isOpen) continue;
    ctx.fillStyle = isFuture ? 'rgba(246,244,239,.55)' : 'rgba(246,244,239,.78)';
    ctx.fillRect(ox + x * cx, oy + y0 * cy, cx + 0.35, (y1 - y0) * cy);
  }
  if (opts.potential) {
    // gestrichelte Umrandung der offenen Fläche
    let start = -1;
    for (let x = x0; x <= x1; x++) {
      const reg = x < x1 ? model.regions[x] : null;
      const open = reg && (reg.type === 'filler' || reg.type === 'future');
      if (open && start < 0) start = x;
      if (!open && start >= 0) {
        ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = '#0E2240'; ctx.lineWidth = 1.2;
        ctx.strokeRect(ox + start * cx + 1, oy + 1, (x - start) * cx - 2, (y1 - y0) * cy - 2);
        ctx.restore(); start = -1;
      }
    }
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

function regionSpan(model, x) {
  const reg = model.regions[x];
  let a = x, b = x;
  while (a > 0 && model.regions[a - 1] === reg) a--;
  while (b < model.L - 1 && model.regions[b + 1] === reg) b++;
  return [a, b];
}

function drawHover(canvas, lay, model, x) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(lay.width * dpr); canvas.height = Math.round(lay.height * dpr);
  canvas.style.width = lay.width + 'px'; canvas.style.height = lay.height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, lay.width, lay.height);
  if (x == null) return;
  const [a, b] = regionSpan(model, x);
  for (let s = 0; s < lay.segs; s++) {
    const sx0 = s * lay.segLen, sx1 = Math.min(model.L, sx0 + lay.segLen) - 1;
    const lo = Math.max(a, sx0), hi = Math.min(b, sx1);
    if (lo > hi) continue;
    const o = segOrigin(lay, s);
    ctx.strokeStyle = '#FFD84D'; ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 4;
    ctx.strokeRect(o.x + (lo - sx0) * lay.cx - 1, o.y - 2, (hi - lo + 1) * lay.cx + 2, lay.segH + 4);
  }
}

function drawLens(canvas, model, x, y, knit) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 260, h = canvas.clientHeight || 170;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#e9e5dc'; ctx.fillRect(0, 0, w, h);
  const cy = 15, cx = cy * STITCH_ASPECT;
  const nx = Math.ceil(w / cx), ny = Math.ceil(h / cy);
  const x0 = Math.max(0, Math.min(model.L - nx, x - Math.floor(nx / 2)));
  const y0 = Math.max(0, Math.min(model.W - ny, y - Math.floor(ny / 2)));
  drawCells(ctx, model, x0, Math.min(model.L, x0 + nx), y0, Math.min(model.W, y0 + ny), -x0 * cx, -y0 * cy, cx, cy, { knit });
}

function drawThumb(canvas, model, width, potential) {
  const dpr = window.devicePixelRatio || 1;
  const cx = width / model.L, cy = cx / STITCH_ASPECT * 1.6;
  const h = model.W * cy;
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = width + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCells(ctx, model, 0, model.L, 0, model.W, 0, 0, cx, cy, { knit: false, potential });
}

function patternPNG(model) {
  const c = document.createElement('canvas');
  const cx = 4, cy = 5;
  c.width = model.L * cx; c.height = model.W * cy;
  const ctx = c.getContext('2d');
  drawCells(ctx, model, 0, model.L, 0, model.W, 0, 0, cx, cy, { knit: false });
  return c.toDataURL('image/png');
}
