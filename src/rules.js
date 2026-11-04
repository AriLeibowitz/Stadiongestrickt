/* =========================================================================
   Stadion gestrickt – Regelwerk (ein Schal pro Saison)
   Statistik der Saison  →  Meilensteine  →  Design-Elemente
   Alles hier ist deterministisch: gleicher Fan-Code + gleiche Saison = gleicher Schal.
   ========================================================================= */
'use strict';

const SEASON_MONTHS = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5];
const MONTH_SHORT = { 8: 'AUG', 9: 'SEP', 10: 'OKT', 11: 'NOV', 12: 'DEZ', 1: 'JAN', 2: 'FEB', 3: 'MRZ', 4: 'APR', 5: 'MAI' };

function computeStats(games) {
  const s = {
    total: games.length, played: 0, W: 0, D: 0, L: 0, goalsFor: 0, goalsAgainst: 0,
    byComp: { BL: 0, DFB: 0, CL: 0, SC: 0 }, home: 0, away: 0, neutral: 0,
    awayCountries: new Set(), stadiums: new Set(), awayBLOpp: new Set(), blOpp: new Set(),
    months: new Map(), km: 0, finals: 0, titles: 0, comebacks: 0, late: 0,
    rain: 0, snow: 0, klassiker: 0, fest: 0, pens: 0, homeBL: 0,
    longestUnbeaten: { len: 0, from: -1, to: -1 }, fullHomeSeason: false, firstVisit: new Set(),
  };
  let run = 0, runStart = 0;
  games.forEach((g, i) => {
    const mo = Number(g.date.slice(5, 7));
    s.months.set(mo, (s.months.get(mo) || 0) + 1);
    s.byComp[g.comp]++;
    if (g.venue === 'H') s.home++; else if (g.venue === 'A') s.away++; else s.neutral++;
    if (g.venue !== 'H') s.km += g.km * 2;
    if (g.venue !== 'H' && g.country !== 'GER') s.awayCountries.add(g.country);
    if (!s.stadiums.has(g.stadiumKey)) { s.stadiums.add(g.stadiumKey); s.firstVisit.add(g.nr); }
    if (g.comp === 'BL') { s.blOpp.add(g.opp); if (g.venue === 'A') s.awayBLOpp.add(g.opp); else s.homeBL++; }
    if (g.klassiker) s.klassiker++;
    if (g.result == null) return; // Zukunft: Ergebnis unbekannt
    s.played++;
    s[g.result]++;
    s.goalsFor += g.fcbGoals; s.goalsAgainst += g.oppGoals;
    if (g.final) s.finals++;
    if (g.titleClinch) s.titles++;
    if (g.comeback) s.comebacks++;
    if (g.lateWinner) s.late++;
    if (g.weather === 'rain') s.rain++;
    if (g.weather === 'snow') s.snow++;
    if (g.fcbGoals >= 5) s.fest++;
    if (g.pens) s.pens++;
    if (g.result !== 'L') {
      if (run === 0) runStart = i;
      run++;
      if (run > s.longestUnbeaten.len) s.longestUnbeaten = { len: run, from: runStart, to: i };
    } else run = 0;
  });
  s.fullHomeSeason = s.homeBL >= 17;
  s.monthCount = SEASON_MONTHS.filter(m => s.months.has(m)).length;
  return s;
}

/* ---- Design-Elemente ----------------------------------------------------
   Der Schal startet einfarbig in Vereinsrot. Jeder Meilenstein legt eine
   Design-Ebene darüber: Streifen, Symbole, Musterbänder, Rauten, Gold.
   basis: true → immer da.  layer: wo das Element auf dem Schal sitzt.        */
const ELEMENTS = [
  // Basis
  { id: 'base', name: 'Vereinsrot', basis: true, where: 'Vorderseite', desc: 'Jeder Saisonschal beginnt einfarbig rot mit weißen Fransen. Alles andere kommt über Meilensteine dazu.' },
  { id: 'crest', name: 'Vereinswappen', basis: true, where: 'Rückseite, Ende A', desc: 'Das Wappen, eingestrickt und so ausgerichtet, dass es beim Tragen aufrecht steht. Nachgezeichnet nur für den Prototyp, die Nutzung muss mit dem Verein abgestimmt werden.' },
  { id: 'backInfo', name: 'Name & Saison (gestickt)', basis: true, where: 'Rückseite, Ende A', desc: 'Name, Saison, Mitglied seit und Bilanz, eingestickt und lesbar, wenn der Schal hängt.' },
  { id: 'highlights', name: 'Spiele-Patches', basis: true, where: 'Rückseite, Ende B', desc: 'Die bis zu 5 wichtigsten Spiele der Saison, ausgewählt von der KI, als kompakte gewebte Aufnäher. Das Herzstück sitzt allein unten, die anderen zu zweit darüber.' },
  { id: 'code', name: 'Strickcode', basis: true, where: 'Rückseite, beide Enden', desc: 'Fan-Code und Saison als 45-Bit-Muster. Die App erkennt den Schal daran wieder.' },
  // Reihe Treue (Stufen: immer nur eine aktiv)
  { id: 'stripe1', name: 'Stufe 1: 1 Streifen', where: 'Vorderseite, Enden', desc: 'Ein breiter weißer Querstreifen an jedem Ende.' },
  { id: 'stripe3', name: 'Stufe 2: 3 Streifen', where: 'Vorderseite, Enden', desc: 'Drei weiße Querstreifen an jedem Ende, das klassische Rot-Weiß.' },
  { id: 'blocks', name: 'Stufe 3: Blockstreifen', where: 'Vorderseite', desc: '3 Endstreifen und breite weiße Blockstreifen im Mittelteil.' },
  { id: 'border', name: 'Stufe 4: Weißer Rand', where: 'Vorderseite', desc: 'Wie Stufe 3, dazu eine weiße Kante entlang beider Längsseiten.' },
  { id: 'gold', name: 'Stufe 5: Goldstreifen', where: 'Vorderseite, Fransen', desc: 'Die Endstreifen bekommen goldene Nadelstreifen, in die Fransen kommt Gold.' },
  { id: 'centerStripe', name: 'Stufe 6: Mittelstreifen', where: 'Vorderseite, Mitte', desc: 'Ein breiter weißer Mittelstreifen mit Goldkanten, auch die Blockstreifen werden golden gerahmt.' },
  { id: 'rautenField', name: 'Stufe 7: Rauten-Mitte', where: 'Vorderseite, Mitte', desc: 'Die Schalmitte wird blau-weiß gerautet, das höchste Treue-Abzeichen.' },
  // Reihe Wettbewerbe
  { id: 'cupIcon', name: 'Pokal über dem Wappen', where: 'Rückseite, über dem Wappen', desc: 'Ein kleiner Pokal, eingestickt über dem Wappen.' },
  { id: 'silverBar', name: 'Silberfaden', where: 'Vorderseite, Enden', desc: 'Ein dünner Silberfaden quer über beide Enden, aufgestickt wie eine Kordel.' },
  { id: 'night', name: 'Europapokal-Nacht', where: 'Rückseite', desc: 'Die Grundfarbe der Rückseite wechselt von Rot zu Nachtblau mit Sternenhimmel.' },
  { id: 'fourStars', name: 'Vier Sterne', where: 'Rückseite, über dem Wappen', desc: 'Vier goldene Sterne über dem Wappen, einer pro Wettbewerb.' },
  { id: 'cup', name: 'Finalpokal', where: 'Rückseite, über dem Wappen', desc: 'Ein goldener Pokal, eingestickt über dem Wappen.' },
  { id: 'plate', name: 'Meisterschale', where: 'Rückseite, über dem Wappen', desc: 'Die Meisterschale, eingestickt über dem Wappen.' },
  // Reihe Auswärts
  { id: 'awaySeam', name: 'Auswärtsnaht', where: 'Vorderseite, Längskanten', desc: 'Eine gestrichelte Naht entlang beider Längsseiten.' },
  { id: 'fringeRW', name: 'Rot-weiße Fransen', where: 'Fransen', desc: 'Die Fransen werden abwechselnd rot und weiß.' },
  { id: 'awayRauten', name: 'Rauten-Enden', where: 'Vorderseite, Enden', desc: 'Ein blau-weißes Rautenband direkt an den Fransen.' },
  { id: 'travel', name: 'Reise-Feld', where: 'Rückseite, Mitte', desc: 'Deine Reisekilometer der Saison und die Länder, in denen du warst, eingestickt.' },
  { id: 'stadiumDots', name: 'Stadion-Punkte', where: 'Vorderseite, Enden', desc: 'Eine Punktreihe im mittleren Endstreifen: ein Punkt pro besuchtem Stadion.' },
  { id: 'tour', name: 'Goldene Naht & Fransen', where: 'Vorderseite, Fransen', desc: 'Die Auswärtsnaht wird golden, die Fransen gold-rot.' },
  // Reihe Momente: gestickte Zeichen in 3 Versionen (1×, 2×, 3×)
  { id: 'bStreak', name: 'Ungeschlagen', mark: { icon: 'zigzag', label: 'UNGESCHLAGEN' }, where: 'Rückseite, Ende B', desc: 'Gesticktes Zeichen für 10 Spiele ohne Niederlage. Version 2 ab 20, Version 3 ab 30 Spielen.' },
  { id: 'bFest', name: 'Torfestival', mark: { icon: 'spark', label: 'TORFESTIVAL' }, where: 'Rückseite, Ende B', desc: 'Gesticktes Zeichen für ein Spiel mit 5+ Toren. Version 2 und 3 bei zwei und drei solchen Spielen.' },
  { id: 'bKlassiker', name: 'Klassiker', mark: { icon: 'cross', label: 'KLASSIKER' }, where: 'Rückseite, Ende B', desc: 'Gesticktes Zeichen für beide Klassiker gegen Dortmund. Weitere Versionen mit Pokal- und Supercup-Duellen.' },
  { id: 'bComeback', name: 'Comeback', mark: { icon: 'arrow', label: 'COMEBACK' }, where: 'Rückseite, Ende B', desc: 'Gesticktes Zeichen für einen Sieg nach Rückstand, Version 2 und 3 bei zwei und drei Comebacks.' },
  { id: 'bLate', name: 'Last Minute', mark: { icon: 'heart', label: 'LAST MINUTE' }, where: 'Rückseite, Ende B', desc: 'Gesticktes Zeichen für ein Siegtor in letzter Minute, Version 2 und 3 bei mehreren.' },
  { id: 'bRain', name: 'Allwetter', mark: { icon: 'rain', label: 'ALLWETTER' }, where: 'Rückseite, Ende B', desc: 'Gesticktes Zeichen für 3 Regenspiele, Version 2 ab 6, Version 3 ab 9.' },
  { id: 'bLoyal', name: 'Trotzdem da', mark: { icon: 'diamond', label: 'TROTZDEM DA' }, where: 'Rückseite, Ende B', desc: 'Gesticktes Zeichen: Du warst auch bei Niederlagen da (3, 6 oder 9).' },
  { id: 'bHome', name: 'Dauerbrenner', mark: { icon: 'home', label: 'DAUERBRENNER' }, where: 'Rückseite, Ende B', desc: 'Gesticktes Zeichen für alle 17 Bundesliga-Heimspiele.' },
  // Reihe Gegner-Sammler (Stufen)
  { id: 'threads1', name: 'Goldfäden I', where: 'Rückseite, Mitte', desc: '2 hauchdünne goldene Fäden laufen längs durch die Mitte der Rückseite.' },
  { id: 'threads2', name: 'Goldfäden II', where: 'Rückseite, Mitte', desc: 'Upgrade auf 4 goldene Längsfäden.' },
  { id: 'threads3', name: 'Goldfäden III', where: 'Rückseite, Mitte', desc: 'Upgrade auf 6 goldene Längsfäden: alle Gegner gesehen.' },
  // Reihe Mitgliedschaft (Stufen)
  { id: 'crestTradition', name: 'Traditionswappen', where: 'Rückseite, Ende A', desc: 'Das Wappen bekommt einen goldenen Außenring und den Zusatz „E.V.“ (Entwurf).' },
  { id: 'crestRetro', name: 'Retro-Wappen', where: 'Rückseite, Ende A', desc: 'Das Wappen wechselt in eine Retro-Version mit FCB-Monogramm (Entwurf in Anlehnung an historische Wappen).' },
];
const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map(e => [e.id, e]));
const GOLD_ELEMENTS = ['gold', 'centerStripe', 'rautenField', 'tour', 'threads1', 'threads2', 'threads3', 'crestTradition', 'crestRetro'];
const TIERED = ['treue', 'sammlung', 'mitglied'];   // Reihen, in denen immer nur eine Stufe aktiv ist

const MILESTONE_CATEGORIES = [
  ['treue', 'Treue', 'Eine Stufe, die mit jedem Spiel wächst'],
  ['wettbewerbe', 'Wettbewerbe', 'Silberfaden, Grundfarbe, Trophäen über dem Wappen'],
  ['auswaerts', 'Auswärts', 'Kanten, Enden und Fransen'],
  ['momente', 'Momente', 'Gestickte Zeichen in 3 Versionen'],
  ['sammlung', 'Gegner-Sammler', 'Goldfäden in 3 Stufen'],
  ['mitglied', 'Mitgliedschaft', 'Das Wappen wird älter mit dir'],
];

const MILESTONES = [
  { id: 'first', cat: 'treue', name: 'Saisonstart', cond: '1 Spiel in der Saison', target: 1, value: s => s.total, element: 'stripe1' },
  { id: 'g5', cat: 'treue', name: 'Wiederholungstäter', cond: '5 Spiele in der Saison', target: 5, value: s => s.total, element: 'stripe3' },
  { id: 'g10', cat: 'treue', name: 'Zweistellig', cond: '10 Spiele in der Saison', target: 10, value: s => s.total, element: 'blocks' },
  { id: 'g20', cat: 'treue', name: 'Kurvengesicht', cond: '20 Spiele in der Saison', target: 20, value: s => s.total, element: 'border' },
  { id: 'g30', cat: 'treue', name: 'Goldenes Garn', cond: '30 Spiele in der Saison', target: 30, value: s => s.total, element: 'gold' },
  { id: 'g40', cat: 'treue', name: 'Vierziger', cond: '40 Spiele in der Saison', target: 40, value: s => s.total, element: 'centerStripe' },
  { id: 'g50', cat: 'treue', name: 'Allesfahrer', cond: '50 Spiele in der Saison', target: 50, value: s => s.total, element: 'rautenField' },
  { id: 'dfb1', cat: 'wettbewerbe', name: 'Pokalnacht', cond: '1 DFB-Pokalspiel', target: 1, value: s => s.byComp.DFB, element: 'cupIcon' },
  { id: 'cl1', cat: 'wettbewerbe', name: 'Hymne live', cond: '1 Champions-League-Spiel', target: 1, value: s => s.byComp.CL, element: 'silverBar' },
  { id: 'cl5', cat: 'wettbewerbe', name: 'Europapokal-Abende', cond: '5 Champions-League-Spiele', target: 5, value: s => s.byComp.CL, element: 'night' },
  { id: 'comp4', cat: 'wettbewerbe', name: 'Grand Slam', cond: 'In allen 4 Wettbewerben (BL, Pokal, CL, Supercup)', target: 4, value: s => Object.values(s.byComp).filter(n => n > 0).length, element: 'fourStars' },
  { id: 'final', cat: 'wettbewerbe', name: 'Endspiel', cond: '1 Finale live', target: 1, value: s => s.finals, element: 'cup' },
  { id: 'title', cat: 'wettbewerbe', name: 'Meister-Moment', cond: 'Beim Spiel der Titelentscheidung dabei', target: 1, value: s => s.titles, element: 'plate' },
  { id: 'a1', cat: 'auswaerts', name: 'Erste Auswärtsfahrt', cond: '1 Auswärtsspiel', target: 1, value: s => s.away, element: 'awaySeam' },
  { id: 'a5', cat: 'auswaerts', name: 'Vielfahrer', cond: '5 Auswärtsspiele', target: 5, value: s => s.away, element: 'fringeRW' },
  { id: 'a10', cat: 'auswaerts', name: 'Auswärtsfahrer', cond: '10 Auswärtsspiele', target: 10, value: s => s.away, element: 'awayRauten' },
  { id: 'countries2', cat: 'auswaerts', name: 'Länderpunkte', cond: 'Auswärts in 2 Ländern außerhalb Deutschlands', target: 2, value: s => s.awayCountries.size, element: 'travel' },
  { id: 'stadiums8', cat: 'auswaerts', name: 'Groundhopper', cond: '8 verschiedene Stadien', target: 8, value: s => s.stadiums.size, element: 'stadiumDots' },
  { id: 'tour17', cat: 'auswaerts', name: 'Komplett-Tour', cond: 'Alle 17 Bundesliga-Auswärtsspiele', target: 17, value: s => s.awayBLOpp.size, element: 'tour' },
  { id: 'streak10', cat: 'momente', name: 'Ungeschlagen', cond: '10 Spiele in Folge ohne Niederlage', target: 10, value: s => s.longestUnbeaten.len, element: 'bStreak' },
  { id: 'fest', cat: 'momente', name: 'Torfestival', cond: '1 Spiel mit 5+ Bayern-Toren', target: 1, value: s => s.fest, element: 'bFest' },
  { id: 'klassiker2', cat: 'momente', name: 'Beide Klassiker', cond: '2 Spiele gegen Dortmund', target: 2, value: s => s.klassiker, element: 'bKlassiker' },
  { id: 'comeback', cat: 'momente', name: 'Nie aufgeben', cond: '1 Comeback-Sieg nach Rückstand', target: 1, value: s => s.comebacks, element: 'bComeback' },
  { id: 'late', cat: 'momente', name: 'Herzschlagfinale', cond: '1 Siegtor in letzter Minute', target: 1, value: s => s.late, element: 'bLate' },
  { id: 'rain3', cat: 'momente', name: 'Allwetterfan', cond: '3 Regenspiele', target: 3, value: s => s.rain, element: 'bRain' },
  { id: 'loss3', cat: 'momente', name: 'Trotzdem da', cond: '3 Niederlagen miterlebt', target: 3, value: s => s.L, element: 'bLoyal' },
  { id: 'fullSeason', cat: 'momente', name: 'Dauerbrenner', cond: 'Alle 17 Bundesliga-Heimspiele', target: 17, value: s => s.homeBL, element: 'bHome' },
  { id: 'opp6', cat: 'sammlung', name: 'Gegner I', cond: '6 verschiedene Bundesliga-Gegner gesehen', target: 6, value: s => s.blOpp.size, element: 'threads1' },
  { id: 'opp12', cat: 'sammlung', name: 'Gegner II', cond: '12 verschiedene Bundesliga-Gegner gesehen', target: 12, value: s => s.blOpp.size, element: 'threads2' },
  { id: 'opp17', cat: 'sammlung', name: 'Gegner III', cond: 'Alle 17 Bundesliga-Gegner gesehen', target: 17, value: s => s.blOpp.size, element: 'threads3' },
  { id: 'member5', cat: 'mitglied', name: '5 Jahre dabei', cond: 'Seit mindestens 5 Jahren Mitglied', target: 5, value: s => s.memberYears || 0, element: 'crestTradition' },
  { id: 'member10', cat: 'mitglied', name: '10 Jahre dabei', cond: 'Seit mindestens 10 Jahren Mitglied', target: 10, value: s => s.memberYears || 0, element: 'crestRetro' },
];

// Version eines Moment-Zeichens: 1×, 2× oder 3× das Ziel erreicht
function markVersion(m) { return !m || !m.reached ? 1 : m.current >= 3 * m.target ? 3 : m.current >= 2 * m.target ? 2 : 1; }

function evaluateMilestones(stats) {
  return MILESTONES.map(m => {
    const v = m.value(stats);
    return { ...m, current: v, reached: v >= m.target, progress: Math.min(1, v / m.target) };
  });
}

// overrides: { elementId: 'on' | 'off' }  (fehlt = automatisch)
// overrides: { elementId: 'on' | 'off' }  (fehlt = automatisch)
// In gestuften Reihen bleibt nur die höchste aktive Stufe an.
function resolveElements(milestoneStates, overrides) {
  const auto = {};
  for (const e of ELEMENTS) auto[e.id] = !!e.basis;
  for (const m of milestoneStates) if (m.reached) auto[m.element] = true;
  const active = {};
  for (const e of ELEMENTS) {
    const o = overrides[e.id];
    active[e.id] = o === 'on' ? true : o === 'off' ? false : auto[e.id];
  }
  for (const cat of TIERED) {
    const ids = MILESTONES.filter(m => m.cat === cat).map(m => m.element);
    const top = ids.filter(id => active[id]).pop();
    for (const id of ids) active[id] = id === top;
  }
  return { auto, active };
}
function milestoneForElement(id) { return MILESTONES.find(m => m.element === id); }

