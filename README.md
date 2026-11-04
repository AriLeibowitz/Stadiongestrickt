# Stadion gestrickt

**Ein Schal pro Saison, der mit jedem Meilenstein wächst.** Die Vorderseite startet einfarbig in Vereinsrot. Jeder Saison-Meilenstein legt eine neue Ebene darauf: Streifen, Symbole, Musterbänder, Rauten, Gold. Die Rückseite erzählt die Geschichte der Saison: Gemini liest alle besuchten Spiele, wählt die 5 größten Momente für die Highlight-Felder aus und beschreibt, wie die Saison war. Gestrickt wird erst auf Bestellung, in Einzelfertigung.

Konzept-Prototyp für die **FC Bayern AI-deation 2026**. Das ist keine offizielle FC-Bayern-Anwendung.

## Prototyp öffnen

`dist/stadion-gestrickt.html` im Browser öffnen, ohne Installation und ohne Server. Die Datei läuft offline (nur die Webfonts kommen aus dem Netz, sonst greift eine Systemschrift). `index.html` im Hauptordner ist dieselbe Datei, etwa für GitHub Pages.

Direktlink auf Fan und Saison: `…/stadion-gestrickt.html#FCB-STAM-M105/2025`

## Was man ausprobieren kann

| Bereich | Inhalt |
|---|---|
| **Fan-Code** | 5 Beispiel-Fans (Neumitglied, Dauerkarte, Auswärtsfahrerin, Europapokal-Reisender, Allesfahrer), ein Zufallsfan oder ein eigener Code im Format `FCB-XXXX-XXXX` mit Prüfzeichen |
| **Saison** | Jede Saison, in der der Fan im Stadion war, ergibt einen eigenen Schal. 26/27 läuft noch. |
| **Schal** | Vorderseite (Meilenstein-Design) und Rückseite (Highlights und Statistik), Strick- oder Rasteransicht, 150, 180 oder 220 cm, Lupe. „Schal lesen“: Beim Hover über ein Element zeigt die App, welcher Meilenstein es freigeschaltet hat. |
| **Garn** | Genau 5 Garnfarben (Strickerei-Limit), Anteile und Gramm. Gold gibt es nur über Meilensteine. |
| **KI-Kurator** | Gemini (eigener API-Key) oder Offline-Kurator. Highlights lassen sich tauschen oder entfernen, jedes Spiel kann zum Herzstück werden, und der vollständige Prompt ist einsehbar. |
| **Meilensteine** | 30 Saison-Meilensteine in 5 Kategorien und 34 Design-Elemente. Jedes Element lässt sich auf Auto, An oder Aus stellen, dazu „Alle an“ und „Alle aus“. |
| **Schalpotenzial & Umfrage** | Für die laufende Saison die nächsten Spiele simulieren. Neu freigeschaltete Elemente werden auf dem Schal gelb markiert, dazu ein App-Teaser. Dazu eine Kauf-Umfrage mit CSV-Export (lokal gespeichert). |
| **Spiele** | Alle Spiele der Saison, Highlights per ★ setzen |
| **Regelwerk** | Das komplette, festgelegte System: Fan-Code, Maße, Aufbau, Spuren, Dichte und alle Meilensteine. Es wird aus demselben Code erzeugt, der den Schal strickt. |
| **Export** | Strickdatei (`.txt`, eine Zeile pro Reihe, ein Buchstabe pro Masche) und Muster als PNG |

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
