<?php

declare(strict_types=1);

namespace App\Tests\Unit\Entity;

use App\Entity\User;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for the Google avatar fields added to User.
 *
 * Covered fields:
 *   – googleAvatarUrl : the picture URL returned by Google on each OAuth login
 *   – useGoogleAvatar : user preference to display the Google picture instead of the
 *                       locally uploaded avatar
 */
class UserGoogleAvatarTest extends TestCase
{
    // ── googleAvatarUrl ───────────────────────────────────────────────────────

    public function testGoogleAvatarUrlIsNullByDefault(): void
    {
        $user = new User();

        $this->assertNull($user->getGoogleAvatarUrl());
    }

    public function testSetGoogleAvatarUrl(): void
    {
        $user = new User();
        $url = 'https://lh3.googleusercontent.com/a/ACg8ocL1234=s96-c';

        $user->setGoogleAvatarUrl($url);

        $this->assertSame($url, $user->getGoogleAvatarUrl());
    }

    public function testSetGoogleAvatarUrlToNull(): void
    {
        $user = new User();
        $user->setGoogleAvatarUrl('https://example.com/photo.jpg');

        $user->setGoogleAvatarUrl(null);

        $this->assertNull($user->getGoogleAvatarUrl());
    }

    public function testSetGoogleAvatarUrlReturnsSelf(): void
    {
        $user = new User();
        $result = $user->setGoogleAvatarUrl('https://example.com/photo.jpg');

        $this->assertSame($user, $result);
    }

    // ── useGoogleAvatar ───────────────────────────────────────────────────────

    public function testUseGoogleAvatarIsFalseByDefault(): void
    {
        $user = new User();

        $this->assertFalse($user->isUseGoogleAvatar());
    }

    public function testSetUseGoogleAvatarToTrue(): void
    {
        $user = new User();

        $user->setUseGoogleAvatar(true);

        $this->assertTrue($user->isUseGoogleAvatar());
    }

    public function testSetUseGoogleAvatarToFalse(): void
    {
        $user = new User();
        $user->setUseGoogleAvatar(true);

        $user->setUseGoogleAvatar(false);

        $this->assertFalse($user->isUseGoogleAvatar());
    }

    public function testSetUseGoogleAvatarReturnsSelf(): void
    {
        $user = new User();
        $result = $user->setUseGoogleAvatar(true);

        $this->assertSame($user, $result);
    }

    // ── independence from avatarFilename ──────────────────────────────────────

    public function testUseGoogleAvatarAndAvatarFilenameAreIndependent(): void
    {
        $user = new User();
        $user->setAvatarFilename('uploaded.jpg');
        $user->setUseGoogleAvatar(true);
        $user->setGoogleAvatarUrl('https://example.com/google.jpg');

        // Both can coexist – the consumer decides which to display
        $this->assertSame('uploaded.jpg', $user->getAvatarFilename());
        $this->assertSame('https://example.com/google.jpg', $user->getGoogleAvatarUrl());
        $this->assertTrue($user->isUseGoogleAvatar());
    }
}
