<?php

namespace App\DataFixtures\MasterData;

use App\Entity\GameEventType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class GameEventTypeFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $eventTypes = [
            // 1. Grundlegende Ballaktionen
            ['name' => 'Normaler Pass', 'code' => 'pass_normal', 'color' => '#007bff', 'icon' => 'fas fa-arrows-alt-h', 'isSystem' => true],
            ['name' => 'Steilpass', 'code' => 'pass_through', 'color' => '#007bff', 'icon' => 'fas fa-long-arrow-alt-right', 'isSystem' => true],
            ['name' => 'Flanke', 'code' => 'cross', 'color' => '#007bff', 'icon' => 'fas fa-share', 'isSystem' => true],
            ['name' => 'Rückpass', 'code' => 'pass_back', 'color' => '#007bff', 'icon' => 'fas fa-undo', 'isSystem' => true],
            ['name' => 'Querpass', 'code' => 'pass_sideways', 'color' => '#007bff', 'icon' => 'fas fa-exchange-alt', 'isSystem' => true],
            ['name' => 'Chipball / Lupfer', 'code' => 'chip_ball', 'color' => '#007bff', 'icon' => 'fas fa-arrow-up', 'isSystem' => true],
            ['name' => 'Schnittstellenpass', 'code' => 'pass_cut', 'color' => '#007bff', 'icon' => 'fas fa-cut', 'isSystem' => true],
            ['name' => 'Langer Ball', 'code' => 'long_ball', 'color' => '#007bff', 'icon' => 'fas fa-long-arrow-alt-up', 'isSystem' => true],
            ['name' => 'Verlagerung', 'code' => 'switch_play', 'color' => '#007bff', 'icon' => 'fas fa-random', 'isSystem' => true],
            ['name' => 'Kopfballpass', 'code' => 'header_pass', 'color' => '#007bff', 'icon' => 'fas fa-arrow-circle-up', 'isSystem' => true],
            ['name' => 'Einwurf (als Pass)', 'code' => 'throw_in_pass', 'color' => '#007bff', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],
            ['name' => 'Ballannahme', 'code' => 'ball_control', 'color' => '#6c757d', 'icon' => 'fas fa-hand-rock', 'isSystem' => true],
            ['name' => 'Misslungene Ballkontrolle', 'code' => 'bad_control', 'color' => '#6c757d', 'icon' => 'fas fa-times-circle', 'isSystem' => true],
            ['name' => 'Erster Kontakt', 'code' => 'first_touch', 'color' => '#6c757d', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'Ballverlust (unforced)', 'code' => 'ball_loss_unforced', 'color' => '#dc3545', 'icon' => 'fas fa-minus-circle', 'isSystem' => true],
            ['name' => 'Ballverlust (forced)', 'code' => 'ball_loss_forced', 'color' => '#dc3545', 'icon' => 'fas fa-bolt', 'isSystem' => true],
            ['name' => 'Ballgewinn', 'code' => 'ball_win', 'color' => '#28a745', 'icon' => 'fas fa-plus-circle', 'isSystem' => true],
            ['name' => 'Erfolgreiches Dribbling', 'code' => 'dribble_success', 'color' => '#17a2b8', 'icon' => 'fas fa-running', 'isSystem' => true],
            ['name' => 'Misslungenes Dribbling', 'code' => 'dribble_fail', 'color' => '#dc3545', 'icon' => 'fas fa-running', 'isSystem' => true],

            // 2. Torschüsse
            ['name' => 'Schuss aufs Tor', 'code' => 'shot_on_target', 'color' => '#28a745', 'icon' => 'fas fa-bullseye', 'isSystem' => true],
            ['name' => 'Schuss neben das Tor', 'code' => 'shot_off_target', 'color' => '#ffc107', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'Geblockter Schuss', 'code' => 'shot_blocked', 'color' => '#6c757d', 'icon' => 'fas fa-ban', 'isSystem' => true],
            ['name' => 'Kopfball aufs Tor', 'code' => 'header_on_target', 'color' => '#28a745', 'icon' => 'fas fa-arrow-circle-up', 'isSystem' => true],
            ['name' => 'Kopfball daneben', 'code' => 'header_off_target', 'color' => '#ffc107', 'icon' => 'fas fa-arrow-circle-up', 'isSystem' => true],
            ['name' => 'Distanzschuss', 'code' => 'long_shot', 'color' => '#17a2b8', 'icon' => 'fas fa-bullseye', 'isSystem' => true],
            ['name' => 'Volley / Halbvolley', 'code' => 'volley', 'color' => '#17a2b8', 'icon' => 'fas fa-bolt', 'isSystem' => true],
            ['name' => 'Fallrückzieher / Seitfallzieher', 'code' => 'bicycle_kick', 'color' => '#17a2b8', 'icon' => 'fas fa-bolt', 'isSystem' => true],
            ['name' => 'Schuss an Pfosten', 'code' => 'shot_post', 'color' => '#fd7e14', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'Schuss an Latte', 'code' => 'shot_bar', 'color' => '#fd7e14', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'Eigentor-Versuch', 'code' => 'own_goal_attempt', 'color' => '#dc3545', 'icon' => 'fas fa-futbol', 'isSystem' => true],
            ['name' => 'Eigentor', 'code' => 'own_goal', 'color' => '#dc3545', 'icon' => 'fas fa-futbol', 'isSystem' => true],

            // 3. Tore
            ['name' => 'Tor', 'code' => 'goal', 'color' => '#28a745', 'icon' => 'fas fa-futbol', 'isSystem' => true],
            ['name' => 'Abseitstor', 'code' => 'offside_goal', 'color' => '#6c757d', 'icon' => 'fas fa-futbol', 'isSystem' => true],
            ['name' => 'Strafstoßtor', 'code' => 'penalty_goal', 'color' => '#28a745', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'Freistoßtor', 'code' => 'freekick_goal', 'color' => '#28a745', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'Kopfballtor', 'code' => 'header_goal', 'color' => '#28a745', 'icon' => 'fas fa-arrow-circle-up', 'isSystem' => true],
            // Torvorlage/Assist
            ['name' => 'Torvorlage', 'code' => 'assist', 'color' => '#20c997', 'icon' => 'fas fa-hands-helping', 'isSystem' => true],
            ['name' => 'Tor nach Ecke', 'code' => 'corner_goal', 'color' => '#28a745', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'Tor nach Flanke', 'code' => 'cross_goal', 'color' => '#28a745', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'Tor nach Konter', 'code' => 'counter_goal', 'color' => '#28a745', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'Tor nach Pressinggewinn', 'code' => 'pressing_goal', 'color' => '#28a745', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'VAR-bestätigtes Tor', 'code' => 'var_goal_confirmed', 'color' => '#20c997', 'icon' => 'fas fa-check', 'isSystem' => true],
            ['name' => 'VAR-abgelehntes Tor', 'code' => 'var_goal_denied', 'color' => '#dc3545', 'icon' => 'fas fa-times', 'isSystem' => true],

            // 4. Torhüteraktionen
            ['name' => 'Parade', 'code' => 'save', 'color' => '#17a2b8', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],
            ['name' => 'Herauslaufen', 'code' => 'keeper_rush', 'color' => '#17a2b8', 'icon' => 'fas fa-running', 'isSystem' => true],
            ['name' => 'Abpraller verursacht', 'code' => 'keeper_rebound', 'color' => '#ffc107', 'icon' => 'fas fa-exclamation', 'isSystem' => true],
            ['name' => 'Abschlag', 'code' => 'keeper_throw', 'color' => '#007bff', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],
            ['name' => 'Fausten', 'code' => 'keeper_punch', 'color' => '#17a2b8', 'icon' => 'fas fa-hand-rock', 'isSystem' => true],
            ['name' => 'Halten', 'code' => 'keeper_hold', 'color' => '#17a2b8', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],
            ['name' => 'Torwartdribbling', 'code' => 'keeper_dribble', 'color' => '#17a2b8', 'icon' => 'fas fa-running', 'isSystem' => true],
            ['name' => 'Torwartpass', 'code' => 'keeper_pass', 'color' => '#17a2b8', 'icon' => 'fas fa-arrows-alt-h', 'isSystem' => true],
            ['name' => 'Elfmeter gehalten', 'code' => 'penalty_save', 'color' => '#20c997', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],

            // 5. Fouls & Disziplinarmaßnahmen
            ['name' => 'Foulspiel allgemein', 'code' => 'foul', 'color' => '#dc3545', 'icon' => 'fas fa-exclamation-triangle', 'isSystem' => true],
            ['name' => 'Halten (Foul)', 'code' => 'foul_holding', 'color' => '#dc3545', 'icon' => 'fas fa-hand-holding', 'isSystem' => true],
            ['name' => 'Schubsen', 'code' => 'foul_push', 'color' => '#dc3545', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],
            ['name' => 'Stoßen', 'code' => 'foul_shove', 'color' => '#dc3545', 'icon' => 'fas fa-hand-rock', 'isSystem' => true],
            ['name' => 'Rempeln', 'code' => 'foul_bump', 'color' => '#dc3545', 'icon' => 'fas fa-hand-rock', 'isSystem' => true],
            ['name' => 'Bein stellen', 'code' => 'foul_trip', 'color' => '#dc3545', 'icon' => 'fas fa-shoe-prints', 'isSystem' => true],
            ['name' => 'Tritt', 'code' => 'foul_kick', 'color' => '#dc3545', 'icon' => 'fas fa-shoe-prints', 'isSystem' => true],
            ['name' => 'Schlag / Ellbogen', 'code' => 'foul_elbow', 'color' => '#dc3545', 'icon' => 'fas fa-hand-rock', 'isSystem' => true],
            ['name' => 'Gefährliches Spiel', 'code' => 'dangerous_play', 'color' => '#fd7e14', 'icon' => 'fas fa-exclamation', 'isSystem' => true],
            ['name' => 'Vorteil gegeben', 'code' => 'advantage', 'color' => '#20c997', 'icon' => 'fas fa-forward', 'isSystem' => true],
            ['name' => 'Gelbe Karte', 'code' => 'yellow_card', 'color' => '#ffc107', 'icon' => 'fas fa-square', 'isSystem' => true],
            ['name' => 'Gelb-Rote Karte', 'code' => 'yellow_red_card', 'color' => '#fd7e14', 'icon' => 'fas fa-square', 'isSystem' => true],
            ['name' => 'Rote Karte', 'code' => 'red_card', 'color' => '#dc3545', 'icon' => 'fas fa-square', 'isSystem' => true],
            ['name' => 'Verwarnung ohne Karte', 'code' => 'verbal_warning', 'color' => '#6c757d', 'icon' => 'fas fa-comment', 'isSystem' => true],
            ['name' => 'VAR: Karte bestätigt', 'code' => 'var_card_confirmed', 'color' => '#20c997', 'icon' => 'fas fa-check', 'isSystem' => true],
            ['name' => 'VAR: Karte aufgehoben', 'code' => 'var_card_revoked', 'color' => '#6c757d', 'icon' => 'fas fa-times', 'isSystem' => true],

            // 6. Regelverstöße
            ['name' => 'Abseits', 'code' => 'offside', 'color' => '#6c757d', 'icon' => 'fas fa-ban', 'isSystem' => true],
            ['name' => 'Handspiel', 'code' => 'handball', 'color' => '#6c757d', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],
            ['name' => 'Unsportlichkeit', 'code' => 'unsporting', 'color' => '#6c757d', 'icon' => 'fas fa-user-slash', 'isSystem' => true],
            ['name' => 'Behinderung Torhüter', 'code' => 'obstruct_keeper', 'color' => '#6c757d', 'icon' => 'fas fa-user-shield', 'isSystem' => true],
            ['name' => 'Simulation', 'code' => 'dive', 'color' => '#6c757d', 'icon' => 'fas fa-theater-masks', 'isSystem' => true],
            ['name' => 'Zeitspiel', 'code' => 'time_wasting', 'color' => '#6c757d', 'icon' => 'fas fa-hourglass-end', 'isSystem' => true],
            ['name' => 'Falscher Einwurf', 'code' => 'bad_throw_in', 'color' => '#6c757d', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],
            ['name' => 'Spielverzögerung', 'code' => 'delay_of_game', 'color' => '#6c757d', 'icon' => 'fas fa-hourglass-half', 'isSystem' => true],
            ['name' => 'Technisches Vergehen', 'code' => 'technical_offense', 'color' => '#6c757d', 'icon' => 'fas fa-cogs', 'isSystem' => true],

            // 7. Standardsituationen
            ['name' => 'Eckball', 'code' => 'corner', 'color' => '#007bff', 'icon' => 'fas fa-flag', 'isSystem' => true],
            ['name' => 'Kurz ausgeführte Ecke', 'code' => 'short_corner', 'color' => '#007bff', 'icon' => 'fas fa-flag', 'isSystem' => true],
            ['name' => 'Direkte Ecke aufs Tor', 'code' => 'direct_corner', 'color' => '#007bff', 'icon' => 'fas fa-flag', 'isSystem' => true],
            ['name' => 'Ecke abgewehrt', 'code' => 'corner_cleared', 'color' => '#007bff', 'icon' => 'fas fa-flag', 'isSystem' => true],
            ['name' => 'Direkter Freistoß', 'code' => 'direct_freekick', 'color' => '#007bff', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'Indirekter Freistoß', 'code' => 'indirect_freekick', 'color' => '#007bff', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'Schnell ausgeführter Freistoß', 'code' => 'quick_freekick', 'color' => '#007bff', 'icon' => 'fas fa-bolt', 'isSystem' => true],
            ['name' => 'Freistoß-Flanke', 'code' => 'freekick_cross', 'color' => '#007bff', 'icon' => 'fas fa-share', 'isSystem' => true],
            ['name' => 'Freistoß-Schuss', 'code' => 'freekick_shot', 'color' => '#007bff', 'icon' => 'fas fa-bullseye', 'isSystem' => true],
            ['name' => 'Einwurf', 'code' => 'throw_in', 'color' => '#007bff', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],
            ['name' => 'Langer Einwurf', 'code' => 'long_throw_in', 'color' => '#007bff', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],
            ['name' => 'Anstoß', 'code' => 'kickoff', 'color' => '#007bff', 'icon' => 'fas fa-play', 'isSystem' => true],
            ['name' => 'Abstoß', 'code' => 'goal_kick_2', 'color' => '#007bff', 'icon' => 'fas fa-long-arrow-alt-up', 'isSystem' => true],
            ['name' => 'Schiedsrichterball', 'code' => 'referee_ball', 'color' => '#6c757d', 'icon' => 'fas fa-user', 'isSystem' => true],
            ['name' => 'Zurückspiel zum Torwart', 'code' => 'backpass_to_keeper', 'color' => '#6c757d', 'icon' => 'fas fa-arrow-left', 'isSystem' => true],

            // 8. Elfmeter & Strafstöße
            ['name' => 'Foul führt zum Elfmeter', 'code' => 'penalty_foul', 'color' => '#dc3545', 'icon' => 'fas fa-exclamation-triangle', 'isSystem' => true],
            ['name' => 'Vergebener Elfmeter', 'code' => 'penalty_missed', 'color' => '#dc3545', 'icon' => 'fas fa-times', 'isSystem' => true],
            ['name' => 'Gehaltener Elfmeter', 'code' => 'penalty_saved', 'color' => '#20c997', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],
            ['name' => 'Pfostenschuss beim Elfmeter', 'code' => 'penalty_post', 'color' => '#fd7e14', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'VAR-Elfmeterentscheidung', 'code' => 'var_penalty_decision', 'color' => '#20c997', 'icon' => 'fas fa-check', 'isSystem' => true],
            ['name' => 'Zurückgenommener Elfmeter', 'code' => 'penalty_revoked', 'color' => '#6c757d', 'icon' => 'fas fa-times', 'isSystem' => true],

            // 9. Defensivaktionen
            ['name' => 'Tackling erfolgreich', 'code' => 'tackle_success', 'color' => '#28a745', 'icon' => 'fas fa-shield-alt', 'isSystem' => true],
            ['name' => 'Tackling erfolglos', 'code' => 'tackle_fail', 'color' => '#dc3545', 'icon' => 'fas fa-shield-alt', 'isSystem' => true],
            ['name' => 'Block (Schussblock)', 'code' => 'block_shot', 'color' => '#6c757d', 'icon' => 'fas fa-ban', 'isSystem' => true],
            ['name' => 'Passblock', 'code' => 'block_pass', 'color' => '#6c757d', 'icon' => 'fas fa-ban', 'isSystem' => true],
            ['name' => 'Klärung / Befreiungsschlag', 'code' => 'clearance', 'color' => '#007bff', 'icon' => 'fas fa-broom', 'isSystem' => true],
            ['name' => 'Interception', 'code' => 'interception', 'color' => '#007bff', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],
            ['name' => 'Abfangen einer Flanke', 'code' => 'intercept_cross', 'color' => '#007bff', 'icon' => 'fas fa-hand-paper', 'isSystem' => true],
            ['name' => 'Pressing-Aktion', 'code' => 'def_pressing', 'color' => '#6610f2', 'icon' => 'fas fa-compress-arrows-alt', 'isSystem' => true],
            ['name' => 'Gegenpressing-Aktion', 'code' => 'def_counter_pressing', 'color' => '#6610f2', 'icon' => 'fas fa-sync', 'isSystem' => true],
            ['name' => 'Stellungsspiel-Aktion', 'code' => 'positioning', 'color' => '#6c757d', 'icon' => 'fas fa-grip-lines', 'isSystem' => true],

            // 10. Spielverlauf-Aktionen
            ['name' => 'Spielerwechsel', 'code' => 'substitution', 'color' => '#17a2b8', 'icon' => 'fas fa-exchange-alt', 'isSystem' => true],
            ['name' => 'Einwechslung', 'code' => 'substitution_in', 'color' => '#28a745', 'icon' => 'fas fa-arrow-right', 'isSystem' => true],
            ['name' => 'Auswechslung', 'code' => 'substitution_out', 'color' => '#dc3545', 'icon' => 'fas fa-arrow-left', 'isSystem' => true],
            ['name' => 'Auswechslung verletzungsbedingt', 'code' => 'substitution_injury', 'color' => '#fd7e14', 'icon' => 'fas fa-ambulance', 'isSystem' => true],
            ['name' => 'Einwechselspieler trifft', 'code' => 'sub_goal', 'color' => '#28a745', 'icon' => 'fas fa-futbol', 'isSystem' => true],
            ['name' => 'Unterbrechung wegen Verletzung', 'code' => 'injury_break', 'color' => '#fd7e14', 'icon' => 'fas fa-ambulance', 'isSystem' => true],
            ['name' => 'Unterbrechung wegen VAR', 'code' => 'var_break', 'color' => '#20c997', 'icon' => 'fas fa-video', 'isSystem' => true],
            ['name' => 'Trinkpause', 'code' => 'drink_break', 'color' => '#20c997', 'icon' => 'fas fa-glass-whiskey', 'isSystem' => true],
            ['name' => 'Halbzeitbeginn', 'code' => 'halftime_start', 'color' => '#6c757d', 'icon' => 'fas fa-play', 'isSystem' => true],
            ['name' => 'Halbzeitende', 'code' => 'halftime_end', 'color' => '#6c757d', 'icon' => 'fas fa-stop', 'isSystem' => true],
            ['name' => 'Verlängerung Beginn/Ende', 'code' => 'extra_time', 'color' => '#6c757d', 'icon' => 'fas fa-clock', 'isSystem' => true],
            ['name' => 'Elfmeterschießen', 'code' => 'penalty_shootout', 'color' => '#6c757d', 'icon' => 'fas fa-dot-circle', 'isSystem' => true],
            ['name' => 'Spielabbruch', 'code' => 'match_abandoned', 'color' => '#dc3545', 'icon' => 'fas fa-ban', 'isSystem' => true],
            ['name' => 'Wiederaufnahme nach Abbruch', 'code' => 'match_resumed', 'color' => '#28a745', 'icon' => 'fas fa-play', 'isSystem' => true],

            // 11. Sonstige Ereignisse
            ['name' => 'Vorteil angezeigt', 'code' => 'advantage_shown', 'color' => '#20c997', 'icon' => 'fas fa-forward', 'isSystem' => true],
            ['name' => 'Ball im Aus', 'code' => 'ball_out', 'color' => '#6c757d', 'icon' => 'fas fa-times-circle', 'isSystem' => true],
            ['name' => 'Ball an Schiedsrichter', 'code' => 'ball_referee', 'color' => '#6c757d', 'icon' => 'fas fa-user', 'isSystem' => true],
            ['name' => 'Technische Probleme', 'code' => 'technical_issue', 'color' => '#6c757d', 'icon' => 'fas fa-tools', 'isSystem' => true],
            ['name' => 'Unsportliches Verhalten von außen', 'code' => 'unsporting_external', 'color' => '#6c757d', 'icon' => 'fas fa-users', 'isSystem' => true],
        ];

        foreach ($eventTypes as $type) {
            $existing = $manager->getRepository(GameEventType::class)
                ->findOneBy(['name' => $type['name']]);
            if (!$existing) {
                $eventType = new GameEventType();
                $eventType->setName($type['name']);
                $manager->persist($eventType);
            } else {
                $eventType = $existing;
            }
            // Always sync code, color, icon, isSystem to keep master data up-to-date
            $eventType->setCode($type['code']);
            $eventType->setColor($type['color']);
            $eventType->setIcon($type['icon']);
            $eventType->setSystem($type['isSystem']);
            $this->addReference(
                'game_event_type_' . strtolower(str_replace(['-', ' ', '(', ')'], '_', $type['name'])),
                $eventType
            );
        }

        $manager->flush();
        $manager->clear();
    }
}
