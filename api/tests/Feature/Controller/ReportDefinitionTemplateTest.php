<?php

namespace App\Tests\Feature\Controller;

use App\Entity\ReportDefinition;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Tests für die Template-Logik im ReportController (API):
 *
 * – POST /api/report/definition
 *   · Normaler User kann kein Template anlegen (isTemplate wird auf false erzwungen)
 *   · Admin/SuperAdmin kann ein Template anlegen (isTemplate=true, user=null)
 *
 * – PUT /api/report/definition/{id}
 *   · Normaler User bearbeitet Template → bekommt eine persönliche Kopie (neue ID)
 *   · Admin bearbeitet Template → Änderung in-place (keine neue ID)
 *   · Admin kann eigenen Report zum Template promoten (isTemplate=true setzen)
 *   · Admin kann Template wieder auf normalen Report zurückstufen (isTemplate=false)
 */
class ReportDefinitionTemplateTest extends WebTestCase
{
    private const PREFIX = 'rpt-tpl-test-';
    private const BASIC_CONFIG = [
        'diagramType' => 'bar',
        'xField' => 'player',
        'yField' => 'goals',
        'filters' => [],
        'groupBy' => [],
        'metrics' => [],
        'showLegend' => true,
        'showLabels' => false,
    ];

    private KernelBrowser $client;
    private EntityManagerInterface $em;
    private User $u6;
    private User $u16;
    private User $u21;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        /** @var User $u6 */
        $u6 = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $this->assertNotNull($u6, 'Fixture user user6@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->u6 = $u6;
        /** @var User $u16 */
        $u16 = $this->em->getRepository(User::class)->findOneBy(['email' => 'user16@example.com']);
        $this->assertNotNull($u16, 'Fixture user user16@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->u16 = $u16;
        /** @var User $u21 */
        $u21 = $this->em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);
        $this->assertNotNull($u21, 'Fixture user user21@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->u21 = $u21;
    }

    // =========================================================================
    //  POST /api/report/definition — isTemplate beim Erstellen
    // =========================================================================

    public function testRegularUserCannotCreateTemplate(): void
    {
        $user = $this->u6;

        $this->client->loginUser($user);
        $this->client->request(
            'POST',
            '/api/report/definition',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name' => self::PREFIX . 'My Report',
                'config' => self::BASIC_CONFIG,
                'isTemplate' => true,
            ]),
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('id', $data);

        $report = $this->em->find(ReportDefinition::class, $data['id']);
        $this->assertNotNull($report);
        $this->assertFalse($report->isTemplate(), 'Regular user must not create a template.');
        $this->assertNotNull($report->getUser(), 'Report should be owned by the user.');
    }

    public function testAdminCanCreateTemplate(): void
    {
        $admin = $this->u16;

        $this->client->loginUser($admin);
        $this->client->request(
            'POST',
            '/api/report/definition',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name' => self::PREFIX . 'Admin Template',
                'config' => self::BASIC_CONFIG,
                'isTemplate' => true,
            ]),
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('id', $data);

        $report = $this->em->find(ReportDefinition::class, $data['id']);
        $this->assertNotNull($report);
        $this->assertTrue($report->isTemplate(), 'Admin must be able to create a template.');
        $this->assertNull($report->getUser(), 'Template reports must have no user owner.');
    }

    public function testSuperAdminCanCreateTemplate(): void
    {
        $superAdmin = $this->u21;

        $this->client->loginUser($superAdmin);
        $this->client->request(
            'POST',
            '/api/report/definition',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name' => self::PREFIX . 'SuperAdmin Template',
                'config' => self::BASIC_CONFIG,
                'isTemplate' => true,
            ]),
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $report = $this->em->find(ReportDefinition::class, $data['id']);
        $this->assertTrue($report->isTemplate());
        $this->assertNull($report->getUser());
    }

    // =========================================================================
    //  PUT /api/report/definition/{id} — Bearbeitung von Templates
    // =========================================================================

    public function testRegularUserEditingTemplateGetsCopy(): void
    {
        $template = $this->createTemplateReport(self::PREFIX . 'Template A');
        $user = $this->u6;

        $this->client->loginUser($user);
        $this->client->request(
            'PUT',
            '/api/report/definition/' . $template->getId(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name' => self::PREFIX . 'My Copy',
                'config' => self::BASIC_CONFIG,
                'isTemplate' => false,
            ]),
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        // Response must contain a NEW report id (the copy)
        $this->assertArrayHasKey('id', $data, 'Non-admin editing a template must receive a copy id.');
        $this->assertNotEquals($template->getId(), $data['id'], 'Copy must have a different id than the original template.');

        // Original template must remain unchanged — re-fetch after detach
        $this->em->clear();
        $originalTemplate = $this->em->find(ReportDefinition::class, $template->getId());
        $this->assertNotNull($originalTemplate);
        $this->assertTrue($originalTemplate->isTemplate(), 'Original template must remain a template after copy creation.');

        // Copy must belong to the user and must not be a template
        $copy = $this->em->find(ReportDefinition::class, $data['id']);
        $this->assertNotNull($copy);
        $this->assertFalse($copy->isTemplate());
        $this->assertSame($user->getId(), $copy->getUser()?->getId());
    }

    public function testAdminEditingTemplateUpdatesInPlace(): void
    {
        $template = $this->createTemplateReport(self::PREFIX . 'Template B');
        $admin = $this->u16;

        $newName = self::PREFIX . 'Updated Template B';

        $this->client->loginUser($admin);
        $this->client->request(
            'PUT',
            '/api/report/definition/' . $template->getId(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name' => $newName,
                'config' => self::BASIC_CONFIG,
                'isTemplate' => true,
            ]),
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        // No new id in response — edit was in-place
        $this->assertArrayNotHasKey('id', $data, 'Admin editing template in-place must not return a new id.');

        // Template must be updated
        $this->em->clear();
        $updated = $this->em->find(ReportDefinition::class, $template->getId());
        $this->assertSame($newName, $updated->getName());
        $this->assertTrue($updated->isTemplate());
    }

    // =========================================================================
    //  PUT /api/report/definition/{id} — isTemplate-Wechsel durch Admin
    // =========================================================================

    public function testAdminCanPromoteOwnReportToTemplate(): void
    {
        $admin = $this->u16;
        $report = $this->createOwnedReport(self::PREFIX . 'Promote Me', $admin);

        $this->client->loginUser($admin);
        $this->client->request(
            'PUT',
            '/api/report/definition/' . $report->getId(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name' => $report->getName(),
                'config' => self::BASIC_CONFIG,
                'isTemplate' => true,
            ]),
        );

        $this->assertResponseIsSuccessful();
        $this->em->clear();
        $promoted = $this->em->find(ReportDefinition::class, $report->getId());
        $this->assertTrue($promoted->isTemplate(), 'Admin must be able to promote a report to template.');
        $this->assertNull($promoted->getUser(), 'Promoted template must have user=null.');
    }

    public function testAdminCanDemoteTemplateToRegularReport(): void
    {
        $admin = $this->u16;
        $template = $this->createTemplateReport(self::PREFIX . 'Demote Me');

        $this->client->loginUser($admin);
        $this->client->request(
            'PUT',
            '/api/report/definition/' . $template->getId(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name' => $template->getName(),
                'config' => self::BASIC_CONFIG,
                'isTemplate' => false,
            ]),
        );

        $this->assertResponseIsSuccessful();
        $this->em->clear();
        $demoted = $this->em->find(ReportDefinition::class, $template->getId());
        $this->assertFalse($demoted->isTemplate(), 'Admin must be able to demote a template to a regular report.');
    }

    // =========================================================================
    //  Helpers
    // =========================================================================

    private function createTemplateReport(string $name): ReportDefinition
    {
        $report = new ReportDefinition();
        $report->setName($name);
        $report->setConfig(self::BASIC_CONFIG);
        $report->setIsTemplate(true);
        $report->setUser(null);
        $this->em->persist($report);
        $this->em->flush();

        return $report;
    }

    private function createOwnedReport(string $name, User $owner): ReportDefinition
    {
        $report = new ReportDefinition();
        $report->setName($name);
        $report->setConfig(self::BASIC_CONFIG);
        $report->setIsTemplate(false);
        $report->setUser($owner);
        $this->em->persist($report);
        $this->em->flush();

        return $report;
    }

    protected function tearDown(): void
    {
        $conn = $this->em->getConnection();

        // Remove widget relations first to avoid FK violations
        $conn->executeStatement(
            'DELETE dw FROM dashboard_widgets dw
             INNER JOIN report_definitions rd ON rd.id = dw.report_definition_id
             WHERE rd.name LIKE :prefix',
            ['prefix' => self::PREFIX . '%'],
        );

        $conn->executeStatement(
            'DELETE FROM report_definitions WHERE name LIKE :prefix',
            ['prefix' => self::PREFIX . '%'],
        );

        $this->em->close();
        parent::tearDown();
        restore_exception_handler();
    }
}
