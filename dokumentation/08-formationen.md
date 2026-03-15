# Aufstellungen & Formationen

Der **Aufstellungsplaner** ermöglicht es Trainern, die Startelf visuell auf einem Spielfeld zu planen — mit echten Spielern aus dem Kader, die per Drag & Drop frei positioniert werden können.

> 📋 **Tipp:** Jede Aufstellung hat einen integrierten **Taktik-Editor**, mit dem ihr Pfeile, Laufwege und Spielzüge direkt aufs Feld zeichnen könnt. Mehr dazu in [08b - Taktik-Editor](08b-taktik-editor.md).

---

## Übersicht der Aufstellungen

Unter **Trainer → Aufstellungen** (Administratoren finden diesen Bereich zusätzlich unter **Administration → Verwaltung → Aufstellungen**) sind alle gespeicherten Aufstellungen als **Karten-Raster** aufgelistet:

Jede Karte zeigt:
- Den **Namen** der Aufstellung (z. B. „Ligaspiel vs. FC Muster — Startelf")
- Den **Formations-Typ** als Badge (z. B. „4-4-2", „4-3-3")
- Eine **Miniatur-Vorschau** des Spielfelds mit den platzierten Spielern als kleine farbige Kreise
- **Bearbeiten** (✏️) und **Löschen** (🗑️) Buttons

Sollten noch keine Aufstellungen vorhanden sein, wird der Direktlink **„Erstellen Sie jetzt Ihre erste Aufstellung"** angezeigt.

---

## Eine neue Aufstellung erstellen

### Den Editor öffnen

1. Auf **„Neue Aufstellung"** oder den Direktlink in der leeren Übersicht klicken.
2. Es öffnet sich der **Aufstellungs-Editor** — ein zweigeteiltes Fenster.

### Der Editor im Detail

Der Editor besteht aus **zwei Spalten**:

#### Linke Seite — Das Spielfeld

Ein **Fußball-Halbfeld** als Hintergrundbild (standardmäßig ein grünes Rasenfeld mit weißen Linien). Hier platziert ihr die Spieler.

> Nach dem Speichern könnt ihr die Aufstellung im **Taktik-Editor** öffnen, um Pfeile und Spielzüge einzuzeichnen. Siehe [08b - Taktik-Editor](08b-taktik-editor.md).

- Jeder Spieler wird als **farbiger Kreis** dargestellt (ca. 32px)
  - **Echte Spieler** → in der Vereinsfarbe (primäre Farbe der App)
  - **Generische Spieler** (Platzhalter ohne konkreten Spieler) → in Grau
- Im Kreis steht der **Name** oder eine Abkürzung
- Kreise lassen sich **frei auf dem Feld verschieben** — die Position wird so gespeichert, dass die Aufstellung auf allen Bildschirmgrößen korrekt dargestellt wird

> **Hinweis:** Neu hinzugefügte Spieler werden automatisch auf einer freien Stelle platziert, sodass sich keine Kreise überlappen.

#### Rechte Seite — Spielerliste & Steuerung

Hier wird der Kader für die Aufstellung verwaltet:

| Element | Beschreibung |
|---------|-------------|
| **Name der Aufstellung** | Textfeld für den Namen (z. B. „Startelf Samstag") |
| **Formations-Typ** | Auswahl der Formation: 4-4-2, 4-3-3, 3-5-2 usw. (bestimmt auch das Hintergrundbild) |
| **Team-Auswahl** | Auswahl des Teams — filtert die Spielerliste entsprechend |
| **„Platzhalter hinzufügen"** | Fügt einen Kreis ohne zugewiesenen Spieler hinzu (z. B. für noch unbesetzte Positionen) |
| **Verfügbare Spieler** | Liste aller Spieler des gewählten Teams — mit „Hinzufügen"-Schaltfläche |
| **Aktive Spieler** | Liste der bereits platzierten Spieler — mit „Entfernen"-Schaltfläche |

### Spieler platzieren — Schritt für Schritt

1. **Team wählen** — im Dropdown-Menü das gewünschte Team auswählen.
2. **Spieler hinzufügen** — in der Spielerliste auf **„Hinzufügen"** klicken. Der Spieler erscheint als Kreis auf dem Spielfeld.
3. **Position anpassen** — den Kreis an die gewünschte Stelle auf dem Spielfeld ziehen.
4. Schritte 2 und 3 für alle weiteren Spieler wiederholen.
5. Optional: **Platzhalter hinzufügen**, wenn einzelne Positionen noch nicht besetzt sind.
6. Auf **Speichern** klicken — die Aufstellung wird gespeichert und in der Übersicht angezeigt.

### Spieler entfernen

In der Liste der aktiven Spieler (rechte Seite) auf **„Entfernen"** klicken — der Spieler wird vom Feld entfernt.

---

## Formations-Typen

Formations-Typen legen das taktische Grundgerüst fest und bestimmen das **Hintergrundbild** des Spielfelds:

| Formation | Beschreibung | Typische Verwendung |
|-----------|-------------|---------------------|
| **4-4-2** | 4 Abwehr, 4 Mittelfeld, 2 Sturm | Klassisches Grundsystem |
| **4-3-3** | 4 Abwehr, 3 Mittelfeld, 3 Sturm | Offensives System |
| **3-5-2** | 3 Abwehr, 5 Mittelfeld, 2 Sturm | Mittelfeld-dominantes Spiel |
| **4-2-3-1** | 4 Abwehr, 2 DM, 3 OM, 1 Sturm | Flexibles System |
| **5-3-2** | 5 Abwehr, 3 Mittelfeld, 2 Sturm | Defensives System |
| **3-4-3** | 3 Abwehr, 4 Mittelfeld, 3 Sturm | Sehr offensiv |

Jeder Formations-Typ kann ein eigenes **Hintergrundbild** und **Standardpositionen** haben. Bei der 4-4-2 stehen beispielsweise bereits die typischen Ausgangspositionen zur Verfügung, die anschließend frei angepasst werden können.

> Neue Formations-Typen können von Administratoren unter **Administration → Stammdaten → Aufstellungstypen** angelegt werden (siehe [20-admin.md](20-admin.md)).

---

## Aufstellungen bearbeiten

1. In der Übersicht auf das **Bearbeiten-Symbol** (✏️) der gewünschten Aufstellung klicken.
2. Der Editor öffnet sich mit der gespeicherten Aufstellung.
3. Spieler verschieben, hinzufügen oder entfernen.
4. Auf **Speichern** klicken — die Änderungen werden übernommen.

---

## Aufstellungen löschen

1. In der Übersicht auf das **Löschen-Symbol** (🗑️) klicken.
2. Ein Bestätigungsdialog erscheint.
3. Löschen bestätigen — die Aufstellung wird endgültig entfernt.

---

## Tipps für die Aufstellungsplanung

- **Zuerst das Team wählen**, damit nur die Spieler des betreffenden Teams angezeigt werden.
- **Platzhalter verwenden**, um die taktische Formation zunächst ohne konkrete Spieler zu planen und anschließend die Positionen zu besetzen.
- **Aussagekräftige Namen vergeben**: z. B. „U13 Liga Heimspiel 4-3-3" statt „Aufstellung 1".
- **Verschiedene Varianten anlegen**: z. B. eine offensive und eine defensive Aufstellung für dasselbe Spiel.
- **Laptop oder Tablet bevorzugen**: Das Verschieben der Spieler funktioniert auf größeren Bildschirmen komfortabler als auf dem Smartphone.
- **Taktik-Editor nutzen**: Nach dem Erstellen der Aufstellung direkt auf **„Taktik-Editor"** klicken und Spielzüge, Laufwege und Bereiche einzeichnen. Mehr dazu in [08b - Taktik-Editor](08b-taktik-editor.md).

---

## Wer kann Aufstellungen nutzen?

| Rolle | Berechtigungen |
|-------|----------------|
| **Spieler** | Gespeicherte Aufstellungen ansehen |
| **Trainer** | Aufstellungen erstellen, bearbeiten und löschen — über **Trainer → Aufstellungen** |
| **Administrator** | Aufstellungen erstellen, bearbeiten und löschen — über **Administration → Verwaltung → Aufstellungen**. Zusätzlich: Formations-Typen verwalten |

---

## Häufige Fragen

### Kann ich denselben Spieler in mehreren Aufstellungen verwenden?
Ja, ein Spieler kann in beliebig vielen Aufstellungen gleichzeitig erscheinen.

### Was sind Platzhalter?
Platzhalter sind Kreise ohne zugewiesenen Spieler — für Positionen, die noch nicht besetzt sind. Sie werden grau statt farbig dargestellt.

### Können Positionen nachträglich geändert werden?
Ja — die Aufstellung einfach öffnen und bearbeiten. Die Kreise lassen sich an jede gewünschte Stelle auf dem Feld verschieben.

### Warum werden keine Spieler in der Liste angezeigt?
Es muss zuerst ein **Team** ausgewählt werden. Danach werden nur die Spieler dieses Teams aufgelistet. Wenn das Team keine Spieler hat, muss zunächst ein Spieler dem Team zugewiesen werden (siehe [04-spieler.md](04-spieler.md)).

### Wie wird das Hintergrundbild des Spielfelds festgelegt?
Jeder Formations-Typ hat ein eigenes Hintergrundbild. Administratoren können unter **Administration → Stammdaten** neue Formations-Typen anlegen.

### Was ist der Unterschied zwischen dem Aufstellungsplaner und dem Taktik-Editor?
Der **Aufstellungsplaner** legt fest, **welcher Spieler** auf welcher Position startet. Der **Taktik-Editor** zeigt, **wie gespielt werden soll** — mit Pfeilen, Laufwegen und Spielzügen auf dem Feld. Idealerweise nutzt ihr beide zusammen: erst die Aufstellung anlegen, dann die Taktik darauf aufbauen.

---

## Weiterführend

- [08b - Taktik-Editor](08b-taktik-editor.md) — Spielzüge, Laufwege und Zonen direkt auf dem Spielfeld einzeichnen
- [06 - Spielverwaltung](06-spielverwaltung.md) — Spiele planen und Live-Ereignisse verwalten
- [10 - Video-Analyse](10-video-analyse.md) — Spielvideos analysieren
