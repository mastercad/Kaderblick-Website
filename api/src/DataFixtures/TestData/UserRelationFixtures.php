<?php

namespace App\DataFixtures\TestData;

use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Position;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use DateTimeImmutable;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

class UserRelationFixtures extends Fixture implements DependentFixtureInterface, FixtureGroupInterface
{
    public function getDependencies(): array
    {
        return [
            PlayerFixtures::class,
            CoachFixtures::class,
            UserFixtures::class
        ];
    }

    /** @return list<string> */
    public static function getGroups(): array
    {
        return ['test'];
    }

    public function load(ObjectManager $manager): void
    {
        // Zusätzliche Relationen für Test-User mit ROLE_USER (user6, user7, user8)
        $user6 = $this->getReference('user_6', User::class); // ROLE_USER
        $user7 = $this->getReference('user_7', User::class); // ROLE_USER
        $user8 = $this->getReference('user_8', User::class); // ROLE_USER
        $player1_1 = $this->getReference('player_1_1', Player::class); // Team 1
        $player_2_1 = $this->getReference('player_2_1', Player::class); // Team 1
        $player_3_2 = $this->getReference('player_3_2', Player::class); // Team 2
        $relationTypeParent = $this->getReference('relation_type_parent', RelationType::class);

        // user6 -> Elternteil von Spieler 1 in Team 1
        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $user6,
            'player' => $player1_1,
            'relationType' => $relationTypeParent,
        ]);
        if (!$existing) {
            $rel = new UserRelation();
            $rel->setUser($user6);
            $rel->setPlayer($player1_1);
            $rel->setRelationType($relationTypeParent);
            $manager->persist($rel);
        }

        // user7 -> Elternteil von Spieler 2 in Team 1
        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $user7,
            'player' => $player_2_1,
            'relationType' => $relationTypeParent,
        ]);
        if (!$existing) {
            $rel = new UserRelation();
            $rel->setUser($user7);
            $rel->setPlayer($player_2_1);
            $rel->setRelationType($relationTypeParent);
            $manager->persist($rel);
        }

        // user8 -> Elternteil von Spieler 3 in Team 2
        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $user8,
            'player' => $player_3_2,
            'relationType' => $relationTypeParent,
        ]);
        if (!$existing) {
            $rel = new UserRelation();
            $rel->setUser($user8);
            $rel->setPlayer($player_3_2);
            $rel->setRelationType($relationTypeParent);
            $manager->persist($rel);
        }

        $userMutterVonSpielerEinsTeamEins = $this->getReference('user_1', User::class);
        $playerEinsTeamEins = $this->getReference('player_1_1', Player::class);

        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $userMutterVonSpielerEinsTeamEins,
            'player' => $playerEinsTeamEins,
            'relationType' => $this->getReference('relation_type_parent', RelationType::class),
        ]);
        if (!$existing) {
            $userRelationMutterVonSpielerEinsTeamEins = new UserRelation();
            $userRelationMutterVonSpielerEinsTeamEins->setPlayer($playerEinsTeamEins);
            $userRelationMutterVonSpielerEinsTeamEins->setUser($userMutterVonSpielerEinsTeamEins);
            $userRelationMutterVonSpielerEinsTeamEins->setRelationType($this->getReference('relation_type_parent', RelationType::class));
            $manager->persist($userRelationMutterVonSpielerEinsTeamEins);
        }

        $userVaterVonSpielerZehnTeamZweiUndCoachVonTeamVier = $this->getReference('user_5', User::class);
        $playerZehnTeamZwei = $this->getReference('player_10_2', Player::class);
        $coachTeamVier = $this->getReference('coach_7', Coach::class);

        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $userVaterVonSpielerZehnTeamZweiUndCoachVonTeamVier,
            'player' => $playerZehnTeamZwei,
            'coach' => $coachTeamVier,
            'relationType' => $this->getReference('relation_type_parent', RelationType::class),
        ]);
        if (!$existing) {
            $userRelationVaterVonSpielerZehnTeamZweiUndCoachVonTeamVier = new UserRelation();
            $userRelationVaterVonSpielerZehnTeamZweiUndCoachVonTeamVier->setPlayer($playerZehnTeamZwei);
            $userRelationVaterVonSpielerZehnTeamZweiUndCoachVonTeamVier->setUser($userVaterVonSpielerZehnTeamZweiUndCoachVonTeamVier);
            $userRelationVaterVonSpielerZehnTeamZweiUndCoachVonTeamVier->setRelationType($this->getReference('relation_type_parent', RelationType::class));
            $userRelationVaterVonSpielerZehnTeamZweiUndCoachVonTeamVier->setCoach($coachTeamVier);
            $manager->persist($userRelationVaterVonSpielerZehnTeamZweiUndCoachVonTeamVier);
        }

        // Bruder von Spieler 2 in Team 1
        $userBruderVonSpieler2 = $this->getReference('user_2', User::class);
        $player2Team1 = $this->getReference('player_2_1', Player::class);
        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $userBruderVonSpieler2,
            'player' => $player2Team1,
            'relationType' => $this->getReference('relation_type_sibling', RelationType::class),
        ]);
        if (!$existing) {
            $relationBruder = new UserRelation();
            $relationBruder->setUser($userBruderVonSpieler2);
            $relationBruder->setPlayer($player2Team1);
            $relationBruder->setRelationType($this->getReference('relation_type_sibling', RelationType::class));
            $manager->persist($relationBruder);
        }

        // Vater von Spieler 3 in Team 2
        $userVaterVonSpieler3 = $this->getReference('user_3', User::class);
        $player3Team2 = $this->getReference('player_3_2', Player::class);
        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $userVaterVonSpieler3,
            'player' => $player3Team2,
            'relationType' => $this->getReference('relation_type_parent', RelationType::class),
        ]);
        if (!$existing) {
            $relationVater = new UserRelation();
            $relationVater->setUser($userVaterVonSpieler3);
            $relationVater->setPlayer($player3Team2);
            $relationVater->setRelationType($this->getReference('relation_type_parent', RelationType::class));
            $manager->persist($relationVater);
        }

        // Freund von Spieler 4 (Team 1) und Spieler 5 (Team 2)
        $userFreundMehrererSpieler = $this->getReference('user_4', User::class);
        $player4Team1 = $this->getReference('player_4_1', Player::class);
        $player5Team2 = $this->getReference('player_5_2', Player::class);
        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $userFreundMehrererSpieler,
            'player' => $player4Team1,
            'relationType' => $this->getReference('relation_type_friend', RelationType::class),
        ]);
        if (!$existing) {
            $relationFriend1 = new UserRelation();
            $relationFriend1->setUser($userFreundMehrererSpieler);
            $relationFriend1->setPlayer($player4Team1);
            $relationFriend1->setRelationType($this->getReference('relation_type_friend', RelationType::class));
            $manager->persist($relationFriend1);
        }
        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $userFreundMehrererSpieler,
            'player' => $player5Team2,
            'relationType' => $this->getReference('relation_type_friend', RelationType::class),
        ]);
        if (!$existing) {
            $relationFriend2 = new UserRelation();
            $relationFriend2->setUser($userFreundMehrererSpieler);
            $relationFriend2->setPlayer($player5Team2);
            $relationFriend2->setRelationType($this->getReference('relation_type_friend', RelationType::class));
            $manager->persist($relationFriend2);
        }

        // Freund von Coach 2 und Coach 3 (verschiedene Teams)
        $userFreundMehrererCoaches = $this->getReference('user_5', User::class);
        $coach2 = $this->getReference('coach_2', Coach::class);
        $coach3 = $this->getReference('coach_3', Coach::class);
        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $userFreundMehrererCoaches,
            'coach' => $coach2,
            'relationType' => $this->getReference('relation_type_friend', RelationType::class),
        ]);
        if (!$existing) {
            $relationFriendCoach2 = new UserRelation();
            $relationFriendCoach2->setUser($userFreundMehrererCoaches);
            $relationFriendCoach2->setCoach($coach2);
            $relationFriendCoach2->setRelationType($this->getReference('relation_type_friend', RelationType::class));
            $manager->persist($relationFriendCoach2);
        }
        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $userFreundMehrererCoaches,
            'coach' => $coach3,
            'relationType' => $this->getReference('relation_type_friend', RelationType::class),
        ]);
        if (!$existing) {
            $relationFriendCoach3 = new UserRelation();
            $relationFriendCoach3->setUser($userFreundMehrererCoaches);
            $relationFriendCoach3->setCoach($coach3);
            $relationFriendCoach3->setRelationType($this->getReference('relation_type_friend', RelationType::class));
            $manager->persist($relationFriendCoach3);
        }

        // User ist Bruder von Spieler 2 und Freund von Coach 3
        $userBruderUndFreund = $this->getReference('user_2', User::class);
        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $userBruderUndFreund,
            'coach' => $coach3,
            'relationType' => $this->getReference('relation_type_friend', RelationType::class),
        ]);
        if (!$existing) {
            $relationBruderUndFreund = new UserRelation();
            $relationBruderUndFreund->setUser($userBruderUndFreund);
            $relationBruderUndFreund->setCoach($coach3);
            $relationBruderUndFreund->setRelationType($this->getReference('relation_type_friend', RelationType::class));
            $manager->persist($relationBruderUndFreund);
        }

        // User ist Mentor von Coach 5 und Freund von Spieler 4
        $userMentorUndFreund = $this->getReference('user_3', User::class);
        $coach5 = $this->getReference('coach_5', Coach::class);
        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $userMentorUndFreund,
            'coach' => $coach5,
            'relationType' => $this->getReference('relation_type_mentor', RelationType::class),
        ]);
        if (!$existing) {
            $relationMentor = new UserRelation();
            $relationMentor->setUser($userMentorUndFreund);
            $relationMentor->setCoach($coach5);
            $relationMentor->setRelationType($this->getReference('relation_type_mentor', RelationType::class));
            $manager->persist($relationMentor);
        }

        $existing = $manager->getRepository(UserRelation::class)->findOneBy([
            'user' => $userMentorUndFreund,
            'player' => $player4Team1,
            'relationType' => $this->getReference('relation_type_friend', RelationType::class),
        ]);
        if (!$existing) {
            $relationFriendSpieler4 = new UserRelation();
            $relationFriendSpieler4->setUser($userMentorUndFreund);
            $relationFriendSpieler4->setPlayer($player4Team1);
            $relationFriendSpieler4->setRelationType($this->getReference('relation_type_friend', RelationType::class));
            $manager->persist($relationFriendSpieler4);
        }

        // ─── Squad-Readiness-Relationen ──────────────────────────────────────────
        // Benötigt für MatchdayControllerSquadReadinessTest.
        // Jede Relation bildet exakt das Szenario ab, das im Test geprüft wird:
        //   user_9  (ROLE_USER)  → self_player → player_5_1  → Team 1  (start 2023-01-01, kein Ende)
        //   user_11 (ROLE_CLUB)  → self_coach  → coach_1     → Team 1  (start 2023-01-01, kein Ende)
        //   user_12 (ROLE_CLUB)  → self_player → player_6_1  → Team 1  (start 2023-01-01, kein Ende)
        //                        → self_coach  → coach_5     → Team 2  (start 2016-01-01, kein Ende)
        //   user_13 (ROLE_CLUB)  → self_coach  → coach_8     → Team 1  (start 2015-01-01, ENDE 2020-12-31 = abgelaufen)
        //   user_14 (ROLE_CLUB)  → self_player → player_5_2  → Team 2  (start 2023-01-01, kein Ende)
        //
        // Absichtlich NICHT verändert:
        //   user_10 → wird in UserRelationTest als "User ohne Relation" genutzt

        $relTypeSelfPlayer = $this->getReference('relation_type_self_player', RelationType::class);
        $relTypeSelfCoach = $this->getReference('relation_type_self_coach', RelationType::class);

        // user_9 → self_player → player_5_1 (Team 1)
        $squadUser9 = $this->getReference('user_9', User::class);
        $squadP5Team1 = $this->getReference('player_5_1', Player::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser9, 'player' => $squadP5Team1])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser9)->setPlayer($squadP5Team1)->setRelationType($relTypeSelfPlayer);
            $manager->persist($rel);
        }

        // user_11 → self_coach → coach_1 (aktiv in Team 1, start 2023-01-01)
        $squadUser11 = $this->getReference('user_11', User::class);
        $squadCoach1 = $this->getReference('coach_1', Coach::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser11, 'coach' => $squadCoach1])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser11)->setCoach($squadCoach1)->setRelationType($relTypeSelfCoach);
            $manager->persist($rel);
        }

        // user_12 → self_player → player_6_1 (Team 1) + self_coach → coach_5 (Team 2)
        $squadUser12 = $this->getReference('user_12', User::class);
        $squadP6Team1 = $this->getReference('player_6_1', Player::class);
        $squadCoach5 = $this->getReference('coach_5', Coach::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser12, 'player' => $squadP6Team1])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser12)->setPlayer($squadP6Team1)->setRelationType($relTypeSelfPlayer);
            $manager->persist($rel);
        }
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser12, 'coach' => $squadCoach5])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser12)->setCoach($squadCoach5)->setRelationType($relTypeSelfCoach);
            $manager->persist($rel);
        }

        // user_13 → self_coach → coach_8 (Team 1, abgelaufen 2020-12-31)
        $squadUser13 = $this->getReference('user_13', User::class);
        $squadCoach8 = $this->getReference('coach_8', Coach::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser13, 'coach' => $squadCoach8])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser13)->setCoach($squadCoach8)->setRelationType($relTypeSelfCoach);
            $manager->persist($rel);
        }

        // user_14 → self_player → player_5_2 (Team 2, start 2023-01-01)
        $squadUser14 = $this->getReference('user_14', User::class);
        $squadP5Team2 = $this->getReference('player_5_2', Player::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser14, 'player' => $squadP5Team2])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser14)->setPlayer($squadP5Team2)->setRelationType($relTypeSelfPlayer);
            $manager->persist($rel);
        }

        // ─── Weitere Squad-Readiness-Relationen ─────────────────────────────────
        // user_15 → self_player × 2 → player_7_1 (Team 1) + player_7_2 (Team 2)  [D3: zwei self_player]
        $squadUser15 = $this->getReference('user_15', User::class);
        $squadP7Team1 = $this->getReference('player_7_1', Player::class);
        $squadP7Team2 = $this->getReference('player_7_2', Player::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser15, 'player' => $squadP7Team1])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser15)->setPlayer($squadP7Team1)->setRelationType($relTypeSelfPlayer);
            $manager->persist($rel);
        }
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser15, 'player' => $squadP7Team2])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser15)->setPlayer($squadP7Team2)->setRelationType($relTypeSelfPlayer);
            $manager->persist($rel);
        }

        // user_17 → relative → player_10_1  [A4: relative ≠ self_player → DENY]
        $relTypeRelative = $this->getReference('relation_type_relative', RelationType::class);
        $squadUser17 = $this->getReference('user_17', User::class);
        $squadP10Team1 = $this->getReference('player_10_1', Player::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser17, 'player' => $squadP10Team1])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser17)->setPlayer($squadP10Team1)->setRelationType($relTypeRelative);
            $manager->persist($rel);
        }

        // user_18 → guardian → player_11_1  [A5: guardian ≠ self_player → DENY]
        $relTypeGuardian = $this->getReference('relation_type_guardian', RelationType::class);
        $squadUser18 = $this->getReference('user_18', User::class);
        $squadP11Team1 = $this->getReference('player_11_1', Player::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser18, 'player' => $squadP11Team1])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser18)->setPlayer($squadP11Team1)->setRelationType($relTypeGuardian);
            $manager->persist($rel);
        }

        // user_19 → assistant → coach_1  [A9: assistant ≠ self_coach → DENY]
        $relTypeAssistant = $this->getReference('relation_type_assistant', RelationType::class);
        $squadUser19 = $this->getReference('user_19', User::class);
        $coachOne = $this->getReference('coach_1', Coach::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser19, 'coach' => $coachOne])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser19)->setCoach($coachOne)->setRelationType($relTypeAssistant);
            $manager->persist($rel);
        }

        // user_20 → observer → coach_5  [A10: observer ≠ self_coach → DENY]
        $relTypeObserver = $this->getReference('relation_type_observer', RelationType::class);
        $squadUser20 = $this->getReference('user_20', User::class);
        $coachFive = $this->getReference('coach_5', Coach::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser20, 'coach' => $coachFive])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser20)->setCoach($coachFive)->setRelationType($relTypeObserver);
            $manager->persist($rel);
        }

        // user_22 → substitute → coach_1  [A11: substitute ≠ self_coach → DENY]
        $relTypeSubstitute = $this->getReference('relation_type_substitute', RelationType::class);
        $squadUser22 = $this->getReference('user_22', User::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser22, 'coach' => $coachOne])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser22)->setCoach($coachOne)->setRelationType($relTypeSubstitute);
            $manager->persist($rel);
        }

        // user_23 → self_coach → coach_6 (CTA: startDate=NULL, endDate=NULL)  [B6: null-dates → ALLOW]
        $squadUser23 = $this->getReference('user_23', User::class);
        $squadCoach6 = $this->getReference('coach_6', Coach::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser23, 'coach' => $squadCoach6])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser23)->setCoach($squadCoach6)->setRelationType($relTypeSelfCoach);
            $manager->persist($rel);
        }

        // user_24 → self_player → Spieler mit abgelaufener PTA  [B12: expired PTA → DENY]
        $squadUser24 = $this->getReference('user_24', User::class);
        $expiredPlayerMail = 'squad_test_expired@example.com';
        $expiredPlayer = $manager->getRepository(Player::class)->findOneBy(['email' => $expiredPlayerMail]);
        if (!$expiredPlayer) {
            $expiredPlayer = new Player();
            $expiredPlayer->setFirstName('ExpiredTest');
            $expiredPlayer->setLastName('Squad24');
            $expiredPlayer->setEmail($expiredPlayerMail);
            /** @var Position $anyPosition */
            $anyPosition = $manager->getRepository(Position::class)->findOneBy([]);
            $expiredPlayer->setMainPosition($anyPosition);
            $manager->persist($expiredPlayer);

            $team1 = $this->getReference('Team 1', Team::class);
            $expiredPta = new PlayerTeamAssignment();
            $expiredPta->setPlayer($expiredPlayer);
            $expiredPta->setTeam($team1);
            $expiredPta->setStartDate(new DateTimeImmutable('2020-01-01'));
            $expiredPta->setEndDate(new DateTimeImmutable('2021-12-31'));
            $manager->persist($expiredPta);
        }
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $squadUser24, 'player' => $expiredPlayer])) {
            $rel = new UserRelation();
            $rel->setUser($squadUser24)->setPlayer($expiredPlayer)->setRelationType($relTypeSelfPlayer);
            $manager->persist($rel);
        }

        // ─── SUPERADMIN-Relation für Formation-Archive-Tests ────────────────────
        // user_21 (ROLE_SUPERADMIN) → self_coach → coach_9 (aktiv in Team 13, start 2020-01-01)
        // Ermöglicht testArchivedEndpointFiltersByTeamForSuperAdmin: SUPERADMIN
        // hat ein eigenes Coach-Team und kann per ?teamId filtern.
        $superAdminUser = $this->getReference('user_21', User::class);
        $superAdminCoach = $this->getReference('coach_9', Coach::class);
        if (!$manager->getRepository(UserRelation::class)->findOneBy(['user' => $superAdminUser, 'coach' => $superAdminCoach])) {
            $rel = new UserRelation();
            $rel->setUser($superAdminUser)->setCoach($superAdminCoach)->setRelationType($relTypeSelfCoach);
            $manager->persist($rel);
        }

        $manager->flush();
    }
}
