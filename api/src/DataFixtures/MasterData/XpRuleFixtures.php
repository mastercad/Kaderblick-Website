<?php

declare(strict_types=1);

namespace App\DataFixtures\MasterData;

use App\Entity\XpRule;
use DateTimeImmutable;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class XpRuleFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $defaults = $this->getDefaults();

        foreach ($defaults as $actionType => $def) {
            $rule = $manager->getRepository(XpRule::class)->findOneBy(['actionType' => $actionType]);

            if (null === $rule) {
                $rule = new XpRule();
                $rule->setActionType($actionType);
                $rule->setCreatedAt(new DateTimeImmutable());
                $manager->persist($rule);
            }

            $rule->setLabel($def['label']);
            $rule->setCategory($def['category']);
            $rule->setDescription($def['description'] ?? null);
            $rule->setXpValue($def['xpValue']);
            $rule->setEnabled(true);
            $rule->setIsSystem(true);
            $rule->setCooldownMinutes($def['cooldownMinutes'] ?? 0);
            $rule->setDailyLimit($def['dailyLimit'] ?? null);
            $rule->setMonthlyLimit($def['monthlyLimit'] ?? null);
            $rule->setUpdatedAt(new DateTimeImmutable());
        }

        $manager->flush();
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function getDefaults(): array
    {
        return [
            // ── Platform ────────────────────────────────────────────────────
            'daily_login' => [
                'label' => 'Täglicher Login',
                'category' => 'platform',
                'description' => 'Einmal pro Tag XP für das Einloggen.',
                'xpValue' => 5,
                'cooldownMinutes' => -1,
                'dailyLimit' => 1,
            ],
            'profile_update' => [
                'label' => 'Profil aktualisiert',
                'category' => 'platform',
                'description' => 'Beim Speichern von Profiländerungen (max. 1× täglich).',
                'xpValue' => 5,
                'cooldownMinutes' => 1440,
                'dailyLimit' => 1,
            ],
            'profile_completion_25' => [
                'label' => 'Profilvollständigkeit 25 %',
                'category' => 'platform',
                'description' => 'Einmalig, wenn das Profil erstmals 25 % vollständig ist.',
                'xpValue' => 25,
            ],
            'profile_completion_50' => [
                'label' => 'Profilvollständigkeit 50 %',
                'category' => 'platform',
                'description' => 'Einmalig, wenn das Profil erstmals 50 % vollständig ist.',
                'xpValue' => 50,
            ],
            'profile_completion_75' => [
                'label' => 'Profilvollständigkeit 75 %',
                'category' => 'platform',
                'description' => 'Einmalig, wenn das Profil erstmals 75 % vollständig ist.',
                'xpValue' => 75,
            ],
            'profile_completion_100' => [
                'label' => 'Profilvollständigkeit 100 %',
                'category' => 'platform',
                'description' => 'Einmalig, wenn das Profil zu 100 % vollständig ist.',
                'xpValue' => 100,
            ],
            'survey_completed' => [
                'label' => 'Umfrage ausgefüllt',
                'category' => 'platform',
                'description' => 'Einmalig je Umfrage.',
                'xpValue' => 10,
            ],
            'task_completed' => [
                'label' => 'Aufgabe erledigt',
                'category' => 'platform',
                'description' => 'Einmalig je Aufgabe, max. 10× pro Monat.',
                'xpValue' => 8,
                'monthlyLimit' => 10,
            ],

            // ── Sport ────────────────────────────────────────────────────────
            'calendar_event' => [
                'label' => 'Kalender-Teilnahme bestätigt',
                'category' => 'sport',
                'description' => 'Einmalig je Event, wenn Teilnahme bestätigt wird.',
                'xpValue' => 10,
            ],
            'calendar_event_created' => [
                'label' => 'Kalender-Event angelegt',
                'category' => 'sport',
                'description' => 'Einmalig je Event beim Erstellen.',
                'xpValue' => 5,
            ],
            'training_attended' => [
                'label' => 'Training besucht',
                'category' => 'sport',
                'description' => 'Einmalig je Trainingseinheit nach bestätigter Anwesenheit.',
                'xpValue' => 15,
            ],
            'match_attended' => [
                'label' => 'Spiel bestritten',
                'category' => 'sport',
                'description' => 'Einmalig je Spieltermin nach bestätigter Teilnahme.',
                'xpValue' => 20,
            ],
            'participation_response' => [
                'label' => 'Teilnahme beantwortet',
                'category' => 'sport',
                'description' => 'Einmalig je Event für eine Rückmeldung (Absage, Vielleicht, Verspätet).',
                'xpValue' => 5,
            ],
            'carpool_offered' => [
                'label' => 'Fahrgemeinschaft angeboten',
                'category' => 'sport',
                'description' => 'Einmalig je Fahrtangebot, max. 8× pro Monat.',
                'xpValue' => 5,
                'monthlyLimit' => 8,
            ],
            'game_event' => [
                'label' => 'Spielereignis hinterlegt (generisch)',
                'category' => 'sport',
                'description' => 'Fallback, wenn kein typenspezifischer game_event_type_* Eintrag vorhanden.',
                'xpValue' => 15,
            ],
            'game_event_updated' => [
                'label' => 'Spielereignis angepasst',
                'category' => 'sport',
                'description' => 'Pro angepasstem Event, max. 5× pro Monat, Cooldown 24 h je Ereignis.',
                'xpValue' => 5,
                'cooldownMinutes' => 1440,
                'monthlyLimit' => 5,
            ],
        ];
    }
}
