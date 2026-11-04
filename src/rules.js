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
  { id: 'highlights', name: 'Highlight-Patches', basis: true, where: 'Rückseite', desc: 'Die bis zu 5 wichtigsten Spiele der Saison, ausgewählt von der KI, als gewebte Aufnäher. Das wichtigste sitzt als „Herzstück“ in der Mitte.' },
  { id: 'code', name: 'Strickcode', basis: true, where: 'Rückseite, beide Enden', desc: 'Fan-Code und Saison als 45-Bit-Muster. Die App erkennt den Schal daran wieder.' },
  // Reihe Treue: Streifen wachsen
  { id: 'stripe1', name: '1 weißer Streifen', where: 'Vorderseite, Enden', desc: 'Ein breiter weißer Querstreifen an jedem Ende.' },
  { id: 'stripe3', name: '3 weiße Streifen', where: 'Vorderseite, Enden', desc: 'Aus einem Streifen werden drei, das klassische Rot-Weiß der Schalenden.' },
  { id: 'blocks', name: 'Blockstreifen', where: 'Vorderseite, Mittelteil', desc: 'Breite weiße Blockstreifen im Mittelteil.' },
  { id: 'border', name: 'Weißer Rand', where: 'Vorderseite, Längskanten', desc: 'Eine weiße Kante entlang beider Längsseiten.' },
  { id: 'gold', name: 'Goldene Nadelstreifen', where: 'Vorderseite, Fransen', desc: 'Jeder weiße Streifen bekommt goldene Nadelstreifen, und in die Fransen kommt Gold.' },
  { id: 'medal', name: 'Medaillon', where: 'Vorderseite, Mitte', desc: 'Ein Medaillon in der Schalmitte, darin deine Spielzahl der Saison eingestickt.' },
  { id: 'rautenField', name: 'Rauten-Mitte', where: 'Vorderseite, Mitte', desc: 'Die Schalmitte wird blau-weiß gerautet, das höchste Treue-Abzeichen.' },
  // Reihe Wettbewerbe
  { id: 'cupIcon', name: 'Pokal-Symbol', where: 'Vorderseite, Enden', desc: 'Ein weißer Pokal im Endfeld.' },
  { id: 'starBand', name: 'Sternenband', where: 'Vorderseite, Enden', desc: 'Ein nachtblaues Band mit weißen Sternen an beiden Enden.' },
  { id: 'night', name: 'Europapokal-Nacht', where: 'Rückseite', desc: 'Die Grundfarbe der Rückseite wechselt von Rot zu Nachtblau mit Sternenhimmel.' },
  { id: 'fourStars', name: 'Vier Sterne', where: 'Vorderseite, Enden', desc: 'Vier goldene Sterne im Endfeld, einer pro Wettbewerb.' },
  { id: 'cup', name: 'Pokal im Medaillon', where: 'Vorderseite, Mitte', desc: 'Ein goldener Pokal in der Schalmitte.' },
  { id: 'plate', name: 'Meisterschale', where: 'Vorderseite, Mitte', desc: 'Die Meisterschale in der Schalmitte.' },
  // Reihe Auswärts
  { id: 'awaySeam', name: 'Auswärtsnaht', where: 'Vorderseite, Längskanten', desc: 'Eine gestrichelte Naht entlang beider Längsseiten.' },
  { id: 'fringeRW', name: 'Rot-weiße Fransen', where: 'Fransen', desc: 'Die Fransen werden abwechselnd rot und weiß.' },
  { id: 'awayRauten', name: 'Rauten-Enden', where: 'Vorderseite, Enden', desc: 'Ein blau-weißes Rautenband direkt an den Fransen.' },
  { id: 'travel', name: 'Reise-Feld', where: 'Rückseite', desc: 'Deine Reisekilometer der Saison und die Länder, in denen du warst, eingestickt.' },
  { id: 'stadiumDots', name: 'Stadion-Punkte', where: 'Vorderseite, Enden', desc: 'Eine Punktreihe im mittleren Streifen: ein Punkt pro besuchtem Stadion.' },
  { id: 'tour', name: 'Goldene Naht & Fransen', where: 'Vorderseite, Fransen', desc: 'Die Auswärtsnaht wird golden, die Fransen gold-rot.' },
  // Reihe Momente: Abzeichen-Patches
  { id: 'bStreak', name: 'Abzeichen: Ungeschlagen', badge: { icon: 'zigzag', label: 'UNGESCHLAGEN' }, where: 'Rückseite', desc: 'Ein runder Aufnäher für 10 Spiele in Folge ohne Niederlage.' },
  { id: 'bFest', name: 'Abzeichen: Torfestival', badge: { icon: 'spark', label: 'TORFESTIVAL' }, where: 'Rückseite', desc: 'Ein runder Aufnäher für ein Spiel mit 5 oder mehr Bayern-Toren.' },
  { id: 'bKlassiker', name: 'Abzeichen: Klassiker', badge: { icon: 'cross', label: 'KLASSIKER' }, where: 'Rückseite', desc: 'Ein runder Aufnäher für beide Klassiker gegen Dortmund.' },
  { id: 'bComeback', name: 'Abzeichen: Comeback', badge: { icon: 'arrow', label: 'COMEBACK' }, where: 'Rückseite', desc: 'Ein runder Aufnäher für einen Sieg nach Rückstand.' },
  { id: 'bLate', name: 'Abzeichen: Last Minute', badge: { icon: 'heart', label: 'LAST MINUTE' }, where: 'Rückseite', desc: 'Ein runder Aufnäher für ein Siegtor in letzter Minute.' },
  { id: 'bRain', name: 'Abzeichen: Allwetter', badge: { icon: 'rain', label: 'ALLWETTER' }, where: 'Rückseite', desc: 'Ein runder Aufnäher für 3 Regenspiele.' },
  { id: 'bLoyal', name: 'Abzeichen: Trotzdem da', badge: { icon: 'diamond', label: 'TROTZDEM DA' }, where: 'Rückseite', desc: 'Ein runder Aufnäher: Du warst auch bei Niederlagen da.' },
  // Reihe Saison komplett
  { id: 'crown', name: 'Krone', where: 'Vorderseite, Enden', desc: 'Eine goldene Krone im Endfeld.' },
  { id: 'threads1', name: 'Goldfäden I', where: 'Vorderseite, längs', desc: '2 hauchdünne goldene Fäden laufen längs durch den Schal.' },
  { id: 'threads2', name: 'Goldfäden II', where: 'Vorderseite, längs', desc: 'Upgrade auf 4 goldene Längsfäden.' },
  { id: 'threads3', name: 'Goldfäden III', where: 'Vorderseite, längs', desc: 'Upgrade auf 6 goldene Längsfäden, alle Gegner gesehen.' },
  // Reihe Mitgliedschaft
  { id: 'crestTradition', name: 'Traditionswappen', where: 'Rückseite, Ende A', desc: 'Das Wappen bekommt einen goldenen Außenring und den Zusatz „E.V.“ (Entwurf).' },
  { id: 'crestRetro', name: 'Retro-Wappen', where: 'Rückseite, Ende A', desc: 'Das Wappen wechselt in eine Retro-Version mit FCB-Monogramm (Entwurf in Anlehnung an historische Wappen).' },
];
const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map(e => [e.id, e]));
const GOLD_ELEMENTS = ['gold', 'fourStars', 'cup', 'plate', 'tour', 'crown', 'threads1', 'threads2', 'threads3', 'crestTradition'];

/* ---- Meilensteine (alle pro Saison, Mitgliedschaft in Jahren) --------- */
const MILESTONE_CATEGORIES = [
  ['treue', 'Treue', 'Die Streifen wachsen mit jedem Spiel'],
  ['wettbewerbe', 'Wettbewerbe', 'Symbole und die Grundfarbe der Rückseite'],
  ['auswaerts', 'Auswärts', 'Kanten, Enden und Fransen'],
  ['momente', 'Momente', 'Abzeichen-Patches auf der Rückseite'],
  ['sammlung', 'Saison komplett', 'Krone und goldene Längsfäden'],
  ['mitglied', 'Mitgliedschaft', 'Das Wappen wird älter mit dir'],
];

const MILESTONES = [
  { id: 'first', cat: 'treue', name: 'Saisonstart', cond: '1 Spiel in der Saison', target: 1, value: s => s.total, element: 'stripe1' },
  { id: 'g5', cat: 'treue', name: 'Wiederholungstäter', cond: '5 Spiele in der Saison', target: 5, value: s => s.total, element: 'stripe3' },
  { id: 'g10', cat: 'treue', name: 'Zweistellig', cond: '10 Spiele in der Saison', target: 10, value: s => s.total, element: 'blocks' },
  { id: 'g20', cat: 'treue', name: 'Kurvengesicht', cond: '20 Spiele in der Saison', target: 20, value: s => s.total, element: 'border' },
  { id: 'g30', cat: 'treue', name: 'Goldenes Garn', cond: '30 Spiele in der Saison', target: 30, value: s => s.total, element: 'gold' },
  { id: 'g40', cat: 'treue', name: 'Vierziger', cond: '40 Spiele in der Saison', target: 40, value: s => s.total, element: 'medal' },
  { id: 'g50', cat: 'treue', name: 'Allesfahrer', cond: '50 Spiele in der Saison', target: 50, value: s => s.total, element: 'rautenField' },
  { id: 'dfb1', cat: 'wettbewerbe', name: 'Pokalnacht', cond: '1 DFB-Pokalspiel', target: 1, value: s => s.byComp.DFB, element: 'cupIcon' },
  { id: 'cl1', cat: 'wettbewerbe', name: 'Hymne live', cond: '1 Champions-League-Spiel', target: 1, value: s => s.byComp.CL, element: 'starBand' },
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
  { id: 'fullSeason', cat: 'sammlung', name: 'Dauerbrenner', cond: 'Alle 17 Bundesliga-Heimspiele', target: 17, value: s => s.homeBL, element: 'crown' },
  { id: 'opp6', cat: 'sammlung', name: 'Gegner-Sammler I', cond: '6 verschiedene Bundesliga-Gegner gesehen', target: 6, value: s => s.blOpp.size, element: 'threads1' },
  { id: 'opp12', cat: 'sammlung', name: 'Gegner-Sammler II', cond: '12 verschiedene Bundesliga-Gegner gesehen', target: 12, value: s => s.blOpp.size, element: 'threads2' },
  { id: 'opp17', cat: 'sammlung', name: 'Gegner-Sammler III', cond: 'Alle 17 Bundesliga-Gegner gesehen', target: 17, value: s => s.blOpp.size, element: 'threads3' },
  { id: 'member5', cat: 'mitglied', name: '5 Jahre dabei', cond: 'Seit mindestens 5 Jahren Mitglied', target: 5, value: s => s.memberYears || 0, element: 'crestTradition' },
  { id: 'member10', cat: 'mitglied', name: '10 Jahre dabei', cond: 'Seit mindestens 10 Jahren Mitglied', target: 10, value: s => s.memberYears || 0, element: 'crestRetro' },
];

function evaluateMilestones(stats) {
  return MILESTONES.map(m => {
    const v = m.value(stats);
    return { ...m, current: v, reached: v >= m.target, progress: Math.min(1, v / m.target) };
  });
}

// overrides: { elementId: 'on' | 'off' }  (fehlt = automatisch)
function resolveElements(milestoneStates, overrides) {
  const auto = {};
  for (const e of ELEMENTS) auto[e.id] = !!e.basis;
  for (const m of milestoneStates) if (m.reached) auto[m.element] = true;
  const active = {};
  for (const e of ELEMENTS) {
    const o = overrides[e.id];
    active[e.id] = o === 'on' ? true : o === 'off' ? false : auto[e.id];
  }
  return { auto, active };
}
function milestoneForElement(id) { return MILESTONES.find(m => m.element === id); }

