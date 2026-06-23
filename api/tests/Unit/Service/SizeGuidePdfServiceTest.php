<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Service\SizeGuidePdfService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use Twig\Environment;

/**
 * Unit tests for SizeGuidePdfService.
 *
 * The private helpers aggregate() and buildTemplateData() are exercised via
 * Reflection. generatePdf() is covered by a smoke test that verifies real
 * dompdf output starts with the PDF magic bytes.
 *
 * No database, no file system (except sys_get_temp_dir as a projectDir stub).
 */
#[AllowMockObjectsWithoutExpectations]
class SizeGuidePdfServiceTest extends TestCase
{
    private SizeGuidePdfService $service;
    private ReflectionMethod $aggregate;
    private ReflectionMethod $buildTemplateData;

    protected function setUp(): void
    {
        // sys_get_temp_dir() is used as projectDir – no logo.png exists there,
        // so logoBase64 will be null in all buildTemplateData() tests.
        $this->service = new SizeGuidePdfService(
            $this->createMock(Environment::class),
            sys_get_temp_dir(),
        );

        $this->aggregate = new ReflectionMethod(SizeGuidePdfService::class, 'aggregate');
        $this->buildTemplateData = new ReflectionMethod(SizeGuidePdfService::class, 'buildTemplateData');
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /**
     * @param array<array<string, mixed>> $players
     *
     * @return array<array-key, int>
     */
    private function agg(array $players, string $key): array
    {
        /* @var array<array-key, int> */
        return $this->aggregate->invoke($this->service, $players, $key);
    }

    /**
     * @param array<array<string, mixed>> $players
     *
     * @return array<string, mixed>
     */
    private function build(string $teamName, array $players): array
    {
        /* @var array<string, mixed> */
        return $this->buildTemplateData->invoke($this->service, $teamName, $players);
    }

    /**
     * Build a minimal player array matching the shape produced by the controller.
     *
     * @return array<string, mixed>
     */
    private function player(
        string $name,
        ?string $shirt,
        ?string $shorts,
        ?string $shoe,
        ?string $socks = null,
        ?string $jacket = null,
        int $id = 0,
    ): array {
        return [
            'id' => $id ?: random_int(1, 9_999),
            'name' => $name,
            'shirt_size' => $shirt,
            'shorts_size' => $shorts,
            'shoe_size' => $shoe,
            'socks_size' => $socks,
            'jacket_size' => $jacket,
        ];
    }

    // ═════════════════════════════════════════════════════════════════════════
    // aggregate()
    // ═════════════════════════════════════════════════════════════════════════

    public function testAggregateSkipsEmptyString(): void
    {
        $result = $this->agg([['shirt_size' => '']], 'shirt_size');

        $this->assertEmpty($result);
    }

    public function testAggregateSkipsNull(): void
    {
        $result = $this->agg([['shirt_size' => null]], 'shirt_size');

        $this->assertEmpty($result);
    }

    public function testAggregateSkipsMissingKey(): void
    {
        $result = $this->agg([[]], 'shirt_size');

        $this->assertEmpty($result);
    }

    public function testAggregateSkipsZeroString(): void
    {
        $result = $this->agg([['shoe_size' => '0']], 'shoe_size');

        $this->assertEmpty($result);
        $this->assertArrayNotHasKey('0', $result);
    }

    public function testAggregateSkipsZeroAmongValidSizes(): void
    {
        $players = [
            ['shoe_size' => '42'],
            ['shoe_size' => '0'],
            ['shoe_size' => '43'],
            ['shoe_size' => '42'],
        ];

        $result = $this->agg($players, 'shoe_size');

        $this->assertSame(2, $result['42']);
        $this->assertSame(1, $result['43']);
        $this->assertArrayNotHasKey('0', $result);
    }

    public function testAggregateCountsValidSizes(): void
    {
        $players = [
            ['shirt_size' => 'M'],
            ['shirt_size' => 'M'],
            ['shirt_size' => 'L'],
        ];

        $result = $this->agg($players, 'shirt_size');

        $this->assertSame(2, $result['M']);
        $this->assertSame(1, $result['L']);
    }

    public function testAggregateCountsSinglePlayer(): void
    {
        $result = $this->agg([['shirt_size' => 'XL']], 'shirt_size');

        $this->assertSame(['XL' => 1], $result);
    }

    public function testAggregateMixedNullAndValid(): void
    {
        $players = [
            ['socks_size' => null],
            ['socks_size' => 'M'],
            ['socks_size' => '0'],
            ['socks_size' => 'M'],
        ];

        $result = $this->agg($players, 'socks_size');

        $this->assertSame(['M' => 2], $result);
    }

    public function testAggregateSortsClothingSizesInKnownOrder(): void
    {
        $players = [
            ['shirt_size' => 'L'],
            ['shirt_size' => 'XS'],
            ['shirt_size' => 'XXL'],
            ['shirt_size' => 'M'],
            ['shirt_size' => 'S'],
        ];

        $keys = array_keys($this->agg($players, 'shirt_size'));

        $this->assertSame(['XS', 'S', 'M', 'L', 'XXL'], $keys);
    }

    public function testAggregateSortsNumericSizesAscending(): void
    {
        $players = [
            ['shoe_size' => '44'],
            ['shoe_size' => '40'],
            ['shoe_size' => '42'],
        ];

        // PHP auto-casts purely numeric string keys to integers in arrays
        $keys = array_map('strval', array_keys($this->agg($players, 'shoe_size')));

        $this->assertSame(['40', '42', '44'], $keys);
    }

    public function testAggregateClothingSizesPrecedeNumericSizes(): void
    {
        // XS must appear before any numeric value
        $players = [
            ['shirt_size' => '40'],
            ['shirt_size' => 'XS'],
        ];

        $keys = array_keys($this->agg($players, 'shirt_size'));

        $this->assertSame('XS', $keys[0], 'Clothing sizes must be sorted before numeric ones.');
    }

    public function testAggregateAllZeroProducesEmptyResult(): void
    {
        $players = [
            ['shoe_size' => '0'],
            ['shoe_size' => '0'],
        ];

        $this->assertEmpty($this->agg($players, 'shoe_size'));
    }

    // ═════════════════════════════════════════════════════════════════════════
    // buildTemplateData()
    // ═════════════════════════════════════════════════════════════════════════

    public function testBuildTemplateDataTeamName(): void
    {
        $data = $this->build('Testteam', []);

        $this->assertSame('Testteam', $data['teamName']);
    }

    public function testBuildTemplateDataTotalPlayersCount(): void
    {
        $players = [
            $this->player('A', 'M', 'L', '42'),
            $this->player('B', 'L', 'XL', '44'),
        ];

        $this->assertSame(2, $this->build('Team', $players)['totalPlayers']);
    }

    public function testBuildTemplateDataZeroPlayersIsValid(): void
    {
        $data = $this->build('Leeres Team', []);

        $this->assertSame(0, $data['totalPlayers']);
        $this->assertEmpty($data['players']);
    }

    public function testBuildTemplateDataSortsPlayersByNameNaturally(): void
    {
        $players = [
            $this->player('Zimmermann', null, null, null),
            $this->player('Auer', null, null, null),
            $this->player('müller', null, null, null), // lowercase to test case-insensitivity
        ];

        $names = array_column($this->build('Team', $players)['players'], 'name');

        $this->assertSame(['Auer', 'müller', 'Zimmermann'], $names);
    }

    public function testBuildTemplateDataSummariesContainAllFiveCategories(): void
    {
        $data = $this->build('Team', []);

        foreach (['shirt', 'shorts', 'jacket', 'socks', 'shoes'] as $key) {
            $this->assertArrayHasKey($key, $data['summaries'], "Missing summary key: $key");
        }
    }

    public function testBuildTemplateDataSummariesAggregateCorrectly(): void
    {
        $players = [
            $this->player('A', 'M', 'L', '42', 'M', 'S'),
            $this->player('B', 'M', 'XL', '44', 'L', 'M'),
            $this->player('C', null, null, null),
        ];

        $summaries = $this->build('Team', $players)['summaries'];

        $this->assertSame(2, $summaries['shirt']['M']);
        $this->assertSame(1, $summaries['shorts']['L']);
        $this->assertSame(1, $summaries['shorts']['XL']);
        $this->assertSame(1, $summaries['shoes']['42']);
        $this->assertSame(1, $summaries['shoes']['44']);
        $this->assertSame(1, $summaries['socks']['M']);
        $this->assertSame(1, $summaries['socks']['L']);
    }

    public function testBuildTemplateDataZeroShoeAndSocksSizeExcludedFromSummaries(): void
    {
        $players = [
            $this->player('A', 'M', 'L', '0', '0'),
        ];

        $summaries = $this->build('Team', $players)['summaries'];

        $this->assertArrayNotHasKey('0', $summaries['shoes']);
        $this->assertArrayNotHasKey('0', $summaries['socks']);
    }

    public function testBuildTemplateDataLogoIsNullWhenFileDoesNotExist(): void
    {
        // sys_get_temp_dir() as projectDir means the Kaderblick mark won't exist
        $this->assertNull($this->build('Team', [])['logoBase64']);
    }

    public function testBuildTemplateDataEmbedsKaderblickSvgFromProject(): void
    {
        $service = new SizeGuidePdfService($this->createMock(Environment::class), dirname(__DIR__, 3));
        $method = new ReflectionMethod(SizeGuidePdfService::class, 'buildTemplateData');
        $data = $method->invoke($service, 'Team', []);

        $this->assertIsArray($data);
        $this->assertIsString($data['logoBase64']);
        $this->assertStringStartsWith('data:image/png;base64,', $data['logoBase64']);
    }

    public function testBuildTemplateDataGeneratedAtMatchesDateFormat(): void
    {
        $generatedAt = $this->build('Team', [])['generatedAt'];

        $this->assertMatchesRegularExpression(
            '/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/',
            $generatedAt,
            'generatedAt must match d.m.Y H:i format.',
        );
    }

    public function testBuildTemplateDataMissingAnyContainsPlayerWithNullShirtSize(): void
    {
        $players = [
            $this->player('A', null, 'M', '42'),
            $this->player('B', 'M', 'M', '42'),
        ];

        $this->assertCount(1, $this->build('Team', $players)['missingAny']);
    }

    public function testBuildTemplateDataMissingAnyContainsPlayerWithNullShortsSize(): void
    {
        $players = [
            $this->player('A', 'M', null, '42'),
            $this->player('B', 'M', 'L', '42'),
        ];

        $this->assertCount(1, $this->build('Team', $players)['missingAny']);
    }

    public function testBuildTemplateDataMissingAnyContainsPlayerWithNullShoeSize(): void
    {
        $players = [
            $this->player('A', 'M', 'L', null),
            $this->player('B', 'M', 'L', '42'),
        ];

        $this->assertCount(1, $this->build('Team', $players)['missingAny']);
    }

    public function testBuildTemplateDataMissingAnyIsEmptyWhenAllPlayersHaveRequiredSizes(): void
    {
        $players = [
            $this->player('A', 'M', 'L', '42'),
            $this->player('B', 'XL', 'XL', '44'),
        ];

        $this->assertCount(0, $this->build('Team', $players)['missingAny']);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // generatePdf() – smoke test
    // ═════════════════════════════════════════════════════════════════════════

    public function testGeneratePdfReturnsBytesStartingWithPdfMagicBytes(): void
    {
        $twig = $this->createMock(Environment::class);
        $twig->method('render')->willReturn('<html><body><p>Testinhalt</p></body></html>');

        $service = new SizeGuidePdfService($twig, sys_get_temp_dir());
        $result = $service->generatePdf('Testteam', []);

        $this->assertNotEmpty($result);
        $this->assertStringStartsWith('%PDF', $result, 'generatePdf() must return a valid PDF binary.');
    }

    public function testGeneratePdfWithPlayersProducesPdf(): void
    {
        $players = [
            $this->player('Müller Max', 'M', 'L', '42', 'M', 'S'),
            $this->player('Schmidt Tom', null, null, null),
        ];

        $twig = $this->createMock(Environment::class);
        $twig->method('render')->willReturn(
            '<html><body><p>M</p><p>42</p></body></html>',
        );

        $service = new SizeGuidePdfService($twig, sys_get_temp_dir());
        $result = $service->generatePdf('Testteam', $players);

        $this->assertStringStartsWith('%PDF', $result);
    }

    public function testGeneratePdfOutputIsNonEmptyString(): void
    {
        $twig = $this->createMock(Environment::class);
        $twig->method('render')->willReturn('<html><body></body></html>');

        $service = new SizeGuidePdfService($twig, sys_get_temp_dir());

        /* @phpstan-ignore method.alreadyNarrowedType */
        $this->assertIsString($service->generatePdf('Team', []));
        $this->assertGreaterThan(0, strlen($service->generatePdf('Team', [])));
    }
}
