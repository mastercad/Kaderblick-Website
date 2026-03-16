<?php

namespace App\Tests\Unit\Entity;

use App\Entity\SystemAlert;
use App\Enum\SystemAlertCategory;
use DateTimeImmutable;
use LogicException;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class SystemAlertTest extends TestCase
{
    private function makeAlert(
        SystemAlertCategory $category = SystemAlertCategory::SERVER_ERROR,
        string $fingerprint = 'abc123',
        string $message = 'Something broke'
    ): SystemAlert {
        return new SystemAlert($category, $fingerprint, $message);
    }

    // ── Constructor ────────────────────────────────────────────────────────

    public function testConstructorSetsFields(): void
    {
        $alert = $this->makeAlert(SystemAlertCategory::LOGIN_FAILURE, 'fp42', 'Bad login');

        $this->assertSame(SystemAlertCategory::LOGIN_FAILURE, $alert->getCategory());
        $this->assertSame('fp42', $alert->getFingerprint());
        $this->assertSame('Bad login', $alert->getMessage());
        $this->assertSame(1, $alert->getOccurrenceCount());
        $this->assertFalse($alert->isResolved());
        $this->assertNull($alert->getResolvedAt());
        $this->assertNull($alert->getResolvedNote());
        $this->assertNull($alert->getId());
    }

    public function testFirstAndLastOccurrenceAtAreSetOnConstruction(): void
    {
        $before = new DateTimeImmutable();
        $alert = $this->makeAlert();
        $after = new DateTimeImmutable();

        $this->assertGreaterThanOrEqual($before, $alert->getFirstOccurrenceAt());
        $this->assertLessThanOrEqual($after, $alert->getFirstOccurrenceAt());
        // Beide Timestamps werden direkt nacheinander gesetzt – sie liegen maximal 1ms auseinander
        $diff = abs($alert->getFirstOccurrenceAt()->getTimestamp() - $alert->getLastOccurrenceAt()->getTimestamp());
        $this->assertLessThanOrEqual(1, $diff, 'firstOccurrenceAt and lastOccurrenceAt should be set at the same time');
    }

    // ── incrementOccurrence ────────────────────────────────────────────────

    public function testIncrementOccurrenceIncrementsCount(): void
    {
        $alert = $this->makeAlert();
        $this->assertSame(1, $alert->getOccurrenceCount());

        $alert->incrementOccurrence();
        $this->assertSame(2, $alert->getOccurrenceCount());

        $alert->incrementOccurrence();
        $this->assertSame(3, $alert->getOccurrenceCount());
    }

    public function testIncrementOccurrenceUpdatesLastOccurrenceAt(): void
    {
        $alert = $this->makeAlert();
        $firstOccurrenceAt = $alert->getFirstOccurrenceAt();

        // Kleine Pause um sicherzustellen, dass die Zeit sich unterscheiden kann
        usleep(1000);
        $alert->incrementOccurrence();

        $this->assertGreaterThanOrEqual($firstOccurrenceAt, $alert->getLastOccurrenceAt());
    }

    public function testIncrementOccurrenceDoesNotChangeFirstOccurrenceAt(): void
    {
        $alert = $this->makeAlert();
        $original = $alert->getFirstOccurrenceAt();

        $alert->incrementOccurrence();
        $alert->incrementOccurrence();

        $this->assertEquals($original, $alert->getFirstOccurrenceAt());
    }

    public function testIncrementOccurrenceReturnsSelf(): void
    {
        $alert = $this->makeAlert();
        $result = $alert->incrementOccurrence();

        $this->assertSame($alert, $result);
    }

    // ── resolve ────────────────────────────────────────────────────────────

    public function testResolveMarksAsResolved(): void
    {
        $alert = $this->makeAlert();
        $alert->resolve('Problem behoben');

        $this->assertTrue($alert->isResolved());
        $this->assertSame('Problem behoben', $alert->getResolvedNote());
        $this->assertNotNull($alert->getResolvedAt());
    }

    public function testResolveWithoutNoteSetsNullNote(): void
    {
        $alert = $this->makeAlert();
        $alert->resolve();

        $this->assertTrue($alert->isResolved());
        $this->assertNull($alert->getResolvedNote());
    }

    public function testResolvedAtIsSetToNow(): void
    {
        $before = new DateTimeImmutable();
        $alert = $this->makeAlert();
        $alert->resolve();
        $after = new DateTimeImmutable();

        $this->assertGreaterThanOrEqual($before, $alert->getResolvedAt());
        $this->assertLessThanOrEqual($after, $alert->getResolvedAt());
    }

    // ── reopen ─────────────────────────────────────────────────────────────

    public function testReopenClearsResolvedState(): void
    {
        $alert = $this->makeAlert();
        $alert->resolve('fixed');

        $this->assertTrue($alert->isResolved());

        $alert->reopen();

        $this->assertFalse($alert->isResolved());
        $this->assertNull($alert->getResolvedAt());
        $this->assertNull($alert->getResolvedNote());
    }

    // ── Setters ────────────────────────────────────────────────────────────

    public function testSettersReturnSelf(): void
    {
        $alert = $this->makeAlert();

        $this->assertSame($alert, $alert->setRequestUri('/foo'));
        $this->assertSame($alert, $alert->setHttpMethod('POST'));
        $this->assertSame($alert, $alert->setClientIp('1.2.3.4'));
        $this->assertSame($alert, $alert->setExceptionClass(RuntimeException::class));
        $this->assertSame($alert, $alert->setStackTrace('#0 foo'));
        $this->assertSame($alert, $alert->setContext(['key' => 'val']));
    }

    public function testSettersStoreValues(): void
    {
        $alert = $this->makeAlert();
        $alert->setRequestUri('/api/test');
        $alert->setHttpMethod('GET');
        $alert->setClientIp('127.0.0.1');
        $alert->setExceptionClass(LogicException::class);
        $alert->setStackTrace('#0 bar');
        $alert->setContext(['foo' => 'bar']);

        $this->assertSame('/api/test', $alert->getRequestUri());
        $this->assertSame('GET', $alert->getHttpMethod());
        $this->assertSame('127.0.0.1', $alert->getClientIp());
        $this->assertSame(LogicException::class, $alert->getExceptionClass());
        $this->assertSame('#0 bar', $alert->getStackTrace());
        $this->assertSame(['foo' => 'bar'], $alert->getContext());
    }

    // ── toArray ────────────────────────────────────────────────────────────

    public function testToArrayContainsRequiredKeys(): void
    {
        $alert = $this->makeAlert(SystemAlertCategory::BRUTE_FORCE, 'fp99', 'Brute force!');
        $alert->setClientIp('10.0.0.1');

        $data = $alert->toArray();

        $this->assertSame('brute_force', $data['category']);
        $this->assertSame($alert->getCategory()->label(), $data['categoryLabel']);
        $this->assertSame($alert->getCategory()->icon(), $data['categoryIcon']);
        $this->assertSame($alert->getCategory()->color(), $data['categoryColor']);
        $this->assertSame('fp99', $data['fingerprint']);
        $this->assertSame('Brute force!', $data['message']);
        $this->assertSame('10.0.0.1', $data['clientIp']);
        $this->assertSame(1, $data['occurrenceCount']);
        $this->assertFalse($data['isResolved']);
        $this->assertNull($data['resolvedAt']);
        $this->assertArrayHasKey('firstOccurrenceAt', $data);
        $this->assertArrayHasKey('lastOccurrenceAt', $data);
    }

    public function testToArrayReflectsResolvedState(): void
    {
        $alert = $this->makeAlert();
        $alert->resolve('done');

        $data = $alert->toArray();

        $this->assertTrue($data['isResolved']);
        $this->assertSame('done', $data['resolvedNote']);
        $this->assertNotNull($data['resolvedAt']);
    }

    // ── SystemAlertCategory helpers ────────────────────────────────────────

    public function testCategoryLabelNotEmpty(): void
    {
        foreach (SystemAlertCategory::cases() as $case) {
            $this->assertNotEmpty($case->label(), "label() should not be empty for {$case->value}");
        }
    }

    public function testCategoryIconNotEmpty(): void
    {
        foreach (SystemAlertCategory::cases() as $case) {
            $this->assertNotEmpty($case->icon(), "icon() should not be empty for {$case->value}");
        }
    }

    public function testCategoryColorIsHexString(): void
    {
        foreach (SystemAlertCategory::cases() as $case) {
            $this->assertMatchesRegularExpression(
                '/^#[0-9a-fA-F]{6}$/',
                $case->color(),
                "color() for {$case->value} should be a hex color string"
            );
        }
    }
}
