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
use Twig\Environment;

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
    public function __construct(
        private readonly MediaUrlParserService $urlParser,
        private readonly Environment $twig,
    ) {
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

        $postRepository = $manager->getRepository(KnowledgeBasePost::class);

        foreach ($this->getArticles() as $data) {
            /** @var KnowledgeBaseCategory $category */
            $category = $this->getReference($data['categoryRef'], KnowledgeBaseCategory::class);

            // Upsert: bestehenden Artikel per Titel finden oder neu anlegen
            $post = $postRepository->findOneBy(['title' => $data['title'], 'team' => null]);
            if (null === $post) {
                $post = new KnowledgeBasePost();
                $post->setCreatedBy($author);
            } else {
                // Bestehende Verknüpfungen zurücksetzen (werden unten neu gesetzt)
                $post->getTags()->clear();
                $post->getMediaLinks()->clear();
            }

            $description = $this->twig->render($data['template']);

            $post->setTitle($data['title']);
            $post->setDescription($description);
            $post->setCategory($category);
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

    /**
     * Artikeldefinitionen – Beschreibungen als Twig-Templates.
     *
     * categoryRef / tagRef-Indizes:
     *   Kategorien: 0=Taktik  1=Training  2=Spielanalyse  3=Athletik&Fitness
     *               4=Ernährung  5=Mentales Training  6=Verletzung&Reha
     *               7=Regelkunde  8=Videoanalyse  9=Kommunikation
     *   Tags:       0=Pressing  1=Gegenpressing  2=Ballbesitz  3=Konter
     *               4=Umschaltspiel  5=Standards  6=Eckbälle  7=Freistöße
     *               8=Raumdeckung  9=Manndeckung  12=4-3-3  13=4-4-2  14=3-5-2
     *              15=4-2-3-1  16=5-3-2  17=Aufwärmen  18=Kraft  19=Ausdauer
     *              20=Sprint  21=Koordination  22=Dehnen  23=Regeneration
     *              24=Torschuss  25=Dribbling  26=Flanken  27=Kopfball
     *              28=Passspiel  29=Ballkontrolle  30=Ernährung  31=Hydration
     *              32=Schlaf  33=Verletzungsprävention  34=Motivation
     *              35=Konzentration  36=Teamgeist  37=Führung
     *
     * @return array<int, array{
     *     categoryRef: string,
     *     tagRefs: list<string>,
     *     isPinned: bool,
     *     title: string,
     *     template: string,
     *     mediaLinks: list<array{url: string, label: string}>
     * }>
     */
    private function getArticles(): array
    {
        return [
            // ── Taktik ────────────────────────────────────────────────────────────

            [
                'categoryRef' => 'knowledge_base_category_0',
                'tagRefs' => [
                    'knowledge_base_tag_0',
                    'knowledge_base_tag_10',
                    'knowledge_base_tag_11',
                ],
                'isPinned' => true,
                'title' => 'Pressing – wann, wo und wie',
                'template' => 'knowledge_base/taktik_pressing.html.twig',
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
            ],

            [
                'categoryRef' => 'knowledge_base_category_0',
                'tagRefs' => [
                    'knowledge_base_tag_12',
                    'knowledge_base_tag_15',
                    'knowledge_base_tag_13',
                    'knowledge_base_tag_14',
                    'knowledge_base_tag_16',
                ],
                'isPinned' => false,
                'title' => 'Formationen im Überblick: 4-3-3, 4-2-3-1, 4-4-2, 3-5-2 und 5-3-2',
                'template' => 'knowledge_base/taktik_formationen.html.twig',
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
            ],

            [
                'categoryRef' => 'knowledge_base_category_0',
                'tagRefs' => ['knowledge_base_tag_1'],
                'isPinned' => false,
                'title' => 'Gegenpressing – nach Ballverlust sofort angreifen',
                'template' => 'knowledge_base/taktik_gegenpressing.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://spielverlagerung.de/',
                        'label' => 'Spielverlagerung.de – Gegenpressing und Pressing-Konzepte',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=LQVOQTA7ZaQ',
                        'label' => 'Gegenpressing einfach erklärt – Fußball Taktik Kurzvideo (Taktikanalyse)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_0',
                'tagRefs' => ['knowledge_base_tag_3', 'knowledge_base_tag_4'],
                'isPinned' => false,
                'title' => 'Umschaltspiel – Konter und defensives Umschalten',
                'template' => 'knowledge_base/taktik_umschaltspiel.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=x0uYr8Uytv8',
                        'label' => 'Umschaltspiel und Torabschluss – 6 gegen 6 mit Zeitdruck (1x1SPORT)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_0',
                'tagRefs' => ['knowledge_base_tag_2'],
                'isPinned' => false,
                'title' => 'Ballbesitzspiel – Dreiecke, Breite und Tiefe',
                'template' => 'knowledge_base/taktik_ballbesitz.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://spielverlagerung.de/',
                        'label' => 'Spielverlagerung.de – Ballbesitz und Positionsspiel',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=ZYUSp3VCff0',
                        'label' => 'Das taktische Geheimnis von Pep Guardiola – Ballbesitz erklärt (Meister Touch)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_0',
                'tagRefs' => ['knowledge_base_tag_8', 'knowledge_base_tag_9'],
                'isPinned' => false,
                'title' => 'Raumdeckung vs. Manndeckung – was ist besser?',
                'template' => 'knowledge_base/taktik_deckung.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=-gDYwooJb_4',
                        'label' => 'Raumdeckung vs. Manndeckung – der Unterschied erklärt (CoTrainer)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_0',
                'tagRefs' => [
                    'knowledge_base_tag_5',
                    'knowledge_base_tag_6',
                    'knowledge_base_tag_7',
                ],
                'isPinned' => false,
                'title' => 'Standards – Ecken, Freistöße und Einwürfe effektiv nutzen',
                'template' => 'knowledge_base/taktik_standards.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=B48UcDrJLLo',
                        'label' => 'Standardsituationen Fußball – Ecken effektiv trainieren (IFJ96)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_0',
                'tagRefs' => ['knowledge_base_tag_3', 'knowledge_base_tag_25'],
                'isPinned' => false,
                'title' => '2 gegen 2 – Kooperation im Zweikampf',
                'template' => 'knowledge_base/taktik_2gegen2.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://training-service.fussball.de/',
                        'label' => 'DFB Training & Service – Trainingsübungen für alle Altersgruppen',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=N0qnbI86gxs',
                        'label' => '2 gegen 2 auf 4 gegen 4 – Umschaltspiel offensiv und defensiv (Fussballtrainer Stolzenberger)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_0',
                'tagRefs' => ['knowledge_base_tag_2', 'knowledge_base_tag_0'],
                'isPinned' => false,
                'title' => 'Aufbau aus der Defensive – kontrolliert aus der eigenen Hälfte',
                'template' => 'knowledge_base/taktik_aufbau_defensiv.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=34ERjd5P-5k',
                        'label' => 'Spielaufbau über Außenverteidiger und zwei Sechser (MLCoaching)',
                    ],
                ],
            ],

            // ── Training ──────────────────────────────────────────────────────────

            [
                'categoryRef' => 'knowledge_base_category_1',
                'tagRefs' => ['knowledge_base_tag_17', 'knowledge_base_tag_33'],
                'isPinned' => true,
                'title' => 'FIFA 11+ – Das wissenschaftliche Aufwärmprogramm',
                'template' => 'knowledge_base/training_fifa11plus.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.dfb-akademie.de/medizin/-/id-11008482',
                        'label' => 'DFB-Akademie Medizin – Verletzungsprävention und 11+ Programm',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=DiAbszQCwO8',
                        'label' => 'FIFA 11+ Programm – Verletzungsprophylaxe im Fußball (PhysioCoach Matteo)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_1',
                'tagRefs' => ['knowledge_base_tag_28', 'knowledge_base_tag_29'],
                'isPinned' => false,
                'title' => 'Passspiel trainieren – 5 Übungen für jedes Level',
                'template' => 'knowledge_base/training_passspiel.html.twig',
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
            ],

            [
                'categoryRef' => 'knowledge_base_category_1',
                'tagRefs' => ['knowledge_base_tag_25', 'knowledge_base_tag_29'],
                'isPinned' => false,
                'title' => 'Dribbling und Finten – von der Schritttäuschung zum Cruyff-Turn',
                'template' => 'knowledge_base/training_dribbling.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://training-service.fussball.de/',
                        'label' => 'DFB Training & Service – Dribbling und Technik',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=ME_Ib678Y2Q',
                        'label' => 'Finten für Anfänger – Körpertäuschungen im Dribbling (All About Football)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_1',
                'tagRefs' => ['knowledge_base_tag_24', 'knowledge_base_tag_27'],
                'isPinned' => false,
                'title' => 'Torschuss – Technik, Schussarten und Trainingsübungen',
                'template' => 'knowledge_base/training_torschuss.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://training-service.fussball.de/',
                        'label' => 'DFB Training & Service – Torschusstraining und Abschluss',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=89ZJiDRiSlQ',
                        'label' => '5 Schusstechniken für mehr Tore – Torschuss verbessern (All About Football)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_1',
                'tagRefs' => ['knowledge_base_tag_37'],
                'isPinned' => false,
                'title' => 'Torwarttraining – Grundlagen für Keeper aller Altersgruppen',
                'template' => 'knowledge_base/training_torwart.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://training-service.fussball.de/',
                        'label' => 'DFB Training & Service – Torwarttraining und Übungen',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=9Yxh3a3PvZM',
                        'label' => 'Torwarttraining: Erlernen der Grundlagen des Fangens (Deutsches Fußball Internat)',
                    ],
                ],
            ],

            // ── Spielanalyse ──────────────────────────────────────────────────────

            [
                'categoryRef' => 'knowledge_base_category_2',
                'tagRefs' => ['knowledge_base_tag_4', 'knowledge_base_tag_2'],
                'isPinned' => false,
                'title' => 'Spielanalyse im Amateurbereich – einfach starten',
                'template' => 'knowledge_base/analyse_einstieg.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://learning.coachesvoice.com/',
                        'label' => 'Coaches Voice – Taktik- und Spielanalysen aus Trainerperspektive',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=VEu-Yy6TeW0',
                        'label' => 'Professionelle Spielanalyse mit Coachingstool (Staige)',
                    ],
                ],
            ],

            // ── Athletik & Fitness ────────────────────────────────────────────────

            [
                'categoryRef' => 'knowledge_base_category_3',
                'tagRefs' => [
                    'knowledge_base_tag_18',
                    'knowledge_base_tag_19',
                    'knowledge_base_tag_20',
                ],
                'isPinned' => false,
                'title' => 'Athletiktraining für Fußballer – Grundlagen',
                'template' => 'knowledge_base/athletik_grundlagen.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=7-xWdlsUzUc',
                        'label' => 'Fußball Athletik Training – Wofür ist es wichtig? (Fitness Motivation Key)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_3',
                'tagRefs' => ['knowledge_base_tag_21'],
                'isPinned' => false,
                'title' => 'Koordinationstraining – die sieben koordinativen Fähigkeiten',
                'template' => 'knowledge_base/athletik_koordination.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://training-service.fussball.de/',
                        'label' => 'DFB Training & Service – Koordination und Bewegungsschulung',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=HDLckxJGlBU',
                        'label' => '15 Übungen mit der Koordinationsleiter – Fußballtraining (Eddie Lucenka)',
                    ],
                ],
            ],

            // ── Ernährung ─────────────────────────────────────────────────────────

            [
                'categoryRef' => 'knowledge_base_category_4',
                'tagRefs' => ['knowledge_base_tag_30', 'knowledge_base_tag_31'],
                'isPinned' => false,
                'title' => 'Was essen vor, während und nach dem Spiel?',
                'template' => 'knowledge_base/ernaehrung_spieltag.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.dge.de/',
                        'label' => 'Deutsche Gesellschaft für Ernährung – Sportlerernährung',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=zQchlO6WFjE',
                        'label' => 'Die PERFEKTE Fußballer-Ernährung (Sascha John)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_4',
                'tagRefs' => ['knowledge_base_tag_31'],
                'isPinned' => false,
                'title' => 'Richtig trinken – vor, während und nach dem Spiel',
                'template' => 'knowledge_base/ernaehrung_hydration.html.twig',
                'mediaLinks' => [],
            ],

            // ── Mentales Training ─────────────────────────────────────────────────

            [
                'categoryRef' => 'knowledge_base_category_5',
                'tagRefs' => ['knowledge_base_tag_34', 'knowledge_base_tag_35'],
                'isPinned' => false,
                'title' => 'Nervosität vor dem Spiel – normal und nutzbar',
                'template' => 'knowledge_base/mental_nervositaet.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=Kwh7LAZZ4_0',
                        'label' => 'Nervosität auf dem Platz verlieren – Mentaltraining für Fußballer (Football Leverage)',
                    ],
                ],
            ],

            // ── Verletzung & Reha ─────────────────────────────────────────────────

            [
                'categoryRef' => 'knowledge_base_category_6',
                'tagRefs' => ['knowledge_base_tag_33'],
                'isPinned' => false,
                'title' => 'Häufige Verletzungen im Fußball und wie man sie vorbeugt',
                'template' => 'knowledge_base/reha_verletzungspraevention.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=uFJc0C9TIRg',
                        'label' => 'Sportverletzungen im Fußball – Prävention und PECH-Regel (Heimat Krankenkasse)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_6',
                'tagRefs' => ['knowledge_base_tag_32', 'knowledge_base_tag_23'],
                'isPinned' => false,
                'title' => 'Schlaf und Regeneration – der unterschätzte Leistungsfaktor',
                'template' => 'knowledge_base/reha_schlaf_regeneration.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=KRlu8y4KCvU',
                        'label' => 'Schlaf im Profifußball – wie Regeneration Leistung steigert (VBG)',
                    ],
                ],
            ],

            // ── Regelkunde ────────────────────────────────────────────────────────

            [
                'categoryRef' => 'knowledge_base_category_7',
                'tagRefs' => [
                    'knowledge_base_tag_5',
                    'knowledge_base_tag_6',
                    'knowledge_base_tag_7',
                ],
                'isPinned' => false,
                'title' => 'Abseitsregel – verständlich erklärt',
                'template' => 'knowledge_base/regelkunde_abseits.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.theifab.com/laws/latest/offside/',
                        'label' => 'IFAB Laws of the Game – Regel 11: Abseits (offizielle Quelle)',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=taedkr_IYoM',
                        'label' => 'Abseits einfach erklärt – das steckt hinter der Abseitsregel (owayo)',
                    ],
                ],
            ],

            [
                'categoryRef' => 'knowledge_base_category_7',
                'tagRefs' => ['knowledge_base_tag_5'],
                'isPinned' => false,
                'title' => 'Fouls, Karten und besondere Spielsituationen – Regelkunde kompakt',
                'template' => 'knowledge_base/regelkunde_fouls_karten.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.theifab.com/laws/latest/fouls-and-misconduct/',
                        'label' => 'IFAB Laws of the Game – Regel 12: Fouls und Unsportlichkeit',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=NNLanzaAUfU',
                        'label' => 'Fußball-Regeln kompakt – Fouls und Karten erklärt (Die Sportlehrer)',
                    ],
                ],
            ],

            // ── Videoanalyse ──────────────────────────────────────────────────────

            [
                'categoryRef' => 'knowledge_base_category_8',
                'tagRefs' => [],
                'isPinned' => false,
                'title' => 'Videoanalyse im Amateurbereich – Einstieg leicht gemacht',
                'template' => 'knowledge_base/video_einstieg.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.youtube.com/watch?v=unaIDTiYy20',
                        'label' => 'Warum Videoanalyse im Fußball unverzichtbar ist (Coach² Academy)',
                    ],
                ],
            ],

            // ── Kommunikation ─────────────────────────────────────────────────────

            [
                'categoryRef' => 'knowledge_base_category_9',
                'tagRefs' => ['knowledge_base_tag_36', 'knowledge_base_tag_37'],
                'isPinned' => false,
                'title' => 'Kommunikation auf und neben dem Platz',
                'template' => 'knowledge_base/kommunikation_team.html.twig',
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
            ],

            [
                'categoryRef' => 'knowledge_base_category_9',
                'tagRefs' => [
                    'knowledge_base_tag_36',
                    'knowledge_base_tag_37',
                    'knowledge_base_tag_34',
                ],
                'isPinned' => false,
                'title' => 'Saisonplanung und Teamorganisation für Amateurtrainer',
                'template' => 'knowledge_base/organisation_saisonplanung.html.twig',
                'mediaLinks' => [
                    [
                        'url' => 'https://www.dfb-akademie.de/',
                        'label' => 'DFB-Akademie – Trainerausbildung und Organisationskompetenz',
                    ],
                    [
                        'url' => 'https://www.youtube.com/watch?v=8wLJSowX2P8',
                        'label' => 'Der perfekte Fußball-Trainingsplan – Belastungssteuerung für die Saison (Sascha John)',
                    ],
                ],
            ],
        ];
    }
}
