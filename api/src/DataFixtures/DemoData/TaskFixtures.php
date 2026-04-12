<?php

namespace App\DataFixtures\DemoData;

use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\User;
use DateTimeImmutable;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Demo-Fixtures: Aufgaben und Zuweisungen für alle 10 Clubs.
 *
 * Pro Club werden erstellt:
 * - 2 wiederkehrende Aufgaben (classic) mit je 3 Assignments
 * - 1 spieltag-gebundene Aufgabe (per_match) mit je 3 Assignments
 * - 2 Einzel-Aufgaben (one-time) mit je 1 Assignment
 *
 * Gruppe: demo
 */
class TaskFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    /**
     * Aufgaben-Vorlagen pro Club.
     * [title, description, isRecurring, recurrenceMode, recurrenceRule, assignedDateOffset (Tage ab 2025-09-01)].
     *
     * @var array<int, array{title: string, desc: string, recurring: bool, mode: string, rule: string|null, offset: int|null}>
     */
    private const TASK_TEMPLATES = [
        [
            'title' => 'Trikots waschen',
            'desc' => 'Nach jedem Spieltag Trikots waschen und für das nächste Spiel vorbereiten.',
            'recurring' => true,
            'mode' => 'classic',
            'rule' => '{"freq":"WEEKLY","interval":2}',
            'offset' => null,
        ],
        [
            'title' => 'Netze und Fahnen prüfen',
            'desc' => 'Vor dem Heimspiel Tornetze und Eckfahnen auf Beschädigungen prüfen und ggf. austauschen.',
            'recurring' => true,
            'mode' => 'classic',
            'rule' => '{"freq":"WEEKLY","interval":1,"byday":["SA"]}',
            'offset' => null,
        ],
        [
            'title' => 'Bälle aufpumpen',
            'desc' => 'Bälle aufpumpen und auf den richtigen Druck prüfen – vor jedem Spieltag.',
            'recurring' => true,
            'mode' => 'per_match',
            'rule' => null,
            'offset' => null,
        ],
        [
            'title' => 'Jahreshauptversammlung vorbereiten',
            'desc' => 'Einladungen versenden, Jahresbericht erstellen, Tagesordnung vorbereiten.',
            'recurring' => false,
            'mode' => 'classic',
            'rule' => null,
            'offset' => 50, // ca. November
        ],
        [
            'title' => 'Vereinsfoto organisieren',
            'desc' => 'Fotografen buchen, Termin mit allen Mannschaften abstimmen.',
            'recurring' => false,
            'mode' => 'classic',
            'rule' => null,
            'offset' => 14, // ca. Mitte September
        ],
    ];

    /** Zuweisung der Aufgaben an Benutzer-Indizes (localIdx). */
    private const ASSIGNMENT_USERS = [0 => 3, 1 => 4, 2 => 5, 3 => 3, 4 => 4];

    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [UserFixtures::class];
    }

    public function load(ObjectManager $manager): void
    {
        assert($manager instanceof EntityManagerInterface);

        // Idempotenz
        $existing = $manager->getRepository(Task::class)->findOneBy([]);
        if (null !== $existing) {
            return;
        }

        // ── User-ID-Map [clubIdx][localIdx] => userId ────────────────────────
        /** @var array<int, array<int, int>> $userIdMap */
        $userIdMap = [];
        for ($clubIdx = 0; $clubIdx < 10; ++$clubIdx) {
            for ($local = 0; $local < 10; ++$local) {
                $user = $this->getReference("demo_user_{$clubIdx}_{$local}", User::class);
                $id = $user->getId();
                if (null !== $id) {
                    $userIdMap[$clubIdx][$local] = $id;
                }
            }
        }

        $baseDate = new DateTimeImmutable('2025-09-01');
        $count = 0;

        for ($clubIdx = 0; $clubIdx < 10; ++$clubIdx) {
            $adminId = $userIdMap[$clubIdx][0] ?? null;
            if (null === $adminId) {
                continue;
            }

            /** @var User $adminUser */
            $adminUser = $manager->getReference(User::class, $adminId);

            foreach (self::TASK_TEMPLATES as $tmplIdx => $template) {
                $task = new Task();
                $task->setTitle($template['title']);
                $task->setDescription($template['desc']);
                $task->setIsRecurring($template['recurring']);
                $task->setRecurrenceMode($template['mode']);
                $task->setCreatedBy($adminUser);

                if (null !== $template['rule']) {
                    $task->setRecurrenceRule($template['rule']);
                }

                if (!$template['recurring'] && null !== $template['offset']) {
                    $task->setAssignedDate($baseDate->modify("+{$template['offset']} days"));
                }

                $manager->persist($task);

                // ── Assignments ──────────────────────────────────────────────
                $assigneeLocalIdx = self::ASSIGNMENT_USERS[$tmplIdx];
                $assigneeId = $userIdMap[$clubIdx][$assigneeLocalIdx] ?? null;

                if (null !== $assigneeId) {
                    $numAssignments = $template['recurring'] ? 3 : 1;

                    for ($a = 0; $a < $numAssignments; ++$a) {
                        $offset = $template['offset'] ?? ($a * 14); // alle 2 Wochen
                        $assignDate = $baseDate->modify("+{$offset} days")->modify("+{$a} weeks");

                        // Erste Assignment: erledigt, Rest: offen
                        $status = (0 === $a) ? 'erledigt' : 'offen';

                        /** @var User $assignee */
                        $assignee = $manager->getReference(User::class, $assigneeId);

                        $assignment = new TaskAssignment();
                        $assignment->setTask($task);
                        $assignment->setUser($assignee);
                        $assignment->setAssignedDate($assignDate);
                        $assignment->setStatus($status);

                        $manager->persist($assignment);
                        ++$count;
                    }
                }

                if ($count > 0 && 0 === $count % 100) {
                    $manager->flush();
                }
            }
        }

        $manager->flush();
    }
}
