<?php

namespace App\DataFixtures\DemoData;

use App\Entity\Message;
use App\Entity\User;
use DateTime;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;
use ReflectionProperty;

/**
 * Demo-Fixtures: Interne Nachrichten zwischen Demo-Benutzern.
 *
 * Pro Club werden 3 Konversationen erstellt:
 * 1. Admin → Trainer + Spieler: Infos zur neuen Saison (2 Nachrichten)
 * 2. Trainer → Spieler: Aufstellungs-Information (2 Nachrichten)
 * 3. Admin → Trainer: Trainingszeiten-Abstimmung (1 Nachricht)
 *
 * Gruppe: demo
 */
class MessageFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    /**
     * Konversations-Vorlagen.
     * [senderLocalIdx, recipientLocalIdxs, subject, content, sentDate, replies: [[senderLocalIdx, recipientLocalIdxs, content, sentDate]]].
     *
     * @var array<int, array{
     *     senderIdx: int, recipientIdxs: int[], subject: string, content: string,
     *     sentDate: string, replies: array<array{senderIdx: int, recipientIdxs: int[], content: string, sentDate: string}>
     * }>
     */
    private const CONVERSATIONS = [
        [
            'senderIdx' => 0,
            'recipientIdxs' => [1, 3, 4, 5],
            'subject' => 'Wichtige Infos zur neuen Saison',
            'content' => "Liebe Mannschaft,\n\ndie neue Saison steht vor der Tür!\n"
                . "Bitte merkt euch folgende Termine:\n\n"
                . "- Trainingsauftakt: 10. Juli 19:00 Uhr\n"
                . "- Erstes Pflichtspiel: 9. August\n"
                . "- Mitgliederbeitrag bitte bis Ende Juli überweisen\n\n"
                . "Bei Fragen stehe ich euch gerne zur Verfügung.\n\nViele Grüße,\nDer Vorstand",
            'sentDate' => '2025-07-12 10:30:00',
            'replies' => [
                [
                    'senderIdx' => 1,
                    'recipientIdxs' => [0],
                    'content' => "Hallo,\n\nvielen Dank für die Infos! Wir freuen uns auf die neue Saison.\n\n"
                        . 'Könnten wir den Trainingsauftakt evtl. auf 19:30 Uhr verschieben? '
                        . "Einige Spieler kommen direkt von der Arbeit.\n\nViele Grüße",
                    'sentDate' => '2025-07-12 14:45:00',
                ],
            ],
        ],
        [
            'senderIdx' => 1,
            'recipientIdxs' => [3, 4, 5, 6, 7, 8],
            'subject' => 'Aufstellung fürs Wochenendspiel',
            'content' => "Hey zusammen,\n\nhier die Aufstellung für Samstag:\n\n"
                . "Tor: Spieler 1\nAbwehr: Spieler 2, 3, 4, 5\n"
                . "Mittelfeld: Spieler 6, 7, 8\nAngriff: Spieler 9, 10, 11\n\n"
                . "Wir treffen uns um 13:30 Uhr am Sportplatz. Bitte vollständige Ausrüstung mitbringen!\n\n"
                . 'Grüße, Trainer',
            'sentDate' => '2025-09-10 18:00:00',
            'replies' => [
                [
                    'senderIdx' => 3,
                    'recipientIdxs' => [1],
                    'content' => "Hi Trainer,\n\nok, bin dabei! Kleiner Hinweis: Ich komme vielleicht 10 Minuten später, da ich noch eine Besprechung habe.\n\nBis Samstag!",
                    'sentDate' => '2025-09-10 19:15:00',
                ],
            ],
        ],
        [
            'senderIdx' => 0,
            'recipientIdxs' => [1, 2],
            'subject' => 'Neue Trainingszeiten ab Oktober',
            'content' => "Hallo,\n\naufgrund der Hallenzeiten müssen wir die Trainingszeiten ab Oktober anpassen:\n\n"
                . "- Dienstag: 20:00 – 21:30 Uhr (statt 19:00)\n"
                . "- Donnerstag: bleibt wie gehabt\n\n"
                . "Bitte die Spieler informieren. Danke!\n\nViele Grüße",
            'sentDate' => '2025-09-25 09:00:00',
            'replies' => [],
        ],
    ];

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
        $existing = $manager->getRepository(Message::class)->findOneBy([]);
        if (null !== $existing) {
            return;
        }

        // Reflection für historisches sentAt
        $sentAtProp = new ReflectionProperty(Message::class, 'sentAt');
        $sentAtProp->setAccessible(true);

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

        for ($clubIdx = 0; $clubIdx < 10; ++$clubIdx) {
            foreach (self::CONVERSATIONS as $conv) {
                $senderId = $userIdMap[$clubIdx][$conv['senderIdx']] ?? null;
                if (null === $senderId) {
                    continue;
                }

                /** @var User $sender */
                $sender = $manager->getReference(User::class, $senderId);

                $root = $this->buildMessage(
                    $manager,
                    $sender,
                    $conv['recipientIdxs'],
                    $userIdMap[$clubIdx],
                    $conv['subject'],
                    $conv['content'],
                    new DateTime($conv['sentDate']),
                    null,
                    null,
                    $sentAtProp
                );

                $manager->persist($root);
                $manager->flush(); // flush root so it has an ID for thread references

                foreach ($conv['replies'] as $reply) {
                    $replySenderId = $userIdMap[$clubIdx][$reply['senderIdx']] ?? null;
                    if (null === $replySenderId) {
                        continue;
                    }

                    /** @var User $replySender */
                    $replySender = $manager->getReference(User::class, $replySenderId);

                    $replyMsg = $this->buildMessage(
                        $manager,
                        $replySender,
                        $reply['recipientIdxs'],
                        $userIdMap[$clubIdx],
                        'Re: ' . $conv['subject'],
                        $reply['content'],
                        new DateTime($reply['sentDate']),
                        $root,
                        $root,
                        $sentAtProp
                    );

                    $manager->persist($replyMsg);
                }

                $manager->flush();
            }
        }
    }

    /**
     * @param int[]           $recipientLocalIdxs
     * @param array<int, int> $clubUserIdMap
     */
    private function buildMessage(
        EntityManagerInterface $manager,
        User $sender,
        array $recipientLocalIdxs,
        array $clubUserIdMap,
        string $subject,
        string $content,
        DateTime $sentAt,
        ?Message $parent,
        ?Message $thread,
        ReflectionProperty $sentAtProp
    ): Message {
        $msg = new Message();
        $msg->setSender($sender);
        $msg->setSubject($subject);
        $msg->setContent($content);
        $msg->setParent($parent);
        $msg->setThread($thread);

        // Override sentAt via Reflection to set historical timestamp
        $sentAtProp->setValue($msg, $sentAt);

        foreach ($recipientLocalIdxs as $local) {
            $recipientId = $clubUserIdMap[$local] ?? null;
            if (null === $recipientId) {
                continue;
            }
            /** @var User $recipient */
            $recipient = $manager->getReference(User::class, $recipientId);
            $msg->addRecipient($recipient);
        }

        return $msg;
    }
}
