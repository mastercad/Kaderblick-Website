# Spieler

Die Spielerverwaltung ist das Herzstück von Kaderblick. Hier sind alle Spieler mit ihren Profildaten, Positionen, Teamzugehörigkeiten und Statistiken erfasst.

---

## Spieler-Übersicht

Auf der **Spieler-Seite** seht ihr alle Spieler eures Teams (oder Vereins, je nach Berechtigung) als übersichtliche Tabelle.

### Spieler suchen und filtern

Auch bei vielen Spielern findet ihr schnell den richtigen:

- **Nach Namen suchen**: Gebt einen Namen ein und die Liste zeigt euch sofort nur passende Spieler. Über das Kreuz könnt ihr die Suche wieder zurücksetzen.
- **Nach Team filtern**: Wählt ein bestimmtes Team aus, um nur dessen Spieler zu sehen — oder lasst „Alle Teams" stehen, um alle zu sehen.
- **Durch die Liste blättern**: Bei vielen Spielern könnt ihr bequem durch die Seiten blättern und selbst einstellen, wie viele auf einmal angezeigt werden.
- **Gesamtzahl**: Ihr seht jederzeit, wie viele Spieler insgesamt gefunden wurden.

> 💡 Suche und Filter arbeiten zusammen: Ihr könnt z. B. nach „Max" suchen UND gleichzeitig nur das Team „U15" anzeigen lassen.

### Angezeigte Informationen pro Spieler

| Feld | Beschreibung |
|------|-------------|
| **Vorname** | Vorname des Spielers |
| **Nachname** | Nachname |
| **Geburtsdatum** | Wann der Spieler geboren ist |
| **Größe** | Körpergröße in cm |
| **Gewicht** | Gewicht in kg |
| **Starker Fuß** | Links, Rechts oder Beidfüßig |
| **Hauptposition** | Die bevorzugte Position (z. B. Mittelfeld, Sturm, Abwehr, Tor) |
| **Alternative Positionen** | Weitere Positionen, auf denen der Spieler spielen kann |
| **E-Mail** | E-Mail-Adresse (falls hinterlegt) |
| **fussball.de-ID** | Verknüpfung mit dem fussball.de-Profil |
| **fussball.de-URL** | Direktlink zum fussball.de-Profil |

---

## Spieler-Detail

Klickt auf einen Spieler, um das **Detail-Fenster** zu öffnen. Dort findet ihr alle Informationen auf einen Blick:

### Kopfbereich

- **Profilbild** (Avatar) — falls ein Nutzer-Account verknüpft ist
- **Name** und **Geburtsdatum**
- **Hauptposition** und **starker Fuß**
- Link zum **fussball.de-Profil** (falls vorhanden)

### Team-Zugehörigkeiten

Eine Liste aller Teams, bei denen der Spieler gemeldet ist:

| Feld | Beschreibung |
|------|-------------|
| **Team** | Teamname |
| **Zuweisungstyp** | z. B. „Stammspieler", „Gastspieler", „Zweitspieler" |
| **Trikotnummer** | Die Rückennummer im Team |
| **Von – Bis** | Zeitraum der Zugehörigkeit (Startdatum, optional Enddatum) |

> 💡 Ein Spieler kann in **mehreren Teams** gleichzeitig sein — z. B. als Stammspieler bei der E1 und als Gastspieler bei der E2.

### Vereins-Zugehörigkeiten

Zeigt, bei welchem/welchen Verein(en) der Spieler gemeldet ist:

| Feld | Beschreibung |
|------|-------------|
| **Verein** | Vereinsname |
| **Von – Bis** | Zeitraum der Mitgliedschaft |
| **Aktiv** | Ob die Zugehörigkeit aktuell aktiv ist |

### Nationalitäten

Falls erfasst, werden die Nationalitäten des Spielers angezeigt — als kleine Flaggen-Chips.

### Titel

Spieler können **Titel** haben — das sind Auszeichnungen, die im XP-System vergeben werden:

| Feld | Beschreibung |
|------|-------------|
| **Titelkategorie** | z. B. „Torschützenkönig", „Bester Spieler", „Trainingsfleißigster" |
| **Rang** | z. B. Gold, Silber, Bronze |
| **Geltungsbereich (Scope)** | Team, Liga oder übergreifend |
| **Wert** | Numerischer Wert (z. B. Anzahl Tore) |
| **Aktiv** | Ob der Titel aktuell gültig ist |
| **Vergeben am** | Wann der Titel verliehen wurde |
| **Saison** | In welcher Saison der Titel gilt |

---

## Spieler anlegen

> ℹ️ Das Anlegen von Spielern ist in der Regel Trainern und Administratoren vorbehalten.

1. Klickt auf **„Spieler hinzufügen"**
2. Füllt die **Grunddaten** aus:
   - Vorname, Nachname, Geburtsdatum
   - Größe, Gewicht (optional)
   - Starker Fuß
   - Hauptposition und alternative Positionen
   - E-Mail (optional)
3. Speichern

### Team-Zuweisung hinzufügen

Nach dem Anlegen des Spielers:

1. Im Spieler-Detail auf **„Team-Zuweisung hinzufügen"**
2. **Team** auswählen
3. **Zuweisungstyp** wählen (Stammspieler, Gastspieler, ...)
4. **Trikotnummer** eingeben
5. **Startdatum** setzen (und optional Enddatum)
6. Speichern

### Vereins-Zuweisung hinzufügen

1. **„Vereins-Zuweisung hinzufügen"** klicken
2. **Verein** auswählen
3. **Zeitraum** und **Aktiv-Status** eintragen
4. Speichern

---

## Spieler bearbeiten

Klickt im Detail auf den **Bearbeiten-Button** (✏️). Alle Felder können angepasst werden:

- Persönliche Daten (Name, Geburtsdatum, Größe, ...)
- Position und starker Fuß
- fussball.de-Verknüpfung
- Team- und Vereins-Zuweisungen

> ℹ️ Bearbeitungs-Rechte hängen von eurer Rolle ab. Spieler können häufig nur ihre eigenen Daten anpassen, Trainer können alle Spieler ihres Teams bearbeiten.

---

## Spieler löschen

1. Spieler-Detail öffnen
2. Auf **„Löschen"** klicken
3. Bestätigung im Dialog

> ⚠️ Beim Löschen eines Spielers werden auch seine Team-/Vereins-Zuweisungen und Titel entfernt. Spielereignisse (Tore, Karten etc.) bleiben beim jeweiligen Spiel erhalten.

---

## Alternative Positionen

Neben der **Hauptposition** kann für jeden Spieler eine Liste von **Alternativpositionen** gepflegt werden. Das ist hilfreich für:

- **Trainer**: Bei der Aufstellung sehen, welche Spieler flexibel einsetzbar sind
- **Formationen**: Im Formationseditor Spieler auf verschiedene Positionen ziehen

**Beispiel:** Hauptposition „Mittelfeld", Alternativpositionen „Rechtes Mittelfeld", „Sturm"

---

## fussball.de-Verknüpfung

Wenn ein Spieler auf **fussball.de** registriert ist, könnt ihr sein Profil verknüpfen:

1. **fussball.de-ID** eintragen (die Spieler-ID von fussball.de)
2. **fussball.de-URL** eintragen (der Direktlink zum Profil)
3. Speichern

In der Spieler-Detail-Ansicht erscheint dann ein **Link-Symbol**, über das man direkt zum fussball.de-Profil springen kann.

---

## Körpermaße und Größen

Die Körpermaße (Größe, Gewicht, Schuhgröße, Trikotgröße, Hosengröße) werden nicht nur im Spielerprofil angezeigt, sondern auch:

- Im **Größen-Guide** (Team-Übersicht aller Größen → praktisch für Sammelbestellungen)
- In **Berichten** (z. B. Größenverteilung im Team)

> 💡 Bitte haltet die Größen aktuell — besonders bei wachsenden Jugendspielern ändert sich das regelmäßig!

---

## Tipps zur Spielerverwaltung

### Für Trainer
- **Alle Positionen pflegen**: Tragt Haupt- UND Alternativpositionen ein — das hilft bei der Aufstellungsplanung
- **Trikotnummern aktuall halten**: Ändert die Nummer, wenn ein Spieler wechselt
- **fussball.de verknüpfen**: Erleichtert den Abgleich mit dem offiziellen Spielerprofil

### Für Spieler & Eltern
- **Größen aktualisieren**: Nach dem Wachstumsschub die neuen Maße eintragen
- **Position prüfen**: Stimmt eure Hauptposition noch? Gebt dem Trainer Bescheid, wenn ihr euch auf einer anderen Position wohler fühlt

---

## Häufige Fragen

### Kann ein Spieler in mehreren Vereinen sein?
Ja — über die Vereins-Zuweisungen kann ein Spieler bei mehreren Vereinen hinterlegt werden (z. B. bei einem Vereinswechsel, wo alter und neuer Verein erfasst bleiben).

### Was bedeutet „Gastspieler"?
Ein Gastspieler ist ein Spieler, der normalerweise einem anderen Team angehört, aber gelegentlich in eurem Team aushilft. Der Zuweisungstyp unterscheidet zwischen Stammspieler, Gastspieler und weiteren Typen.

### Kann ich Spieler aus einem anderen Team sehen?
Das hängt von euren Berechtigungen ab. In der Regel seht ihr nur Spieler eures eigenen Teams. Trainer mit Zugriff auf mehrere Teams sehen alle ihre Spieler.

### Was passiert mit einem Spieler, wenn er das Team verlässt?
Setzt ein **Enddatum** bei der Team-Zuweisung. Der Spieler bleibt im System erhalten (mit all seinen Statistiken), wird aber nicht mehr als aktives Mitglied des Teams angezeigt.

### Wie funktionieren die Titel?
Titel werden über das XP-System oder manuell von Administratoren vergeben. Sie erscheinen im Spieler-Profil und in der Admin-Übersicht. Mehr dazu in [20-admin.md](20-admin.md).
