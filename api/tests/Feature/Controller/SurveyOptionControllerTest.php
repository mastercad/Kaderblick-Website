<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

/**
 * Feature-Tests für den SurveyOptionController (/api/survey-options).
 *
 * Fixtures: user6 = ROLE_USER, user7 = ROLE_USER, user21 = ROLE_SUPERADMIN
 */
final class SurveyOptionControllerTest extends ApiWebTestCase
{
    // ========== LIST ==========

    public function testListOptionsReturnsSystemOptions(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('GET', '/api/survey-options');
        self::assertResponseStatusCodeSame(Response::HTTP_OK);

        $data = json_decode($client->getResponse()->getContent(), true);
        self::assertIsArray($data);

        // Es sollten mindestens die System-Optionen aus den Fixtures existieren
        $systemOptions = array_filter($data, fn ($o) => true === $o['isSystem']);
        self::assertNotEmpty($systemOptions, 'System-Optionen aus Fixtures müssen vorhanden sein.');
    }

    public function testListOptionsIncludesOwnCustomOptions(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        // Eigene Option erstellen
        $client->request('POST', '/api/survey-options', [], [], [], json_encode([
            'optionText' => 'Meine Option',
        ]));
        self::assertResponseStatusCodeSame(Response::HTTP_CREATED);

        // Optionen-Liste abrufen
        $client->request('GET', '/api/survey-options');
        $data = json_decode($client->getResponse()->getContent(), true);

        $ownOptions = array_filter($data, fn ($o) => true === $o['isOwn']);
        self::assertNotEmpty($ownOptions, 'Eigene Optionen müssen in der Liste erscheinen.');

        $texts = array_column($ownOptions, 'optionText');
        self::assertContains('Meine Option', $texts);
    }

    public function testListOptionsDoesNotIncludeOtherUsersCustomOptions(): void
    {
        $client = static::createClient();

        // User6 erstellt eine Option
        $this->authenticateUser($client, 'user6@example.com');
        $client->request('POST', '/api/survey-options', [], [], [], json_encode([
            'optionText' => 'Nur für User6 sichtbar',
        ]));
        self::assertResponseStatusCodeSame(Response::HTTP_CREATED);

        // User7 ruft Optionen ab
        $this->authenticateUser($client, 'user7@example.com');
        $client->request('GET', '/api/survey-options');
        $data = json_decode($client->getResponse()->getContent(), true);

        $texts = array_column($data, 'optionText');
        self::assertNotContains('Nur für User6 sichtbar', $texts);
    }

    // ========== CREATE ==========

    public function testCreateCustomOptionAsUser(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('POST', '/api/survey-options', [], [], [], json_encode([
            'optionText' => 'Benutzerdefinierte Antwort',
        ]));
        self::assertResponseStatusCodeSame(Response::HTTP_CREATED);

        $data = json_decode($client->getResponse()->getContent(), true);
        self::assertArrayHasKey('id', $data);
        self::assertEquals('Benutzerdefinierte Antwort', $data['optionText']);
        self::assertFalse($data['isSystem']);
        self::assertTrue($data['isOwn']);
    }

    public function testCreateOptionWithEmptyTextFails(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('POST', '/api/survey-options', [], [], [], json_encode([
            'optionText' => '',
        ]));
        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testCreateOptionWithMissingTextFails(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('POST', '/api/survey-options', [], [], [], json_encode([
            'someField' => 'value',
        ]));
        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    // ========== DELETE ==========

    public function testDeleteOwnCustomOption(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        // Erstelle Option
        $client->request('POST', '/api/survey-options', [], [], [], json_encode([
            'optionText' => 'Zum Löschen',
        ]));
        $created = json_decode($client->getResponse()->getContent(), true);

        // Lösche Option
        $client->request('DELETE', '/api/survey-options/' . $created['id']);
        self::assertResponseStatusCodeSame(Response::HTTP_OK);

        $resp = json_decode($client->getResponse()->getContent(), true);
        self::assertTrue($resp['success']);
    }

    public function testDeleteSystemOptionFails(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        // System-Optionen abrufen
        $client->request('GET', '/api/survey-options');
        $data = json_decode($client->getResponse()->getContent(), true);

        $systemOption = null;
        foreach ($data as $o) {
            if (true === $o['isSystem']) {
                $systemOption = $o;
                break;
            }
        }
        self::assertNotNull($systemOption, 'Es muss eine System-Option existieren.');

        // Löschversuch
        $client->request('DELETE', '/api/survey-options/' . $systemOption['id']);
        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testDeleteOtherUsersOptionFails(): void
    {
        $client = static::createClient();

        // User6 erstellt Option
        $this->authenticateUser($client, 'user6@example.com');
        $client->request('POST', '/api/survey-options', [], [], [], json_encode([
            'optionText' => 'Gehört User6',
        ]));
        $created = json_decode($client->getResponse()->getContent(), true);

        // User7 versucht zu löschen
        $this->authenticateUser($client, 'user7@example.com');
        $client->request('DELETE', '/api/survey-options/' . $created['id']);
        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testAdminCanDeleteOtherUsersOption(): void
    {
        $client = static::createClient();

        // User6 erstellt Option
        $this->authenticateUser($client, 'user6@example.com');
        $client->request('POST', '/api/survey-options', [], [], [], json_encode([
            'optionText' => 'Admin löscht das',
        ]));
        $created = json_decode($client->getResponse()->getContent(), true);

        // Admin löscht
        $this->authenticateUser($client, 'user21@example.com');
        $client->request('DELETE', '/api/survey-options/' . $created['id']);
        self::assertResponseStatusCodeSame(Response::HTTP_OK);
    }

    // ========== SHOW ==========

    public function testShowSystemOption(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        // System-Option aus der Liste holen
        $client->request('GET', '/api/survey-options');
        $data = json_decode($client->getResponse()->getContent(), true);
        $system = array_values(array_filter($data, fn ($o) => $o['isSystem']));
        self::assertNotEmpty($system);

        $client->request('GET', '/api/survey-options/' . $system[0]['id']);
        self::assertResponseStatusCodeSame(Response::HTTP_OK);

        $option = json_decode($client->getResponse()->getContent(), true);
        self::assertTrue($option['isSystem']);
    }

    public function testShowOwnOption(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('POST', '/api/survey-options', [], [], [], json_encode([
            'optionText' => 'Eigene zum Anzeigen',
        ]));
        $created = json_decode($client->getResponse()->getContent(), true);

        $client->request('GET', '/api/survey-options/' . $created['id']);
        self::assertResponseStatusCodeSame(Response::HTTP_OK);

        $option = json_decode($client->getResponse()->getContent(), true);
        self::assertTrue($option['isOwn']);
        self::assertEquals('Eigene zum Anzeigen', $option['optionText']);
    }

    // ========== AUTHENTICATION ==========

    public function testListRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/survey-options');

        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testCreateRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('POST', '/api/survey-options', [], [], [], json_encode([
            'optionText' => 'Anon Option',
        ]));

        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testShowRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/survey-options/1');

        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testDeleteRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('DELETE', '/api/survey-options/1');

        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }
}
