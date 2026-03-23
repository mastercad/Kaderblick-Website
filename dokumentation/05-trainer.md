# Trainer

In der Trainerverwaltung werden alle Trainer mit ihren Profildaten, Lizenzen, Team-Zugehörigkeiten und Vereinszuordnungen erfasst.

---

## Trainer-Übersicht

Auf der **Trainer-Seite** seht ihr alle Trainer als übersichtliche Tabelle.

### Trainer suchen und filtern

Auch bei vielen Trainern findet ihr schnell den richtigen:

- **Nach Namen suchen**: Gebt einen Namen ein und die Liste zeigt euch sofort nur passende Trainer. Über das Kreuz könnt ihr die Suche wieder zurücksetzen.
- **Nach Team filtern**: Wählt ein bestimmtes Team aus, um nur dessen Trainer zu sehen — oder lasst „Alle Teams" stehen, um alle zu sehen.
- **Durch die Liste blättern**: Bei vielen Trainern könnt ihr bequem durch die Seiten blättern und selbst einstellen, wie viele auf einmal angezeigt werden.
- **Gesamtzahl**: Ihr seht jederzeit, wie viele Trainer insgesamt gefunden wurden.

> 💡 Suche und Filter lassen sich kombinieren: Sucht z. B. nach „Schmidt" und filtert gleichzeitig nach dem Team „U17".

### Angezeigte Informationen pro Trainer

| Feld | Beschreibung |
|------|-------------|
| **Vorname** | Vorname des Trainers |
| **Nachname** | Nachname |
| **Geburtsdatum** | Geburtsdatum |
| **E-Mail** | E-Mail-Adresse (falls hinterlegt) |
| **Teams** | In welchen Teams der Trainer aktiv ist |
| **Lizenzen** | Welche Trainerlizenzen der Trainer besitzt |

---

## Trainer-Detail

Klickt auf einen Trainer, um das **Detail-Fenster** zu öffnen. Dort sind alle Informationen übersichtlich zusammengefasst:

### Kopfbereich

- **Profilbild** (Avatar) — falls ein Nutzer-Account verknüpft ist
- **Name** und **Geburtsdatum**
- **E-Mail-Adresse**

### Team-Zugehörigkeiten

Eine Liste aller Teams, die der Trainer betreut:

| Feld | Beschreibung |
|------|-------------|
| **Team** | Name des Teams (z. B. „E1-Junioren") |
| **Funktion** | z. B. „Cheftrainer", „Co-Trainer", „Torwarttrainer" |
| **Von – Bis** | Zeitraum der Zugehörigkeit |

> 💡 Ein Trainer kann **mehrere Teams** gleichzeitig betreuen — z. B. als Cheftrainer der E1 und Co-Trainer der D2.

### Vereins-Zugehörigkeiten

Zeigt, bei welchem/welchen Verein(en) der Trainer aktiv ist:

| Feld | Beschreibung |
|------|-------------|
| **Verein** | Vereinsname |
| **Von – Bis** | Zeitraum der Zugehörigkeit |
| **Aktiv** | Ob die Zugehörigkeit aktuell aktiv ist |

### Nationalitäten

Falls erfasst, werden die Nationalitäten des Trainers als kleine Flaggen-Chips angezeigt.

### Lizenzen

Die **Trainer-Lizenzen** sind ein wichtiger Bestandteil des Trainer-Profils:

| Feld | Beschreibung |
|------|-------------|
| **Lizenz** | Name der Lizenz (z. B. „DFB C-Lizenz", „UEFA B-Lizenz") |
| **Beschreibung** | Weitere Details zur Lizenz |
| **Ländercode** | In welchem Land die Lizenz ausgestellt wurde (z. B. „DE") |
| **Gültig von** | Ab wann die Lizenz gültig ist |
| **Gültig bis** | Wann die Lizenz abläuft (falls befristet) |
| **Aktiv** | Ob die Lizenz aktuell gültig ist |

> 💡 In der Detail-Ansicht werden nur **aktive Lizenzen** prominent angezeigt. Abgelaufene Lizenzen bleiben im System, werden aber als inaktiv markiert.

---

## Trainer anlegen

> ℹ️ Das Anlegen von Trainern ist in der Regel Administratoren vorbehalten.

1. Klickt auf **„Trainer hinzufügen"**
2. Füllt die **Grunddaten** aus:
   - Vorname, Nachname, Geburtsdatum
   - E-Mail (optional)
3. Speichern

### Team-Zuweisung hinzufügen

1. Im Trainer-Detail auf **„Team-Zuweisung hinzufügen"**
2. **Team** auswählen
3. **Funktion** festlegen (z. B. Cheftrainer, Co-Trainer)
4. **Startdatum** setzen (und optional Enddatum)
5. Speichern

### Vereins-Zuweisung hinzufügen

1. **„Vereins-Zuweisung hinzufügen"** klicken
2. **Verein** auswählen
3. **Zeitraum** und **Aktiv-Status** eintragen
4. Speichern

### Lizenz hinzufügen

1. Im Trainer-Detail auf **„Lizenz hinzufügen"**
2. **Lizenz** aus der Lizenz-Verwaltung auswählen (z. B. „DFB C-Lizenz")
3. **Gültig von** und **Gültig bis** eintragen
4. **Aktiv** auf „Ja" setzen
5. Speichern

---

## Trainer bearbeiten

Klickt im Detail auf den **Bearbeiten-Button** (✏️). Alle Felder können angepasst werden:

- Persönliche Daten (Name, Geburtsdatum, E-Mail)
- Team- und Vereins-Zuweisungen hinzufügen, ändern oder entfernen
- Lizenzen hinzufügen, ändern oder entfernen
- Nationalitäten pflegen

---

## Trainer löschen

1. Trainer-Detail öffnen
2. Auf **„Löschen"** klicken
3. Bestätigung im Dialog

> ⚠️ Beim Löschen eines Trainers werden seine Team-/Vereins-Zuweisungen und Lizenz-Zuweisungen entfernt.

---

## Trainer-Lizenzen verwalten

In der Verwaltung können **Lizenztypen** angelegt werden, die dann den Trainern zugewiesen werden:

| Feld | Beschreibung |
|------|-------------|
| **Name** | z. B. „DFB C-Lizenz", „UEFA A-Lizenz", „DFB-Teamleiter" |
| **Beschreibung** | Erklärung der Lizenz |
| **Ländercode** | z. B. „DE" für Deutschland, „AT" für Österreich |
| **Aktiv** | Ob dieser Lizenztyp noch vergeben wird |

### Typische Lizenzen

| Lizenz | Beschreibung |
|--------|-------------|
| **DFB Teamleiter** | Basisqualifikation für Betreuer |
| **DFB C-Lizenz** | Grundlagentrainer-Ausbildung |
| **DFB B-Lizenz** | Fortgeschrittene Trainer-Ausbildung |
| **UEFA B-Lizenz** | Europaweit anerkannt |
| **UEFA A-Lizenz** | Professionelle Trainer-Ausbildung |
| **DFB Torwarttrainer** | Speziallizenz für Torwarttraining |
| **Erste Hilfe** | Erste-Hilfe-Bescheinigung |

---

## Trainer und Nutzer-Verknüpfung

Ein Trainer-Profil kann mit einem **Nutzer-Account** verknüpft werden (über die Nutzer-Verknüpfungen im Profil, siehe [19-profil.md](19-profil.md)):

- Der Trainer kann sich dann im System anmelden und seine Teams verwalten
- Das **Profilbild** des Nutzer-Accounts wird im Trainer-Profil angezeigt
- Die Verknüpfung muss von einem **Administrator bestätigt** werden

---

## Tipps

### Für Administratoren
- **Lizenzen aktuell halten**: Prüft regelmäßig, ob Lizenzen abgelaufen sind — setzt abgelaufene auf „inaktiv"
- **Team-Zuweisungen pflegen**: Wenn ein Trainer das Team wechselt, Enddatum bei der alten Zuweisung setzen und neue Zuweisung anlegen
- **Nutzer-Verknüpfung herstellen**: Damit Trainer ihre Teams in Kaderblick verwalten können

### Für Trainer
- **Profil prüfen**: Schaut, ob eure Lizenzen und Team-Zuweisungen korrekt sind
- **Lizenz-Ablauf im Blick behalten**: Wenn eine Lizenz bald abläuft, rechtzeitig an die Verlängerung denken

---

## Häufige Fragen

### Kann ein Trainer mehrere Teams haben?
Ja — über die Team-Zuweisungen kann ein Trainer beliebig viele Teams betreuen, auch mit unterschiedlichen Funktionen.

### Was passiert, wenn eine Lizenz abläuft?
Die Lizenz wird als „inaktiv" markiert, bleibt aber im System. Sie wird im Trainer-Detail nicht mehr prominent angezeigt.

### Kann ein Trainer auch Spieler sein?
Ja — ein Nutzer-Account kann sowohl mit einem Trainer-Profil als auch mit einem Spieler-Profil verknüpft sein (über die Nutzer-Verknüpfungen).

### Muss ein Trainer einen Nutzer-Account haben?
Nein — ein Trainer-Profil kann auch ohne Nutzer-Account existieren (z. B. für die reine Dokumentation). Aber ohne Account kann der Trainer sich nicht einloggen und hat keinen Zugriff auf Kaderblick.

### Wie verknüpfe ich einen Trainer mit seinem Account?
Über das **Profil** → **Verknüpfungen** → „Neue Verknüpfung" → Typ „Trainer" auswählen → Trainer aus der Liste wählen. Die Verknüpfung muss dann von einem Admin bestätigt werden. Siehe [19-profil.md](19-profil.md) und [20-admin.md](20-admin.md).
