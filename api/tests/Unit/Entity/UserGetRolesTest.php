<?php

namespace App\Tests\Unit\Entity;

use App\Entity\User;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class UserGetRolesTest extends TestCase
{
    public function testNewUserHasGuestRole(): void
    {
        self::assertSame(['ROLE_GUEST'], (new User())->getRoles());
    }

    public function testSetRolesStoresMultipleRolesInStableOrder(): void
    {
        $user = (new User())->setRoles(['ROLE_TEAM_ADMIN', 'ROLE_USER', 'ROLE_SUPPORTER']);

        self::assertSame(['ROLE_USER', 'ROLE_SUPPORTER', 'ROLE_TEAM_ADMIN'], $user->getRoles());
        self::assertSame('ROLE_TEAM_ADMIN', $user->getRole());
        self::assertSame('ROLE_USER', $user->getBaseRole());
    }

    public function testSetRolesRejectsEmptyRoleList(): void
    {
        $this->expectException(InvalidArgumentException::class);

        (new User())->setRoles([]);
    }

    public function testAddRoleAppendsMarkerRole(): void
    {
        $user = (new User())->setRoles(['ROLE_USER'])->addRole('ROLE_SUPPORTER');

        self::assertSame(['ROLE_USER', 'ROLE_SUPPORTER'], $user->getRoles());
    }

    public function testRemoveRoleFallsBackToUserWhenLastRoleWouldBeRemoved(): void
    {
        $user = (new User())->setRoles(['ROLE_SUPPORTER'])->removeRole('ROLE_SUPPORTER');

        self::assertSame(['ROLE_USER'], $user->getRoles());
    }

    public function testVerificationStateDoesNotAddAnotherRole(): void
    {
        $user = (new User())->setRoles(['ROLE_SUPPORTER'])->setIsVerified(true);

        self::assertSame(['ROLE_SUPPORTER'], $user->getRoles());
    }
}
