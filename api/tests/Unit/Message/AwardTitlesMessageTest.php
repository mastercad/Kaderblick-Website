<?php

declare(strict_types=1);

namespace App\Tests\Unit\Message;

use App\Message\AwardTitlesMessage;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class AwardTitlesMessageTest extends TestCase
{
    public function testSeasonIsStoredCorrectly(): void
    {
        $message = new AwardTitlesMessage('2024/2025');

        $this->assertSame('2024/2025', $message->season);
    }

    public function testMessageIsReadonly(): void
    {
        $reflection = new ReflectionClass(AwardTitlesMessage::class);

        $this->assertTrue($reflection->isReadOnly());
    }
}
