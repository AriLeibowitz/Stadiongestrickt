/* =========================================================================
   Stadion gestrickt – Grunddaten
   Pixel-Schrift (3x5), Strickmotive, Farbpalette, Vereine
   ========================================================================= */
'use strict';

/* ---- Die 5 Garnfarben -------------------------------------------------- */
// Strickerei-Vorgabe: max. 5 Farben pro Schal. Gold gibt es nur über Meilensteine.
const YARN = {
  R: { name: 'Vereinsrot', hex: '#DC052D', shade: '#A80322' },
  W: { name: 'Weiß',       hex: '#F4F1EA', shade: '#CFCAC0' },
  N: { name: 'Nachtblau',  hex: '#0E2240', shade: '#07142A' },
  B: { name: 'Rautenblau', hex: '#0074C8', shade: '#00589A' },
  G: { name: 'Gold',       hex: '#C9A13B', shade: '#9C7A22' },
};
const YARN_KEYS = ['R', 'W', 'N', 'B', 'G'];

/* ---- Pixel-Schrift 3x5 -------------------------------------------------- */
const FONT = {
  'A': ['010','101','111','101','101'], 'B': ['110','101','110','101','110'],
  'C': ['011','100','100','100','011'], 'D': ['110','101','101','101','110'],
  'E': ['111','100','110','100','111'], 'F': ['111','100','110','100','100'],
  'G': ['011','100','101','101','011'], 'H': ['101','101','111','101','101'],
  'I': ['111','010','010','010','111'], 'J': ['001','001','001','101','010'],
  'K': ['101','101','110','101','101'], 'L': ['100','100','100','100','111'],
  'M': ['101','111','111','101','101'], 'N': ['101','111','111','111','101'],
  'O': ['010','101','101','101','010'], 'P': ['110','101','110','100','100'],
  'Q': ['010','101','101','111','011'], 'R': ['110','101','110','101','101'],
  'S': ['011','100','010','001','110'], 'T': ['111','010','010','010','010'],
  'U': ['101','101','101','101','111'], 'V': ['101','101','101','101','010'],
  'W': ['101','101','111','111','101'], 'X': ['101','101','010','101','101'],
  'Y': ['101','101','010','010','010'], 'Z': ['111','001','010','100','111'],
  '0': ['111','101','101','101','111'], '1': ['010','110','010','010','111'],
  '2': ['110','001','010','100','111'], '3': ['110','001','010','001','110'],
  '4': ['101','101','111','001','001'], '5': ['111','100','110','001','110'],
  '6': ['011','100','111','101','111'], '7': ['111','001','010','010','010'],
  '8': ['111','101','111','101','111'], '9': ['111','101','111','001','110'],
  ':': ['0','1','0','1','0'], '.': ['0','0','0','0','1'], '-': ['000','000','111','000','000'],
  '/': ['001','001','010','100','100'], '+': ['000','010','111','010','000'],
  ' ': ['00','00','00','00','00'], '·': ['0','0','1','0','0'], "'": ['1','1','0','0','0'],
  '×': ['000','101','010','101','000'], '#': ['101','111','101','111','101'],
};

/* ---- Strickmotive (Pixel-Art) ----------------------------------------- */
// Zeichen: Buchstabe = Garnfarbe, '.' = transparent
const ICONS = {
  star: [
    '..G..',
    '.GGG.',
    'GGGGG',
    '.G.G.',
  ],
  starSmall: ['.W.', 'WWW', '.W.'],
  cup: [ // Pokal (Finale)
    'GG.....GG',
    'G.GGGGG.G',
    'G.GGGGG.G',
    '.GGGGGGG.',
    '...GGG...',
    '....G....',
    '...GGG...',
    '..GGGGG..',
  ],
  plate: [ // Meisterschale
    '..GGGGG..',
    '.GWWWWWG.',
    'GWGGGGGWG',
    'GWG...GWG',
    'GWG...GWG',
    'GWGGGGGWG',
    '.GWWWWWG.',
    '..GGGGG..',
  ],
  crown: [
    'G..G..G',
    'GG.G.GG',
    'GGGGGGG',
    'GGGGGGG',
  ],
  heart: ['.R.R.', 'RRRRR', 'RRRRR', '.RRR.', '..R..'],
  snow: ['W.W', '.W.', 'W.W'],
  arrow: ['..W..', '.WWW.', 'W.W.W', '..W..', '..W..'],
  clStar: ['.G.', 'GGG', '.G.'],
  roundel: [ // Platzhalter-Vereinsrondell (kein offizielles Wappen)
    '....WWWWWWW....',
    '..WWNNNNNNNWW..',
    '.WNNNNNNNNNNNW.',
    '.WNNRRRRRRRNNW.',
    'WNNRRBWBWBRRNNW',
    'WNNRBWBWBWBRNNW',
    'WNNRWBWBWBWRNNW',
    'WNNRBWBWBWBRNNW',
    'WNNRWBWBWBWRNNW',
    'WNNRRBWBWBRRNNW',
    '.WNNRRRRRRRNNW.',
    '.WNNNNNNNNNNNW.',
    '..WWNNNNNNNWW..',
    '....WWWWWWW....',
  ],
  shield: [ // Platzhalter-Gegnerschild (Initialen werden hineingestrickt)
    'WWWWWWWWWWWWWWW',
    'WNNNNNNNNNNNNNW',
    'WNNNNNNNNNNNNNW',
    'WNNNNNNNNNNNNNW',
    'WNNNNNNNNNNNNNW',
    'WNNNNNNNNNNNNNW',
    'WNNNNNNNNNNNNNW',
    'WNNNNNNNNNNNNNW',
    '.WNNNNNNNNNNNW.',
    '..WNNNNNNNNNW..',
    '...WNNNNNNNW...',
    '....WWNNNWW....',
    '......WWW......',
  ],
};

/* ---- Wettbewerbe ------------------------------------------------------- */
const COMPETITIONS = {
  BL:  { name: 'Bundesliga',        short: 'BL',  scarf: 'BUNDESLIGA' },
  DFB: { name: 'DFB-Pokal',         short: 'DFB', scarf: 'DFB-POKAL' },
  CL:  { name: 'Champions League',  short: 'CL',  scarf: 'CHAMPIONS LEAGUE' },
  SC:  { name: 'Supercup',          short: 'SC',  scarf: 'SUPERCUP' },
};

/* ---- Vereine ----------------------------------------------------------- */
// Kürzel sind frei gewählte Prototyp-Kürzel. Gegner-Wappen werden NICHT verwendet
// (Rechte ungeklärt) – stattdessen neutrales Schild mit Initialen.
// [id, Name, Kürzel, Stadt, Land, km ab München, Stärke 0..1]
const BL_CLUBS = [
  ['bvb', 'Borussia Dortmund', 'BVB', 'Dortmund', 'GER', 600, 0.78],
  ['b04', 'Bayer 04 Leverkusen', 'B04', 'Leverkusen', 'GER', 580, 0.72],
  ['rbl', 'RB Leipzig', 'RBL', 'Leipzig', 'GER', 430, 0.70],
  ['sge', 'Eintracht Frankfurt', 'SGE', 'Frankfurt', 'GER', 390, 0.62],
  ['vfb', 'VfB Stuttgart', 'VFB', 'Stuttgart', 'GER', 230, 0.62],
  ['scf', 'SC Freiburg', 'SCF', 'Freiburg', 'GER', 340, 0.55],
  ['m05', '1. FSV Mainz 05', 'M05', 'Mainz', 'GER', 430, 0.48],
  ['wob', 'VfL Wolfsburg', 'WOB', 'Wolfsburg', 'GER', 600, 0.55],
  ['bmg', 'Borussia Mönchengladbach', 'BMG', 'Mönchengladbach', 'GER', 620, 0.56],
  ['tsg', 'TSG Hoffenheim', 'TSG', 'Sinsheim', 'GER', 300, 0.52],
  ['fcu', '1. FC Union Berlin', 'FCU', 'Berlin', 'GER', 590, 0.48],
  ['svw', 'SV Werder Bremen', 'SVW', 'Bremen', 'GER', 750, 0.52],
  ['fca', 'FC Augsburg', 'FCA', 'Augsburg', 'GER', 80, 0.45],
  ['fch', '1. FC Heidenheim', 'FCH', 'Heidenheim', 'GER', 170, 0.42],
  ['koe', '1. FC Köln', 'KOE', 'Köln', 'GER', 580, 0.47],
  ['hsv', 'Hamburger SV', 'HSV', 'Hamburg', 'GER', 790, 0.50],
  ['stp', 'FC St. Pauli', 'STP', 'Hamburg', 'GER', 790, 0.42],
  ['s04', 'FC Schalke 04', 'S04', 'Gelsenkirchen', 'GER', 620, 0.55],
  ['h96', 'Hannover 96', 'H96', 'Hannover', 'GER', 630, 0.44],
  ['fcn', '1. FC Nürnberg', 'FCN', 'Nürnberg', 'GER', 170, 0.44],
  ['bsc', 'Hertha BSC', 'BSC', 'Berlin', 'GER', 590, 0.48],
  ['f95', 'Fortuna Düsseldorf', 'F95', 'Düsseldorf', 'GER', 620, 0.42],
  ['bie', 'Arminia Bielefeld', 'DSC', 'Bielefeld', 'GER', 600, 0.40],
  ['sgf', 'SpVgg Greuther Fürth', 'SGF', 'Fürth', 'GER', 170, 0.38],
  ['boc', 'VfL Bochum', 'BOC', 'Bochum', 'GER', 610, 0.42],
  ['ksc', 'Karlsruher SC', 'KSC', 'Karlsruhe', 'GER', 300, 0.40],
  ['fck', '1. FC Kaiserslautern', 'FCK', 'Kaiserslautern', 'GER', 400, 0.42],
  ['d98', 'SV Darmstadt 98', 'D98', 'Darmstadt', 'GER', 360, 0.38],
  ['ebs', 'Eintracht Braunschweig', 'EBS', 'Braunschweig', 'GER', 600, 0.38],
];
// Kader der "aktuellen" Liga 2025/26 (17 Gegner) – für Meilenstein "Jeden Gegner gesehen"
const CURRENT_BL = ['bvb','b04','rbl','sge','vfb','scf','m05','wob','bmg','tsg','fcu','svw','fca','fch','koe','hsv','stp'];

const EURO_CLUBS = [
  ['rma', 'Real Madrid', 'RMA', 'Madrid', 'ESP', 1950, 0.86],
  ['bar', 'FC Barcelona', 'BAR', 'Barcelona', 'ESP', 1350, 0.82],
  ['atm', 'Atlético Madrid', 'ATM', 'Madrid', 'ESP', 1950, 0.74],
  ['psg', 'Paris Saint-Germain', 'PSG', 'Paris', 'FRA', 830, 0.80],
  ['int', 'Inter Mailand', 'INT', 'Mailand', 'ITA', 350, 0.76],
  ['juv', 'Juventus Turin', 'JUV', 'Turin', 'ITA', 470, 0.74],
  ['acm', 'AC Mailand', 'ACM', 'Mailand', 'ITA', 350, 0.70],
  ['nap', 'SSC Neapel', 'NAP', 'Neapel', 'ITA', 1050, 0.70],
  ['ars', 'Arsenal FC', 'ARS', 'London', 'ENG', 920, 0.80],
  ['mci', 'Manchester City', 'MCI', 'Manchester', 'ENG', 1100, 0.86],
  ['liv', 'Liverpool FC', 'LIV', 'Liverpool', 'ENG', 1150, 0.82],
  ['che', 'Chelsea FC', 'CHE', 'London', 'ENG', 920, 0.74],
  ['mun', 'Manchester United', 'MUN', 'Manchester', 'ENG', 1100, 0.72],
  ['tot', 'Tottenham Hotspur', 'TOT', 'London', 'ENG', 920, 0.68],
  ['ben', 'Benfica Lissabon', 'BEN', 'Lissabon', 'POR', 2300, 0.64],
  ['por', 'FC Porto', 'POR', 'Porto', 'POR', 2050, 0.62],
  ['spo', 'Sporting Lissabon', 'SCL', 'Lissabon', 'POR', 2300, 0.60],
  ['aja', 'Ajax Amsterdam', 'AJA', 'Amsterdam', 'NED', 830, 0.62],
  ['psv', 'PSV Eindhoven', 'PSV', 'Eindhoven', 'NED', 720, 0.58],
  ['cel', 'Celtic Glasgow', 'CEL', 'Glasgow', 'SCO', 1500, 0.52],
  ['rbs', 'RB Salzburg', 'RBS', 'Salzburg', 'AUT', 140, 0.52],
  ['gal', 'Galatasaray', 'GAL', 'Istanbul', 'TUR', 1600, 0.56],
  ['fcbr', 'FC Basel', 'BAS', 'Basel', 'SUI', 390, 0.50],
  ['cop', 'FC Kopenhagen', 'KOP', 'Kopenhagen', 'DEN', 860, 0.50],
  ['olm', 'Olympique Lyon', 'OL', 'Lyon', 'FRA', 600, 0.60],
  ['mar', 'Olympique Marseille', 'OM', 'Marseille', 'FRA', 850, 0.58],
  ['zag', 'Dinamo Zagreb', 'DZG', 'Zagreb', 'CRO', 420, 0.46],
  ['plz', 'Viktoria Pilsen', 'PLZ', 'Pilsen', 'CZE', 280, 0.44],
  ['spa', 'Sparta Prag', 'SPA', 'Prag', 'CZE', 380, 0.46],
  ['bru', 'FC Brügge', 'BRU', 'Brügge', 'BEL', 750, 0.52],
  ['zvz', 'Roter Stern Belgrad', 'RSB', 'Belgrad', 'SRB', 950, 0.48],
  ['shk', 'Schachtar Donezk', 'SHK', 'Lwiw', 'UKR', 1100, 0.50],
];

// Pokal-Gegner aus unteren Ligen (Runde 1/2)
const CUP_CLUBS = [
  ['sv1', 'SV Sandhausen', 'SVS', 'Sandhausen', 'GER', 310, 0.30],
  ['ein', 'Energie Cottbus', 'FCE', 'Cottbus', 'GER', 560, 0.28],
  ['bfc', 'Bremer SV', 'BSV', 'Bremen', 'GER', 750, 0.15],
  ['tsv', 'TSV 1860 München', 'TSV', 'München', 'GER', 5, 0.32],
  ['dfc', 'Drochtersen/Assel', 'D/A', 'Drochtersen', 'GER', 800, 0.14],
  ['mue', 'Preußen Münster', 'PRM', 'Münster', 'GER', 600, 0.28],
  ['saa', '1. FC Saarbrücken', 'FCS', 'Saarbrücken', 'GER', 440, 0.28],
  ['jen', 'Carl Zeiss Jena', 'FCC', 'Jena', 'GER', 380, 0.22],
  ['kie', 'Holstein Kiel', 'KSV', 'Kiel', 'GER', 870, 0.34],
  ['wie', 'SV Wehen Wiesbaden', 'WIE', 'Wiesbaden', 'GER', 420, 0.26],
  ['rot', 'Rot-Weiss Essen', 'RWE', 'Essen', 'GER', 620, 0.26],
  ['ulm', 'SSV Ulm 1846', 'ULM', 'Ulm', 'GER', 150, 0.27],
  ['wue', 'Würzburger Kickers', 'FWK', 'Würzburg', 'GER', 280, 0.24],
  ['reg', 'Jahn Regensburg', 'JRE', 'Regensburg', 'GER', 120, 0.28],
  ['mag', '1. FC Magdeburg', 'FCM', 'Magdeburg', 'GER', 520, 0.30],
  ['pad', 'SC Paderborn', 'SCP', 'Paderborn', 'GER', 560, 0.34],
];

const CLUBS = {};
function registerClubs(list, kind) {
  for (const [id, name, abbr, city, country, km, strength] of list) {
    CLUBS[id] = { id, name, abbr, city, country, km, strength, kind };
  }
}
registerClubs(BL_CLUBS, 'BL');
registerClubs(EURO_CLUBS, 'EURO');
registerClubs(CUP_CLUBS, 'CUP');
CLUBS.fcb = { id: 'fcb', name: 'FC Bayern München', abbr: 'FCB', city: 'München', country: 'GER', km: 0, strength: 0.85, kind: 'HOME' };

const COUNTRY_NAMES = {
  GER: 'Deutschland', ESP: 'Spanien', FRA: 'Frankreich', ITA: 'Italien', ENG: 'England',
  POR: 'Portugal', NED: 'Niederlande', SCO: 'Schottland', AUT: 'Österreich', TUR: 'Türkei',
  SUI: 'Schweiz', DEN: 'Dänemark', CRO: 'Kroatien', CZE: 'Tschechien', BEL: 'Belgien',
  SRB: 'Serbien', UKR: 'Ukraine',
};

// Endspielorte (neutral)
const VENUES = {
  berlin: { city: 'Berlin', country: 'GER', km: 590, stadium: 'Olympiastadion Berlin' },
  clFinals: [
    { city: 'London', country: 'ENG', km: 920, stadium: 'Wembley' },
    { city: 'Madrid', country: 'ESP', km: 1950, stadium: 'Estadio Metropolitano' },
    { city: 'Lissabon', country: 'POR', km: 2300, stadium: 'Estádio da Luz' },
    { city: 'Istanbul', country: 'TUR', km: 1600, stadium: 'Atatürk-Olympiastadion' },
    { city: 'Mailand', country: 'ITA', km: 350, stadium: 'San Siro' },
    { city: 'Budapest', country: 'HUN', km: 560, stadium: 'Puskás Aréna' },
    { city: 'Paris', country: 'FRA', km: 830, stadium: 'Stade de France' },
  ],
};
COUNTRY_NAMES.HUN = 'Ungarn';
