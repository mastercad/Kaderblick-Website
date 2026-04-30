<?php

namespace App\DataFixtures\MasterData;

use App\Entity\KnowledgeBaseCategory;
use App\Entity\KnowledgeBasePost;
use App\Entity\KnowledgeBasePostMedia;
use App\Entity\KnowledgeBaseTag;
use App\Entity\User;
use App\Service\MediaUrlParserService;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Globale Wissensartikel (team = null) für alle Kategorien.
 *
 * Inhalte sind echte, fachlich fundierte Fußball-Wissensartikel
 * mit eingebetteten YouTube-Videos und externen Quellen.
 *
 * Gruppe: master
 */
class KnowledgeBasePostFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    public function __construct(private readonly MediaUrlParserService $urlParser)
    {
    }

    public static function getGroups(): array
    {
        return ['master'];
    }

    public function getDependencies(): array
    {
        return [
            KnowledgeBaseCategoryFixtures::class,
            KnowledgeBaseTagFixtures::class,
            UserFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        /** @var User|null $author */
        $author = $manager->getRepository(User::class)->findOneBy(['email' => 'andreas.kempe@kaderblick.de']);
        if (null === $author) {
            return;
        }

        // Idempotenz: nichts tun wenn bereits Artikel ohne Team vorhanden
        $existing = $manager->getRepository(KnowledgeBasePost::class)->findOneBy(['team' => null]);
        if (null !== $existing) {
            return;
        }

        /**
         * Kategorieindizes:
         *   0 = Taktik | 1 = Training | 2 = Spielanalyse | 3 = Athletik & Fitness
         *   4 = Ernährung | 5 = Mentales Training | 6 = Verletzung & Reha
         *   7 = Regelkunde | 8 = Videoanalyse | 9 = Kommunikation
         *
         * Tag-Indizes:
         *   0=Pressing | 1=Gegenpressing | 2=Ballbesitz | 3=Konter | 4=Umschaltspiel
         *   5=Standards | 6=Eckbälle | 7=Freistöße | 8=Raumdeckung | 9=Manndeckung
         *   12=4-3-3 | 13=4-4-2 | 14=3-5-2 | 15=4-2-3-1 | 16=5-3-2
         *   17=Aufwärmen | 18=Kraft | 19=Ausdauer | 20=Sprint | 21=Koordination
         *   22=Dehnen | 23=Regeneration | 24=Torschuss | 25=Dribbling
         *   26=Flanken | 27=Kopfball | 28=Passspiel | 29=Ballkontrolle
         *   30=Ernährung | 31=Hydration | 32=Schlaf | 33=Verletzungsprävention
         *   34=Motivation | 35=Konzentration | 36=Teamgeist | 37=Führung
         *
         * mediaLinks: ['url', 'label', 'source'] – source wird in den Inhalt eingebettet
         */
        $articles = [
            // ─── 0: Taktik ─────────────────────────────────────────────────────────
            [
                'categoryRef' => 'knowledge_base_category_0',
                'tagRefs' => ['knowledge_base_tag_0', 'knowledge_base_tag_10', 'knowledge_base_tag_11'],
                'isPinned' => true,
                'title' => 'Pressing – wann, wo und wie',
                'mediaLinks' => [
                    [
                        'url' => 'https://spielverlagerung.de/',
                        'label' => 'Spielverlagerung.de – Taktikanalysen und Trainingsideen',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=AV6V6ie1-sk',
                        'label' => 'Fussballtaktik erklärt: So trainierst du Angriffspressing! (1x1SPORT)',
                    ],
                ],
                'description' => '<h2>Was ist Pressing?</h2>
<p>Pressing bedeutet, den Gegner <strong>aktiv unter Druck zu setzen</strong>, sobald er den Ball hat –
mit dem Ziel, Ballgewinne zu erzwingen oder den Aufbau zu stören. Es gibt drei Varianten:</p>
<ul>
  <li><strong>Hochpressing:</strong> Sofort im letzten Drittel des Gegners anlaufen. Erfordert hohe Laufbereitschaft und klare Auslöser (z.&nbsp;B. Rückpass zum Torwart).</li>
  <li><strong>Mittelfeldpressing:</strong> Druck im Mittelfeld aufbauen, kompakt stehen und auf Ballgewinn im Zentrum setzen.</li>
  <li><strong>Tiefes Pressing:</strong> Eigene Hälfte sichern, Räume schließen, auf Fehler des Gegners warten.</li>
</ul>
<h2>Pressing-Auslöser (Trigger)</h2>
<p>Pressing sollte <strong>nie wahllos</strong> eingesetzt werden. Typische Auslöser:</p>
<ul>
  <li>Schlechte Ballannahme beim Gegner (Ball springt ab)</li>
  <li>Rückpass zum Torwart</li>
  <li>Einwurf in ungünstiger Position</li>
  <li>Fehlpass des Gegners</li>
</ul>
<h2>Die Pressingfalle</h2>
<p>Den Gegner bewusst zur Seitenlinie lenken und dann mit mehreren Spielern gleichzeitig zustellen –
klassisches <strong>Seitenlinienpressing</strong>. Der Gegner hat keine Ausweichmöglichkeit mehr.</p>
<h2>Trainingstipp: Rondo 4:2</h2>
<p>Vier Außenspieler halten den Ball gegen zwei Mittelspieler. Die Innenspieler üben gemeinsames
Anlaufen und Auslöser erkennen. Wichtig: <em>immer zusammen anlaufen, nie einer allein</em>.</p>',
            ],
            [
                'categoryRef' => 'knowledge_base_category_0',
                'tagRefs' => ['knowledge_base_tag_12', 'knowledge_base_tag_15', 'knowledge_base_tag_13'],
                'isPinned' => false,
                'title' => 'Formationen im Überblick: 4-3-3, 4-2-3-1 und 4-4-2',
                'mediaLinks' => [
                    [
                        'url' => 'https://spielverlagerung.de/',
                        'label' => 'Spielverlagerung.de – Formationen und Spielsysteme',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=sejwScgoRoc',
                        'label' => 'Fußball Taktik – Spielsystem 4-3-3 erklärt (Taktikanalyse)',
                    ],
                ],
                'description' => '<h2>4-3-3</h2>
<p><strong>Aufstellung:</strong> 4 Verteidiger – 3 Mittelfeldspieler – 3 Angreifer</p>
<ul>
  <li>✅ Hohes Pressing durch die drei Stürmer</li>
  <li>✅ Breite im Angriff durch Außenstürmer</li>
  <li>⚠️ Anfällig für Konter, wenn Außenstürmer zu weit vorne stehen</li>
</ul>
<p><strong>Geeignet für:</strong> Technisch starke Teams mit ausdauernden Außenstürmern.</p>
<h2>4-2-3-1</h2>
<p><strong>Aufstellung:</strong> 4 Verteidiger – 2 Sechser – 3 offensive Mittelfeldspieler – 1 Stürmer</p>
<ul>
  <li>✅ Doppel-Sechs sichert das Zentrum ab</li>
  <li>✅ Viele Passoptionen im Aufbauspiel</li>
  <li>⚠️ Einsame Spitze braucht Stärke im Rückenhalten</li>
</ul>
<p><strong>Geeignet für:</strong> Erfahrene Teams mit spielstarkem Doppel-Sechs.</p>
<h2>4-4-2 (flach)</h2>
<p><strong>Aufstellung:</strong> 4 Verteidiger – 4 Mittelfeldspieler (flach) – 2 Stürmer</p>
<ul>
  <li>✅ Klare Struktur, leicht zu vermitteln</li>
  <li>✅ Doppelspitze schafft Druck und Anspielstationen</li>
  <li>⚠️ Im Zentrum zahlenmäßig unterlegen gegenüber einem 3er-Mittelfeld</li>
</ul>
<p><strong>Geeignet für:</strong> Teams, die Wert auf Solidität und klare Aufgabenverteilung legen.</p>',
            ],

            // ─── 1: Training ───────────────────────────────────────────────────────
            [
                'categoryRef' => 'knowledge_base_category_1',
                'tagRefs' => ['knowledge_base_tag_17', 'knowledge_base_tag_33'],
                'isPinned' => true,
                'title' => 'FIFA 11+ – Das wissenschaftliche Aufwärmprogramm',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.fifamedicalnetwork.com/lessons/11/',
                        'label' => 'FIFA Medical Network – 11+ Programm (Quelle: FIFA)',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=DiAbszQCwO8',
                        'label' => 'FIFA 11+ Programm – Verletzungsprophylaxe im Fußball (PhysioCoach Matteo)',
                    ],
                ],
                'description' => '<h2>Was ist FIFA 11+?</h2>
<p>FIFA 11+ ist ein <strong>wissenschaftlich entwickeltes Aufwärmprogramm</strong>, das das
Verletzungsrisiko im Fußball nachweislich um bis zu <strong>50 %</strong> senkt.
Es dauert ca. 20 Minuten und ist für alle Altersgruppen geeignet.</p>
<p>Quelle: <em>Soligard et al. (2008), British Medical Journal – randomisierte Kontrollstudie mit über 1.800 Spielerinnen</em></p>
<h2>Die drei Phasen</h2>
<ul>
  <li><strong>Phase 1 – Laufen (8 Übungen):</strong> Lockeres Einlaufen, Hüftöffner, Schulterrotation, Ausfallschritte, Kniehebelauf</li>
  <li><strong>Phase 2 – Kraft, Stabilität, Balance (6 Übungen):</strong> Kniebeugen,
Nordic Hamstring Curls (Verletzungsprävention!), einbeiniges Stehen, seitliche Standfestigkeit</li>
  <li><strong>Phase 3 – Laufen mit Ballkontakt (3 Varianten):</strong> Sprints mit Richtungswechsel, Dribbling, Sprünge</li>
</ul>
<h2>Warum kein statisches Dehnen vor dem Training?</h2>
<p>Statisches Dehnen <em>vor</em> der Belastung senkt kurzfristig die Muskelkraft und
-reaktionsfähigkeit. Es gehört <strong>nach</strong> dem Training oder Spiel.
Vor dem Sport: immer <strong>dynamisches Dehnen</strong> (Bewegung).</p>
<h2>Trainingstipp</h2>
<p>Das Programm ist kostenlos auf der FIFA-Webseite verfügbar. Laminierte Karten für die Kabine oder den Trainingsplatz können als PDF ausgedruckt werden.</p>',
            ],
            [
                'categoryRef' => 'knowledge_base_category_1',
                'tagRefs' => ['knowledge_base_tag_28', 'knowledge_base_tag_29'],
                'isPinned' => false,
                'title' => 'Passspiel trainieren – 4 Übungen für jedes Level',
                'mediaLinks' => [
                    [
                        'url' => 'https://training-service.fussball.de/',
                        'label' => 'DFB Training & Service – Trainingsübungen und Tipps für Trainer',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=-e6CuzobJDA',
                        'label' => 'Rondo Trainingsvariationen am Deutschen Fußball Internat',
                    ],
                ],
                'description' => '<h2>Grundsatz: Passspiel heißt Entscheidungen treffen</h2>
<p>Pässe nur im Stand zu üben bringt wenig. Effektives Passübungen immer mit <strong>Bewegung, Tempo und Entscheidungsdruck</strong> kombinieren.</p>
<h2>Übung 1 – Rhombus-Pass (4 Spieler)</h2>
<p>Vier Hütchen im Rhombus (ca. 10 × 10 m). Spieler A passt zu B und läuft zum nächsten Hütchen. B passt weiter und läuft. Immer nach dem Pass mitlaufen.</p>
<p>🎯 <strong>Ziel:</strong> Passqualität, Bewegung nach dem Pass, Timing</p>
<h2>Übung 2 – Rondo 5:2</h2>
<p>5 Außenspieler halten den Ball gegen 2 Mittelspieler (ca. 10 × 10 m). Wer den Ball verliert, geht in die Mitte.</p>
<ul>
  <li>Variante: max. 2 Kontakte, dann 1 Kontakt</li>
  <li>Wertung: 5 direkte Pässe hintereinander = 1 Punkt</li>
</ul>
<p>🎯 <strong>Ziel:</strong> Passsicherheit unter Druck, Körperposition, Übersicht</p>
<h2>Übung 3 – Kombination 3:0 mit Abschluss</h2>
<p>Drei Spieler kombinieren von der Mittellinie zum Tor (ohne Gegner). Pflicht: mindestens 3 Pässe vor dem Abschluss. Trainer gibt Varianten vor (Doppelpass, Überzahl).</p>
<p>🎯 <strong>Ziel:</strong> Automatismen, Zusammenspiel Stürmer und Mittelfeld</p>
<h2>Übung 4 – 4:4 auf Minitore mit Direktpassbonus</h2>
<p>Normales 4:4 auf kleinem Feld. Direktpass = doppelte Punkte. Stärkt Bewusstsein für schnelles Umschalten.</p>
<p>🎯 <strong>Ziel:</strong> Direktspiel, Umschaltmomente, Entscheidungsschnelligkeit</p>',
            ],

            // ─── 2: Spielanalyse ───────────────────────────────────────────────────
            [
                'categoryRef' => 'knowledge_base_category_2',
                'tagRefs' => ['knowledge_base_tag_4', 'knowledge_base_tag_2'],
                'isPinned' => false,
                'title' => 'Spielanalyse im Amateurbereich – einfach starten',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.coachesvoice.com/',
                        'label' => 'Coaches Voice – Taktik- und Spielanalysen aus Trainerperspektive',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=VEu-Yy6TeW0',
                        'label' => 'Professionelle Spielanalyse mit Coachingstool (Staige)',
                    ],
                ],
                'description' => '<h2>Warum lohnt sich Analyse auch im Amateurfußball?</h2>
<p>Das menschliche Gedächtnis ist selektiv und emotional gefärbt.
<strong>Analyse zeigt, was wirklich passiert ist</strong> – unabhängig vom Spielergebnis oder der Stimmung nach dem Abpfiff.</p>
<h2>Was analysieren?</h2>
<p><strong>Eigene Mannschaft offensiv:</strong></p>
<ul>
  <li>Wie bauen wir auf? Kurz-kurz-lang oder direkt lang?</li>
  <li>Welche Zonen nutzen wir am meisten?</li>
  <li>Wie häufig kommen wir in den Strafraum?</li>
</ul>
<p><strong>Eigene Mannschaft defensiv:</strong></p>
<ul>
  <li>Wo verlieren wir die meisten Bälle?</li>
  <li>Sind wir anfällig nach Standards?</li>
</ul>
<p><strong>Gegner:</strong></p>
<ul>
  <li>Welche Formation spielt der Gegner?</li>
  <li>Gibt es eine bevorzugte Seite beim Aufbau?</li>
  <li>Wer ist der Schlüsselspieler?</li>
</ul>
<h2>Einfache Methoden ohne Software</h2>
<p>📋 <strong>Handnotiz-Analyse:</strong> 5-Strich-Methode für Pässe (links/mitte/rechts), Chancen, Ballverluste.</p>
<p>📱 <strong>Video:</strong> Ein Smartphone auf Stativ reicht. Gemeinsam mit der Mannschaft anschauen – kurze Sequenzen, klare Botschaft.</p>
<h2>Häufige Fehler</h2>
<ul>
  <li>❌ Zu viele Metriken auf einmal → besser: 2–3 Fokuspunkte pro Spiel</li>
  <li>❌ Analyse nicht in Training überführen → Erkenntnisse müssen geübt werden</li>
  <li>❌ Spieler an den Pranger stellen → Analyse soll helfen, nicht beschämen</li>
</ul>',
            ],

            // ─── 3: Athletik & Fitness ─────────────────────────────────────────────
            [
                'categoryRef' => 'knowledge_base_category_3',
                'tagRefs' => ['knowledge_base_tag_18', 'knowledge_base_tag_19', 'knowledge_base_tag_20'],
                'isPinned' => false,
                'title' => 'Athletiktraining für Fußballer – Grundlagen',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=7-xWdlsUzUc',
                        'label' => 'Fußball Athletik Training – Wofür ist es wichtig? (Fitness Motivation Key)',
                    ],
                ],
                'description' => '<h2>Welche Fitness-Komponenten braucht ein Fußballer?</h2>
<p>Fußball ist kein Ausdauersport. Die entscheidenden Komponenten:</p>
<ul>
  <li><strong>Aerobe Ausdauer</strong> – Grundlagenausdauer über 90 Minuten</li>
  <li><strong>Explosivschnelligkeit</strong> – Antritt und Sprint über 5–30 m</li>
  <li><strong>Sprungkraft</strong> – Kopfbälle, Zweikämpfe</li>
  <li><strong>Kraftausdauer</strong> – Zweikämpfe auch in der 85. Minute</li>
  <li><strong>Beweglichkeit</strong> – Verletzungsprävention und Schussreichweite</li>
</ul>
<h2>Sprints im Fußball</h2>
<p>Ein Fußballer läuft pro Spiel ca. 10–13 km, davon nur <strong>1–3 % als Sprint</strong>.
Entscheidend sind <strong>kurze Sprints (5–30 m)</strong> mit schneller Erholung.
Daher: mehr intensive Intervalle, weniger Dauerläufe.</p>
<h2>Nordic Hamstring Curls – die wichtigste Präventionsübung</h2>
<p>Diese Übung reduziert das Risiko von Oberschenkelzerrungen nachweislich um ca. <strong>50 %</strong>.</p>
<p>Ablauf: Spieler kniet auf Matte, Partner hält die Fersen. Langsam nach vorn fallen, auf Händen abbremsen. Schwierigkeitsgrad schrittweise steigern.</p>
<p><em>Quelle: van der Horst et al. (2015), American Journal of Sports Medicine</em></p>
<h2>Trainingseinheit Athletik (60 min)</h2>
<ul>
  <li><strong>Aufwärmen (10 min):</strong> Koordinationsleiter, dynamisches Dehnen</li>
  <li><strong>Kraft (20 min):</strong> Kniebeugen 3×10, Ausfallschritte 3×8, Nordic Hamstrings 3×6</li>
  <li><strong>Schnelligkeit (20 min):</strong> 6× 15 m Antritt, 4× 30 m mit Richtungswechsel</li>
  <li><strong>Cool-down (10 min):</strong> Statisches Dehnen, lockeres Auslaufen</li>
</ul>',
            ],

            // ─── 4: Ernährung ──────────────────────────────────────────────────────
            [
                'categoryRef' => 'knowledge_base_category_4',
                'tagRefs' => ['knowledge_base_tag_30', 'knowledge_base_tag_31'],
                'isPinned' => false,
                'title' => 'Was essen vor, während und nach dem Spiel?',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.dge.de/',
                        'label' => 'Deutsche Gesellschaft für Ernährung – Sportlerernährung und Leistungsoptimierung',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=zQchlO6WFjE',
                        'label' => 'Die PERFEKTE Fußballer-Ernährung (Sascha John)',
                    ],
                ],
                'description' => '<h2>Vor dem Spiel (3–4 Stunden vorher)</h2>
<p>Kohlenhydratreiche, <strong>leicht verdauliche Mahlzeit</strong> – Fett und Ballaststoffe reduzieren:</p>
<ul>
  <li>Nudeln mit Tomatensoße</li>
  <li>Reis mit Hähnchen und Gemüse</li>
  <li>Haferflocken mit Obst</li>
</ul>
<p>⚠️ Kein Experiment mit neuen Lebensmitteln am Spieltag!</p>
<p><strong>1 Stunde vorher:</strong> Kleiner Snack: Banane, Energieriegel, Weißbrot mit Honig.</p>
<p><strong>Trinken:</strong> Mind. 0,5 l in den zwei Stunden vor Anpfiff.</p>
<h2>Halbzeit</h2>
<p>Schnell verwertbare Kohlenhydrate: Orangenscheiben, Banane, Energiegel. Flüssigkeit nicht vergessen.</p>
<h2>Nach dem Spiel (innerhalb 30–60 Minuten)</h2>
<p>Glykogenspeicher auffüllen + Muskelregeneration starten:</p>
<ul>
  <li>Kohlenhydrate + Protein kombinieren: Schokoladenmilch, Joghurt mit Früchten, Vollkornbrot mit Quark</li>
  <li>Flüssigkeit: ca. 1,5 l pro kg Gewichtsverlust (Schweiß)</li>
</ul>
<h2>Alltag – was wirklich zählt</h2>
<ul>
  <li>Viel Gemüse und Obst: Vitamine, Antioxidantien, Mikronährstoffe</li>
  <li>Ausreichend Protein: 1,4–1,7 g pro kg Körpergewicht</li>
  <li>Magnesium und Kalium: wichtig für Muskel- und Nervenfunktion</li>
  <li>Zuckerreiche Getränke liefern leere Kalorien – Cola und Energy Drinks meiden</li>
</ul>
<h2>Häufige Fehler</h2>
<ul>
  <li>❌ Kein Frühstück vor Vormittagsspiel → Leistungsabfall in der zweiten Hälfte</li>
  <li>❌ Fettige Mahlzeit kurz vor Anpfiff → schweres Gefühl im Magen</li>
  <li>❌ Kein Ausgleich des Flüssigkeitsverlusts nach dem Spiel</li>
</ul>',
            ],
            // Aus PlayerTips migriert
            [
                'categoryRef' => 'knowledge_base_category_4',
                'tagRefs' => ['knowledge_base_tag_31'],
                'isPinned' => false,
                'title' => 'Richtig trinken – vor, während und nach dem Spiel',
                'mediaLinks' => [],
                'description' => '<h2>Wann trinken?</h2>
<p>Viele Spieler trinken erst wenn sie durstig sind – das ist zu spät. <strong>Durst bedeutet: du bist bereits leicht dehydriert.</strong></p>
<ul>
  <li><strong>Vor dem Spiel:</strong> 500 ml Wasser 2–3 Stunden vor Anpfiff</li>
  <li><strong>Während des Spiels:</strong> alle 15–20 Min. 150–200 ml, auch wenn keine Pause ist</li>
  <li><strong>Nach dem Spiel:</strong> ca. 1,5 l pro kg verlorenem Körpergewicht (Schweiß)</li>
  <li>Isotonische Getränke helfen bei langen Spielen, Elektrolyte zu ersetzen</li>
  <li><strong>Kein Alkohol</strong> in den ersten Stunden nach dem Spiel – er verzögert die Regeneration erheblich</li>
</ul>
<h2>Muskelkrämpfe – Ursachen und Soforthilfe</h2>
<p>Krämpfe entstehen meist nicht zufällig. Die häufigsten Auslöser:</p>
<ul>
  <li>Flüssigkeitsmangel – zu wenig getrunken vor oder während des Spiels</li>
  <li>Elektrolytmangel – besonders Magnesium, Natrium und Kalium</li>
  <li>Überlastung – Muskeln die zu schnell oder zu lang belastet werden</li>
  <li>Unzureichendes Aufwärmen</li>
  <li>Schlechte Schlafqualität in den Tagen zuvor</li>
</ul>
<p><strong>Soforthilfe bei Krämpfen:</strong> Muskel dehnen (nicht reißen), massieren, trinken (Elektrolytgetränk).</p>
<p><strong>Magnesiumreiche Lebensmittel</strong> gegen Krämpfe: Nüsse, Bananen, Vollkorn, dunkle Schokolade.</p>',
            ],

            // ─── 5: Mentales Training ──────────────────────────────────────────────
            [
                'categoryRef' => 'knowledge_base_category_5',
                'tagRefs' => ['knowledge_base_tag_34', 'knowledge_base_tag_35'],
                'isPinned' => false,
                'title' => 'Nervosität vor dem Spiel – normal und nutzbar',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=tybOi4hjZFQ',
                        'label' => 'Mentale Stärke im Sport – Atemtechniken und Fokus (Sportpsychologie)',
                    ],
                ],
                'description' => '<h2>Das Kribbeln ist normal</h2>
<p>Jeder Spieler kennt das Kribbeln vor dem Anpfiff. Das ist kein Problem –
es ist <strong>Energie, die du nutzen kannst</strong>.
Der Unterschied zwischen Nervosität und Vorfreude liegt oft nur in der Interpretation.</p>
<h2>Konkrete Werkzeuge</h2>
<p><strong>Atemübung 4-6:</strong> 4 Sekunden einatmen, 6 Sekunden ausatmen. Beruhigt das Nervensystem innerhalb weniger Minuten. Ideal in der Kabine vor dem Anpfiff.</p>
<p><strong>Routine:</strong> Immer die gleiche Vorbereitung schafft Sicherheit. Musik, Aufwärmreihenfolge, Rituale – sie helfen, in den Fokus zu kommen.</p>
<p><strong>Fokus auf den Prozess:</strong> Nicht auf das Ergebnis konzentrieren, sondern auf das was du im nächsten Moment tun kannst.</p>
<h2>Mit Fehlern umgehen</h2>
<p>Fehler gehören zum Fußball. Wer nach einem Fehler noch lange grübelt, verliert den Anschluss ans Spiel.</p>
<ul>
  <li><strong>3-Sekunden-Regel:</strong> Kurz ärgern, dann abschütteln und weiter.</li>
  <li>Fehler <em>nach</em> dem Spiel analysieren, nicht <em>während</em>.</li>
  <li>Niemand spielt perfekt – auch Profis nicht.</li>
  <li><strong>Konstanz schlägt Perfektion:</strong> Regelmäßig gut sein ist wertvoller als einmal perfekt.</li>
</ul>
<h2>Umgang mit Niederlagen</h2>
<p>Teams die wachsen, unterscheiden sich oft nicht durch Talent, sondern durch den <strong>Umgang mit Rückschlägen</strong>.</p>
<ul>
  <li>Emotionen direkt nach dem Spiel zulassen – keine sofortige Analyse erzwingen</li>
  <li>Keine öffentliche Kritik an Einzelspielern</li>
  <li>Die Niederlage in Trainingsinhalte überführen (Was hat gefehlt? Was üben wir diese Woche?)</li>
</ul>',
            ],

            // ─── 6: Verletzung & Reha ─────────────────────────────────────────────
            [
                'categoryRef' => 'knowledge_base_category_6',
                'tagRefs' => ['knowledge_base_tag_33'],
                'isPinned' => false,
                'title' => 'Häufige Verletzungen im Fußball und wie man sie vorbeugt',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=uFJc0C9TIRg',
                        'label' => 'Sportverletzungen im Fußball – Prävention und PECH-Regel (Heimat Krankenkasse)',
                    ],
                ],
                'description' => '<h2>Die häufigsten Verletzungen</h2>
<ul>
  <li><strong>Muskelfaserriss (Oberschenkel):</strong> Überlastung, zu wenig Aufwärmen – sehr häufig</li>
  <li><strong>Sprunggelenksverstauchung:</strong> Umknicken im Zweikampf – häufig</li>
  <li><strong>Kreuzbandverletzung:</strong> Drehbewegung, Kontakt – selten, aber schwerwiegend</li>
  <li><strong>Schienbeinkantensyndrom:</strong> Überlastung, harter Untergrund – häufig bei Nachwuchs</li>
</ul>
<h2>PECH-Regel bei akuten Verletzungen</h2>
<ul>
  <li>🔴 <strong>P</strong>ause – Belastung sofort stoppen</li>
  <li>🧊 <strong>E</strong>is – 10–15 Min. kühlen, nie direkt auf die Haut</li>
  <li>🩹 <strong>C</strong>ompression – Kompressionsverband anlegen</li>
  <li>⬆️ <strong>H</strong>ochlagerung – betroffene Extremität hochlagern</li>
</ul>
<p>⚠️ Bei Verdacht auf Knochen- oder Bänderverletzung: sofort zum Arzt.</p>
<h2>Prävention – was wirklich hilft</h2>
<ul>
  <li><strong>FIFA 11+</strong> konsequent durchführen → bis zu 50 % weniger Verletzungen</li>
  <li><strong>Nordic Hamstring Curls</strong> regelmäßig üben → schützt vor Zerrungen</li>
  <li><strong>Regeneration ernst nehmen:</strong> Wer nach einem intensiven Spiel sofort Vollgas trainiert, ist deutlich anfälliger</li>
</ul>
<h2>Rückkehr nach Verletzung</h2>
<p>Zu frühe Rückkehr ist eine der häufigsten Ursachen für Rückfälle.
Faustregel: erst dann wieder volles Training,
wenn <strong>90 % der Kraft und Beweglichkeit</strong> im Vergleich zur gesunden Seite erreicht sind.</p>
<h2>Ausrüstung nicht unterschätzen</h2>
<ul>
  <li>Stollenlänge und -typ an den Untergrund anpassen (kurze Noppen auf Kunstrasen)</li>
  <li>Schienbeinschoner schützen – auch im Training</li>
  <li>Ausgelatschte Sohlen nehmen Stabilität → regelmäßig prüfen</li>
</ul>',
            ],
            // Aus PlayerTips migriert
            [
                'categoryRef' => 'knowledge_base_category_6',
                'tagRefs' => ['knowledge_base_tag_32', 'knowledge_base_tag_23'],
                'isPinned' => false,
                'title' => 'Schlaf und Regeneration – der unterschätzte Leistungsfaktor',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=KRlu8y4KCvU',
                        'label' => 'Schlaf im Profifußball: Wie Regeneration Leistung steigert (VBG)',
                    ],
                ],
                'description' => '<h2>Schlaf ist kein Luxus</h2>
<p>Kein Supplement, kein Training ersetzt guten Schlaf. <strong>Während du schläfst, regenerieren Muskeln und Wachstumshormone werden ausgeschüttet.</strong></p>
<ul>
  <li>7–9 Stunden pro Nacht für Jugendliche und junge Erwachsene</li>
  <li>Regelmäßige Schlafzeiten – auch am Wochenende</li>
  <li>Kein Bildschirm 30–60 Min. vor dem Schlafen (blaues Licht stört Melatonin)</li>
  <li>Kühles, dunkles Zimmer hilft beim Einschlafen</li>
  <li>Schlechter Schlaf vor einem Spiel? Lieber 20 Min. Power-Nap als gar nichts</li>
</ul>
<h2>Cool-down nach dem Spiel</h2>
<p>Was nach dem Abpfiff passiert, ist genauso wichtig wie die Vorbereitung:</p>
<ul>
  <li>5–10 Min. ruhiges Auslaufen (Puls langsam senken)</li>
  <li>Statisches Dehnen: 20–30 Sek. pro Muskelgruppe halten</li>
  <li>Besonders wichtig: Oberschenkel vorne und hinten, Waden, Hüftbeuger</li>
  <li>Faszienrolle bei Verhärtungen sehr effektiv</li>
</ul>
<h2>Übertraining erkennen und vermeiden</h2>
<p>Mehr Training ist nicht automatisch besser. Der Körper braucht <strong>Reiz und Erholung</strong> um sich zu verbessern.</p>
<ul>
  <li>Zeichen von Übertraining: anhaltende Müdigkeit, Leistungsabfall, Schlafstörungen, schlechte Laune</li>
  <li>Mindestens 1–2 Ruhetage pro Woche einplanen</li>
  <li>Intensität und Umfang nie gleichzeitig erhöhen</li>
  <li>Auf den eigenen Körper hören – ein Trainingstag weniger schadet selten</li>
</ul>',
            ],

            // ─── 7: Regelkunde ─────────────────────────────────────────────────────
            [
                'categoryRef' => 'knowledge_base_category_7',
                'tagRefs' => ['knowledge_base_tag_5', 'knowledge_base_tag_6', 'knowledge_base_tag_7'],
                'isPinned' => false,
                'title' => 'Abseitsregel – verständlich erklärt',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.theifab.com/laws/latest/offside/',
                        'label' => 'IFAB Laws of the Game – Regel 11: Abseits (offizielle Quelle)',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=taedkr_IYoM',
                        'label' => 'Abseits einfach erklärt: Das steckt hinter der Abseitsregel (owayo)',
                    ],
                ],
                'description' => '<h2>Grundregel (Regel 11)</h2>
<p>Ein Spieler steht im Abseits, wenn er sich im gegnerischen Spielfeld befindet und
<strong>näher an der gegnerischen Torlinie</strong> steht als der Ball <strong>und</strong>
der vorletzte Gegenspieler (meistens der Torwart zählt mit).</p>
<p>⚠️ <strong>Abseits wird zum Zeitpunkt des Passes bewertet</strong>, nicht wenn der Spieler den Ball annimmt.</p>
<h2>Wann ist Abseits strafbar?</h2>
<p>Abseits allein ist kein Vergehen. Strafbar wird es erst wenn der Spieler ins Spielgeschehen eingreift:</p>
<ul>
  <li>Er berührt den Ball</li>
  <li>Er behindert einen Gegner</li>
  <li>Er beeinflusst das Spiel durch eine Aktion</li>
</ul>
<h2>Kein Abseits bei…</h2>
<ul>
  <li>Einwurf, Eckball oder Abstoß</li>
  <li>Spieler steht in der eigenen Hälfte</li>
  <li>Spieler steht auf gleicher Höhe wie der vorletzte Gegner (gleiche Höhe = kein Abseits)</li>
</ul>
<h2>Standardsituationen</h2>
<p><strong>Freistoß:</strong> Abseitsregel gilt normal. Mindestabstand Mauer: 9,15 m.<br>
<strong>Eckball und Einwurf:</strong> Kein Abseits möglich.<br>
<strong>Elfmeter:</strong> Torwart muss auf Linie stehen bis Ball gespielt ist. Alle anderen: außerhalb des Strafraums, mind. 9,15 m vom Punkt.</p>
<p><em>Quelle: IFAB Laws of the Game 2024/25 – Regel 11 und Regel 13</em></p>',
            ],

            // ─── 8: Videoanalyse ───────────────────────────────────────────────────
            [
                'categoryRef' => 'knowledge_base_category_8',
                'tagRefs' => [],
                'isPinned' => false,
                'title' => 'Videoanalyse im Amateurbereich – Einstieg leicht gemacht',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.hudl.com/products/technique',
                        'label' => 'Hudl Technique – kostenlose App für Zeitlupenanalyse (Quelle: Hudl)',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=unaIDTiYy20',
                        'label' => 'Warum Videoanalyse im Fußball unverzichtbar ist (Coach² Academy)',
                    ],
                ],
                'description' => '<h2>Warum Videoanalyse?</h2>
<p>Das menschliche Gedächtnis ist selektiv.
<strong>Video zeigt was wirklich passiert ist</strong> – unabhängig von Emotionen.
Schon eine einfache Aufnahme hilft, taktische und technische Schwächen zu erkennen.</p>
<h2>Minimale Ausrüstung</h2>
<ul>
  <li>Smartphone + stabiles Stativ (15–20 €)</li>
  <li>Erhöhter Standpunkt (Tribüne, Kabinendach)</li>
  <li>App: Standard-Kamera reicht – oder <strong>Hudl Technique</strong> (kostenlos, mit Zeitlupe)</li>
</ul>
<h2>Was aufnehmen?</h2>
<p><strong>Totalkamera (komplettes Spiel):</strong> Alle Laufwege sichtbar, aber Details schwer erkennbar.<br>
<strong>Gezielte Ausschnitte:</strong> Standards, Pressingsituationen, Aufbau – ideal wenn eine zweite Person filmt.</p>
<h2>Auswertung</h2>
<ul>
  <li>2–3 Fokuspunkte pro Spiel definieren – nicht alles auf einmal anschauen</li>
  <li>Positive Beispiele suchen, nicht nur Fehler zeigen</li>
  <li>Kurze Sequenzen mit der Mannschaft gemeinsam anschauen</li>
  <li>Erkenntnisse in Trainingsübungen überführen</li>
</ul>
<h2>⚠️ Datenschutz-Hinweis</h2>
<p>Werden Videoaufnahmen von Spielern – besonders Minderjährigen – an vereinsfremde Dritte
weitergegeben oder öffentlich veröffentlicht, ist die Einwilligung der Erziehungsberechtigten
erforderlich. Die Weitergabe an das eigene Team oder die gegnerische Mannschaft gilt dabei
nicht als externe Weitergabe. Im Zweifel Vereinsführung und ggf. Datenschutzbeauftragten
konsultieren.</p>',
            ],

            // ─── 9: Kommunikation ──────────────────────────────────────────────────
            [
                'categoryRef' => 'knowledge_base_category_9',
                'tagRefs' => ['knowledge_base_tag_36', 'knowledge_base_tag_37'],
                'isPinned' => false,
                'title' => 'Kommunikation auf und neben dem Platz',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.dfb-akademie.de/',
                        'label' => 'DFB-Akademie – Trainerausbildung, Kommunikation und Führung im Sport',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=vCX5J5A3GxQ',
                        'label' => 'Die perfekte Ansprache – Tipps für Trainer (Stefan Kloppe)',
                    ],
                ],
                'description' => '<h2>Kommunikation ist trainierbar</h2>
<p>Teams, die gut kommunizieren, machen weniger taktische Fehler, reagieren schneller auf Situationen und haben ein stärkeres Zusammengehörigkeitsgefühl.</p>
<h2>Kommunikation im Spiel</h2>
<p><strong>Klare, kurze Rufe:</strong></p>
<ul>
  <li>„Zeit!" – du hast Zeit, kein Druck von hinten</li>
  <li>„Mann!" – Gegner direkt hinter dir</li>
  <li>„Halbe Drehung!" – Gegner von der Seite</li>
  <li>„Linie halten!" – Abseitsposition halten</li>
</ul>
<p><strong>Wer kommuniziert was?</strong></p>
<ul>
  <li>Torwart: Raumkontrolle, Flanken ansagen, Aufbaupositionen</li>
  <li>Innenverteidiger: Abseitslinie, Zweikämpfe verteilen</li>
  <li>Sechser: Laufwege der Stürmer einfordern, Übergaben ansagen</li>
</ul>
<h2>Traineransprache – was wirkt</h2>
<p><strong>Kurz vor dem Spiel:</strong> Max. 3 klare Kernbotschaften. Keine Taktiktafel mit 15 Punkten.</p>
<p><strong>Halbzeit:</strong> 5–7 Minuten, 1–2 taktische Anpassungen, keine Generalabrechnung. Positive Aspekte benennen, dann Verbesserungspunkt.</p>
<p><strong>Nach dem Spiel:</strong> Kurz, emotional fair. Die ausführliche Analyse gehört in die nächste Woche.</p>
<h2>Feedback-Kultur im Team</h2>
<p>Feedback immer auf das <strong>Verhalten</strong> beziehen, nie auf die Person.</p>
<p><strong>Sandwich-Modell:</strong></p>
<ol>
  <li>Positives Feedback</li>
  <li>Konkreter Verbesserungshinweis</li>
  <li>Bestärkung und Vertrauen</li>
</ol>
<h2>Elternkommunikation im Nachwuchs</h2>
<p>Regelmäßige, transparente Kommunikation (z.&nbsp;B. monatliche Info-Nachricht) reduziert Missverständnisse und stärkt das Vertrauen in den Trainer.</p>',
            ],
        ];

        foreach ($articles as $data) {
            /** @var KnowledgeBaseCategory $category */
            $category = $this->getReference($data['categoryRef'], KnowledgeBaseCategory::class);

            $post = new KnowledgeBasePost();
            $post->setTitle($data['title']);
            $post->setDescription($data['description']);
            $post->setCategory($category);
            $post->setCreatedBy($author);
            $post->setIsPinned($data['isPinned']);
            // team = null → globaler Artikel

            foreach ($data['tagRefs'] as $tagRef) {
                /** @var KnowledgeBaseTag $tag */
                $tag = $this->getReference($tagRef, KnowledgeBaseTag::class);
                $post->addTag($tag);
            }

            foreach ($data['mediaLinks'] as $linkData) {
                $parsed = $this->urlParser->parse($linkData['url']);

                $media = new KnowledgeBasePostMedia();
                $media->setUrl($linkData['url']);
                $media->setLabel($linkData['label']);
                $media->setMediaType($parsed['mediaType']);
                $media->setExternalId($parsed['externalId']);
                $media->setThumbnailUrl($parsed['thumbnailUrl']);
                $media->setPost($post);

                $post->addMediaLink($media);
                $manager->persist($media);
            }

            $manager->persist($post);
        }

        $manager->flush();
    }
}
