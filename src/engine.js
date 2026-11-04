/* =========================================================================
   Stadion gestrickt – Daten-Engine
   1) Deterministischer Zufall   2) Spielplan (synthetisch, für alle Fans gleich)
   3) Fan-Codes                  4) Fan-Historie (welche Spiele war der Fan)
   ========================================================================= */
'use strict';

const TODAY = new Date('2026-11-04T12:00:00');
const FIRST_SEASON = 2005;  // Eröffnung der Arena
const CURRENT_SEASON = 2026; // Saison 2026/27 läuft

/* ---- 1) Deterministischer Zufall --------------------------------------- */
function hashStr(str, seed = 0) { // cyrb53
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function rng(seedStr) { // mulberry32
  let a = hashStr(String(seedStr)) >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  f.shuffle = (arr) => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
  return f;
}
function poisson(r, lambda) {
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}

/* ---- Datumshelfer ------------------------------------------------------ */
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function nextWeekday(d, wd) { const x = new Date(d); while (x.getDay() !== wd) x.setDate(x.getDate() + 1); return x; }
function iso(d) { return d.toISOString().slice(0, 10); }
function fmtDate(isoStr) { const [y, m, d] = isoStr.split('-'); return `${d}.${m}.${y.slice(2)}`; }
function fmtDateLong(isoStr) { const [y, m, d] = isoStr.split('-'); return `${d}.${m}.${y}`; }
function seasonLabel(y) { return `${String(y).slice(2)}/${String(y + 1).slice(2)}`; }

/* ---- 2) Spielplan ------------------------------------------------------ */
// Synthetische, aber plausible Spielplan- und Ergebnisdaten 2005/06–2026/27.
// Im echten System kämen diese Daten von DFL/UEFA/DFB – die Engine ist austauschbar.
function weatherFor(r, dateIso) {
  const m = Number(dateIso.slice(5, 7));
  const winter = m === 12 || m === 1 || m === 2;
  if (winter && r.chance(0.13)) return 'snow';
  if (r.chance(winter ? 0.22 : 0.18)) return 'rain';
  if (m >= 5 && m <= 8 && r.chance(0.3)) return 'hot';
  return 'clear';
}

function simulateScore(r, fcbStr, opp, venue) {
  const adv = venue === 'H' ? 0.3 : venue === 'A' ? -0.15 : 0;
  const diff = fcbStr - opp.strength;
  const lf = Math.max(0.45, 1.75 + 2.6 * diff + adv);
  const lo = Math.max(0.25, 1.05 - 1.7 * diff - adv * 0.6);
  return [poisson(r, lf), poisson(r, lo)];
}

let _fixtureCache = null;
function getFixtures() {
  if (_fixtureCache) return _fixtureCache;
  const all = [];
  for (let y = FIRST_SEASON; y <= CURRENT_SEASON; y++) all.push(...seasonFixtures(y));
  all.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  _fixtureCache = all;
  return all;
}

function makeMatch(r, y, comp, round, date, venue, opp, fcbStr, extra = {}) {
  const dateIso = iso(date);
  const [f, o] = simulateScore(r, fcbStr, opp, venue);
  const neutral = extra.neutral;
  const m = {
    id: `${y}-${comp}-${round.replace(/[^A-Za-z0-9]/g, '')}-${opp.id}`,
    season: y, seasonLabel: seasonLabel(y), date: dateIso, comp, round, venue,
    opp: opp.id, fcbGoals: f, oppGoals: o,
    result: f > o ? 'W' : f === o ? 'D' : 'L',
    city: venue === 'H' ? 'München' : neutral ? neutral.city : opp.city,
    country: venue === 'H' ? 'GER' : neutral ? neutral.country : opp.country,
    km: venue === 'H' ? 0 : neutral ? neutral.km : opp.km,
    stadium: venue === 'H' ? 'Allianz Arena' : neutral ? neutral.stadium : `Stadion ${opp.city}`,
    stadiumKey: venue === 'H' ? 'home' : neutral ? `n-${neutral.city}` : `a-${opp.id}`,
    weather: weatherFor(r, dateIso),
    final: !!extra.final, titleClinch: false, comeback: false, lateWinner: false, pens: null,
    klassiker: opp.id === 'bvb', derby: opp.id === 'tsv',
    upcoming: date > TODAY,
  };
  if (m.result === 'W' && r.chance(0.11) && m.fcbGoals >= 2) m.comeback = true;
  if (m.result === 'W' && m.fcbGoals - m.oppGoals === 1 && r.chance(0.3)) m.lateWinner = true;
  return m;
}

function seasonFixtures(y) {
  const r = rng(`season-${y}`);
  const fcbStr = 0.8 + r() * 0.1;
  const out = [];
  // --- Bundesliga ---
  let opps;
  if (y >= 2025) opps = CURRENT_BL.slice();
  else {
    const core = ['bvb', 'b04', 'sge', 'wob', 'bmg', 'svw', 'vfb'];
    const rest = r.shuffle(BL_CLUBS.map(c => c[0]).filter(id => !core.includes(id)));
    opps = core.concat(rest.slice(0, 10));
  }
  opps = r.shuffle(opps);
  const start = nextWeekday(new Date(`${y}-08-14T15:30:00`), 6);
  const rStart = nextWeekday(new Date(`${y + 1}-01-12T15:30:00`), 6);
  const firstHome = r.chance(0.5);
  const bl = [];
  for (let i = 0; i < 34; i++) {
    const half = i < 17 ? 0 : 1, k = i % 17;
    const skips = Math.floor(k / 4);
    const date = addDays(half ? rStart : start, (k + skips) * 7);
    const homeFirst = (k % 2 === 0) === firstHome;
    const venue = (half === 0) === homeFirst ? 'H' : 'A';
    const m = makeMatch(r, y, 'BL', `${i + 1}. Spieltag`, date, venue, CLUBS[opps[k]], fcbStr);
    bl.push(m);
  }
  // Meisterschaft (nicht für laufende Saison)
  if (y < CURRENT_SEASON && r.chance(0.78)) {
    const cand = bl.filter((m, i) => i >= 28 && m.result === 'W');
    if (cand.length) r.pick(cand).titleClinch = true;
  }
  out.push(...bl);

  // --- DFB-Pokal ---
  const cupRounds = [
    ['1. Runde', `${y}-08-10`, 'A', 'CUP'],
    ['2. Runde', `${y}-10-29`, r.chance(0.5) ? 'H' : 'A', 'MIX'],
    ['Achtelfinale', `${y + 1}-02-04`, r.chance(0.5) ? 'H' : 'A', 'BL'],
    ['Viertelfinale', `${y + 1}-03-02`, r.chance(0.55) ? 'H' : 'A', 'BL'],
    ['Halbfinale', `${y + 1}-04-21`, r.chance(0.5) ? 'H' : 'A', 'BL'],
    ['Finale', `${y + 1}-05-23`, 'N', 'BL'],
  ];
  const usedCup = new Set();
  for (const [round, d, venue, pool] of cupRounds) {
    let oppId;
    const pickFrom = (ids) => { const c = ids.filter(id => !usedCup.has(id)); return r.pick(c.length ? c : ids); };
    if (pool === 'CUP') oppId = pickFrom(CUP_CLUBS.map(c => c[0]));
    else if (pool === 'MIX') oppId = r.chance(0.5) ? pickFrom(CUP_CLUBS.map(c => c[0])) : pickFrom(opps);
    else oppId = pickFrom(opps);
    usedCup.add(oppId);
    const date = new Date(`${d}T20:45:00`);
    const m = makeMatch(r, y, 'DFB', round, date, venue, CLUBS[oppId], fcbStr,
      { final: round === 'Finale', neutral: round === 'Finale' ? VENUES.berlin : null });
    if (m.upcoming) break; // Zukunft im Pokal ist noch nicht ausgelost
    let advance = m.result === 'W';
    if (m.result === 'D') { advance = r.chance(0.62); m.pens = advance ? 'W' : 'L'; }
    out.push(m);
    if (!advance) break;
  }

  // --- Champions League ---
  const leaguePhase = y >= 2024;
  const nGroup = leaguePhase ? 8 : 6;
  const euroIds = r.shuffle(EURO_CLUBS.map(c => c[0]));
  const groupOpps = leaguePhase ? euroIds.slice(0, 8) : euroIds.slice(0, 3);
  const gStart = nextWeekday(new Date(`${y}-09-15T21:00:00`), 2);
  for (let i = 0; i < nGroup; i++) {
    const oppId = leaguePhase ? groupOpps[i] : groupOpps[i % 3];
    const venue = leaguePhase ? (i % 2 === 0 ? 'H' : 'A') : (i < 3 ? (i % 2 === 0 ? 'H' : 'A') : (i % 2 === 0 ? 'A' : 'H'));
    const date = addDays(gStart, i * (leaguePhase ? 17 : 14));
    out.push(makeMatch(r, y, 'CL', leaguePhase ? `Ligaphase ${i + 1}` : `Gruppe ${i + 1}`, date, venue, CLUBS[oppId], fcbStr));
  }
  if (y < CURRENT_SEASON) {
    const ko = [['Achtelfinale', `${y + 1}-02-18`], ['Viertelfinale', `${y + 1}-04-08`], ['Halbfinale', `${y + 1}-04-29`]];
    const pool = euroIds.slice(8);
    let alive = true;
    for (const [round, d] of ko) {
      if (!alive) break;
      const opp = CLUBS[pool.shift()];
      const first = new Date(`${d}T21:00:00`);
      const v1 = r.chance(0.5) ? 'H' : 'A';
      const m1 = makeMatch(r, y, 'CL', `${round} Hinspiel`, first, v1, opp, fcbStr);
      const m2 = makeMatch(r, y, 'CL', `${round} Rückspiel`, addDays(first, 7), v1 === 'H' ? 'A' : 'H', opp, fcbStr);
      m1.id += '-1'; m2.id += '-2';
      const aggF = m1.fcbGoals + m2.fcbGoals, aggO = m1.oppGoals + m2.oppGoals;
      if (aggF === aggO) { m2.pens = r.chance(0.55) ? 'W' : 'L'; alive = m2.pens === 'W'; }
      else alive = aggF > aggO;
      out.push(m1, m2);
    }
    if (alive) {
      const opp = CLUBS[pool.shift()];
      const venue = r.pick(VENUES.clFinals);
      const m = makeMatch(r, y, 'CL', 'Finale', new Date(`${y + 1}-05-30T21:00:00`), 'N', opp, fcbStr, { final: true, neutral: venue });
      if (m.result === 'D') m.pens = r.chance(0.5) ? 'W' : 'L';
      out.push(m);
    }
  }

  // --- Supercup ---
  if (r.chance(0.55)) {
    const opp = CLUBS[r.pick(['bvb', 'b04', 'sge', 'vfb', 'rbl'])];
    const m = makeMatch(r, y, 'SC', 'Supercup', new Date(`${y}-08-03T20:30:00`), r.chance(0.5) ? 'H' : 'A', opp, fcbStr);
    if (m.result === 'D') m.pens = r.chance(0.6) ? 'W' : 'L';
    out.push(m);
  }
  return out;
}

/* ---- 3) Fan-Codes ------------------------------------------------------ */
// Format: FCB-XXXX-XXXX (Crockford-Base32, ohne I L O U)
// 7 Nutzzeichen + 1 Prüfzeichen (gewichtete Summe mod 32).
// 8 Zeichen x 5 Bit = 40 Bit -> werden als "Strickcode" ins Schalende gestrickt.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function checkChar(payload7) {
  let s = 0;
  for (let i = 0; i < payload7.length; i++) s += (i + 1) * B32.indexOf(payload7[i]);
  return B32[s % 32];
}
function normalizeCode(input) {
  let s = String(input || '').toUpperCase().replace(/^FCB/, '').replace(/[^0-9A-Z]/g, '');
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1');
  return s;
}
function parseCode(input) {
  const s = normalizeCode(input);
  if (s.length !== 8) return { ok: false, error: 'Ein Fan-Code hat 8 Zeichen (FCB-XXXX-XXXX).' };
  for (const ch of s) if (!B32.includes(ch)) return { ok: false, error: `Zeichen „${ch}“ ist in Fan-Codes nicht erlaubt.` };
  if (checkChar(s.slice(0, 7)) !== s[7]) return { ok: false, error: 'Prüfzeichen stimmt nicht – Tippfehler im Fan-Code?' };
  return { ok: true, code: formatCode(s), raw: s };
}
function formatCode(raw8) { return `FCB-${raw8.slice(0, 4)}-${raw8.slice(4)}`; }
function makeCode(payload7) { return formatCode(payload7 + checkChar(payload7)); }
function randomCode() {
  let p = '';
  for (let i = 0; i < 7; i++) p += B32[Math.floor(Math.random() * 32)];
  return makeCode(p);
}
function codeBits(raw8) {
  const bits = [];
  for (const ch of raw8) { const v = B32.indexOf(ch); for (let b = 4; b >= 0; b--) bits.push((v >> b) & 1); }
  return bits;
}
function bitsToCode(bits) {
  let s = '';
  for (let i = 0; i < 8; i++) { let v = 0; for (let b = 0; b < 5; b++) v = (v << 1) | bits[i * 5 + b]; s += B32[v]; }
  return s;
}

/* ---- 4) Fan-Profile ---------------------------------------------------- */
// target: feste Spielzahl (über alle Saisons); ohne target besucht der Fan jedes Spiel
// mit Wahrscheinlichkeit p (Saisonlaune inklusive, außer steady).
const PRESETS = [
  { payload: 'NEW2026', label: 'Neumitglied', who: 'Lena, seit dieser Saison dabei',
    p: { name: 'LENA', start: 2026, target: 3, home: 1, away: 0, cupHome: 0.2, cupAway: 0, clHome: 0.3, clAway: 0, final: 0 } },
  { payload: 'STAMM10', label: 'Dauerkarte Südkurve', who: 'Thomas, fast jedes Heimspiel',
    p: { name: 'THOMAS', start: 2016, home: 0.97, away: 0.06, cupHome: 0.8, cupAway: 0.05, clHome: 0.85, clAway: 0.05, final: 0.5, steady: true } },
  { payload: 'AWAY025', label: 'Auswärtsfahrerin', who: 'Mira, fährt fast jedes Wochenende',
    p: { name: 'MIRA', start: 2013, home: 0.45, away: 0.95, cupHome: 0.5, cupAway: 0.9, clHome: 0.4, clAway: 0.7, final: 0.9, steady: true } },
  { payload: 'EVR0PA5', label: 'Europapokal-Reisender', who: 'Can, nur die großen Abende',
    p: { name: 'CAN', start: 2010, home: 0.06, away: 0.02, cupHome: 0.1, cupAway: 0.05, clHome: 0.95, clAway: 0.9, final: 1, steady: true } },
  { payload: 'MYTH250', label: 'Allesfahrer', who: 'Sepp, verpasst kein Spiel',
    p: { name: 'SEPP', start: 2005, home: 1, away: 1, cupHome: 1, cupAway: 1, clHome: 1, clAway: 1, final: 1, steady: true } },
];
PRESETS.forEach(p => { p.code = makeCode(p.payload); });

const RANDOM_NAMES = ['ANNA', 'MAX', 'SOPHIE', 'JONAS', 'LUKAS', 'MARIE', 'FELIX', 'EMMA', 'PAUL', 'LEA', 'TIM', 'SARAH', 'BEN', 'JULIA', 'ELIAS', 'HANNAH', 'NOAH', 'LAURA', 'ALI', 'ZEYNEP', 'KENJI', 'AMIR'];

function profileFromCode(code) {
  const parsed = parseCode(code);
  const raw = parsed.raw;
  const preset = PRESETS.find(p => p.code === parsed.code);
  if (preset) return { code: parsed.code, raw, preset: preset.label, who: preset.who, ...preset.p };
  const r = rng(`fan-${raw}`);
  const start = r.chance(0.35) ? r.int(2005, 2012) : r.int(2013, 2025);
  const intensity = 0.08 + 0.92 * Math.pow(r(), 1.4); // die meisten Fans sind gelegentliche Besucher
  const awayType = r();
  return {
    code: parsed.code, raw, preset: null, who: 'Zufälliger Fan',
    name: RANDOM_NAMES[Math.floor(r() * RANDOM_NAMES.length)],
    start,
    home: intensity * (0.7 + r() * 0.3),
    away: intensity * (awayType > 0.75 ? 0.6 + r() * 0.4 : r() * 0.25),
    cupHome: intensity * (0.3 + r() * 0.7), cupAway: intensity * r() * 0.5,
    clHome: intensity * (0.3 + r() * 0.7), clAway: intensity * (awayType > 0.6 ? r() * 0.7 : r() * 0.1),
    final: intensity * r() * 0.8,
  };
}

function matchWeight(p, m) {
  if (m.season < p.start) return 0;
  if (m.venue === 'N') return p.final;
  if (m.comp === 'BL' || m.comp === 'SC') {
    if (m.venue === 'H') return p.home;
    const near = Math.max(0.4, Math.min(1.3, 1.35 - m.km / 900));
    return p.away * near;
  }
  if (m.comp === 'DFB') return m.venue === 'H' ? p.cupHome : p.cupAway;
  if (m.comp === 'CL') return m.venue === 'H' ? p.clHome : p.clAway;
  return 0;
}

// Liefert die besuchten Spiele (chronologisch, nummeriert).
// Auswahl ist deterministisch: jedes Spiel bekommt pro Fan einen Zufallswert u,
// gewichtet mit der Wahrscheinlichkeit p. Die "target" Spiele mit kleinstem u/p werden besucht.
function attendedGames(profile) {
  const r = rng(`attend-${profile.raw}`);
  const fx = getFixtures();
  const seasonMood = {};
  for (let y = FIRST_SEASON; y <= CURRENT_SEASON; y++) seasonMood[y] = profile.steady ? 1 : 0.45 + r() * 0.9;
  const scored = [];
  for (const m of fx) {
    const u = r();
    if (m.upcoming) continue;
    const p = Math.min(1, matchWeight(profile, m) * seasonMood[m.season]);
    if (p <= 0) continue;
    if (profile.target || u < p) scored.push({ m, s: u / p });
  }
  if (profile.target) { scored.sort((a, b) => a.s - b.s); scored.length = Math.min(scored.length, profile.target); }
  const picked = scored.map(x => x.m);
  picked.sort((a, b) => a.date.localeCompare(b.date));
  return picked.map((m, i) => ({ ...m, nrTotal: i + 1 }));
}

// Spiele einer Saison, neu durchnummeriert (Nr. 1 = erstes Spiel der Saison)
function seasonGames(all, season) {
  return all.filter(m => m.season === season).map((m, i) => ({ ...m, nr: i + 1 }));
}
function seasonsOf(all) {
  const map = new Map();
  for (const m of all) map.set(m.season, (map.get(m.season) || 0) + 1);
  return [...map.entries()].sort((a, b) => b[0] - a[0]);
}
function seasonBLOpponents(season) {
  return [...new Set(getFixtures().filter(m => m.season === season && m.comp === 'BL').map(m => m.opp))];
}

// Kommende Spiele, die ein Fan wahrscheinlich besucht (für "Schalpotenzial")
function likelyUpcoming(profile) {
  const fx = getFixtures().filter(m => m.upcoming && m.season === CURRENT_SEASON);
  return fx
    .map(m => ({ m, w: Math.max(matchWeight({ ...profile, start: 0 }, m), m.venue === 'H' && m.comp === 'BL' ? 0.5 : 0) }))
    .filter(x => x.w > 0.05)
    .sort((a, b) => a.m.date.localeCompare(b.m.date))
    .map(x => x.m);
}

function clubName(id) { return CLUBS[id] ? CLUBS[id].name : id; }
function clubAbbr(id) { return CLUBS[id] ? CLUBS[id].abbr : id.toUpperCase(); }
function scoreLine(m) { // Heimteam zuerst
  const opp = clubAbbr(m.opp);
  if (m.venue === 'A') return `${opp} ${m.oppGoals}:${m.fcbGoals} FCB`;
  return `FCB ${m.fcbGoals}:${m.oppGoals} ${opp}`;
}
function scoreLong(m) {
  if (m.upcoming || m.result == null) return `${m.venue === 'A' ? clubName(m.opp) + ' – FC Bayern' : 'FC Bayern – ' + clubName(m.opp)}`;
  const pens = m.pens ? ` (i.E. ${m.pens === 'W' ? 'gewonnen' : 'verloren'})` : '';
  if (m.venue === 'A') return `${clubName(m.opp)} – FC Bayern ${m.oppGoals}:${m.fcbGoals}${pens}`;
  return `FC Bayern – ${clubName(m.opp)} ${m.fcbGoals}:${m.oppGoals}${pens}`;
}
