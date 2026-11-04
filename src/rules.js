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
   basis: true  → immer freigeschaltet (Grundausstattung jedes Saisonschals)
   Jedes andere Element wird durch genau einen Meilenstein freigeschaltet.  */
const ELEMENTS = [
  // Basis
  { id: 'results',  name: 'Ergebnis-Streifen', basis: true, where: 'Vorderseite', desc: 'Jedes Spiel der Saison ist ein Streifen: Sieg Vereinsrot, Remis Weiß, Niederlage Nachtblau.' },
  { id: 'goals',    name: 'Tor-Punkte', basis: true, where: 'Vorderseite', desc: 'Jedes Bayern-Tor ein Punkt links der Mittelnaht.' },
  { id: 'against',  name: 'Gegentor-Punkte', basis: true, where: 'Vorderseite', desc: 'Jedes Gegentor ein Punkt rechts der Mittelnaht.' },
  { id: 'highlights', name: 'Highlight-Felder', basis: true, where: 'Vorderseite', desc: 'Bis zu 5 von der KI vorgeschlagene Spiele der Saison als große Felder mit Ergebnis, Gegner und Datum. Das wichtigste sitzt als „Herzstück“ in der Mitte.' },
  { id: 'code',     name: 'Strickcode', basis: true, where: 'Beide Enden', desc: 'Fan-Code und Saison als 45-Bit-Muster. Die App liest den Schal damit wieder aus.' },
  { id: 'backInfo', name: 'Fan-Rückseite', basis: true, where: 'Rückseite', desc: 'Name, Saison, Saisonbilanz und Fan-Code im Klartext.' },
  // Treue
  { id: 'head',       name: 'Kopfteil „SAISON“', where: 'Vorderseite, Ende A', desc: 'Rondell und die Saison in großen Ziffern.' },
  { id: 'fringeRed',  name: 'Rote Fransen', where: 'Fransen', desc: 'Die Fransen wechseln von Weiß zu Vereinsrot.' },
  { id: 'seasonLines', name: 'Monatsnähte', where: 'Vorderseite', desc: 'Eine Naht zwischen den Monaten, damit man den Saisonverlauf abzählen kann.' },
  { id: 'border',     name: 'Kurvenrand', where: 'Ganzer Schal', desc: 'Weiße Kante entlang beider Längsseiten.' },
  { id: 'goldFringe', name: 'Goldene Fransen & Zehnernaht', where: 'Fransen, Vorderseite', desc: 'Goldgarn kommt dazu: goldene Fransen, und jedes 10. Spiel der Saison bekommt eine Goldnaht.' },
  { id: 'centurion',  name: 'Saison-Medaillon', where: 'Vorderseite, Ende B', desc: 'Goldener Ring mit deiner Spielzahl der Saison.' },
  { id: 'legend',     name: 'Allesfahrer', where: 'Rückseite', desc: 'Die ganze Rückseite in Rauten, dazu der Schriftzug „ALLESFAHRER“.' },
  // Wettbewerbe
  { id: 'cupTexture', name: 'Pokal-Raster', where: 'Vorderseite', desc: 'Pokalspiele bekommen eine Rasterstruktur.' },
  { id: 'clStars',    name: 'Henkelpott-Sterne', where: 'Vorderseite', desc: 'Champions-League-Spiele bekommen eine Sternenreihe.' },
  { id: 'floodlight', name: 'Flutlicht-Linie', where: 'Vorderseite', desc: 'Jeder Europapokal-Abend beginnt mit einer Goldlinie.' },
  { id: 'compBand',   name: 'Wettbewerbs-Krone', where: 'Kopfteil', desc: 'Vier Sterne im Kopfteil, einer pro Wettbewerb.' },
  { id: 'cup',        name: 'Pokal-Motiv', where: 'Highlight-Feld, Vorderseite', desc: 'Finalspiele bekommen goldene Kanten und im Highlight-Feld einen Pokal.' },
  { id: 'plate',      name: 'Meisterschale', where: 'Ende B, Vorderseite', desc: 'Eine Schale im Endteil, und das Spiel der Titelentscheidung bekommt eine Goldmitte.' },
  // Auswärts
  { id: 'awaySeam',   name: 'Auswärtsnaht', where: 'Vorderseite', desc: 'Auswärtsspiele bekommen eine gestrichelte Naht an beiden Kanten.' },
  { id: 'km',         name: 'Kilometer-Zähler', where: 'Rückseite', desc: 'Deine Reisekilometer in dieser Saison, hin und zurück.' },
  { id: 'awayDiamond', name: 'Auswärts-Rauten', where: 'Beide Enden', desc: 'Ein Rautenband an beiden Schalenden.' },
  { id: 'countries',  name: 'Länderband', where: 'Rückseite', desc: 'Die Kürzel aller Länder, in denen du in dieser Saison auswärts warst.' },
  { id: 'ground',     name: 'Groundhopper-Pins', where: 'Vorderseite', desc: 'Jeder erste Besuch in einem Stadion in dieser Saison bekommt einen Pin.' },
  { id: 'tour',       name: 'Komplett-Tour', where: 'Vorderseite', desc: 'Die Auswärtsnaht wird golden.' },
  // Serien & Momente
  { id: 'streak',     name: 'Serien-Band', where: 'Vorderseite', desc: 'Ein Goldband über deine längste Serie ohne Niederlage.' },
  { id: 'fest',       name: 'Torfestival-Funken', where: 'Vorderseite', desc: 'Bei Spielen mit 5 oder mehr Bayern-Toren werden die Tor-Punkte golden.' },
  { id: 'klassiker',  name: 'Klassiker-Kreuz', where: 'Vorderseite', desc: 'Spiele gegen Dortmund bekommen ein ×.' },
  { id: 'comeback',   name: 'Comeback-Pfeil', where: 'Vorderseite', desc: 'Siege nach Rückstand bekommen einen Pfeil nach oben.' },
  { id: 'late',       name: 'Herzschlag-Stich', where: 'Vorderseite', desc: 'Siege in letzter Minute bekommen ein kleines Herz.' },
  { id: 'weather',    name: 'Wetter-Textur', where: 'Vorderseite', desc: 'Regenspiele bekommen schräge Schraffur, Schneespiele Flocken.' },
  { id: 'loyal',      name: 'Trotzdem-da-Linie', where: 'Vorderseite', desc: 'Niederlagen bekommen eine weiße Mittellinie: Du warst trotzdem da.' },
  // Saison komplett
  { id: 'rings',      name: 'Saison-Kalender', where: 'Rückseite', desc: 'Ein Balken pro Monat von August bis Mai.' },
  { id: 'decade',     name: 'Ganzjahres-Siegel', where: 'Kopfteil', desc: 'Die Saison im Kopfteil wird golden, dazu „AUG–MAI“.' },
  { id: 'crown',      name: 'Saison-Krone', where: 'Vorderseite', desc: 'Die Spiele beginnen mit einer goldenen Krone.' },
  { id: 'collection', name: 'Gegner-Sammlung', where: 'Rückseite', desc: '17 Felder, eines pro Bundesliga-Gegner der Saison. Jeder gesehene Gegner füllt ein Feld.' },
];
const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map(e => [e.id, e]));

/* ---- Meilensteine (alle pro Saison) ----------------------------------- */
const MILESTONE_CATEGORIES = [
  ['treue', 'Treue', 'Wie oft du in dieser Saison da warst'],
  ['wettbewerbe', 'Wettbewerbe', 'Wo du mitgefiebert hast'],
  ['auswaerts', 'Auswärts', 'Wie weit du gefahren bist'],
  ['momente', 'Momente & Serien', 'Was du live erlebt hast'],
  ['sammlung', 'Saison komplett', 'Wie vollständig deine Saison war'],
];

const MILESTONES = [
  // Treue
  { id: 'first', cat: 'treue', name: 'Saisonstart', cond: '1 Spiel in der Saison', target: 1, value: s => s.total, element: 'head' },
  { id: 'g5', cat: 'treue', name: 'Wiederholungstäter', cond: '5 Spiele in der Saison', target: 5, value: s => s.total, element: 'fringeRed' },
  { id: 'g10', cat: 'treue', name: 'Zweistellig', cond: '10 Spiele in der Saison', target: 10, value: s => s.total, element: 'seasonLines' },
  { id: 'g20', cat: 'treue', name: 'Kurvengesicht', cond: '20 Spiele in der Saison', target: 20, value: s => s.total, element: 'border' },
  { id: 'g30', cat: 'treue', name: 'Goldenes Garn', cond: '30 Spiele in der Saison', target: 30, value: s => s.total, element: 'goldFringe' },
  { id: 'g40', cat: 'treue', name: 'Vierziger', cond: '40 Spiele in der Saison', target: 40, value: s => s.total, element: 'centurion' },
  { id: 'g50', cat: 'treue', name: 'Allesfahrer', cond: '50 Spiele in der Saison', target: 50, value: s => s.total, element: 'legend' },
  // Wettbewerbe
  { id: 'dfb1', cat: 'wettbewerbe', name: 'Pokalnacht', cond: '1 DFB-Pokalspiel', target: 1, value: s => s.byComp.DFB, element: 'cupTexture' },
  { id: 'cl1', cat: 'wettbewerbe', name: 'Hymne live', cond: '1 Champions-League-Spiel', target: 1, value: s => s.byComp.CL, element: 'clStars' },
  { id: 'cl5', cat: 'wettbewerbe', name: 'Europapokal-Abende', cond: '5 Champions-League-Spiele', target: 5, value: s => s.byComp.CL, element: 'floodlight' },
  { id: 'comp4', cat: 'wettbewerbe', name: 'Grand Slam', cond: 'In allen 4 Wettbewerben (BL, Pokal, CL, Supercup)', target: 4, value: s => Object.values(s.byComp).filter(n => n > 0).length, element: 'compBand' },
  { id: 'final', cat: 'wettbewerbe', name: 'Endspiel', cond: '1 Finale live', target: 1, value: s => s.finals, element: 'cup' },
  { id: 'title', cat: 'wettbewerbe', name: 'Meister-Moment', cond: 'Beim Spiel der Titelentscheidung dabei', target: 1, value: s => s.titles, element: 'plate' },
  // Auswärts
  { id: 'a1', cat: 'auswaerts', name: 'Erste Auswärtsfahrt', cond: '1 Auswärtsspiel', target: 1, value: s => s.away, element: 'awaySeam' },
  { id: 'a5', cat: 'auswaerts', name: 'Vielfahrer', cond: '5 Auswärtsspiele', target: 5, value: s => s.away, element: 'km' },
  { id: 'a10', cat: 'auswaerts', name: 'Auswärtsfahrer', cond: '10 Auswärtsspiele', target: 10, value: s => s.away, element: 'awayDiamond' },
  { id: 'countries2', cat: 'auswaerts', name: 'Länderpunkte', cond: 'Auswärts in 2 Ländern außerhalb Deutschlands', target: 2, value: s => s.awayCountries.size, element: 'countries' },
  { id: 'stadiums8', cat: 'auswaerts', name: 'Groundhopper', cond: '8 verschiedene Stadien', target: 8, value: s => s.stadiums.size, element: 'ground' },
  { id: 'tour17', cat: 'auswaerts', name: 'Komplett-Tour', cond: 'Alle 17 Bundesliga-Auswärtsspiele', target: 17, value: s => s.awayBLOpp.size, element: 'tour' },
  // Momente
  { id: 'streak10', cat: 'momente', name: 'Ungeschlagen', cond: '10 Spiele in Folge ohne Niederlage', target: 10, value: s => s.longestUnbeaten.len, element: 'streak' },
  { id: 'fest', cat: 'momente', name: 'Torfestival', cond: '1 Spiel mit 5+ Bayern-Toren', target: 1, value: s => s.fest, element: 'fest' },
  { id: 'klassiker2', cat: 'momente', name: 'Beide Klassiker', cond: '2 Spiele gegen Dortmund', target: 2, value: s => s.klassiker, element: 'klassiker' },
  { id: 'comeback', cat: 'momente', name: 'Nie aufgeben', cond: '1 Comeback-Sieg nach Rückstand', target: 1, value: s => s.comebacks, element: 'comeback' },
  { id: 'late', cat: 'momente', name: 'Herzschlagfinale', cond: '1 Siegtor in letzter Minute', target: 1, value: s => s.late, element: 'late' },
  { id: 'rain3', cat: 'momente', name: 'Allwetterfan', cond: '3 Regenspiele', target: 3, value: s => s.rain, element: 'weather' },
  { id: 'loss3', cat: 'momente', name: 'Trotzdem da', cond: '3 Niederlagen miterlebt', target: 3, value: s => s.L, element: 'loyal' },
  // Saison komplett
  { id: 'months6', cat: 'sammlung', name: 'Halbes Jahr', cond: 'Spiele in 6 verschiedenen Monaten', target: 6, value: s => s.monthCount, element: 'rings' },
  { id: 'months10', cat: 'sammlung', name: 'Ganzjahresfan', cond: 'In jedem Monat von August bis Mai im Stadion', target: 10, value: s => s.monthCount, element: 'decade' },
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

// Dichte-Stufen: wie viele Strickreihen bekommt ein Spiel?
const DENSITY = {
  detail: { name: 'Detail', min: 3, desc: 'Ab 3 Reihen pro Spiel: alle Details inklusive Tor-Punkten und Motiven. Eine volle Saison (bis ca. 57 Spiele) passt bei 150 cm immer in diese Stufe.' },
  fein: { name: 'Fein', min: 2, desc: '2 Reihen pro Spiel: Ergebnisfarbe, Tor-Punkte und Kantenmarken, aber keine Motive.' },
  hauch: { name: 'Hauch', min: 1, desc: '1 Reihe pro Spiel: nur Ergebnisfarbe und Kantenmarken. Nur bei sehr kurzen Sonderlängen.' },
};
