<?php

namespace App\Tests\Unit\Entity;

use App\Entity\DemoRequest;
use App\Entity\User;
use DateTime;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for the DemoRequest entity.
 *
 * Covers: constants, constructor defaults, all getters/setters, isPending(), toArray()-like serialization.
 */
class DemoRequestTest extends TestCase
{
    // ─────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────

    public function testStatusPendingConstant(): void
    {
        $this->assertSame('pending', DemoRequest::STATUS_PENDING);
    }

    public function testStatusContactedConstant(): void
    {
        $this->assertSame('contacted', DemoRequest::STATUS_CONTACTED);
    }

    public function testStatusRejectedConstant(): void
    {
        $this->assertSame('rejected', DemoRequest::STATUS_REJECTED);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Constructor defaults
    // ─────────────────────────────────────────────────────────────────────

    public function testConstructorSetsCreatedAt(): void
    {
        $before = new DateTime();
        $req = new DemoRequest();
        $after = new DateTime();

        $this->assertGreaterThanOrEqual($before->getTimestamp(), $req->getCreatedAt()->getTimestamp());
        $this->assertLessThanOrEqual($after->getTimestamp(), $req->getCreatedAt()->getTimestamp());
    }

    public function testDefaultStatusIsPending(): void
    {
        $req = new DemoRequest();
        $this->assertSame(DemoRequest::STATUS_PENDING, $req->getStatus());
    }

    public function testDefaultIdIsNull(): void
    {
        $req = new DemoRequest();
        $this->assertNull($req->getId());
    }

    public function testDefaultOptionalFieldsAreNull(): void
    {
        $req = new DemoRequest();
        $this->assertNull($req->getClubName());
        $this->assertNull($req->getLeague());
        $this->assertNull($req->getAgeGroup());
        $this->assertNull($req->getPhone());
        $this->assertNull($req->getMessage());
        $this->assertNull($req->getProcessedAt());
        $this->assertNull($req->getProcessedBy());
        $this->assertNull($req->getAdminNote());
    }

    // ─────────────────────────────────────────────────────────────────────
    // Required fields
    // ─────────────────────────────────────────────────────────────────────

    public function testSetAndGetName(): void
    {
        $req = new DemoRequest();
        $result = $req->setName('Max Mustermann');
        $this->assertSame('Max Mustermann', $req->getName());
        $this->assertSame($req, $result); // fluent interface
    }

    public function testSetAndGetEmail(): void
    {
        $req = new DemoRequest();
        $result = $req->setEmail('max@example.com');
        $this->assertSame('max@example.com', $req->getEmail());
        $this->assertSame($req, $result);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Optional fields
    // ─────────────────────────────────────────────────────────────────────

    public function testSetAndGetClubName(): void
    {
        $req = new DemoRequest();
        $result = $req->setClubName('FC Bayern');
        $this->assertSame('FC Bayern', $req->getClubName());
        $this->assertSame($req, $result);
    }

    public function testSetClubNameToNull(): void
    {
        $req = new DemoRequest();
        $req->setClubName('FC Bayern');
        $req->setClubName(null);
        $this->assertNull($req->getClubName());
    }

    public function testSetAndGetLeague(): void
    {
        $req = new DemoRequest();
        $req->setLeague('Kreisliga A');
        $this->assertSame('Kreisliga A', $req->getLeague());
    }

    public function testSetAndGetAgeGroup(): void
    {
        $req = new DemoRequest();
        $req->setAgeGroup('U15');
        $this->assertSame('U15', $req->getAgeGroup());
    }

    public function testSetAndGetPhone(): void
    {
        $req = new DemoRequest();
        $req->setPhone('+49 170 1234567');
        $this->assertSame('+49 170 1234567', $req->getPhone());
    }

    public function testSetAndGetMessage(): void
    {
        $req = new DemoRequest();
        $req->setMessage('Ich interessiere mich für Kaderblick.');
        $this->assertSame('Ich interessiere mich für Kaderblick.', $req->getMessage());
    }

    // ─────────────────────────────────────────────────────────────────────
    // Status transitions
    // ─────────────────────────────────────────────────────────────────────

    public function testSetStatus(): void
    {
        $req = new DemoRequest();
        $result = $req->setStatus(DemoRequest::STATUS_CONTACTED);
        $this->assertSame(DemoRequest::STATUS_CONTACTED, $req->getStatus());
        $this->assertSame($req, $result);
    }

    public function testSetStatusToRejected(): void
    {
        $req = new DemoRequest();
        $req->setStatus(DemoRequest::STATUS_REJECTED);
        $this->assertSame(DemoRequest::STATUS_REJECTED, $req->getStatus());
    }

    // ─────────────────────────────────────────────────────────────────────
    // isPending()
    // ─────────────────────────────────────────────────────────────────────

    public function testIsPendingReturnsTrueForPendingStatus(): void
    {
        $req = new DemoRequest();
        // Default status is pending
        $this->assertTrue($req->isPending());
    }

    public function testIsPendingReturnsFalseAfterContacted(): void
    {
        $req = new DemoRequest();
        $req->setStatus(DemoRequest::STATUS_CONTACTED);
        $this->assertFalse($req->isPending());
    }

    public function testIsPendingReturnsFalseAfterRejected(): void
    {
        $req = new DemoRequest();
        $req->setStatus(DemoRequest::STATUS_REJECTED);
        $this->assertFalse($req->isPending());
    }

    // ─────────────────────────────────────────────────────────────────────
    // processedAt / processedBy / adminNote
    // ─────────────────────────────────────────────────────────────────────

    public function testSetAndGetProcessedAt(): void
    {
        $req = new DemoRequest();
        $dt = new DateTime('2026-05-06 10:00:00');
        $result = $req->setProcessedAt($dt);
        $this->assertSame($dt, $req->getProcessedAt());
        $this->assertSame($req, $result);
    }

    public function testSetProcessedAtToNull(): void
    {
        $req = new DemoRequest();
        $req->setProcessedAt(new DateTime());
        $req->setProcessedAt(null);
        $this->assertNull($req->getProcessedAt());
    }

    public function testSetAndGetProcessedBy(): void
    {
        $req = new DemoRequest();
        $user = $this->createStub(User::class);
        $result = $req->setProcessedBy($user);
        $this->assertSame($user, $req->getProcessedBy());
        $this->assertSame($req, $result);
    }

    public function testSetProcessedByToNull(): void
    {
        $req = new DemoRequest();
        $user = $this->createStub(User::class);
        $req->setProcessedBy($user);
        $req->setProcessedBy(null);
        $this->assertNull($req->getProcessedBy());
    }

    public function testSetAndGetAdminNote(): void
    {
        $req = new DemoRequest();
        $result = $req->setAdminNote('Kunde bereits bekannt');
        $this->assertSame('Kunde bereits bekannt', $req->getAdminNote());
        $this->assertSame($req, $result);
    }

    // ─────────────────────────────────────────────────────────────────────
    // createdAt setter
    // ─────────────────────────────────────────────────────────────────────

    public function testGetCreatedAtReturnsDateTime(): void
    {
        $req = new DemoRequest();
        $this->assertInstanceOf(DateTime::class, $req->getCreatedAt());
    }

    // ─────────────────────────────────────────────────────────────────────
    // Full lifecycle scenario
    // ─────────────────────────────────────────────────────────────────────

    public function testFullWorkflowFromPendingToContacted(): void
    {
        $req = new DemoRequest();
        $req->setName('Anna Müller')
            ->setEmail('anna@example.com')
            ->setClubName('SV Musterstadt')
            ->setLeague('Bezirksliga')
            ->setAgeGroup('U13')
            ->setPhone('0171 1234567')
            ->setMessage('Bitte Demo-Zugang.');

        $this->assertTrue($req->isPending());
        $this->assertSame('Anna Müller', $req->getName());
        $this->assertSame('anna@example.com', $req->getEmail());
        $this->assertSame('SV Musterstadt', $req->getClubName());
        $this->assertSame('Bezirksliga', $req->getLeague());
        $this->assertSame('U13', $req->getAgeGroup());
        $this->assertSame('0171 1234567', $req->getPhone());
        $this->assertSame('Bitte Demo-Zugang.', $req->getMessage());

        $admin = $this->createStub(User::class);
        $processedAt = new DateTime();

        $req->setStatus(DemoRequest::STATUS_CONTACTED)
            ->setProcessedAt($processedAt)
            ->setProcessedBy($admin)
            ->setAdminNote('Per E-Mail kontaktiert');

        $this->assertFalse($req->isPending());
        $this->assertSame(DemoRequest::STATUS_CONTACTED, $req->getStatus());
        $this->assertSame($processedAt, $req->getProcessedAt());
        $this->assertSame($admin, $req->getProcessedBy());
        $this->assertSame('Per E-Mail kontaktiert', $req->getAdminNote());
    }
}
