/* =========================================================================
   Stadion gestrickt – Oberfläche
   ========================================================================= */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privat */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } },
};

const state = {
  profile: null, games: [], stats: null, statsAll: null, ms: [], el: null, overrides: {},
  curation: null, curations: {}, lengthCm: 150, side: 'front', knit: true, segs: 3,
  future: 0, potential: true, name: '', scarf: null, lay: null, pinned: null, tab: 'ai',
  msMode: 'auto',
};

/* ---------------------------------------------------------------- Laden */
function loadFan(code) {
  const p = parseCode(code);
  if (!p.ok) { $('#codeErr').textContent = p.error; return false; }
  $('#codeErr').textContent = '';
  state.profile = profileFromCode(p.code);
  state.allGames = attendedGames(state.profile);
  state.seasons = seasonsOf(state.allGames);
  state.name = state.profile.name;
  $('#codeIn').value = p.code;
  $('#nameIn').value = state.name;
  const has = y => state.seasons.some(([s]) => s === y);
  const start = has(CURRENT_SEASON - 1) ? CURRENT_SEASON - 1 : state.seasons.length ? state.seasons[0][0] : CURRENT_SEASON;
  $('#seasonSel').innerHTML = (state.seasons.length ? state.seasons : [[CURRENT_SEASON, 0]]).map(([y, n]) =>
    `<option value="${y}">Saison ${seasonLabel(y)} · ${n} ${n === 1 ? 'Spiel' : 'Spiele'}${y === CURRENT_SEASON ? ' (läuft)' : ''}</option>`).join('');
  renderPresets();
  selectSeason(start);
  return true;
}

function selectSeason(y) {
  state.season = y;
  $('#seasonSel').value = String(y);
  state.games = seasonGames(state.allGames, y);
  state.stats = computeStats(state.games);
  state.future = 0; $('#futureIn').value = 0;
  state.pinned = null;
  const key = `${state.profile.code}|${y}`;
  state.curation = state.curations[key] || curateOffline(state.games, state.stats, y);
  state.curations[key] = state.curation;
  try { history.replaceState(null, '', `#${state.profile.code}/${y}`); } catch (e) { /* file:// */ }
  update();
  renderStory();
}

function futureGames() {
  if (!state.future || state.season !== CURRENT_SEASON) return [];
  return likelyUpcoming(state.profile).slice(0, state.future).map((m, i) => ({
    ...m, nr: state.games.length + i + 1, result: null, fcbGoals: 0, oppGoals: 0,
    titleClinch: false, comeback: false, lateWinner: false, pens: null,
  }));
}

function update() {
  const fut = futureGames();
  state.fut = fut;
  state.statsAll = computeStats(state.games.concat(fut));
  state.ms = evaluateMilestones(state.statsAll);
  const ov = state.msMode === 'all' ? Object.fromEntries(ELEMENTS.map(e => [e.id, 'on']))
    : state.msMode === 'none' ? Object.fromEntries(ELEMENTS.filter(e => !e.basis).map(e => [e.id, 'off'])) : {};
  state.el = resolveElements(state.ms, { ...ov, ...state.overrides });
  const before = resolveElements(evaluateMilestones(state.stats), { ...ov, ...state.overrides }).active;
  state.newEls = new Set(ELEMENTS.filter(e => state.el.active[e.id] && !before[e.id]).map(e => e.id));
  const byNr = new Map(state.games.map(g => [g.nr, g]));
  const hl = state.curation.highlights.map(h => byNr.get(h.nr)).filter(Boolean);
  state.scarf = buildScarf({
    profile: state.profile, games: state.games, futureGames: fut, highlights: hl,
    act: state.el.active, lengthCm: state.lengthCm, stats: state.statsAll, name: state.name,
    season: state.season, blOpponents: seasonBLOpponents(state.season),
  });
  renderScarf();
  renderSide();
  renderMilestones();
  renderPotential();
  renderGames();
  renderHighlights();
  if (state.tab === 'rules') renderRules();
}

/* ---------------------------------------------------------------- Schal */
function currentModel() { return state.side === 'front' ? state.scarf.front : state.scarf.back; }

function renderScarf() {
  const model = currentModel();
  const stage = $('#stage');
  const width = Math.max(300, stage.clientWidth);
  const mark = state.potential && state.fut.length ? state.newEls : null;
  state.lay = drawScarf($('#scarf'), model, { width, segs: state.segs, knit: state.knit, markEls: mark });
  drawHover($('#hover'), state.lay, model, state.pinned);
  $('#scarfTitle').textContent = `Saison ${seasonLabel(state.season)} · ${state.side === 'front' ? 'Vorderseite' : 'Rückseite'}`;
  const n = state.games.length + state.fut.length;
  const reached = state.ms.filter(m => m.reached).length;
  $('#densityChip').textContent = `${n} ${n === 1 ? 'Spiel' : 'Spiele'} · ${reached}/${state.ms.length} Meilensteine`;
  const decoded = decodeCodeBand(state.scarf.back);
  $('#codeChip').textContent = decoded ? `✓ Strickcode gelesen: ${decoded.code} · Saison ${seasonLabel(decoded.season)}` : 'Strickcode aus';
  $('#codeChip').className = 'chip ' + (decoded ? 'green' : '');
  const activeCount = ELEMENTS.filter(e => state.el.active[e.id]).length;
  $('#elChip').textContent = `${activeCount}/${ELEMENTS.length} Design-Elemente aktiv`;
  renderLegend();
  if (state.pinned) showReader(state.pinned);
  drawLens($('#lens'), model, state.lensX != null ? state.lensX : Math.floor(model.L / 2), state.lensY != null ? state.lensY : 36, state.knit);
}

function elementSide(e) { return e.where.startsWith('Rückseite') ? 'back' : 'front'; }

function renderLegend() {
  const a = state.el.active;
  const list = ELEMENTS.filter(e => a[e.id] && elementSide(e) === state.side);
  const info = state.scarf[state.side].info;
  let html = `<span class="tiny muted" style="width:100%">Auf der ${state.side === 'front' ? 'Vorderseite' : 'Rückseite'}:</span>` +
    list.map(e => `<span class="chip ${state.newEls.has(e.id) && state.fut.length ? 'gold' : ''}" title="${esc(e.desc)}">${esc(e.name)}</span>`).join('');
  if (info.dropped) html += `<span class="chip red">${info.dropped} Feld(er) passen bei ${state.lengthCm} cm nicht auf die Rückseite</span>`;
  $('#legend').innerHTML = html;
}

function tagText(t) {
  if (!t) return null;
  const gameHtml = (m, title) => {
    const flags = [];
    if (m.final) flags.push('Finale');
    if (m.titleClinch) flags.push('Meisterschaft entschieden');
    if (m.comeback) flags.push('Comeback');
    if (m.lateWinner) flags.push('Siegtor in letzter Minute');
    if (m.pens) flags.push(`Elfmeterschießen ${m.pens === 'W' ? 'gewonnen' : 'verloren'}`);
    if (m.klassiker) flags.push('Klassiker');
    if (m.weather === 'rain') flags.push('Regen'); if (m.weather === 'snow') flags.push('Schnee');
    return `${title ? `<b>${esc(title)}</b><br>` : ''}<b>Spiel #${m.nr}</b> der Saison · ${fmtDateLong(m.date)}<br>${esc(COMP_DE[m.comp])}, ${esc(m.round)} · ${m.venue === 'H' ? 'Allianz Arena' : esc(m.city)}<br>${esc(scoreLong(m))}${flags.length ? '<br><span style="opacity:.8">' + esc(flags.join(' · ')) + '</span>' : ''}`;
  };
  if (t.el) {
    const e = ELEMENT_BY_ID[t.el]; if (!e) return null;
    const m = milestoneForElement(t.el);
    const st = m && state.ms.find(x => x.id === m.id);
    const src = m ? `Freigeschaltet durch <b>${esc(m.name)}</b>: ${esc(m.cond)}${st ? ` (${Math.min(st.current, st.target)}/${st.target})` : ''}` : 'Grundausstattung';
    return `<b>${esc(e.name)}</b><br>${esc(e.desc)}<br><span style="opacity:.8">${src}${st && !st.reached ? ' · noch nicht erreicht, manuell eingeschaltet' : ''}</span>`;
  }
  switch (t.type) {
    case 'panel': {
      const h = state.curation.highlights.find(x => x.nr === t.game.nr);
      return `${t.heart ? '♥ Herzstück · ' : ''}Highlight-Feld (KI-Auswahl)<br>` + gameHtml(t.game, h && h.title);
    }
    case 'code': return `<b>Strickcode</b> (Ende ${t.side})<br>${esc(state.profile.code)} und Saison ${seasonLabel(state.season)} als 45 Bit zwischen zwei Prüfmustern. Fotografiert die App dieses Band, erkennt sie Fan und Saison.`;
    case 'backBase': return '<b>Rückseite</b><br>Nachtblau mit roten Nadelstreifen';
    default: return null;
  }
}

function showReader(hit) {
  const model = currentModel();
  const txt = tagText(tagAtCell(model, hit.x, hit.y));
  $('#reader').innerHTML = `<h4>Schal lesen · ${(hit.x / ROWS_PER_CM).toFixed(1).replace('.', ',')} cm ab Ende A</h4>${txt || '<span class="muted">Grundfläche</span>'}`;
}

function bindScarf() {
  const cv = $('#scarf'), tip = $('#tip');
  let last = null;
  cv.addEventListener('mousemove', ev => {
    const rect = cv.getBoundingClientRect();
    const model = currentModel();
    const hit = hitTest(state.lay, model, ev.clientX - rect.left, ev.clientY - rect.top);
    if (!hit) { tip.style.display = 'none'; if (!state.pinned) drawHover($('#hover'), state.lay, model, null); last = null; return; }
    state.lensX = hit.x; state.lensY = hit.y;
    drawLens($('#lens'), model, hit.x, hit.y, state.knit);
    const t = tagAtCell(model, hit.x, hit.y);
    if (t !== last) {
      last = t;
      if (!state.pinned) drawHover($('#hover'), state.lay, model, hit);
      const txt = tagText(t);
      if (txt) { tip.innerHTML = txt; tip.style.display = 'block'; } else tip.style.display = 'none';
    }
    const stage = $('#stage').getBoundingClientRect();
    let tx = ev.clientX - stage.left + 14, ty = ev.clientY - stage.top + 14;
    if (tx + 300 > stage.width) tx = Math.max(0, ev.clientX - stage.left - 310);
    tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
  });
  cv.addEventListener('mouseleave', () => { tip.style.display = 'none'; if (!state.pinned) drawHover($('#hover'), state.lay, currentModel(), null); last = null; });
  cv.addEventListener('click', ev => {
    const rect = cv.getBoundingClientRect();
    const hit = hitTest(state.lay, currentModel(), ev.clientX - rect.left, ev.clientY - rect.top);
    state.pinned = hit || null;
    drawHover($('#hover'), state.lay, currentModel(), hit);
    if (hit) showReader(hit);
  });
}

/* ---------------------------------------------------------------- Seite */
function renderPresets() {
  $('#presets').innerHTML = PRESETS.map(p => `<button type="button" class="preset ${state.profile && state.profile.code === p.code ? 'active' : ''}" data-code="${p.code}"><b>${esc(p.label)}</b><span>${esc(p.who)}</span><code>${p.code}</code></button>`).join('');
  $$('#presets .preset').forEach(b => b.onclick = () => loadFan(b.dataset.code));
}

function renderSide() {
  const s = state.stats, p = state.profile;
  $('#who').textContent = p.preset ? p.who : 'Zufälliger Fan';
  $('#stats').innerHTML = [
    [s.total, 'Spiele'], [`${s.W}/${s.D}/${s.L}`, 'S / U / N'], [s.away, 'Auswärts'],
    [s.monthCount, 'Monate'], [s.km.toLocaleString('de-DE'), 'Reise-km'], [`${s.goalsFor}:${s.goalsAgainst}`, 'Tore'],
  ].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  const usage = yarnUsage(state.scarf);
  const total = usage.counts.reduce((a, b) => a + b, 0);
  // Garnbedarf: ca. 180 g für 150 cm Doppeljacquard
  const grams = 180 * state.lengthCm / 150;
  $('#yarns').innerHTML = CI_KEYS.map((k, i) => {
    const on = usage.used.includes(k);
    const pct = total ? usage.counts[i] / total : 0;
    return `<div class="yarn ${on ? '' : 'off'}"><i style="background-color:${YARN[k].hex}"></i><span>${YARN[k].name}</span><em>${on ? `${Math.round(pct * 100)} % · ${Math.max(1, Math.round(pct * grams))} g` : 'nicht verwendet'}</em></div>`;
  }).join('');
  $('#yarnOk').textContent = `✓ ${usage.used.length} von 5 Farben, passt zum Strickerei-Limit`;
  $('#yarnOk').className = 'okline good';
}

/* ---------------------------------------------------------------- KI */
function renderStory() {
  const c = state.curation;
  const src = c.source === 'gemini' ? `✦ Gemini · ${esc(c.model)}` : '⚙ Offline-Kurator (Simulation der Gemini-Auswahl)';
  $('#story').innerHTML = `<div class="src">${src}</div><div>${esc(c.story)}</div>${c.rejected ? `<div class="tiny" style="opacity:.75;margin-top:6px">${c.rejected} Vorschlag/Vorschläge verworfen, weil die Spielnummer nicht existierte.</div>` : ''}`;
  $('#promptPre').textContent = buildPrompt(state.profile, state.games, state.stats, state.season);
}

function renderHighlights() {
  const c = state.curation;
  const byNr = new Map(state.games.map(g => [g.nr, g]));
  if (!state.games.length) { $('#hlList').innerHTML = '<p class="muted">Noch keine Spiele, also noch keine Highlights.</p>'; return; }
  const opts = state.games.map(g => `<option value="${g.nr}">#${g.nr} ${fmtDate(g.date)} ${esc(scoreLine(g))}</option>`).join('');
  $('#hlList').innerHTML = c.highlights.map((h, i) => {
    const m = byNr.get(h.nr); if (!m) return '';
    const srcTag = h.source === 'gemini' ? 'Vorschlag von Gemini' : h.source === 'fan' ? 'Vom Fan gewählt' : h.source === 'regel' ? 'Ergänzt (Regel)' : 'Offline-Kurator';
    return `<div class="hl ${i === 0 ? 'heart' : ''}">
      <div class="num">${i === 0 ? '♥' : i + 1}<small>${i === 0 ? 'Herzstück' : 'Highlight'}</small></div>
      <div><h4>${esc(h.title)}</h4><div class="meta">#${m.nr} · ${fmtDateLong(m.date)} · ${esc(COMP_DE[m.comp])}, ${esc(m.round)} · ${esc(scoreLong(m))}</div><p>${esc(h.reason)}</p><div class="src-tag">${srcTag}</div></div>
      <div class="stack" style="text-align:right"><select data-i="${i}" aria-label="Highlight tauschen"><option value="">Tauschen gegen …</option>${opts}</select>
      <div class="row" style="justify-content:flex-end">${i > 0 ? `<button class="btn ghost sm" data-heart="${i}" type="button">♥ Herzstück</button>` : ''}<button class="btn ghost sm" data-rm="${i}" type="button">Entfernen</button></div></div>
    </div>`;
  }).join('') + (c.highlights.length < Math.min(5, state.games.length) ? `<p class="small muted">Noch ${Math.min(5, state.games.length) - c.highlights.length} Feld(er) frei. Setz in der Spieleliste ein ★.</p>` : '');
  $$('#hlList select').forEach(sel => sel.onchange = () => {
    const nr = Number(sel.value); if (!nr) return;
    const i = Number(sel.dataset.i);
    if (c.highlights.some(h => h.nr === nr)) { sel.value = ''; return; }
    const m = byNr.get(nr);
    c.highlights[i] = { nr, title: m.result === 'W' ? `Sieg gegen ${clubAbbr(m.opp)}` : `${clubAbbr(m.opp)}, ${fmtDate(m.date)}`, reason: 'Selbst ausgewählt.', source: 'fan' };
    update();
  });
  $$('#hlList [data-rm]').forEach(b => b.onclick = () => { c.highlights.splice(Number(b.dataset.rm), 1); update(); });
  $$('#hlList [data-heart]').forEach(b => b.onclick = () => { const i = Number(b.dataset.heart); const [h] = c.highlights.splice(i, 1); c.highlights.unshift(h); update(); });
}

async function runGemini() {
  const key = $('#keyIn').value.trim(), model = $('#modelIn').value.trim() || 'gemini-2.5-flash';
  const st = $('#aiStatus');
  if (!key) { st.className = 'status err'; st.textContent = 'Bitte zuerst einen Gemini-API-Key eintragen (kostenlos über Google AI Studio).'; return; }
  if ($('#keyRemember').checked) store.set('sg-key', key); else store.del('sg-key');
  store.set('sg-model', model);
  if (!state.games.length) { st.textContent = 'Keine Spiele in dieser Saison, also nichts auszuwählen.'; return; }
  const btn = $('#geminiBtn'); btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Gemini analysiert …';
  st.className = 'status'; st.textContent = `${state.games.length} Spiele der Saison ${seasonLabel(state.season)} werden an ${model} gesendet …`;
  try {
    const res = await curateWithGemini(key, model, state.profile, state.games, state.stats, state.season);
    state.curation = res; state.curations[`${state.profile.code}|${state.season}`] = res;
    st.textContent = `✓ Gemini hat ${res.highlights.filter(h => h.source === 'gemini').length} Highlights gewählt.`;
    renderStory(); update();
  } catch (e) {
    st.className = 'status err'; st.textContent = `${e.message}. Der Offline-Kurator bleibt aktiv.`;
  } finally { btn.disabled = false; btn.textContent = 'Mit Gemini auswählen'; }
}

/* ---------------------------------------------------------------- Meilensteine */
function triHtml(id) {
  const o = state.overrides[id] || 'auto';
  return `<div class="tri" data-el="${id}"><button data-v="auto" class="${o === 'auto' ? 'on' : ''}">Auto</button><button data-v="on" class="${o === 'on' ? 'on force-on' : ''}">An</button><button data-v="off" class="${o === 'off' ? 'on force-off' : ''}">Aus</button></div>`;
}

function renderMilestones() {
  const reached = state.ms.filter(m => m.reached).length;
  $('#msCount').textContent = `${reached}/${state.ms.length}`;
  $('#msSummary').textContent = `${reached} von ${state.ms.length} Meilensteinen erreicht. Mit „An“ und „Aus“ lässt sich jedes Element unabhängig vom Fan-Status testen.`;
  const act = state.el.active;
  const basis = ELEMENTS.filter(e => e.basis);
  let html = `<div class="card ms-cat"><h3>Grundausstattung <small>jeder Schal</small></h3>${basis.map(e => `
    <div class="ms reached"><div class="ico">✓</div><div><b>${esc(e.name)}</b><div class="el"><span class="state-dot ${act[e.id] ? 'on' : ''}"></span>${esc(e.desc)} <span class="muted">· ${esc(e.where)}</span></div></div>${triHtml(e.id)}</div>`).join('')}</div>`;
  for (const [cat, title, sub] of MILESTONE_CATEGORIES) {
    const list = state.ms.filter(m => m.cat === cat);
    html += `<div class="card ms-cat"><h3>${title} <small>${list.filter(m => m.reached).length}/${list.length} · ${sub}</small></h3>${list.map(m => {
      const e = ELEMENT_BY_ID[m.element];
      return `<div class="ms ${m.reached ? 'reached' : ''}"><div class="ico">${m.reached ? '✓' : Math.round(m.progress * 100) + ''}</div>
        <div><b>${esc(m.name)}</b> <span class="cond">· ${esc(m.cond)}</span>
          <div class="bar"><i style="width:${m.progress * 100}%"></i></div>
          <div class="tiny muted">${Math.min(m.current, m.target)} / ${m.target}${m.reached ? ' · erreicht' : ` · noch ${m.target - m.current}`}</div>
          <div class="el"><span class="state-dot ${act[e.id] ? 'on' : ''}"></span>Schaltet frei: <strong>${esc(e.name)}</strong>. ${esc(e.desc)} <span class="muted">· ${esc(e.where)}</span></div>
        </div>${triHtml(e.id)}</div>`;
    }).join('')}</div>`;
  }
  $('#msCats').innerHTML = html;
  $$('#msCats .tri').forEach(t => t.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const id = t.dataset.el;
    if (b.dataset.v === 'auto') delete state.overrides[id]; else state.overrides[id] = b.dataset.v;
    update();
  });
}

/* ---------------------------------------------------------------- Potenzial */
function renderPotential() {
  const running = state.season === CURRENT_SEASON;
  $('#futureIn').disabled = !running;
  $('#futureIn').max = Math.min(30, likelyUpcoming(state.profile).length);
  $('#futureLabel').textContent = !running ? `Saison ${seasonLabel(state.season)} ist abgeschlossen. Wähl ${seasonLabel(CURRENT_SEASON)}, um das Wachstum zu simulieren.` : state.future ? `+${state.future} kommende Spiele simuliert` : 'Heute';
  const base = evaluateMilestones(state.stats);
  const newly = state.ms.filter(m => m.reached && !base.find(b => b.id === m.id).reached);
  $('#unlocks').innerHTML = state.future
    ? (newly.length ? `<p style="margin:10px 0 0"><b>Damit schaltest du frei</b> <span class="muted">(auf dem Schal gelb markiert, wenn „Neue Elemente markieren“ an ist)</span>:</p><ul class="unlock-list">${newly.map(m => `<li><b>${esc(ELEMENT_BY_ID[m.element].name)}</b> <span class="muted">· ${esc(m.name)}</span></li>`).join('')}</ul>` : '<p class="muted" style="margin:10px 0 0">Mit diesen Spielen kommt noch kein neues Element dazu. Schieb den Regler weiter.</p>')
    : '';
  // Teaser wie in App/E-Mail
  const next = base.filter(m => !m.reached).sort((a, b) => b.progress - a.progress || (a.target - a.current) - (b.target - b.current)).slice(0, 3);
  const reached = base.filter(m => m.reached).length;
  const s = state.stats;
  $('#teaser').innerHTML = `<div class="phone-top">FC Bayern App · Mein Schal</div>
    <h3>${running ? 'Deine Saison bisher' : 'Deine Saison ' + seasonLabel(state.season)}, ${esc(state.name || state.profile.name)}</h3>
    <div class="small" style="opacity:.85">Saison ${seasonLabel(state.season)} · ${s.total} Spiele · ${reached} von ${base.length} Meilensteinen · ${ELEMENTS.filter(e => state.el.active[e.id]).length} Design-Elemente</div>
    <canvas id="thumb"></canvas>
    ${next.map(m => `<div class="next"><span>${esc(ELEMENT_BY_ID[m.element].name)}</span><em>noch ${m.target - m.current}</em><span class="tiny" style="opacity:.75;grid-column:1/-1">${esc(m.cond)}</span><div class="bar"><i style="width:${m.progress * 100}%"></i></div></div>`).join('')}
    <div class="row" style="margin-top:12px"><button class="btn red sm" type="button" onclick="document.querySelector('#survey').scrollIntoView({behavior:'smooth'})">Schal vormerken</button><span class="tiny" style="opacity:.7">Unverbindlich, ab 69 €</span></div>`;
  const tw = $('#teaser').clientWidth - 36;
  if (tw > 50) drawThumb($('#thumb'), state.scarf.front, tw, state.fut.length ? state.newEls : null);
}

/* ---------------------------------------------------------------- Umfrage */
function bindSurvey() {
  $('#priceIn').oninput = () => { $('#priceOut').textContent = $('#priceIn').value + ' €'; };
  $('#survey').onsubmit = ev => {
    ev.preventDefault();
    const f = new FormData($('#survey'));
    if (!f.get('buy')) { $('#surveyMsg').textContent = 'Bitte die erste Frage beantworten.'; return; }
    const list = store.get('sg-survey', []);
    list.push({
      t: new Date().toISOString(), code: state.profile.code, games: state.stats.total,
      buy: Number(f.get('buy')), price: Number(f.get('price')), more: f.get('more') || '', why: f.getAll('why').join('|'), note: f.get('note') || '',
    });
    store.set('sg-survey', list);
    $('#surveyMsg').textContent = '✓ Gespeichert (lokal). Danke!';
    $('#survey').reset(); $('#priceOut').textContent = '69 €';
    renderResults();
  };
  $('#csvBtn').onclick = () => {
    const list = store.get('sg-survey', []);
    const rows = [['zeit', 'fan_code', 'spiele', 'kauf_1_5', 'preis_eur', 'oefter', 'warum', 'notiz']].concat(list.map(r => [r.t, r.code, r.games, r.buy, r.price, r.more, r.why, r.note]));
    download('umfrage-stadion-gestrickt.csv', rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
  };
  $('#clearBtn').onclick = () => { if (confirm('Alle lokal gespeicherten Antworten löschen?')) { store.del('sg-survey'); renderResults(); } };
  renderResults();
}
function renderResults() {
  const list = store.get('sg-survey', []);
  const n = list.length;
  const buyers = list.filter(r => r.buy >= 4).length;
  const prices = list.map(r => r.price).sort((a, b) => a - b);
  const median = n ? prices[Math.floor((n - 1) / 2)] : 0;
  const more = list.filter(r => r.more === 'ja').length;
  $('#results').innerHTML = [[n, 'Antworten'], [n ? Math.round(100 * buyers / n) + ' %' : '–', 'Kaufbereit'], [n ? median + ' €' : '–', 'Median-Preis'], [n ? Math.round(100 * more / n) + ' %' : '–', 'Kämen öfter']]
    .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
}

/* ---------------------------------------------------------------- Spiele */
function renderGames() {
  $('#gCount').textContent = state.games.length;
  const fc = $('#fComp').value, fv = $('#fVenue').value;
  const hlSet = new Set(state.curation.highlights.map(h => h.nr));
  const rows = state.games.filter(g => (!fc || g.comp === fc) && (!fv || g.venue === fv)).slice().reverse();
  $('#gBody').innerHTML = rows.map(g => {
    const f = [];
    if (g.final) f.push('Finale'); if (g.titleClinch) f.push('Meister'); if (g.comeback) f.push('Comeback');
    if (g.lateWinner) f.push('Last Minute'); if (g.pens) f.push('i.E.'); if (g.klassiker) f.push('Klassiker');
    if (g.weather === 'rain') f.push('Regen'); if (g.weather === 'snow') f.push('Schnee');
    return `<tr><td>${g.nr}</td><td><button class="star-btn ${hlSet.has(g.nr) ? 'on' : ''}" data-nr="${g.nr}" title="Als Highlight setzen">★</button></td><td>${fmtDate(g.date)}</td><td>${g.seasonLabel}</td><td>${COMP_DE[g.comp]}</td><td>${esc(g.round)}</td><td>${g.venue === 'H' ? 'Heim' : g.venue === 'A' ? esc(g.city) : esc(g.city) + ' (neutral)'}</td><td>${esc(scoreLine(g))}</td><td><span class="res ${g.result}">${{ W: 'S', D: 'U', L: 'N' }[g.result]}</span></td><td class="muted">${f.join(' · ')}</td></tr>`;
  }).join('') || '<tr><td colspan="10" class="muted">Keine Spiele.</td></tr>';
  $$('#gBody .star-btn').forEach(b => b.onclick = () => {
    const nr = Number(b.dataset.nr), c = state.curation;
    const i = c.highlights.findIndex(h => h.nr === nr);
    if (i >= 0) c.highlights.splice(i, 1);
    else {
      if (c.highlights.length >= 5) { alert('Höchstens 5 Highlights. Entferne zuerst eines.'); return; }
      const m = state.games.find(g => g.nr === nr);
      c.highlights.push({ nr, title: m.result === 'W' ? `Sieg gegen ${clubAbbr(m.opp)}` : `${clubAbbr(m.opp)}, ${fmtDate(m.date)}`, reason: 'Selbst ausgewählt.', source: 'fan' });
    }
    update();
  });
}

/* ---------------------------------------------------------------- Regelwerk */
function renderRules() {
  const msRows = MILESTONES.map(m => { const e = ELEMENT_BY_ID[m.element]; return `<tr><td>${esc(MILESTONE_CATEGORIES.find(c => c[0] === m.cat)[1])}</td><td><b>${esc(m.name)}</b></td><td>${esc(m.cond)}</td><td><b>${esc(e.name)}</b>: ${esc(e.desc)}</td><td>${esc(e.where)}</td></tr>`; }).join('');
  $('#rules').innerHTML = `
  <div class="card"><h3>1 · Fan-Code</h3>
    <p>Format <span class="kbd">FCB-XXXX-XXXX</span> in Crockford-Base32 (ohne I, L, O, U, damit nichts verwechselt wird). 7 Nutzzeichen und ein Prüfzeichen (gewichtete Summe mod 32), sodass Tippfehler auffallen.</p>
    <p>Im echten System verknüpft der Code die Mitgliedschaft mit der Ticket-Historie aus App und Dauerkarte. Für alte Spiele ohne digitale Spur liest Gemini Fotos von Papiertickets aus, die Zuordnung prüft der Fan. Im Prototyp erzeugt der Code eine synthetische, aber stabile Historie.</p>
    <p><b>Ein Schal pro Saison:</b> Jeder Fan kann für jede Saison, in der er im Stadion war, einen eigenen Schal bestellen. Meilensteine, Highlights und die KI-Geschichte beziehen sich immer nur auf diese eine Saison. Über die Jahre entsteht so eine Sammlung.</p>
    <p><b>Strickcode:</b> 8 Zeichen × 5 Bit = 40 Bit Fan-Code plus 5 Bit Saison, gestrickt als Band quer über die Breite, mit Start- (1101) und Endmuster (1011), an beiden Schalenden. Die App erkennt daran Fan und Saison. Der Prototyp liest das Band aus dem Raster zurück (siehe grüner Chip).</p></div>
  <div class="card"><h3>2 · Maße &amp; Garn</h3>
    <p>${STITCHES} Maschen Breite (18 cm bei 4 Maschen/cm), ${ROWS_PER_CM} Reihen pro cm. Längen 150, 180 und 220 cm, also ${150 * ROWS_PER_CM} / ${180 * ROWS_PER_CM} / ${220 * ROWS_PER_CM} Reihen. Doppeljacquard mit eigener Vorder- und Rückseite, Einzelfertigung auf Bestellung.</p>
    <p><b>5 Garnfarben:</b> ${CI_KEYS.map(k => `<span class="chip" style="background:${YARN[k].hex};color:${k === 'W' || k === 'G' ? '#0E2240' : '#fff'}">${YARN[k].name}</span>`).join(' ')}</p>
    <p>Gold ist reserviert: Es kommt erst mit einem Gold-Meilenstein in den Schal (${GOLD_ELEMENTS.map(id => esc(ELEMENT_BY_ID[id].name)).join(', ')}). Ein Neumitglied strickt deshalb mit 1–3 Farben.</p></div>
  <div class="card"><h3>3 · Vorderseite: Ebenen statt Streifen pro Spiel</h3>
    <p>Die Vorderseite zeigt nicht jedes einzelne Spiel, sondern was der Fan in der Saison erreicht hat. Sie startet <b>einfarbig in Vereinsrot</b> mit weißen Fransen. Jeder Meilenstein legt eine Ebene darüber, bis ein vollständiger Jacquard-Schal entsteht.</p>
    <div class="flow"><span>Fransen</span><span>Auswärts-Rauten</span><span>Endstreifen</span><span class="h">Endfeld: Sterne · Saison · Pokal · Krone · Stadion-Punkte</span><span>Endstreifen</span><span>Sternenband + Flutlicht</span><span>Musterbänder …</span><span class="k">Mitte: Rauten-Feld + Medaillon (Schale, Pokal, Spielzahl)</span><span>… Musterbänder</span><span>(gespiegelt bis Ende B)</span></div>
    <p><b>Treue</b> baut die Grundstruktur (Schriftzug, Endstreifen, Blockstreifen, Rand, Gold, Medaillon, Rauten). <b>Wettbewerbe</b> setzen Symbole. <b>Auswärts</b> verändert Enden und Kanten. <b>Momente</b> füllen die Streifenbänder mit Mustern. Mehrere Muster wechseln sich ab, immer symmetrisch zu beiden Enden. <b>Saison komplett</b> veredelt Schriftzug und Rückseite.</p>
    <p class="small muted">Feste Lage der Ebenen ab jedem Ende: Rauten Reihe ${FRONT.rauten.join('–')}, Endstreifen ${FRONT.stripeA.join('–')} und ${FRONT.stripeB.join('–')}, Endfeld ${FRONT.zone.join('–')}, Sternenband ${FRONT.starBand.join('–')}, Musterbänder ab Reihe ${FRONT.bodyStart} (je ${FRONT.bandLen} Reihen, Abstand ${FRONT.bandPeriod}). Längere Schals bekommen mehr Musterbänder.</p></div>
  <div class="card"><h3>4 · Rückseite: die Geschichte der Saison</h3>
    <p>Die Rückseite ist nachtblau mit roten Nadelstreifen. In der Mitte sitzen die <b>5 Highlight-Felder</b> der KI, das Herzstück genau in der Schalmitte. Links stehen Fan-Etikett, Kilometer und Länder, rechts Kalender, Gegner-Sammlung und das Allesfahrer-Feld. An beiden Enden sitzt der <b>Strickcode</b>.</p>
    <p class="small muted">Was nicht auf die Länge passt, wird weggelassen und in der App angezeigt. Bei 180 und 220 cm passt alles.</p></div>
  <div class="card" style="grid-column:1/-1"><h3>5 · Meilensteine → Design-Elemente (${MILESTONES.length})</h3>
    <div class="table-wrap" style="max-height:none"><table><thead><tr><th>Kategorie</th><th>Meilenstein</th><th>Bedingung</th><th>Schaltet frei</th><th>Wo</th></tr></thead><tbody>${msRows}</tbody></table></div>
    <p class="small muted">Dazu kommt die Grundausstattung jedes Schals: ${ELEMENTS.filter(e => e.basis).map(e => esc(e.name)).join(', ')}.</p></div>
  <div class="card"><h3>6 · Die Rolle der KI</h3>
    <p><b>Gemini macht:</b> alle Spiele der Saison lesen und einordnen, wie die Saison für den Fan war, bis zu 5 Highlights vorschlagen (das erste wird das Herzstück), jede Wahl begründen und die Fan-Geschichte erzählen. Später kommt dazu: alte Tickets und Fotos den Spielen zuordnen und einen fotografierten Schal über den Strickcode wieder dem Fan zuordnen.</p>
    <p><b>Gemini macht nicht:</b> Ergebnisse, Daten oder Muster erzeugen. Jede Spielnummer wird geprüft, erfundene Nummern werden verworfen. Das Muster ist deterministisch: gleicher Code, gleicher Schal.</p>
    <p><b>Der Fan entscheidet:</b> Jedes Highlight lässt sich tauschen oder entfernen, und jedes Spiel kann zum Herzstück werden.</p></div>
  <div class="card"><h3>7 · Datenquellen im echten Betrieb</h3>
    <p>Besuchte Spiele aus Ticketing, App-Tickets und Dauerkarte, ältere per Ticketfoto. Ergebnisse und Spielverlauf, also Comebacks und späte Tore, aus offiziellen Spieldaten. Wetter aus historischen Wetterdaten. Gegnerwappen nur mit Lizenz, bis dahin neutrale Schilde.</p>
    <p class="small muted">Im Prototyp sind alle Daten synthetisch, aber für alle Fans gleich. Zwei Fans mit denselben Spielen bekommen deshalb dasselbe Muster.</p></div>`;
}

/* ---------------------------------------------------------------- Helfer */
function download(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function bindSeg(id, fn) {
  $$(`#${id} button`).forEach(b => b.onclick = () => {
    $$(`#${id} button`).forEach(x => x.classList.toggle('on', x === b));
    fn(b.dataset.v);
  });
}

/* ---------------------------------------------------------------- Start */
function init() {
  bindSeg('sideSeg', v => { state.side = v; state.pinned = null; renderScarf(); });
  bindSeg('viewSeg', v => { state.knit = v === 'knit'; renderScarf(); });
  bindSeg('lenSeg', v => { state.lengthCm = Number(v); state.pinned = null; update(); });
  bindSeg('segSeg', v => { state.segs = Number(v); renderScarf(); });
  bindSeg('msMode', v => { state.msMode = v; state.overrides = {}; update(); });
  $('#codeForm').onsubmit = ev => { ev.preventDefault(); loadFan($('#codeIn').value); };
  $('#randomBtn').onclick = () => loadFan(randomCode());
  $('#nameIn').oninput = () => { state.name = $('#nameIn').value.toUpperCase(); update(); };
  $('#futureIn').oninput = () => { state.future = Number($('#futureIn').value); update(); };
  $('#potView').onchange = () => { state.potential = $('#potView').checked; renderScarf(); renderPotential(); };
  $('#fComp').onchange = renderGames; $('#fVenue').onchange = renderGames;
  $('#geminiBtn').onclick = runGemini;
  $('#offlineBtn').onclick = () => { state.curation = curateOffline(state.games, state.stats, state.season); state.curations[`${state.profile.code}|${state.season}`] = state.curation; $('#aiStatus').textContent = 'Offline-Kurator aktiv.'; $('#aiStatus').className = 'status'; renderStory(); update(); };
  $('#keyIn').value = store.get('sg-key', ''); $('#keyRemember').checked = !!store.get('sg-key', '');
  $('#modelIn').value = store.get('sg-model', 'gemini-2.5-flash');
  $('#dlTxt').onclick = () => download(`strickdatei-${state.profile.code}-${state.season}.txt`, knitFile(state.scarf, { code: state.profile.code, lengthCm: state.lengthCm, season: state.season }), 'text/plain');
  $('#dlPng').onclick = () => { const a = document.createElement('a'); a.href = patternPNG(currentModel()); a.download = `muster-${state.side}-${state.profile.code}-${state.season}.png`; a.click(); };
  $$('#tabs .tab').forEach(t => t.onclick = () => {
    state.tab = t.dataset.tab;
    $$('#tabs .tab').forEach(x => x.classList.toggle('on', x === t));
    $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + t.dataset.tab));
    if (state.tab === 'rules') renderRules();
    if (state.tab === 'pot') renderPotential();
  });
  bindScarf();
  bindSurvey();
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { renderScarf(); renderPotential(); }, 120); });
  $('#seasonSel').onchange = () => selectSeason(Number($('#seasonSel').value));
  let start = PRESETS[1].code, startSeason = null;
  try {
    const [h, y] = decodeURIComponent(location.hash.slice(1)).split('/');
    if (h && parseCode(h).ok) { start = h; startSeason = Number(y) || null; }
  } catch (e) { /* */ }
  loadFan(start);
  if (startSeason && state.seasons.some(([y]) => y === startSeason)) selectSeason(startSeason);
  window.addEventListener('hashchange', () => {
    const [h, y] = decodeURIComponent(location.hash.slice(1)).split('/');
    if (!h || !parseCode(h).ok) return;
    if (!state.profile || parseCode(h).code !== state.profile.code) loadFan(h);
    if (Number(y) && Number(y) !== state.season && state.seasons.some(([s2]) => s2 === Number(y))) selectSeason(Number(y));
  });
}
document.addEventListener('DOMContentLoaded', init);
