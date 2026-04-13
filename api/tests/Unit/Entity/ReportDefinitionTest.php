<?php

namespace App\Tests\Unit\Entity;

use App\Entity\ReportDefinition;
use App\Entity\User;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class ReportDefinitionTest extends TestCase
{
    public function testConstructorSetsDefaults(): void
    {
        $report = new ReportDefinition();

        $this->assertNull($report->getId());
        $this->assertNull($report->getUser());
        $this->assertSame('', $report->getName());
        $this->assertNull($report->getDescription());
        $this->assertSame([], $report->getConfig());
        $this->assertFalse($report->isTemplate());
        $this->assertInstanceOf(DateTimeImmutable::class, $report->getCreatedAt());
        $this->assertInstanceOf(DateTimeImmutable::class, $report->getUpdatedAt());
        $this->assertCount(0, $report->getWidgets());
    }

    public function testSetAndGetId(): void
    {
        $report = new ReportDefinition();
        $result = $report->setId(42);

        $this->assertSame(42, $report->getId());
        $this->assertSame($report, $result, 'setId should return self');
    }

    public function testSetAndGetUser(): void
    {
        $user = $this->createMock(User::class);
        $report = new ReportDefinition();
        $result = $report->setUser($user);

        $this->assertSame($user, $report->getUser());
        $this->assertSame($report, $result);
    }

    public function testSetUserToNull(): void
    {
        $report = new ReportDefinition();
        $report->setUser($this->createMock(User::class));
        $report->setUser(null);

        $this->assertNull($report->getUser());
    }

    public function testSetAndGetName(): void
    {
        $report = new ReportDefinition();
        $result = $report->setName('Tore pro Spieler');

        $this->assertSame('Tore pro Spieler', $report->getName());
        $this->assertSame($report, $result);
    }

    public function testSetAndGetDescription(): void
    {
        $report = new ReportDefinition();
        $result = $report->setDescription('Zeigt alle Tore pro Spieler');

        $this->assertSame('Zeigt alle Tore pro Spieler', $report->getDescription());
        $this->assertSame($report, $result);
    }

    public function testSetDescriptionToNull(): void
    {
        $report = new ReportDefinition();
        $report->setDescription('Test');
        $report->setDescription(null);

        $this->assertNull($report->getDescription());
    }

    public function testSetAndGetConfig(): void
    {
        $config = [
            'diagramType' => 'bar',
            'xField' => 'player',
            'yField' => 'goals',
            'groupBy' => ['team'],
        ];

        $report = new ReportDefinition();
        $result = $report->setConfig($config);

        $this->assertSame($config, $report->getConfig());
        $this->assertSame($report, $result);
    }

    public function testSetAndGetIsTemplate(): void
    {
        $report = new ReportDefinition();
        $result = $report->setIsTemplate(true);

        $this->assertTrue($report->isTemplate());
        $this->assertSame($report, $result);
    }

    public function testSetAndGetCreatedAt(): void
    {
        $dt = new DateTimeImmutable('2025-01-01 12:00:00');
        $report = new ReportDefinition();
        $result = $report->setCreatedAt($dt);

        $this->assertSame($dt, $report->getCreatedAt());
        $this->assertSame($report, $result);
    }

    public function testSetAndGetUpdatedAt(): void
    {
        $dt = new DateTimeImmutable('2025-06-15 18:30:00');
        $report = new ReportDefinition();
        $result = $report->setUpdatedAt($dt);

        $this->assertSame($dt, $report->getUpdatedAt());
        $this->assertSame($report, $result);
    }

    public function testFluentApi(): void
    {
        $user = $this->createMock(User::class);
        $report = new ReportDefinition();

        $result = $report
            ->setName('Test Report')
            ->setDescription('A test')
            ->setUser($user)
            ->setConfig(['diagramType' => 'line'])
            ->setIsTemplate(false);

        $this->assertSame($report, $result);
        $this->assertSame('Test Report', $report->getName());
        $this->assertSame('A test', $report->getDescription());
        $this->assertSame($user, $report->getUser());
        $this->assertSame(['diagramType' => 'line'], $report->getConfig());
        $this->assertFalse($report->isTemplate());
    }
}
