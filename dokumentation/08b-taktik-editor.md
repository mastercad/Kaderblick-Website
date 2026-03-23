# Taktik-Editor

Der **Taktik-Editor** ist euer digitales Taktikboard. Ihr könnt auf dem Spielfeld Pfeile, Laufwege und Zonen einzeichnen, Gegner-Spieler platzieren und eure eigenen Spieler verschieben — und das alles für mehrere Taktik-Varianten gleichzeitig.

> **Für wen ist das?**  
> Hauptsächlich für **Trainer**. Gespeicherte Taktiken können je nach Vereinseinstellung auch von Spielern eingesehen werden.

---

## Den Taktik-Editor öffnen

Der Taktik-Editor gehört zu einer **Aufstellung**. Ihr öffnet ihn direkt von der Aufstellungs-Übersichtsseite aus.

### Weg 1 — Icon-Button auf der Karte

Jede Aufstellung wird als Karte angezeigt. Unten an der Karte gibt es eine Reihe mit kleinen Buttons. Das **Präsentations-Symbol** (ein kleines Monitor-Icon mit Pfeil) öffnet den Taktik-Editor für diese Aufstellung. Wenn ihr mit der Maus darüber fahrt, erscheint der Hinweis **„Taktik-Board öffnen"**.

### Weg 2 — Drei-Punkte-Menü

Oben rechts auf jeder Aufstellungskarte gibt es einen **⋮ Button** (drei Punkte übereinander). Darauf klicken öffnet ein Menü mit dem Eintrag **„Taktik-Board"**.

### Was dann passiert

Der Taktik-Editor öffnet sich als **Vollbild** — die App verschwindet und ihr seht nur noch das Taktikboard. Zum Schließen gibt es oben rechts in der Leiste ein **✕**.

---

## Der Aufbau des Taktik-Editors

```
┌──────────────────────────────────────────────────────────────────┐
│  WERKZEUGZEILE  (Formationsname · Tools · Farben · Speichern)   │
├──────────────────────────────────────────────────────────────────┤
│  TAKTIKEN:  [ Standard ]  [ Konter ]  [ + Neue Taktik ]         │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│                        SPIELFELD                                   │
│                                                                    │
├──────────────────────────────────────────────────────────────────┤
│  Statuszeile                                                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Die Werkzeugzeile

Die Leiste ganz oben enthält alle Steuerungsmöglichkeiten — von links nach rechts:

### Formationsname und Typ

Ganz links seht ihr den **Namen der Aufstellung** (z. B. „U13 Heimspiel") und daneben ein blaues Badge mit dem Formations-Typ (z. B. „4-3-3"). Diese können hier nicht geändert werden — dafür gibt es den normalen Aufstellungs-Editor (✏️ Bearbeiten).

---

### Zeichenwerkzeuge

Vier Symbole für das, was ihr auf dem Feld zeichnen wollt:

| Symbol | Name | Was es tut |
|--------|------|------------|
| Finger-Symbol | **Auswahl** | Elemente auf dem Feld anfassen, verschieben oder löschen |
| Durchgehender Pfeil | **Bewegungspfeil** | Ballwege, Pässe, taktische Richtungen |
| Gestrichelter Pfeil | **Laufweg** | Laufwege von Spielern ohne Ball |
| Kreis | **Zone** | Bereiche auf dem Feld markieren (z. B. Pressingzone, Raum) |

**Werkzeug wählen → auf dem Feld zeichnen.** Das gewählte Werkzeug bleibt aktiv bis ihr ein anderes auswählt.

---

### „Gegner"-Button *(nur im vollen Feld sichtbar)*

Ein roter Button mit einem kleinen Personen-Symbol und der Aufschrift **„Gegner"**. Damit fügt ihr einen roten Gegner-Token auf dem Feld hinzu (erscheint in der linken Feldhälfte = Gegner-Hälfte).

> ⚠️ **Dieser Button erscheint nur, wenn ihr euch im „Volles Feld"-Modus befindet.** Im Halbfeld-Modus gibt es keine Gegner.

---

### Feld-Umschalter

Ein Button der zwischen zwei Ansichten wechselt:

| Anzeige | Bedeutung |
|---------|-----------|
| **Volles Feld** | Ihr seht gerade das volle Spielfeld. Klicken wechselt zu Hälfte. |
| **Hälfte** | Ihr seht gerade nur eure Spielfeldhälfte. Klicken wechselt zum vollen Feld. |

Beim Wechsel werden alle Zeichnungen automatisch umgerechnet — nichts geht verloren.

---

### „Vorlagen"-Button

Ein Lesezeichen-Symbol mit der Aufschrift **„Vorlagen"**. Öffnet ein kleines Menü mit gespeicherten Taktik-Vorlagen in fünf Kategorien:

- **Pressing** · **Angriff** · **Standards** · **Spielaufbau** · **Defensive**

Eine Vorlage laden → sie erscheint als **neuer Taktik-Tab** (der aktuelle Tab wird nie überschrieben). Ihr könnt auch eure aktuelle Taktik als eigene Vorlage speichern.

---

### Farbpalette

Sechs farbige Kreise. Klickt auf eine Farbe, bevor ihr zeichnet — alle danach gezeichneten Linien und Zonen bekommen diese Farbe. Bereits Gezeichnetes bleibt unverändert.

| Farbe | Name |
|-------|------|
| ⚪ | Weiß |
| 🟡 | Gelb |
| 🔴 | Rot |
| 🔵 | Cyan |
| 🟠 | Orange |
| 🟢 | Grün |

Der aktuell gewählte Farbkreis ist mit einem weißen Ring hervorgehoben.

---

### Rückgängig, Löschen, Zurücksetzen

| Symbol | Funktion |
|--------|---------|
| ↩ (Pfeil zurück) | **Letzte Zeichnung löschen** — nur die zuletzt gezeichnete Linie oder Zone entfernen |
| 🗑 (Kehren-Symbol) | **Alles löschen** — alle Zeichnungen und Gegner-Tokens auf diesem Tab entfernen |
| ⟳ (Zurücksetzen-Symbol) | **Spielerpositionen zurücksetzen** — eigene Spieler springen auf ihre Standard-Ausgangspositionen |

> Der Löschen-Button ist ausgegraut, wenn auf dem aktuellen Tab noch nichts gezeichnet ist. Der Rückgängig-Button ist ausgegraut, wenn keine Zeichnungen vorhanden sind.

---

### Notizen-Button *(nur sichtbar wenn Notizen vorhanden)*

Wenn die Aufstellung Taktik-Notizen enthält, erscheint ein kleiner **„Notizen"** Chip in der Leiste. Klicken blendet ein Notizfeld neben dem Spielfeld ein oder aus. Die Notizen können hier nur gelesen, nicht bearbeitet werden — dafür müsst ihr den normalen Aufstellungs-Editor öffnen.

---

### Speichern-Button

Rechts in der Leiste: **„💾 Speichern"**. Wenn es ungespeicherte Änderungen gibt, erscheint ein **Sternchen ★** nach dem Text: „Speichern ★". Das ist das Zeichen: noch nicht gespeichert!

Nach dem Speichern erscheint kurz eine Bestätigung in der Leiste.

**Beim Schließen mit ungespeicherten Änderungen** erscheint automatisch ein Warnfenster mit drei Optionen:
- **Weiter bearbeiten** — zurück zum Editor
- **Schließen ohne Speichern** — Änderungen verwerfen
- **Speichern & Schließen** — erst speichern, dann schließen

---

### Vollbild und Schließen

Ganz rechts in der Leiste:

| Symbol | Funktion |
|--------|---------|
| ⛶ Vollbild | Browser-Vollbildmodus aktivieren (z. B. für Projektoren) |
| ✕ Schließen | Taktik-Editor schließen (mit Warnfenster wenn ungespeichert) |

---

## Die Taktik-Tabs

Direkt unter der Werkzeugzeile gibt es eine Leiste mit dem Label **„TAKTIKEN"** und runden Tab-Pillen:

```
TAKTIKEN:  [ Standard ]  [ Schneller Konter ]  [ Eckball ]  [ + Neue Taktik ]
```

Jeder Tab ist eine **eigene, unabhängige Taktik** — mit eigenen Zeichnungen, Gegner-Positionen und Spieler-Positionen. Der aktive Tab ist blau hervorgehoben.

### Tab wechseln
Einfach auf einen anderen Tab klicken.

### Tab umbenennen
**Doppelklick** auf den Tab-Namen → ein Texteingabefeld erscheint direkt im Tab → neuen Namen tippen → **Enter** drücken (oder irgendwo anders klicken zum Bestätigen, **Esc** zum Abbrechen).

### Neuen Tab erstellen
Auf **„+ Neue Taktik"** klicken (der gepunktete Button am Ende der Liste). Ein neuer leerer Tab wird angelegt.

### Tab löschen
Neben jedem Tab-Namen gibt es ein kleines **×**. Klicken löscht den Tab.
> ⚠️ Wenn nur ein Tab vorhanden ist, gibt es kein × — der letzte Tab kann nicht gelöscht werden.

---

## Auf dem Spielfeld zeichnen

### Bewegungspfeil oder Laufweg zeichnen

1. **Pfeil- oder Laufweg-Werkzeug** in der Leiste auswählen.
2. Farbe auswählen (optional).
3. Auf dem Spielfeld **klicken und bei gedrückter Taste ziehen** — vom Startpunkt zum Endpunkt.
4. **Loslassen** — die Linie erscheint mit Pfeilspitze als sanfte Kurve.

> 📱 **Auf dem Handy oder Tablet:** Mit dem Finger wischen statt klicken.

### Zone zeichnen

1. **Zonen-Werkzeug** (Kreis) in der Leiste auswählen.
2. Farbe auswählen.
3. Auf dem Spielfeld **klicken und ziehen** — der Kreis wächst je weiter ihr zieht.
4. Loslassen.

### Was ist der Unterschied zwischen Bewegungspfeil und Laufweg?

- **Bewegungspfeil** (durchgehende Linie) → zeigt den Weg des **Balls** oder eine allgemeine taktische Richtung
- **Laufweg** (gestrichelte Linie) → zeigt, wie ein **Spieler ohne Ball** läuft

---

## Elemente bearbeiten und löschen

Mit dem **Auswählen-Werkzeug** (Finger-Symbol) könnt ihr auf gezeichnete Elemente klicken:

### Pfeil oder Laufweg verschieben
- **Auf die Linie klicken und ziehen** → verschiebt die ganze Linie
- **Auf den kleinen Startpunkt-Kreis klicken und ziehen** → nur den Anfang verschieben
- **Auf den kleinen Endpunkt-Kreis klicken und ziehen** → nur die Pfeilspitze verschieben

Die Handles (kleine Kreise an den Enden) erscheinen wenn ihr mit der Maus über die Linie fahrt.

### Zone verschieben oder vergrößern
- **Auf die Kreismitte klicken und ziehen** → verschiebt den Kreis
- **Auf den Rand klicken und ziehen** → Kreis vergrößern oder verkleinern

### Element löschen
Mit dem Auswählen-Werkzeug auf das Element tippen/klicken — ein einzelner Klick löscht es direkt.

---

## Gegner-Tokens

Im **Vollfeld-Modus** gibt es den roten **„Gegner"** Button oben. Jeder Klick fügt einen neuen roten Gegner-Kreis mit einer Nummer auf die linke Spielfeldhälfte (= Gegner-Hälfte) hinzu.

- Die Nummern zählen automatisch hoch: erster Gegner = 1, zweiter = 2 usw.
- Tokens können mit dem **Auswählen-Werkzeug** auf dem Feld verschoben werden
- Ein Klick/Tippen auf einen Token **löscht ihn**

> Gegner-Tokens sind nicht im Halbfeld-Modus verfügbar — sie werden beim Wechsel ausgeblendet, aber nicht gelöscht. Im Vollfeld-Modus sind sie wieder da.

---

## Eigene Spieler verschieben

Eure Spieler sind als farbige Kreise mit Namen auf dem Feld. Ihr könnt sie frei auf neue Positionen schieben:

1. Direkt auf einen Spieler-Kreis **klicken und halten**.
2. Zur neuen Position **ziehen**.
3. **Loslassen**.

Mit dem **⟳ Zurücksetzen-Button** springen alle Spieler auf die in der Aufstellung definierten Ausgangspositionen zurück.

### Was bedeutet der Pfeil am oberen Feldrand?

Im **Halbfeld-Modus** können eure eigenen Spieler außerhalb des sichtbaren Bereichs sein — z. B. ein Stürmer, der weit vorne in der Gegner-Hälfte steht. Dann erscheint am oberen Feldrand ein kleiner **Pfeil** mit der Spieler-Nummer. Das bedeutet: dieser Spieler ist weiter vorne auf dem Platz, außerhalb des gezeigten Halbfelds. Im Vollfeld-Modus ist er wieder zu sehen.

---

## Tipps

**Für Trainingsbesprechungen:**
Vollbild-Modus (⛶) aktivieren und das Tablet oder den Laptop zeigen — das Spielfeld füllt den ganzen Bildschirm und ist gut sichtbar.

**Mehrere Varianten:**
Für jede Spielsituation einen eigenen Tab anlegen: z. B. „Standard", „Eckball Angriff", „Eckball Abwehr", „Konter". Beim Besprechen einfach zwischen den Tabs wechseln.

**Erst Aufstellung, dann Taktik:**
Im normalen Aufstellungs-Editor (✏️ Bearbeiten) werden die Spieler ihrer Position zugewiesen. Im Taktik-Editor zeigt ihr, wie gespielt wird. Beides zusammen ergibt den vollständigen Plan.

**Vorlagen nutzen:**
Unter **„Vorlagen"** gibt es fertige Taktiken als Ausgangspunkt. Eine Vorlage laden und dann anpassen ist oft schneller als von Null anfangen.

---

## Häufige Fragen

### Ich habe aus Versehen etwas gezeichnet — wie mache ich es rückgängig?
Auf den **↩ Rückgängig-Button** klicken. Das entfernt das zuletzt gezeichnete Element.

### Der „Gegner"-Button ist nicht sichtbar
Der Gegner-Button erscheint nur im **„Volles Feld"-Modus**. Wenn ihr aktuell die Hälfte seht, erst auf **„Hälfte"** klicken um zum vollen Feld zu wechseln.

### Kann ich auf dem Handy zeichnen?
Ja, der Taktik-Editor funktioniert mit dem Finger auf Handy und Tablet. Auf größeren Bildschirmen ist es komfortabler, weil das Feld größer ist.

### Warum sehe ich einen Spieler nicht auf dem Halbfeld?
Wenn ein Spieler in der Gegner-Hälfte steht, erscheint er im Halbfeld-Modus nicht auf dem Feld. Am oberen Rand seht ihr stattdessen einen kleinen Pfeil mit seiner Nummer. Wechselt zu **„Volles Feld"** um ihn zu sehen und zu verschieben.

### Die Notizen erscheinen nicht in der Werkzeugzeile
Der „Notizen"-Chip erscheint nur, wenn die Aufstellung Notizen enthält. Notizen werden im normalen Aufstellungs-Editor (✏️ Bearbeiten) gesetzt.

### Was passiert beim Wechsel Halbfeld ↔ Volles Feld mit meinen Zeichnungen?
Alle Zeichnungen bleiben erhalten und werden automatisch umgerechnet. Pfeile, die ins Gegner-Feld zeigen, werden im Halbfeld bis zur Mittellinie dargestellt (mit Pfeilspitze am Rand). Beim Zurückwechseln sind alle Zeichnungen wieder vollständig sichtbar.

### Kann ich eine gespeicherte Vorlage wieder löschen?
Im Vorlagen-Menü gibt es neben eigenen Vorlagen einen Löschen-Button. Systemvorlagen können nicht gelöscht werden.

---

## Berechtigungen

| Rolle | Was ist möglich |
|-------|----------------|
| **Spieler/in** | Gespeicherte Taktiken lesen (je nach Vereinseinstellung) |
| **Trainer/in** | Taktiken erstellen, zeichnen, bearbeiten, speichern, löschen |
| **Administrator** | Alles wie Trainer/in |

---

## Weiterführend

- [08 - Aufstellungen & Formationen](08-formationen.md) — Spieler auf dem Feld platzieren und Aufstellungen verwalten
- [06 - Spielverwaltung](06-spielverwaltung.md) — Spiele planen und Live-Ereignisse verwalten
- [10 - Video-Analyse](10-video-analyse.md) — Spielvideos analysieren
