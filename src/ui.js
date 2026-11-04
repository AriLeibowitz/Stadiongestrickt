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
  profile: null, allGames: [], seasons: [], season: CURRENT_SEASON, games: [], stats: null, statsAll: null,
  ms: [], el: null, overrides: {}, msMode: 'auto', newEls: new Set(),
  curation: null, curations: {}, lengthCm: 150, real: true, future: 0, markNew: true, name: '',
  scarf: null, lays: {}, pinned: null,
};

/* ---------------------------------------------------------------- Laden */
function loadFan(code) {
  const p = parseCode(code);
  if (!p.ok) { $('#codeErr').textContent = p.error; return false; }
  $('#codeErr').textContent = '';
  state.profile = profileFromCode(p.code);
  state.allGames = attendedGames(state.profile);
  state.seasons = seasonsOf(state.allGames);
  if (!state.seasons.some(([y]) => y === CURRENT_SEASON)) state.seasons.unshift([CURRENT_SEASON, 0]);
  state.name = state.profile.name;
  $('#codeIn').value = p.code; $('#nameIn').value = state.name;
  $('#presetSel').value = PRESETS.some(x => x.code === p.code) ? p.code : '';
  $('#seasonSel').innerHTML = state.seasons.map(([y, n]) =>
    `<option value="${y}">${seasonLabel(y)} · ${n} ${n === 1 ? 'Spiel' : 'Spiele'}${y === CURRENT_SEASON ? ' (läuft)' : ''}</option>`).join('');
  selectSeason(CURRENT_SEASON);
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

function modeOverrides() {
  if (state.msMode === 'all') return Object.fromEntries(ELEMENTS.map(e => [e.id, 'on']));
  if (state.msMode === 'none') return Object.fromEntries(ELEMENTS.filter(e => !e.basis).map(e => [e.id, 'off']));
  return {};
}

function update() {
  state.fut = futureGames();
  state.statsAll = computeStats(state.games.concat(state.fut));
  state.ms = evaluateMilestones(state.statsAll);
  const ov = { ...modeOverrides(), ...state.overrides };
  state.el = resolveElements(state.ms, ov);
  const before = resolveElements(evaluateMilestones(state.stats), ov).active;
  state.newEls = new Set(ELEMENTS.filter(e => state.el.active[e.id] && !before[e.id]).map(e => e.id));
  const byNr = new Map(state.games.map(g => [g.nr, g]));
  state.scarf = buildScarf({
    profile: state.profile, games: state.games, highlights: state.curation.highlights.map(h => byNr.get(h.nr)).filter(Boolean),
    act: state.el.active, lengthCm: state.lengthCm, stats: state.statsAll, name: state.name,
    season: state.season, blOpponents: seasonBLOpponents(state.season),
  });
  renderScarf();
  renderFuture();
  renderMilestones();
  renderHighlights();
  renderGames();
  if ($('details.more').open) renderRules();
}

/* ---------------------------------------------------------------- Schal */
const SIDES = { front: { stage: '#stageFront', title: 'Vorderseite' }, back: { stage: '#stageBack', title: 'Rückseite' } };

function renderScarf() {
  const mark = state.markNew && state.fut.length ? state.newEls : null;
  for (const [side, cfg] of Object.entries(SIDES)) {
    const stage = $(cfg.stage), model = state.scarf[side];
    const width = Math.max(320, stage.clientWidth);
    state.lays[side] = drawScarf($('.scarf', stage), model, { width, segs: 1, knit: state.real, real: state.real, markEls: mark, title: cfg.title });
    drawHover($('.hover', stage), state.lays[side], model, state.pinned && state.pinned.side === side ? state.pinned : null);
  }
  const n = state.games.length + state.fut.length;
  const reached = state.ms.filter(m => m.reached).length;
  $('#scarfTitle').textContent = `Saison ${seasonLabel(state.season)}${state.season === CURRENT_SEASON ? ' (läuft)' : ''}`;
  $('#sumChip').textContent = `${n} ${n === 1 ? 'Spiel' : 'Spiele'}${state.fut.length ? ` (davon ${state.fut.length} kommend)` : ''} · ${reached}/${state.ms.length} Meilensteine`;
  const dec = decodeCodeBand(state.scarf.back);
  $('#codeChip').textContent = dec ? `✓ Strickcode gelesen: ${dec.code} · ${seasonLabel(dec.season)}` : 'Strickcode aus';
  $('#codeChip').className = 'chip ' + (dec ? 'green' : '');
  const usage = yarnUsage(state.scarf);
  $('#yarns').innerHTML = `<span class="muted">Garn:</span> ` + usage.used.map(k => `<span class="yarn-dot" style="background:${YARN[k].hex}" title="${YARN[k].name}"></span>${YARN[k].name}`).join(' ') + ` <span class="muted">· ${usage.used.length}/5 Farben${state.scarf.back.info.dropped ? ` · ${state.scarf.back.info.dropped} Feld(er) der Rückseite passen bei ${state.lengthCm} cm nicht` : ''}</span>`;
  if (state.pinned) showReader(state.pinned);
  const lm = state.scarf[state.lensSide || 'front'];
  drawLens($('#lens'), lm, state.lensX != null ? state.lensX : Math.round(FRONT.zoneC * ROWS_PER_CM), state.lensY != null ? state.lensY : 48, true);
}

function tagText(t) {
  if (!t) return null;
  if (t.el) {
    const e = ELEMENT_BY_ID[t.el]; if (!e) return null;
    const m = milestoneForElement(t.el);
    const st = m && state.ms.find(x => x.id === m.id);
    const src = m ? `Meilenstein <b>${esc(m.name)}</b>: ${esc(m.cond)}${st ? ` (${Math.min(st.current, st.target)}/${st.target})` : ''}` : 'Grundausstattung';
    return `<b>${esc(e.name)}</b>${state.newEls.has(e.id) && state.fut.length ? ' <span class="newtag">neu</span>' : ''}<br>${esc(e.desc)}<br><span class="dim">${src}${st && !st.reached ? ' · manuell eingeschaltet' : ''}</span>`;
  }
  if (t.type === 'panel') {
    const m = t.game, h = state.curation.highlights.find(x => x.nr === m.nr);
    return `${t.heart ? '♥ Herzstück' : 'Highlight'}${h ? ': <b>' + esc(h.title) + '</b>' : ''}<br>Spiel #${m.nr} · ${fmtDateLong(m.date)} · ${esc(COMP_DE[m.comp])}, ${esc(m.round)}<br>${esc(scoreLong(m))}${h ? `<br><span class="dim">${esc(h.reason)}</span>` : ''}`;
  }
  if (t.type === 'code') return `<b>Strickcode</b> (Ende ${t.side})<br>${esc(state.profile.code)} und Saison ${seasonLabel(state.season)} als 45-Bit-Muster. Daran erkennt die App den Schal.`;
  if (t.type === 'backBase') return '<b>Rückseite</b><br>Vereinsrot. Der Meilenstein „Europapokal-Abende“ färbt sie nachtblau.';
  return null;
}

const TECH = { knit: '🧶 gestrickt (Jacquard)', emb: '🪡 gestickt', patch: '🏷️ aufgenähter Patch' };
function hitText(hit) {
  const it = hit.item;
  const txt = tagText(it ? it.tag : tagAtCell(state.scarf[hit.side], hit.x, hit.y));
  if (!txt) return null;
  return `${txt}<br><span class="tech">${TECH[it ? it.kind : 'knit']}</span>`;
}
function showReader(hit) {
  $('#reader').innerHTML = `<div class="small muted">${SIDES[hit.side].title} · ${(hit.x / ROWS_PER_CM).toFixed(1).replace('.', ',')} cm ab Ende A</div>${hitText(hit) || '<span class="muted">Grundfläche Vereinsrot · gestrickt</span>'}`;
}

function bindScarf() {
  const tip = $('#tip');
  for (const [side, cfg] of Object.entries(SIDES)) {
    const stage = $(cfg.stage), cv = $('.scarf', stage);
    let last = null;
    const hitOf = ev => { const r = cv.getBoundingClientRect(); const h = hitTest(state.lays[side], state.scarf[side], ev.clientX - r.left, ev.clientY - r.top); return h && { ...h, side, item: itemAt(state.scarf[side], h.x, h.y) }; };
    cv.addEventListener('mousemove', ev => {
      const hit = hitOf(ev), model = state.scarf[side];
      if (!hit) { tip.style.display = 'none'; if (!state.pinned) drawHover($('.hover', stage), state.lays[side], model, null); last = null; return; }
      state.lensX = hit.x; state.lensY = hit.y; state.lensSide = side;
      drawLens($('#lens'), model, hit.x, hit.y, true);
      const t = hit.item ? hit.item : tagAtCell(model, hit.x, hit.y);
      if (t !== last) {
        last = t;
        if (!state.pinned) drawHover($('.hover', stage), state.lays[side], model, hit);
        const txt = hitText(hit);
        if (txt) { tip.innerHTML = txt; tip.style.display = 'block'; } else tip.style.display = 'none';
      }
      const card = $('.scarf-card').getBoundingClientRect();
      let tx = ev.clientX - card.left + 14;
      if (tx + 320 > card.width) tx = Math.max(0, ev.clientX - card.left - 330);
      tip.style.left = tx + 'px'; tip.style.top = (ev.clientY - card.top + 16) + 'px';
    });
    cv.addEventListener('mouseleave', () => { tip.style.display = 'none'; if (!state.pinned) drawHover($('.hover', stage), state.lays[side], state.scarf[side], null); last = null; });
    cv.addEventListener('click', ev => {
      const hit = hitOf(ev);
      state.pinned = hit || null;
      for (const [s2, c2] of Object.entries(SIDES)) drawHover($('.hover', $(c2.stage)), state.lays[s2], state.scarf[s2], hit && hit.side === s2 ? hit : null);
      if (hit) showReader(hit);
    });
  }
}

/* ---------------------------------------------------------------- Zukunft */
function renderFuture() {
  const running = state.season === CURRENT_SEASON;
  $('#future').classList.toggle('off', !running);
  const max = running ? Math.min(30, likelyUpcoming(state.profile).length) : 0;
  $('#futureIn').max = max; $('#futureIn').disabled = !running;
  if (!running) { $('#futureLabel').textContent = `Saison ${seasonLabel(state.season)} ist abgeschlossen. Die Vorschau gibt es für die laufende Saison ${seasonLabel(CURRENT_SEASON)}.`; $('#unlocks').innerHTML = ''; return; }
  $('#futureLabel').textContent = state.future ? `Vorschau: +${state.future} kommende Spiele` : `Wie wächst dein Schal? Kommende Spiele simulieren (bis ${max})`;
  const base = evaluateMilestones(state.stats);
  const newly = state.ms.filter(m => m.reached && !base.find(b => b.id === m.id).reached);
  if (state.future) {
    $('#unlocks').innerHTML = newly.length
      ? `Damit kommt dazu: ${newly.map(m => `<span class="chip gold">${esc(ELEMENT_BY_ID[m.element].name)}</span>`).join(' ')}`
      : '<span class="muted">Mit diesen Spielen kommt noch nichts dazu. Schieb den Regler weiter.</span>';
  } else {
    const next = base.filter(m => !m.reached).sort((a, b) => (a.target - a.current) - (b.target - b.current) || b.progress - a.progress).slice(0, 3);
    $('#unlocks').innerHTML = next.length ? `Als Nächstes in Reichweite: ${next.map(m => `<span class="chip">${esc(ELEMENT_BY_ID[m.element].name)} · noch ${m.target - m.current}</span>`).join(' ')}` : '';
  }
}

/* ---------------------------------------------------------------- Meilensteine */
function renderMilestones() {
  const act = state.el.active;
  const reached = state.ms.filter(m => m.reached).length;
  $('#msSummary').textContent = `${reached} von ${state.ms.length} erreicht`;
  $('#msRows').innerHTML = MILESTONE_CATEGORIES.map(([cat, title, sub]) => {
    const list = state.ms.filter(m => m.cat === cat);
    return `<div class="ms-row"><div class="ms-row-head"><b>${title}</b><span>${sub}</span></div><div class="ms-chips">${list.map(m => {
      const e = ELEMENT_BY_ID[m.element], on = act[e.id];
      const manual = on !== m.reached;
      return `<button type="button" class="ms-chip ${on ? 'on' : ''} ${manual ? 'manual' : ''} ${state.newEls.has(e.id) && state.fut.length ? 'new' : ''}" data-el="${e.id}" data-reached="${m.reached ? 1 : 0}" title="${esc(m.cond)} → ${esc(e.desc)}">
        <span class="dot ${m.reached ? 'got' : ''}"></span><span class="nm">${esc(m.name)}</span><span class="pr">${Math.min(m.current, m.target)}/${m.target}</span><span class="elname">${esc(e.name)}</span></button>`;
    }).join('')}</div></div>`;
  }).join('');
  $$('#msRows .ms-chip').forEach(b => b.onclick = () => {
    const id = b.dataset.el, on = state.el.active[id];
    const autoOn = state.msMode === 'all' ? true : state.msMode === 'none' ? false : b.dataset.reached === '1';
    if (!on === autoOn) delete state.overrides[id]; else state.overrides[id] = on ? 'off' : 'on';
    update();
  });
}

/* ---------------------------------------------------------------- KI */
function renderStory() {
  const c = state.curation;
  $('#aiSrc').textContent = c.source === 'gemini' ? `✦ ausgewählt von Gemini (${c.model})` : '⚙ Offline-Kurator (Simulation der Gemini-Auswahl)';
  $('#story').innerHTML = `${esc(c.story)}${c.rejected ? `<div class="tiny dim" style="margin-top:6px">${c.rejected} Vorschlag/Vorschläge verworfen, weil die Spielnummer nicht existierte.</div>` : ''}`;
  $('#promptPre').textContent = buildPrompt(state.profile, state.games, state.stats, state.season);
}

function newHighlight(m) {
  return { nr: m.nr, title: m.result === 'W' ? `Sieg gegen ${clubAbbr(m.opp)}` : `${clubAbbr(m.opp)}, ${fmtDate(m.date)}`, reason: 'Selbst ausgewählt.', source: 'fan' };
}

function renderHighlights() {
  const c = state.curation;
  const byNr = new Map(state.games.map(g => [g.nr, g]));
  if (!state.games.length) { $('#hlList').innerHTML = '<p class="muted">Noch keine Spiele in dieser Saison, also noch keine Highlights.</p>'; return; }
  const opts = state.games.map(g => `<option value="${g.nr}">#${g.nr} ${fmtDate(g.date)} ${esc(scoreLine(g))}</option>`).join('');
  $('#hlList').innerHTML = c.highlights.map((h, i) => {
    const m = byNr.get(h.nr); if (!m) return '';
    const srcTag = h.source === 'gemini' ? 'Gemini' : h.source === 'fan' ? 'selbst gewählt' : h.source === 'regel' ? 'ergänzt' : 'Offline-Kurator';
    return `<div class="hl ${i === 0 ? 'heart' : ''}">
      <div class="num">${i === 0 ? '♥' : i + 1}<small>${i === 0 ? 'Herzstück' : 'Highlight'}</small></div>
      <div><h4>${esc(h.title)}</h4><div class="meta">${esc(scoreLong(m))} · ${fmtDateLong(m.date)} · ${esc(COMP_DE[m.comp])}, ${esc(m.round)}</div><p>${esc(h.reason)}</p><div class="src-tag">${srcTag}</div></div>
      <div class="hl-actions"><select data-i="${i}" aria-label="Highlight tauschen"><option value="">Tauschen …</option>${opts}</select>
      <div class="row nowrap">${i > 0 ? `<button class="btn ghost sm" data-heart="${i}" type="button" title="Zum Herzstück machen">♥</button>` : ''}<button class="btn ghost sm" data-rm="${i}" type="button" title="Entfernen">✕</button></div></div>
    </div>`;
  }).join('');
  $$('#hlList select').forEach(sel => sel.onchange = () => {
    const nr = Number(sel.value); if (!nr || c.highlights.some(h => h.nr === nr)) { sel.value = ''; return; }
    c.highlights[Number(sel.dataset.i)] = newHighlight(byNr.get(nr)); update();
  });
  $$('#hlList [data-rm]').forEach(b => b.onclick = () => { c.highlights.splice(Number(b.dataset.rm), 1); update(); });
  $$('#hlList [data-heart]').forEach(b => b.onclick = () => { const [h] = c.highlights.splice(Number(b.dataset.heart), 1); c.highlights.unshift(h); update(); });
}

async function runGemini() {
  const key = $('#keyIn').value.trim(), model = $('#modelIn').value.trim() || 'gemini-2.5-flash';
  const st = $('#aiStatus');
  if (!key) { st.className = 'status err'; st.textContent = 'Bitte zuerst einen Gemini-API-Key eintragen (kostenlos über Google AI Studio).'; return; }
  if ($('#keyRemember').checked) store.set('sg-key', key); else store.del('sg-key');
  store.set('sg-model', model);
  if (!state.games.length) { st.textContent = 'Keine Spiele in dieser Saison.'; return; }
  const btn = $('#geminiBtn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Gemini analysiert …';
  st.className = 'status'; st.textContent = '';
  try {
    const res = await curateWithGemini(key, model, state.profile, state.games, state.stats, state.season);
    state.curation = res; state.curations[`${state.profile.code}|${state.season}`] = res;
    st.textContent = `✓ ${res.highlights.filter(h => h.source === 'gemini').length} Highlights von Gemini.`;
    renderStory(); update();
  } catch (e) {
    st.className = 'status err'; st.textContent = `${e.message}. Der Offline-Kurator bleibt aktiv.`;
  } finally { btn.disabled = false; btn.textContent = 'Mit Gemini auswählen'; }
}

/* ---------------------------------------------------------------- Spiele */
function renderGames() {
  const hlSet = new Set(state.curation.highlights.map(h => h.nr));
  $('#gBody').innerHTML = state.games.slice().reverse().map(g => {
    const f = [];
    if (g.final) f.push('Finale'); if (g.titleClinch) f.push('Meister'); if (g.comeback) f.push('Comeback');
    if (g.lateWinner) f.push('Last Minute'); if (g.pens) f.push('i.E.'); if (g.klassiker) f.push('Klassiker');
    if (g.weather === 'rain') f.push('Regen'); if (g.weather === 'snow') f.push('Schnee');
    return `<tr><td>${g.nr}</td><td><button class="star-btn ${hlSet.has(g.nr) ? 'on' : ''}" data-nr="${g.nr}" title="Als Highlight setzen">★</button></td><td>${fmtDate(g.date)}</td><td>${COMP_DE[g.comp]}</td><td>${esc(g.round)}</td><td>${g.venue === 'H' ? 'Heim' : g.venue === 'A' ? esc(g.city) : esc(g.city) + ' (neutral)'}</td><td>${esc(scoreLine(g))}</td><td><span class="res ${g.result}">${{ W: 'S', D: 'U', L: 'N' }[g.result]}</span></td><td class="muted">${f.join(' · ')}</td></tr>`;
  }).join('') || '<tr><td colspan="9" class="muted">Keine Spiele.</td></tr>';
  $$('#gBody .star-btn').forEach(b => b.onclick = () => {
    const nr = Number(b.dataset.nr), c = state.curation;
    const i = c.highlights.findIndex(h => h.nr === nr);
    if (i >= 0) c.highlights.splice(i, 1);
    else { if (c.highlights.length >= 5) { alert('Höchstens 5 Highlights. Entferne zuerst eines.'); return; } c.highlights.push(newHighlight(state.games.find(g => g.nr === nr))); }
    update();
  });
}

/* ---------------------------------------------------------------- Umfrage */
function bindSurvey() {
  $('#priceIn').oninput = () => { $('#priceOut').textContent = $('#priceIn').value + ' €'; };
  $('#survey').onsubmit = ev => {
    ev.preventDefault();
    const f = new FormData($('#survey'));
    if (!f.get('buy')) { $('#surveyMsg').textContent = 'Bitte die erste Frage beantworten.'; return; }
    const list = store.get('sg-survey', []);
    list.push({ t: new Date().toISOString(), code: state.profile.code, season: state.season, games: state.stats.total, buy: Number(f.get('buy')), price: Number(f.get('price')), more: f.get('more') || '', note: f.get('note') || '' });
    store.set('sg-survey', list);
    $('#surveyMsg').textContent = '✓ Gespeichert (lokal).';
    $('#survey').reset(); $('#priceOut').textContent = '69 €';
    renderResults();
  };
  $('#csvBtn').onclick = () => {
    const list = store.get('sg-survey', []);
    const rows = [['zeit', 'fan_code', 'saison', 'spiele', 'kauf_1_5', 'preis_eur', 'oefter', 'notiz']].concat(list.map(r => [r.t, r.code, r.season, r.games, r.buy, r.price, r.more, r.note]));
    download('umfrage-stadion-gestrickt.csv', rows.map(r => r.map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
  };
  $('#clearBtn').onclick = () => { if (confirm('Alle lokal gespeicherten Antworten löschen?')) { store.del('sg-survey'); renderResults(); } };
  renderResults();
}
function renderResults() {
  const list = store.get('sg-survey', []), n = list.length;
  const prices = list.map(r => r.price).sort((a, b) => a - b);
  $('#results').innerHTML = [[n, 'Antworten'], [n ? Math.round(100 * list.filter(r => r.buy >= 4).length / n) + ' %' : '–', 'Kaufbereit'], [n ? prices[Math.floor((n - 1) / 2)] + ' €' : '–', 'Median-Preis'], [n ? Math.round(100 * list.filter(r => r.more === 'ja').length / n) + ' %' : '–', 'Kämen öfter']]
    .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
}

/* ---------------------------------------------------------------- Regelwerk */
function renderRules() {
  const msRows = MILESTONES.map(m => { const e = ELEMENT_BY_ID[m.element]; return `<tr><td>${esc(MILESTONE_CATEGORIES.find(c => c[0] === m.cat)[1])}</td><td><b>${esc(m.name)}</b></td><td>${esc(m.cond)}</td><td><b>${esc(e.name)}</b>: ${esc(e.desc)}</td><td>${esc(e.where)}</td></tr>`; }).join('');
  $('#rules').innerHTML = `
  <div class="card"><h3>Ein Schal pro Saison</h3>
    <p>Jeder Fan kann für jede Saison, in der er im Stadion war, einen eigenen Schal bestellen. Die Vorderseite startet <b>einfarbig rot</b>, jeder Meilenstein der Saison legt eine Ebene darüber. Die Rückseite ist ebenfalls rot (nachtblau mit dem Meilenstein „Europapokal-Abende“) und erzählt die Saison: die 5 Spiele, die Gemini ausgewählt hat, und das Fan-Etikett.</p>
    <p><b>Fan-Code</b> <span class="kbd">FCB-XXXX-XXXX</span>: Crockford-Base32 mit Prüfzeichen. Der <b>Strickcode</b> an den Enden der Rückseite enthält Fan-Code und Saison (45 Bit, 2 Maschen pro Bit), damit die App den Schal erkennt.</p></div>
  <div class="card"><h3>Maße, Raster &amp; Garn</h3>
    <p>${WIDTH_CM} cm breit, 150, 180 oder 220 cm lang. Raster: ${ST_PER_CM} Maschen/cm quer und ${ROWS_PER_CM} Reihen/cm längs, also ${STITCHES} × ${150 * ROWS_PER_CM} Maschen bei 150 cm. Schrift und Symbole werden als Vektoren in Zentimetern gezeichnet und Masche für Masche in eine von 5 Garnfarben übersetzt, ohne Zwischentöne. Doppeljacquard, Einzelfertigung.</p>
    <p>${CI_KEYS.map(k => `<span class="chip" style="background:${YARN[k].hex};color:${k === 'W' || k === 'G' ? '#0E2240' : '#fff'}">${YARN[k].name}</span>`).join(' ')}</p>
    <p class="small muted">Gold kommt nur über Gold-Meilensteine in den Schal (${GOLD_ELEMENTS.map(id => esc(ELEMENT_BY_ID[id].name)).join(', ')}).</p></div>
  <div class="card"><h3>Gestrickt, gestickt, aufgenäht</h3>
    <p>Wie beim Mitgliederschal werden drei Techniken kombiniert:</p>
    <p>🧶 <b>Gestrickt (Jacquard):</b> alles Grafische, also Grundfarbe, Bänder, Muster, Rauten, Sterne, Medaillon-Ring, große Saison-Ziffern und das Vereinswappen. Daraus entsteht die Strickdatei.</p>
    <p>🪡 <b>Gestickt:</b> Schrift, die klar lesbar sein muss: Name, Saison, Fan-Code, Bilanz, Kilometer, Länder, die Spielzahl im Medaillon und „AUG–MAI“. Sie wird nach dem Stricken aufgestickt (Stickdatei als SVG).</p>
    <p>🏷️ <b>Patches:</b> die 5 Highlight-Spiele als gewebte Aufnäher mit Overlock-Rand. Sie werden für jeden Fan einzeln gedruckt oder gewebt und aufgenäht. So muss das Strickmuster keine feine Schrift tragen.</p>
    <p class="small muted">Noch zu klären: Stickerei geht beim doppellagigen Gestrick durch beide Seiten. Lösung: Unterfaden in der Farbe der Gegenseite, oder nur in Bereichen sticken, die auf der Gegenseite schlicht sind. Das sollte ein Probestück zeigen. Das Wappen ist für den Prototyp nachgezeichnet, die Nutzung muss mit dem Verein abgestimmt werden.</p></div>
  <div class="card"><h3>Die fünf Reihen</h3>
    <p><b>Treue</b> baut den Grundaufbau. <b>Wettbewerbe</b> setzen Symbole und färben die Rückseite um. <b>Auswärts</b> verändert Kanten, Enden und Fransenfarbe. <b>Momente</b> füllen die Streifenbänder mit Mustern, die sich abwechseln. <b>Saison komplett</b> veredelt das Endfeld und die Rückseite.</p>
    <div class="flow"><span>Fransen</span><span>Rauten-Enden</span><span>Endstreifen</span><span class="h">Endfeld: Sterne · Saison · AUG–MAI · Pokal · Krone · Stadion-Punkte</span><span>Endstreifen</span><span>Sternenband</span><span>Musterbänder …</span><span class="k">Mitte: Rauten + Medaillon</span><span>… gespiegelt bis Ende B</span></div></div>
  <div class="card"><h3>Rolle der KI</h3>
    <p><b>Gemini macht:</b> alle Spiele der Saison lesen, einordnen, wie die Saison für den Fan war, und bis zu 5 Highlights wählen und begründen. <b>Gemini macht nicht:</b> Ergebnisse oder Muster erzeugen. Jede Spielnummer wird geprüft, und gleicher Code plus gleiche Saison ergeben immer denselben Schal.</p></div>
  <div class="card" style="grid-column:1/-1"><h3>Alle Meilensteine (${MILESTONES.length})</h3>
    <div class="table-wrap" style="max-height:none"><table><thead><tr><th>Reihe</th><th>Meilenstein</th><th>Bedingung</th><th>Schaltet frei</th><th>Wo</th></tr></thead><tbody>${msRows}</tbody></table></div></div>`;
}

/* ---------------------------------------------------------------- Helfer & Start */
function download(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function bindSeg(id, fn) {
  $$(`#${id} button`).forEach(b => b.onclick = () => { $$(`#${id} button`).forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.v); });
}

function init() {
  $('#presetSel').innerHTML = PRESETS.map(p => `<option value="${p.code}">${esc(p.label)} – ${esc(p.who)}</option>`).join('') + '<option value="">Eigener Code / Zufall</option>';
  $('#presetSel').onchange = () => { if ($('#presetSel').value) loadFan($('#presetSel').value); };
  $('#codeForm').onsubmit = ev => { ev.preventDefault(); loadFan($('#codeIn').value); };
  $('#randomBtn').onclick = () => loadFan(randomCode());
  $('#seasonSel').onchange = () => selectSeason(Number($('#seasonSel').value));
  $('#lenSel').onchange = () => { state.lengthCm = Number($('#lenSel').value); state.pinned = null; update(); };
  $('#nameIn').oninput = () => { state.name = $('#nameIn').value.toUpperCase(); update(); };
  bindSeg('viewSeg', v => { state.real = v === 'real'; renderScarf(); });
  bindSeg('msMode', v => { state.msMode = v; state.overrides = {}; update(); });
  $('#futureIn').oninput = () => { state.future = Number($('#futureIn').value); update(); };
  $('#markNew').onchange = () => { state.markNew = $('#markNew').checked; renderScarf(); };
  $('#geminiBtn').onclick = runGemini;
  $('#offlineBtn').onclick = () => { state.curation = curateOffline(state.games, state.stats, state.season); state.curations[`${state.profile.code}|${state.season}`] = state.curation; $('#aiStatus').textContent = 'Offline-Kurator aktiv.'; renderStory(); update(); };
  $('#keyIn').value = store.get('sg-key', ''); $('#keyRemember').checked = !!store.get('sg-key', '');
  $('#modelIn').value = store.get('sg-model', 'gemini-2.5-flash');
  $('#dlTxt').onclick = () => download(`strickdatei-${state.profile.code}-${state.season}.txt`, knitFile(state.scarf, { code: state.profile.code, lengthCm: state.lengthCm, season: state.season }), 'text/plain');
  $('#dlSvg').onclick = () => download(`stickdatei-${state.profile.code}-${state.season}.svg`, embroiderySVG(state.scarf, { code: state.profile.code, lengthCm: state.lengthCm, season: state.season }), 'image/svg+xml');
  $('#dlPng').onclick = () => {
    const a = document.createElement('a'); a.href = patternPNG(state.scarf.front); a.download = `muster-vorderseite-${state.profile.code}-${state.season}.png`; a.click();
    setTimeout(() => { const b = document.createElement('a'); b.href = patternPNG(state.scarf.back); b.download = `muster-rueckseite-${state.profile.code}-${state.season}.png`; b.click(); }, 300);
  };
  $('details.more').addEventListener('toggle', () => { if ($('details.more').open) renderRules(); });
  bindScarf();
  bindSurvey();
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderScarf, 120); });
  const fromHash = () => {
    const [h, y] = decodeURIComponent(location.hash.slice(1)).split('/');
    if (!h || !parseCode(h).ok) return false;
    if (!state.profile || parseCode(h).code !== state.profile.code) loadFan(h);
    if (Number(y) && Number(y) !== state.season && state.seasons.some(([s2]) => s2 === Number(y))) selectSeason(Number(y));
    return true;
  };
  window.addEventListener('hashchange', fromHash);
  if (!fromHash()) loadFan(PRESETS[2].code);
}

document.addEventListener('DOMContentLoaded', () => {
  // Erst rendern, wenn die eingebettete Schrift geladen ist (sonst stimmt die Beschriftung nicht)
  const go = () => { try { init(); } catch (e) { console.error(e); } };
  if (document.fonts && document.fonts.load) Promise.race([document.fonts.load('700 40px ScarfFont'), new Promise(r => setTimeout(r, 1500))]).then(go, go);
  else go();
});
