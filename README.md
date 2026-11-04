# Stadion gestrickt

**Ein Schal pro Saison, der mit jedem Meilenstein wächst.** Die Vorderseite startet einfarbig in Vereinsrot. Jeder Saison-Meilenstein legt eine neue Ebene darauf: Streifen, Rauten und Gold, Trophäen und Momente werden eingestickt. Die Rückseite erzählt die Geschichte der Saison: Gemini liest alle besuchten Spiele, wählt die 5 größten Momente für die Highlight-Felder aus und beschreibt, wie die Saison war. Gestrickt wird erst auf Bestellung, in Einzelfertigung.

Konzept-Prototyp für die **FC Bayern AI-deation 2026**. Das ist keine offizielle FC-Bayern-Anwendung.

## Prototyp öffnen

`dist/stadion-gestrickt.html` im Browser öffnen, ohne Installation und ohne Server. Die Datei läuft offline (nur die Webfonts kommen aus dem Netz, sonst greift eine Systemschrift). `index.html` im Hauptordner ist dieselbe Datei, etwa für GitHub Pages.

Direktlink auf Fan und Saison: `…/stadion-gestrickt.html#FCB-STAM-M105/2025`

## Was man ausprobieren kann

Die Seite hat drei Bereiche, von oben nach unten:

1. **Der Schal:** Vorder- und Rückseite in voller Länge, wie er heute für die gewählte Saison gestrickt würde. Fährt man darüber, zeigt die App jedes Element und den Meilenstein, der es freigeschaltet hat. Die Lupe zeigt echte Maschen. Für die laufende Saison 26/27 lassen sich kommende Spiele simulieren, und neu freigeschaltete Elemente werden gelb markiert.
2. **Meilensteine:** 30 Meilensteine in 5 Reihen. Ein Klick wählt einen Meilenstein an oder ab. Der Punkt zeigt, ob der Fan ihn wirklich erreicht hat. Dazu gibt es „Fan-Status“, „Alle“ und „Keine“.
3. **Die wichtigsten Spiele:** Gemini (oder der Offline-Kurator) wählt bis zu 5 Spiele für die Rückseite und erzählt die Saison. Spiele lassen sich tauschen, entfernen oder zum Herzstück machen.

Unter „Mehr“ stehen alle Spiele der Saison, die Kauf-Umfrage (mit CSV-Export) und das Regelwerk. Oben wählt man Fan (5 Beispiel-Fans, eigener Code oder Zufall), Saison, Länge (150, 180 oder 220 cm) und den Namen für die Rückseite. Exportieren lassen sich die Strickdatei (`.txt`, ein Buchstabe pro Masche) und das Muster als PNG.

## Design-System

- **Ansicht:** Der Schal wird hochkant gezeigt, Vorder- und Rückseite nebeneinander. Mit „Ende A unten“ oder „Ende B unten“ dreht man ihn so, dass die Schrift am jeweiligen Ende richtig herum steht. Es gibt 3 Größen (S, M, L).
- **Raster:** 6 Maschen/cm quer, 8 Reihen/cm längs, also 108 × 1200 Maschen bei 150 cm.
- **Treue** (exklusive Stufen, jede ersetzt die vorige, nur die Goldstreifen bleiben ab Stufe 5):
  1. 1 Streifen
  2. 3 schmale Streifen
  3. nur die Blockstreifen weiter zur Mitte
  4. zwei große weiße Blöcke
  5. Goldstreifen
  6. Mittelstreifen
  7. Rauten-Mitte
- **Wettbewerbe:**
  - Silberkordel (1 CL-Spiel)
  - nachtblaue Rückseite (5 CL-Spiele)
  - Trophäen über dem Wappen eingestickt, nur wenn man beim entscheidenden Spiel dabei war: Meisterschale, DFB-Pokal, Henkelpott, Supercup
- **Auswärts:** Naht, rot-weiße Fransen, Rauten-Enden, Reise-Zeile, Stadion-Punkte, goldene Naht und Fransen
- **Momente:** gestickte Zeichen an Ende B in Weiß (1×), Silber (2×) oder Gold (3×)
- **Gegner-Sammler** (Stufen): 2, 4 oder 6 Goldfäden auf der Rückseite
- **Mitgliedschaft** (Stufen): modernes, Traditions- oder Retro-Wappen
- **Rückseite:**
  - **Ende A:** Reise-Zeile, Name, Wappen und Trophäen
  - **Ende B:** Herzstück-Patch, 4 Spiele-Patches zu zweit und die Momente-Zeichen

## Gestrickt, gestickt, aufgenäht

Wie beim Mitgliederschal werden drei Techniken kombiniert. In der App lässt sich zwischen **Realistisch** und **Produktion** umschalten.

- **Gestrickt (Jacquard):** Grundfarbe, Bänder, Muster, Rauten, Sterne, Medaillon-Ring, große Ziffern und das Vereinswappen auf der Rückseite. Export als Strickdatei.
- **Gestickt:** Name, Saison, Bilanz, Trophäen und Sterne über dem Wappen, Momente-Zeichen, Reise-Feld und die Silberkordel. Export als Stickdatei (SVG, mm).
- **Aufgenäht:** die 5 Spiele als kompakte gewebte Patches mit Overlock-Rand an Ende B.

Das Vereinswappen ist für den Prototyp nachgezeichnet. Die Nutzung muss mit dem Verein abgestimmt werden.

## Wie die KI eingebunden ist

- **Gemini macht:** alle Spiele der Saison lesen, bis zu 5 Highlights auswählen (das erste wird das Herzstück in der Schalmitte), jede Wahl begründen und die Saison-Geschichte schreiben.
- **Gemini macht nicht:** Ergebnisse, Daten oder Muster erzeugen. Die Antwort kommt als JSON nach festem Schema, jede Spielnummer wird geprüft, erfundene Nummern werden verworfen. Das Muster ist deterministisch: gleicher Code und gleiche Saison ergeben denselben Schal.
- **Ohne API-Key** übernimmt ein regelbasierter Offline-Kurator dieselbe Aufgabe, damit die Demo überall läuft. Der Key wird nur direkt an `generativelanguage.googleapis.com` gesendet.

## Daten und Rechte

- Spielplan, Ergebnisse und Fan-Historien sind **synthetische Beispieldaten** (2005/06–2026/27). Sie sind für alle Fans gleich.
- Gegner erscheinen nur als neutrales Schild mit Kürzel. **Die Rechte an Vereinslogos und -namen sind noch nicht geklärt.** Das Rondell im Kopfteil ist ein Platzhalter, ein offizielles Wappen kann eingesetzt werden, sobald die Freigabe vorliegt.

## Aufbau des Codes

```
src/
  data.js       Garnfarben, Pixel-Schrift, Motive, Vereine
  engine.js     Zufall, synthetischer Spielplan, Fan-Codes, Fan-Historien
  rules.js      Saison-Statistik, 30 Meilensteine, 34 Design-Elemente
  pattern.js    Muster-Generator: Ebenen-Design vorne, Highlights hinten, Strickcode, Strickdatei
  curator.js    Gemini-Anbindung, Prompt, Validierung, Offline-Kurator
  render.js     Canvas-Darstellung (Strickoptik, Fransen, Lupe, Hit-Test)
  ui.js         Oberfläche
  template.html, styles.css
build.py        baut daraus dist/stadion-gestrickt.html und index.html
```

Bauen: `python3 build.py`
