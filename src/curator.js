/* =========================================================================
   Stadion gestrickt – KI-Kurator
   Gemini sieht ALLE besuchten Spiele und schlägt bis zu 5 Highlights vor,
   begründet die Auswahl und erzählt die Fan-Geschichte.
   Gemini wählt nur aus echten Spielen aus (Prüfung über die Spielnummer) –
   Ergebnisse, Daten und Muster kommen nie von der KI.
   ========================================================================= */
'use strict';

const COMP_DE = { BL: 'Bundesliga', DFB: 'DFB-Pokal', CL: 'Champions League', SC: 'Supercup' };
const WEATHER_DE = { rain: 'Regen', snow: 'Schnee', hot: 'Hitze', clear: '' };

function gameLine(m) {
  const flags = [];
  if (m.final) flags.push('FINALE');
  if (m.titleClinch) flags.push('Meisterschaft entschieden');
  if (m.comeback) flags.push('Comeback nach Rückstand');
  if (m.lateWinner) flags.push('Siegtor in letzter Minute');
  if (m.pens) flags.push(`Elfmeterschießen ${m.pens === 'W' ? 'gewonnen' : 'verloren'}`);
  if (m.klassiker) flags.push('Klassiker');
  if (m.derby) flags.push('Stadtderby');
  if (WEATHER_DE[m.weather]) flags.push(WEATHER_DE[m.weather]);
  const v = m.venue === 'H' ? 'Heim' : m.venue === 'A' ? `Auswärts in ${m.city} (${m.km} km)` : `Neutral in ${m.city}`;
  return `#${m.nr} | ${m.date} | ${COMP_DE[m.comp]}, ${m.round} | ${v} | ${scoreLong(m)}${flags.length ? ' | ' + flags.join(', ') : ''}`;
}

function buildPrompt(profile, games, stats, season) {
  const months = SEASON_MONTHS.filter(m => stats.months.has(m)).map(m => `${MONTH_SHORT[m]}: ${stats.months.get(m)}`).join(', ');
  return `Du bist der Kurator von „Stadion gestrickt“, einem persönlichen FC-Bayern-Saisonschal. Er wird aus den Spielen gestrickt, die ein Fan in der Saison ${seasonLabel(season)} live im Stadion erlebt hat.

AUFGABE
1. Lies ALLE Spiele des Fans in dieser Saison.
2. Wähle bis zu 5 Spiele für die großen Highlight-Felder des Schals. Das erste Spiel deiner Liste wird das „Herzstück“ in der Schalmitte.
3. Begründe jede Wahl in 1–2 Sätzen, persönlich und auf Deutsch, in der Du-Form.
4. Schreibe eine kurze Saison-Geschichte (3–5 Sätze): Wie war die Saison für diesen Fan? Wie verlief sie, welche Phase war besonders, was zeichnet seine Saison aus?

REGELN
- Verwende AUSSCHLIESSLICH die Daten unten. Erfinde keine Torschützen, Spielszenen oder Gefühle, die nicht aus den Daten folgen.
- Gib Spiele nur über ihre Nummer (#) an.
- Achte auf Vielfalt: verschiedene Saisons, Gegner und Wettbewerbe, wenn möglich.
- Gute Kandidaten sind zum Beispiel das erste Spiel der Saison, Finals, Titelentscheidungen, Comebacks, weite Auswärtsfahrten und Klassiker.
- Titel je Highlight: höchstens 4 Wörter.

FAN
Fan-Code: ${profile.code}
Saison: ${seasonLabel(season)}${season === CURRENT_SEASON ? ' (läuft noch)' : ''}
Spiele in der Saison: ${stats.total} (S ${stats.W} / U ${stats.D} / N ${stats.L}), Tore ${stats.goalsFor}:${stats.goalsAgainst}
Heim ${stats.home}, Auswärts ${stats.away}, Neutral ${stats.neutral}, Reise-km ${stats.km}
Wettbewerbe: BL ${stats.byComp.BL}, DFB-Pokal ${stats.byComp.DFB}, CL ${stats.byComp.CL}, Supercup ${stats.byComp.SC}
Länder auswärts: ${[...stats.awayCountries].map(c => COUNTRY_NAMES[c] || c).join(', ') || 'keine'}
Spiele pro Monat: ${months}

SPIELE
${games.map(gameLine).join('\n')}`;
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    story: { type: 'STRING' },
    highlights: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { nr: { type: 'INTEGER' }, title: { type: 'STRING' }, reason: { type: 'STRING' } },
        required: ['nr', 'title', 'reason'],
      },
    },
  },
  required: ['story', 'highlights'],
};

async function curateWithGemini(apiKey, model, profile, games, stats, season) {
  const prompt = buildPrompt(profile, games, stats, season);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
    }),
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { const j = await res.json(); msg += ` – ${j.error && j.error.message ? j.error.message : ''}`; } catch (e) { /* */ }
    throw new Error(`Gemini-Anfrage fehlgeschlagen (${msg})`);
  }
  const data = await res.json();
  const text = data.candidates && data.candidates[0] && data.candidates[0].content.parts.map(p => p.text || '').join('');
  if (!text) throw new Error('Gemini hat keine Antwort geliefert.');
  const parsed = JSON.parse(text);
  return validateCuration(parsed, games, stats, 'gemini', model);
}

// Schutz gegen Halluzination: nur existierende Spielnummern, keine Duplikate, max. 5
function validateCuration(parsed, games, stats, source, model) {
  const byNr = new Map(games.map(g => [g.nr, g]));
  const seen = new Set(), highlights = [];
  for (const h of parsed.highlights || []) {
    const nr = Number(h.nr);
    if (!byNr.has(nr) || seen.has(nr)) continue;
    seen.add(nr);
    highlights.push({ nr, title: String(h.title || '').slice(0, 40), reason: String(h.reason || '').slice(0, 400), source });
    if (highlights.length === 5) break;
  }
  const rejected = (parsed.highlights || []).length - highlights.length;
  // Auffüllen, falls die KI weniger als möglich vorschlägt
  const want = Math.min(5, games.length);
  if (highlights.length < want) {
    const fill = curateOffline(games, stats, games[0] && games[0].season).highlights.filter(h => !seen.has(h.nr));
    for (const h of fill) { if (highlights.length >= want) break; highlights.push({ ...h, source: 'regel' }); }
  }
  return { source, model, story: String(parsed.story || ''), highlights, rejected };
}

/* ---- Offline-Kurator: regelbasierte Simulation derselben Aufgabe ------- */
function curateOffline(games, stats, season) {
  if (!games.length) return { source: 'offline', story: `Noch kein Spiel in der Saison ${seasonLabel(season)}. Dein Schal wartet auf dein erstes Stadionerlebnis.`, highlights: [] };
  const maxKm = Math.max(...games.map(g => g.km));
  const maxDiff = Math.max(...games.map(g => g.fcbGoals - g.oppGoals));
  const cand = games.map(m => {
    let score = 0; const why = [];
    let title = '', kind = '';
    const k = t => { if (!kind) kind = t; };
    if (m.nr === 1) { k('first'); score += 100; title = 'Dein Saisonauftakt'; why.push(`Hier hat deine Saison angefangen: ${fmtDateLong(m.date)}.`); }
    if (m.final) { k('final'); score += 90 + (m.result === 'W' || m.pens === 'W' ? 25 : 0); title = title || (m.comp === 'DFB' ? 'Pokalfinale in Berlin' : `Finale in ${m.city}`); why.push(m.result === 'W' || m.pens === 'W' ? `Du warst beim Finale in ${m.city} dabei, als ${m.comp === 'CL' ? 'der Henkelpott' : 'der DFB-Pokal'} gewonnen wurde.` : `Ein Finale in ${m.city}. Auch ohne Pokal bleibt das ein Abend fürs Leben.`); }
    if (m.titleClinch) { k('title'); score += 85; title = title || 'Meister-Moment'; why.push('An diesem Tag wurde die Meisterschaft entschieden, und du warst im Stadion.'); }
    if (m.nr > 1 && m.nr % 10 === 0) { k('jubilee'); score += 20 + m.nr / 2; title = title || `Saisonspiel Nr. ${m.nr}`; why.push(`Dein ${m.nr}. Spiel dieser Saison.`); }
    if (m.comp === 'CL' && /finale|Halb|Viertel/i.test(m.round) && !m.final) { k('euro'); score += 40 + (m.result === 'W' ? 15 : 0); title = title || `${m.round.split(' ')[0]} in Europa`; why.push(`Ein ${m.round} gegen ${clubName(m.opp)}, eine große Europapokal-Nacht.`); }
    if (m.comeback) { k('comeback'); score += 42; title = title || 'Das Comeback'; why.push('Ein Sieg nach Rückstand. Solche Spiele vergisst man nicht.'); }
    if (m.lateWinner) { k('late'); score += 32; title = title || 'Last-Minute-Sieg'; why.push('Das Siegtor fiel in letzter Minute.'); }
    if (m.pens) { k('pens'); score += 30; title = title || 'Nervenkrimi'; why.push(`Entschieden erst im Elfmeterschießen, ${m.pens === 'W' ? 'mit glücklichem Ende' : 'leider mit bitterem Ende'}.`); }
    if (m.klassiker && m.result === 'W') { k('klassiker'); score += 30 + m.fcbGoals * 3; title = title || 'Klassiker-Sieg'; why.push(`Ein ${m.fcbGoals}:${m.oppGoals}-Sieg im Klassiker gegen Dortmund.`); }
    if (m.fcbGoals - m.oppGoals === maxDiff && maxDiff >= 4) { k('fest'); score += 28; title = title || 'Torfestival'; why.push(`Dein höchster Sieg der Saison: ${m.fcbGoals}:${m.oppGoals}.`); }
    if (m.km === maxKm && m.km > 0) { k('far'); score += 30; title = title || `Weiteste Reise`; why.push(`Mit ${(m.km * 2).toLocaleString('de-DE')} km hin und zurück deine weiteste Fahrt der Saison, nach ${m.city}.`); }
    if (m.weather === 'snow') { score += 10; why.push('Dazu noch Schnee.'); }
    if (m.derby) { k('derby'); score += 20; title = title || 'Stadtderby'; why.push('Das Münchner Stadtderby.'); }
    if (m.nr === games.length && games.length > 1) { k('last'); score += 18; title = title || 'Dein Saisonfinale'; why.push('Dein letztes Spiel dieser Saison.'); }
    if (!title) { title = m.result === 'W' ? `Sieg gegen ${clubAbbr(m.opp)}` : `${clubAbbr(m.opp)} ${m.venue === 'A' ? 'auswärts' : 'zuhause'}`; why.push(`${scoreLong(m)}, ${m.round} in der ${COMP_DE[m.comp]}.`); }
    score += m.fcbGoals * 0.5 + (m.result === 'W' ? 2 : 0);
    return { m, score, title, kind: kind || 'other', reason: why.slice(0, 2).join(' ') };
  });
  // Greedy mit Vielfalt
  const chosen = [];
  const pool = cand.slice();
  while (chosen.length < Math.min(5, games.length) && pool.length) {
    pool.forEach(c => {
      c.adj = c.score;
      for (const k of chosen) {
        if (k.m.season === c.m.season) c.adj -= 22;
        if (k.m.opp === c.m.opp) c.adj -= 25;
        if (k.m.comp === c.m.comp) c.adj -= 6;
        if (k.kind === c.kind) c.adj -= 60;
      }
      if (c.m.venue !== 'H' && !chosen.some(k => k.m.venue !== 'H')) c.adj += 8;
    });
    pool.sort((a, b) => b.adj - a.adj);
    chosen.push(pool.shift());
  }
  // Herzstück = höchster Rohwert
  chosen.sort((a, b) => b.score - a.score);
  return {
    source: 'offline',
    story: offlineStory(games, stats, season),
    highlights: chosen.map(c => ({ nr: c.m.nr, title: c.title, reason: c.reason, source: 'offline' })),
  };
}

function offlineStory(games, stats, season) {
  const first = games[0], last = games[games.length - 1];
  const bestMonth = [...stats.months.entries()].sort((a, b) => b[1] - a[1])[0];
  const MONTH_DE = { 1: 'Januar', 2: 'Februar', 3: 'März', 4: 'April', 5: 'Mai', 6: 'Juni', 7: 'Juli', 8: 'August', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Dezember' };
  const winRate = stats.played ? Math.round(100 * stats.W / stats.played) : 0;
  const parts = [];
  parts.push(`Deine Saison ${seasonLabel(season)} begann am ${fmtDateLong(first.date)} mit ${scoreLong(first)}.`);
  if (games.length > 1) parts.push(`Du warst bei ${stats.total} Spielen dabei und hast ${stats.W} Siege gesehen (${winRate} %), mit ${stats.goalsFor} Bayern-Toren.`);
  if (stats.months.size > 1) parts.push(`Dein intensivster Monat war der ${MONTH_DE[bestMonth[0]]} mit ${bestMonth[1]} Spielen.`);
  if (stats.longestUnbeaten.len >= 5) parts.push(`${stats.longestUnbeaten.len} Spiele in Folge hast du keine Niederlage erlebt.`);
  if (stats.away >= 3) parts.push(`Auf ${stats.away} Auswärtsfahrten hast du ${stats.km.toLocaleString('de-DE')} km zurückgelegt${stats.awayCountries.size ? ', unter anderem in ' + [...stats.awayCountries].slice(0, 3).map(c => COUNTRY_NAMES[c]).join(', ') : ''}.`);
  else if (stats.home === stats.total && stats.total > 3) parts.push('Deine Saison spielte sich in der Arena ab: Jedes deiner Spiele war ein Heimspiel.');
  if (stats.finals) parts.push(`${stats.finals === 1 ? 'Ein Finale' : stats.finals + ' Finals'} live erlebt: Das schaffen nur wenige.`);
  if (stats.titles) parts.push('Und du warst dabei, als die Meisterschaft entschieden wurde.');
  if (season === CURRENT_SEASON) parts.push('Die Saison läuft noch, dein Schal wächst mit jedem Spiel.');
  else if (games.length > 1) parts.push(`Dein letztes Spiel der Saison war am ${fmtDateLong(last.date)}.`);
  return parts.join(' ');
}
