<?php

namespace App\Tests\Unit\Service;

use App\Entity\Club;
use App\Entity\Player;
use App\Entity\PlayerDocument;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Repository\UserRelationRepository;
use App\Service\AdminScopeService;
use App\Service\CoachTeamPlayerService;
use App\Service\PlayerDocumentAccessService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class PlayerDocumentAccessServiceTest extends TestCase
{
    public function testRelationNeedsExplicitDocumentPermission(): void
    {
        $user = (new User())->setRoles(['ROLE_USER']);
        $player = new Player();
        $document = (new PlayerDocument())->setPlayer($player)->setClub(new Club());
        $relation = (new UserRelation())->setUser($user)->setPlayer($player)->setPermissions(['view_profile']);
        $coachTeams = $this->createMock(CoachTeamPlayerService::class);
        $coachTeams->method('collectCoachTeams')->willReturn([]);
        $relations = $this->createMock(UserRelationRepository::class);
        $relations->method('findBy')->willReturn([$relation]);
        $service = new PlayerDocumentAccessService($coachTeams, $relations, $this->createMock(AdminScopeService::class));
        self::assertFalse($service->canView($user, $document));
        $relation->addPermission('view_documents');
        self::assertTrue($service->canView($user, $document));
        self::assertFalse($service->canManagePlayer($user, $player));
    }

    public function testPlatformAdminCanManageDocuments(): void
    {
        $user = (new User())->setRoles(['ROLE_ADMIN']);
        $service = new PlayerDocumentAccessService(
            $this->createMock(CoachTeamPlayerService::class),
            $this->createMock(UserRelationRepository::class),
            $this->createMock(AdminScopeService::class)
        );
        self::assertTrue($service->canManagePlayer($user, new Player()));
    }
}
