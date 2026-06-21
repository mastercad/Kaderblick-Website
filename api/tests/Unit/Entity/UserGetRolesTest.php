<?php

namespace App\Tests\Unit\Entity;

use App\Entity\User;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class UserGetRolesTest extends TestCase
{
    public function testNewUserHasExactlyOneGuestRole(): void
    {
        self::assertSame(['ROLE_GUEST'], (new User())->getRoles());
    }

    public function testSetRolesStoresExactlyOneRole(): void
    {
        $user = (new User())->setRoles(['ROLE_SUPPORTER']);

        self::assertSame(['ROLE_SUPPORTER'], $user->getRoles());
        self::assertSame('ROLE_SUPPORTER', $user->getRole());
    }

    public function testSetRolesRejectsMultipleRoles(): void
    {
        $this->expectException(InvalidArgumentException::class);

        (new User())->setRoles(['ROLE_USER', 'ROLE_SUPPORTER']);
    }

    public function testSetRolesRejectsEmptyRoleList(): void
    {
        $this->expectException(InvalidArgumentException::class);

        (new User())->setRoles([]);
    }

    public function testAddRoleReplacesExistingRole(): void
    {
        $user = (new User())->setRoles(['ROLE_USER'])->addRole('ROLE_SUPPORTER');

        self::assertSame(['ROLE_SUPPORTER'], $user->getRoles());
    }

    public function testVerificationStateDoesNotAddAnotherRole(): void
    {
        $user = (new User())->setRoles(['ROLE_SUPPORTER'])->setIsVerified(true);

        self::assertSame(['ROLE_SUPPORTER'], $user->getRoles());
    }
}
