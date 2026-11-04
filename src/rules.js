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
  { id: 'highlights', name: 'Highlight-Felder', basis: true, where: 'Rückseite', desc: 'Die bis zu 5 wichtigsten Spiele der Saison, ausgewählt von der KI. Das wichtigste sitzt als „Herzstück“ in der Mitte.' },
  { id: 'backInfo', name: 'Fan-Etikett', basis: true, where: 'Rückseite', desc: 'Name, Saison, Fan-Code und Saisonbilanz.' },
  { id: 'code', name: 'Strickcode', basis: true, where: 'Rückseite, beide Enden', desc: 'Fan-Code und Saison als 45-Bit-Muster. Die App erkennt den Schal daran wieder.' },
  // Reihe Treue: Grundaufbau wächst
  { id: 'season', name: 'Saison-Schriftzug', where: 'Vorderseite, Enden', desc: 'Die Saison in großen Ziffern an beiden Enden.' },
  { id: 'endStripes', name: 'Endstreifen', where: 'Vorderseite, Enden', desc: 'Zwei weiße Querstreifen rahmen jedes Ende ein.' },
  { id: 'blocks', name: 'Blockstreifen', where: 'Vorderseite, Mittelteil', desc: 'Breite weiße Querstreifen im klassischen Rot-Weiß-Rhythmus.' },
  { id: 'border', name: 'Weißer Rand', where: 'Vorderseite, Längskanten', desc: 'Eine weiße Kante entlang beider Längsseiten.' },
  { id: 'gold', name: 'Goldgarn', where: 'Vorderseite', desc: 'Gold kommt in den Schal: Der Schriftzug wird golden, und jedes Streifenband bekommt goldene Nadelstreifen.' },
  { id: 'medal', name: 'Medaillon', where: 'Vorderseite, Mitte', desc: 'Ein Medaillon in der Schalmitte mit deiner Spielzahl der Saison.' },
  { id: 'rautenField', name: 'Rauten-Mitte', where: 'Vorderseite, Mitte', desc: 'Die Schalmitte wird blau-weiß gerautet, das höchste Treue-Abzeichen.' },
  // Reihe Wettbewerbe: Symbole & Grundfarbe
  { id: 'cupIcon', name: 'Pokal-Symbol', where: 'Vorderseite, Enden', desc: 'Ein weißer Pokal unter dem Saison-Schriftzug.' },
  { id: 'starBand', name: 'Sternenband', where: 'Vorderseite, Enden', desc: 'Ein nachtblaues Band mit weißen Sternen an beiden Enden.' },
  { id: 'night', name: 'Europapokal-Nacht', where: 'Rückseite', desc: 'Die Grundfarbe der Rückseite wechselt von Rot zu Nachtblau mit Sternenhimmel.' },
  { id: 'fourStars', name: 'Vier Sterne', where: 'Vorderseite, Enden', desc: 'Vier goldene Sterne über dem Saison-Schriftzug, einer pro Wettbewerb.' },
  { id: 'cup', name: 'Pokal im Medaillon', where: 'Vorderseite, Mitte', desc: 'Ein goldener Pokal in der Schalmitte.' },
  { id: 'plate', name: 'Meisterschale', where: 'Vorderseite, Mitte', desc: 'Die Meisterschale in der Schalmitte.' },
  // Reihe Auswärts: Kanten & Fransen
  { id: 'awaySeam', name: 'Auswärtsnaht', where: 'Vorderseite, Längskanten', desc: 'Eine gestrichelte Naht entlang beider Längsseiten.' },
  { id: 'fringeRW', name: 'Rot-weiße Fransen', where: 'Fransen', desc: 'Die Fransen werden abwechselnd rot und weiß.' },
  { id: 'awayRauten', name: 'Rauten-Enden', where: 'Vorderseite, Enden', desc: 'Ein blau-weißes Rautenband direkt an den Fransen.' },
  { id: 'travel', name: 'Reise-Feld', where: 'Rückseite', desc: 'Deine Reisekilometer der Saison und die Länder, in denen du warst.' },
  { id: 'stadiumDots', name: 'Stadion-Punkte', where: 'Vorderseite, Enden', desc: 'Eine Punktreihe unter dem Schriftzug: ein Punkt pro besuchtem Stadion.' },
  { id: 'tour', name: 'Goldene Naht & Fransen', where: 'Vorderseite, Fransen', desc: 'Die Auswärtsnaht wird golden, die Fransen gold-rot.' },
  // Reihe Momente: Muster in den Streifenbändern
  { id: 'mZigzag', name: 'Muster: Zickzack', motif: true, where: 'Vorderseite, Streifenbänder', desc: 'Eine durchgehende Zickzacklinie: ungeschlagen.' },
  { id: 'mSparks', name: 'Muster: Funken', motif: true, where: 'Vorderseite, Streifenbänder', desc: 'Funkelnde Sterne, golden sobald Goldgarn im Schal ist.' },
  { id: 'mCross', name: 'Muster: Kreuze', motif: true, where: 'Vorderseite, Streifenbänder', desc: 'Eine Kette aus nachtblauen × für die Klassiker.' },
  { id: 'mArrows', name: 'Muster: Pfeile', motif: true, where: 'Vorderseite, Streifenbänder', desc: 'Pfeile nach oben für das gedrehte Spiel.' },
  { id: 'mHearts', name: 'Muster: Herzen', motif: true, where: 'Vorderseite, Streifenbänder', desc: 'Rote Herzen für das Tor in letzter Minute.' },
  { id: 'mRain', name: 'Muster: Regen', motif: true, where: 'Vorderseite, Streifenbänder', desc: 'Blaue Regenschraffur.' },
  { id: 'mDiamonds', name: 'Muster: Rautenkette', motif: true, where: 'Vorderseite, Streifenbänder', desc: 'Nachtblaue Rauten: Du warst auch in schweren Spielen da.' },
  // Reihe Saison komplett
  { id: 'calendar', name: 'Saison-Kalender', where: 'Rückseite', desc: 'Ein Balken pro Monat von August bis Mai.' },
  { id: 'monthSeal', name: 'AUG–MAI', where: 'Vorderseite, Enden', desc: 'Unter dem Schriftzug steht in Gold „AUG – MAI“.' },
  { id: 'crown', name: 'Krone', where: 'Vorderseite, Enden', desc: 'Eine goldene Krone unter dem Schriftzug.' },
  { id: 'collection', name: 'Gegner-Sammlung', where: 'Rückseite', desc: '17 Wappenfelder, eines pro Bundesliga-Gegner. Jeder gesehene Gegner füllt eines.' },
];
const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map(e => [e.id, e]));
const MOTIF_ORDER = ['mHearts', 'mCross', 'mSparks', 'mArrows', 'mDiamonds', 'mRain', 'mZigzag'];
const GOLD_ELEMENTS = ['gold', 'fourStars', 'cup', 'plate', 'tour', 'monthSeal', 'crown'];

/* ---- Meilensteine (alle pro Saison) ----------------------------------- */
const MILESTONE_CATEGORIES = [
  ['treue', 'Treue', 'Der Grundaufbau wächst mit jedem Spiel'],
  ['wettbewerbe', 'Wettbewerbe', 'Symbole und die Grundfarbe der Rückseite'],
  ['auswaerts', 'Auswärts', 'Kanten, Enden und Fransen'],
  ['momente', 'Momente', 'Muster in den Streifenbändern'],
  ['sammlung', 'Saison komplett', 'Veredelung des Endfelds und der Rückseite'],
];

const MILESTONES = [
  // Treue
  { id: 'first', cat: 'treue', name: 'Saisonstart', cond: '1 Spiel in der Saison', target: 1, value: s => s.total, element: 'season' },
  { id: 'g5', cat: 'treue', name: 'Wiederholungstäter', cond: '5 Spiele in der Saison', target: 5, value: s => s.total, element: 'endStripes' },
  { id: 'g10', cat: 'treue', name: 'Zweistellig', cond: '10 Spiele in der Saison', target: 10, value: s => s.total, element: 'blocks' },
  { id: 'g20', cat: 'treue', name: 'Kurvengesicht', cond: '20 Spiele in der Saison', target: 20, value: s => s.total, element: 'border' },
  { id: 'g30', cat: 'treue', name: 'Goldenes Garn', cond: '30 Spiele in der Saison', target: 30, value: s => s.total, element: 'gold' },
  { id: 'g40', cat: 'treue', name: 'Vierziger', cond: '40 Spiele in der Saison', target: 40, value: s => s.total, element: 'medal' },
  { id: 'g50', cat: 'treue', name: 'Allesfahrer', cond: '50 Spiele in der Saison', target: 50, value: s => s.total, element: 'rautenField' },
  // Wettbewerbe
  { id: 'dfb1', cat: 'wettbewerbe', name: 'Pokalnacht', cond: '1 DFB-Pokalspiel', target: 1, value: s => s.byComp.DFB, element: 'cupIcon' },
  { id: 'cl1', cat: 'wettbewerbe', name: 'Hymne live', cond: '1 Champions-League-Spiel', target: 1, value: s => s.byComp.CL, element: 'starBand' },
  { id: 'cl5', cat: 'wettbewerbe', name: 'Europapokal-Abende', cond: '5 Champions-League-Spiele', target: 5, value: s => s.byComp.CL, element: 'night' },
  { id: 'comp4', cat: 'wettbewerbe', name: 'Grand Slam', cond: 'In allen 4 Wettbewerben (BL, Pokal, CL, Supercup)', target: 4, value: s => Object.values(s.byComp).filter(n => n > 0).length, element: 'fourStars' },
  { id: 'final', cat: 'wettbewerbe', name: 'Endspiel', cond: '1 Finale live', target: 1, value: s => s.finals, element: 'cup' },
  { id: 'title', cat: 'wettbewerbe', name: 'Meister-Moment', cond: 'Beim Spiel der Titelentscheidung dabei', target: 1, value: s => s.titles, element: 'plate' },
  // Auswärts
  { id: 'a1', cat: 'auswaerts', name: 'Erste Auswärtsfahrt', cond: '1 Auswärtsspiel', target: 1, value: s => s.away, element: 'awaySeam' },
  { id: 'a5', cat: 'auswaerts', name: 'Vielfahrer', cond: '5 Auswärtsspiele', target: 5, value: s => s.away, element: 'fringeRW' },
  { id: 'a10', cat: 'auswaerts', name: 'Auswärtsfahrer', cond: '10 Auswärtsspiele', target: 10, value: s => s.away, element: 'awayRauten' },
  { id: 'countries2', cat: 'auswaerts', name: 'Länderpunkte', cond: 'Auswärts in 2 Ländern außerhalb Deutschlands', target: 2, value: s => s.awayCountries.size, element: 'travel' },
  { id: 'stadiums8', cat: 'auswaerts', name: 'Groundhopper', cond: '8 verschiedene Stadien', target: 8, value: s => s.stadiums.size, element: 'stadiumDots' },
  { id: 'tour17', cat: 'auswaerts', name: 'Komplett-Tour', cond: 'Alle 17 Bundesliga-Auswärtsspiele', target: 17, value: s => s.awayBLOpp.size, element: 'tour' },
  // Momente
  { id: 'streak10', cat: 'momente', name: 'Ungeschlagen', cond: '10 Spiele in Folge ohne Niederlage', target: 10, value: s => s.longestUnbeaten.len, element: 'mZigzag' },
  { id: 'fest', cat: 'momente', name: 'Torfestival', cond: '1 Spiel mit 5+ Bayern-Toren', target: 1, value: s => s.fest, element: 'mSparks' },
  { id: 'klassiker2', cat: 'momente', name: 'Beide Klassiker', cond: '2 Spiele gegen Dortmund', target: 2, value: s => s.klassiker, element: 'mCross' },
  { id: 'comeback', cat: 'momente', name: 'Nie aufgeben', cond: '1 Comeback-Sieg nach Rückstand', target: 1, value: s => s.comebacks, element: 'mArrows' },
  { id: 'late', cat: 'momente', name: 'Herzschlagfinale', cond: '1 Siegtor in letzter Minute', target: 1, value: s => s.late, element: 'mHearts' },
  { id: 'rain3', cat: 'momente', name: 'Allwetterfan', cond: '3 Regenspiele', target: 3, value: s => s.rain, element: 'mRain' },
  { id: 'loss3', cat: 'momente', name: 'Trotzdem da', cond: '3 Niederlagen miterlebt', target: 3, value: s => s.L, element: 'mDiamonds' },
  // Saison komplett
  { id: 'months6', cat: 'sammlung', name: 'Halbes Jahr', cond: 'Spiele in 6 verschiedenen Monaten', target: 6, value: s => s.monthCount, element: 'calendar' },
  { id: 'months10', cat: 'sammlung', name: 'Ganzjahresfan', cond: 'In jedem Monat von August bis Mai im Stadion', target: 10, value: s => s.monthCount, element: 'monthSeal' },
  { id: 'fullSeason', cat: 'sammlung', name: 'Dauerbrenner', cond: 'Alle 17 Bundesliga-Heimspiele', target: 17, value: s => s.homeBL, element: 'crown' },
  { id: 'allOpp', cat: 'sammlung', name: 'Gegner-Sammler', cond: 'Alle 17 Bundesliga-Gegner gesehen (heim oder auswärts)', target: 17, value: s => s.blOpp.size, element: 'collection' },
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

