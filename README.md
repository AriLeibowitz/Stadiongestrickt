# Stadion gestrickt

**Ein Schal pro Saison, der mit jedem Meilenstein wächst.** Die Vorderseite startet einfarbig in Vereinsrot. Jeder Saison-Meilenstein legt eine neue Ebene darauf: Streifen, Symbole, Musterbänder, Rauten, Gold. Die Rückseite erzählt die Geschichte der Saison: Gemini liest alle besuchten Spiele, wählt die 5 größten Momente für die Highlight-Felder aus und beschreibt, wie die Saison war. Gestrickt wird erst auf Bestellung, in Einzelfertigung.

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

- **Raster:** 6 Maschen/cm quer, 8 Reihen/cm längs, also 108 × 1200 Maschen bei 150 cm. Schrift (Barlow Condensed, eingebettet) und Symbole werden als Vektoren in Zentimetern gezeichnet und Masche für Masche in eine von 5 Garnfarben übersetzt.
- **Vorderseite:** Sie startet einfarbig rot. Die fünf Meilenstein-Reihen legen Ebenen darüber:
  - **Treue:** Schriftzug, Endstreifen, Blockstreifen, Rand, Goldgarn, Medaillon, Rauten-Mitte
  - **Wettbewerbe:** Pokal, Sternenband, vier Sterne, Pokal und Schale im Medaillon
  - **Auswärts:** Naht, Fransenfarbe, Rauten-Enden, Stadion-Punkte, goldene Naht und Fransen
  - **Momente:** 7 Muster in den Streifenbändern
  - **Saison komplett:** AUG–MAI, Krone
- **Rückseite:** Sie ist ebenfalls rot. Der Meilenstein „Europapokal-Abende“ ändert ihre Grundfarbe zu Nachtblau mit Sternenhimmel. Sie zeigt die KI-Highlights, das Fan-Etikett, Reise-Feld, Kalender, Gegner-Sammlung und den Strickcode.

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
