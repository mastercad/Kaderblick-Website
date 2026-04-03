export interface NewsTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  html: string;
}

/**
 * Vorgefertigte News-Vorlagen für den RichText-Editor.
 * HTML ist im TipTap-Ausgabe-Format: Listen verwenden <li><p>…</p></li>,
 * Blockquotes <blockquote><p>…</p></blockquote>.
 */
export const NEWS_TEMPLATES: NewsTemplate[] = [
  {
    id: 'platform-update',
    name: 'Plattform-Update',
    description: 'Neue Features, Verbesserungen & Bugfixes kompakt und übersichtlich ankündigen',
    icon: '🚀',
    color: '#1976d2',
    html: `<h1>🚀 Plattform-Update</h1><p>Wir haben wieder fleißig an der Plattform geschraubt und freuen uns, euch die neuesten Verbesserungen vorstellen zu dürfen. Hier ist, was sich getan hat:</p><h2>✨ Neue Features</h2><ul><li><p><strong>Feature-Name</strong> – Beschreibt hier kurz was das neue Feature macht und warum es nützlich ist.</p></li><li><p><strong>Feature-Name</strong> – Kurze, prägnante Beschreibung.</p></li></ul><h2>⚡ Verbesserungen</h2><ul><li><p>Ladezeiten für … deutlich verbessert</p></li><li><p>Benutzeroberfläche der … Seite überarbeitet und modernisiert</p></li></ul><h2>🐛 Bugfixes</h2><ul><li><p>Fehler beim … wurde behoben</p></li><li><p>Problem mit … ist nun gelöst</p></li></ul><blockquote><p>Habt ihr Feedback oder Ideen für neue Features? Nutzt einfach die <strong>Feedback-Funktion</strong> – wir freuen uns über jede Rückmeldung! 💬</p></blockquote><p></p>`,
  },
  {
    id: 'new-feature',
    name: 'Neues Feature',
    description: 'Ein einzelnes Feature mit Schritt-für-Schritt-Anleitung und Links ausführlich vorstellen',
    icon: '🎉',
    color: '#7b1fa2',
    html: `<h1>🎉 Neu: [Feature-Name]</h1><p>Ab sofort steht euch ein neues Feature zur Verfügung – und es wird eure Arbeit auf der Plattform spürbar erleichtern!</p><h2>Was kann es?</h2><p>Erklärt hier in 2–3 Sätzen, was das Feature leistet. Was löst es für ein Problem? Was ist der Mehrwert für den Alltag im Verein?</p><h2>So nutzt ihr es</h2><ol><li><p><strong>Schritt 1</strong> – Navigiert zu … (z. B. Spielerverwaltung)</p></li><li><p><strong>Schritt 2</strong> – Klickt auf …</p></li><li><p><strong>Schritt 3</strong> – Fertig! 🎯</p></li></ol><hr><p>👉 <a href="#">Direkt zum Feature öffnen</a> · <a href="#">Mehr Infos in der Dokumentation</a></p>`,
  },
  {
    id: 'match-preview',
    name: 'Spielankündigung',
    description: 'Kommendes Spiel mit Datum, Ort und Vorschau ankündigen',
    icon: '⚽',
    color: '#2e7d32',
    html: `<h1>⚽ Spielankündigung: [Heim] vs. [Gast]</h1><p><strong>📅 Datum:</strong> TT.MM.JJJJ &nbsp;·&nbsp; <strong>🕐 Uhrzeit:</strong> HH:MM Uhr &nbsp;·&nbsp; <strong>📍 Ort:</strong> Sportplatz …</p><hr><h2>Vorschau</h2><p>Freitext zur Spielvorschau: aktuelle Form, letztes Aufeinandertreffen, Ausfallliste, Motivation, etc.</p><h2>Aufstellung &amp; Kader</h2><p>Hier könnt ihr einen Hinweis auf die voraussichtliche Aufstellung oder wichtige Personalien geben.</p><blockquote><p>💪 Wir freuen uns auf eure Unterstützung! Kommt zahlreich und macht Lärm!</p></blockquote><p></p>`,
  },
  {
    id: 'match-report',
    name: 'Spielbericht',
    description: 'Spielergebnis, Torschützen, Stimmen und Ausblick festhalten',
    icon: '🏆',
    color: '#e65100',
    html: `<h1>⚽ Spielbericht: [Heim] 3:1 [Gast]</h1><p>Spieltag X · Liga · TT.MM.JJJJ</p><hr><h2>Spielverlauf</h2><p>Beschreibt hier den Verlauf der Partie. Was war der Schlüsselmoment? Wie entwickelte sich das Spiel? Welche Phasen gab es?</p><h2>🥅 Torschützen</h2><ul><li><p><strong>Name</strong> – Minute' (Torvorlage: Name)</p></li><li><p><strong>Name</strong> – Minute'</p></li><li><p><strong>Name</strong> – Minute' (Elfmeter)</p></li></ul><h2>Stimmen zum Spiel</h2><blockquote><p>„Zitat des Trainers oder Spielers zum Spiel." – <strong>Name</strong>, Trainer/Spieler</p></blockquote><p></p><h2>Ausblick</h2><p>Nächstes Spiel: <strong>[Gegner]</strong> am TT.MM. um HH:MM Uhr in/bei [Location].</p>`,
  },
  {
    id: 'announcement',
    name: 'Vereinsankündigung',
    description: 'Allgemeine Ankündigung mit Eckdaten, Details und Kontakthinweis',
    icon: '📣',
    color: '#0288d1',
    html: `<h1>📣 [Titel der Ankündigung]</h1><p>Einleitungstext zur Ankündigung. Ein bis zwei Sätze, die das Wichtigste auf den Punkt bringen und zum Weiterlesen animieren.</p><h2>Eckdaten auf einen Blick</h2><ul><li><p><strong>Was:</strong> …</p></li><li><p><strong>Wann:</strong> TT.MM.JJJJ, HH:MM Uhr</p></li><li><p><strong>Wo:</strong> …</p></li><li><p><strong>Für wen:</strong> Alle Mitglieder / Spieler / Trainer</p></li></ul><p>Weiterer Text mit Details, Hintergrundinformationen oder wichtigen Hinweisen zur Ankündigung.</p><blockquote><p>Bei Fragen stehen wir euch jederzeit gerne zur Verfügung. Meldet euch einfach!</p></blockquote><p></p>`,
  },
  {
    id: 'tournament',
    name: 'Turnier',
    description: 'Turnier ankündigen oder Ergebnisse und Impressionen berichten',
    icon: '🥇',
    color: '#f57f17',
    html: `<h1>🥇 Turnier: [Name des Turniers]</h1><p><strong>📅 Datum:</strong> TT.MM.JJJJ &nbsp;·&nbsp; <strong>📍 Ort:</strong> Sportstätte, Stadt</p><hr><h2>Über das Turnier</h2><p>Beschreibt hier das Turnier: Format, teilnehmende Teams, Modus, Besonderheiten.</p><h2>Unsere Mannschaft</h2><p>Wer nimmt für uns teil? Welche Erwartungen haben wir? Welches Ziel verfolgen wir?</p><h2>Ergebnisse</h2><ul><li><p>Gruppenphase: <strong>X Siege, Y Unentschieden, Z Niederlagen</strong></p></li><li><p>Finale: <strong>Unser Team vs. Gegner – Ergebnis</strong></p></li></ul><blockquote><p>Ein herzliches Dankeschön an alle, die dabei waren und uns unterstützt haben! 🙌</p></blockquote><p></p>`,
  },
  {
    id: 'feature-spotlight',
    name: 'Feature Spotlight',
    description: 'Ein Feature mit Bild, Schritt-für-Schritt-Erklärung und Direktlink vorstellen',
    icon: '🖼️',
    color: '#0288d1',
    html: `<h1>✨ Feature Spotlight: [Name]</h1><p>Ein Satz, der das neue Feature auf den Punkt bringt und neugierig macht – was ist es, und warum wurde es gebaut?</p><blockquote><p>📸 <strong>Screenshot hier einfügen</strong> – zeigt das Feature in Aktion. Empfehlung: Größe <strong>Mittel (55 %)</strong> für einen ausgewogenen Look.</p></blockquote><p></p><h2>Was kann es?</h2><p>Erklärt in 2–3 Sätzen den Mehrwert: Welches Problem löst es? Was spart es euch? Worüber müsst ihr euch ab jetzt keine Gedanken mehr machen?</p><h2>So nutzt ihr es</h2><ol><li><p><strong>Schritt 1</strong> – Navigiert zu … (z. B. Spielerverwaltung → Aufstellungen)</p></li><li><p><strong>Schritt 2</strong> – Klickt auf …</p></li><li><p><strong>Schritt 3</strong> – Fertig – das war's! 🎯</p></li></ol><hr><p>👉 <a href="#">Direkt zum Feature öffnen</a> &nbsp;·&nbsp; <a href="#">Mehr in der Dokumentation</a></p>`,
  },
  {
    id: 'update-with-images',
    name: 'Update mit Bildern',
    description: 'Changelog-Stil: Highlight-Feature mit Screenshot, Verbesserungen und Bugfixes',
    icon: '📸',
    color: '#6a1b9a',
    html: `<h1>🆕 Was ist neu – [Version / Datum]</h1><p>Kurze Einleitung: Was waren die Schwerpunkte dieses Updates? Was freut uns besonders?</p><h2>✨ Das Highlight</h2><p>Beschreibt das wichtigste neue Feature in einem Absatz. Was kann es? Warum ist es ein echter Mehrwert?</p><blockquote><p>📸 <strong>Screenshot hier einfügen</strong> – zeigt, wie das Feature konkret aussieht. Empfehlung: Größe <strong>Groß (80 %)</strong>.</p></blockquote><p></p><h2>⚡ Weitere Verbesserungen</h2><ul><li><p><strong>Verbesserung 1</strong> – Kurze Beschreibung</p></li><li><p><strong>Verbesserung 2</strong> – Kurze Beschreibung</p></li></ul><blockquote><p>📸 <strong>Weiteres Bild einfügen</strong> – optional, z. B. Vorher/Nachher. Empfehlung: Größe <strong>Mittel (55 %)</strong>.</p></blockquote><p></p><h2>🐛 Bugfixes</h2><ul><li><p>Fehler beim … wurde behoben</p></li><li><p>Problem mit … ist nun gelöst</p></li></ul><blockquote><p>Habt ihr Feedback oder Ideen? Schreibt uns über die <strong>Feedback-Funktion</strong> in der App! 💬</p></blockquote><p></p>`,
  },
];
