<?php

namespace Tests\Integration;

use App\Controller\Api\FeedbackController;
use App\Controller\Api\GamesController;
use App\Controller\Api\MyTeamController;
use App\Controller\Api\PlayersController;
use App\Controller\Api\SurveyController;
use App\Controller\Api\TaskController;
use App\Controller\Api\TeamsController;
use App\Controller\Api\TwoFactorController;
use App\Controller\CalendarController;
use App\Controller\ParticipationController;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Verifies that all API controllers can be instantiated from the DI container.
 *
 * This test specifically prevents the class of bug where a new constructor
 * dependency is added to a controller but the dev container cache is stale
 * (or the service is misconfigured), causing a runtime "Too few arguments"
 * error that only appears on application startup — not in unit tests.
 *
 * When any controller in this list gets a new constructor parameter that cannot
 * be resolved by the container, this test will fail immediately during
 * `vendor/bin/phpunit`, before a developer even opens a browser.
 */
class ContainerWiringTest extends KernelTestCase
{
    protected function tearDown(): void
    {
        parent::tearDown();
        restore_exception_handler();
    }

    /**
     * @param class-string $controllerClass
     */
    #[DataProvider('controllerClassProvider')]
    public function testControllerCanBeInstantiatedFromContainer(string $controllerClass): void
    {
        self::bootKernel();

        $controller = static::getContainer()->get($controllerClass);

        $this->assertInstanceOf(
            $controllerClass,
            $controller,
            sprintf(
                'Controller "%s" could not be retrieved from the DI container. ' .
                'Check that all constructor dependencies are properly configured.',
                $controllerClass
            )
        );
    }

    /**
     * @return array<string, array{class-string}>
     */
    public static function controllerClassProvider(): array
    {
        return [
            'TeamsController' => [TeamsController::class],
            'GamesController' => [GamesController::class],
            'FeedbackController' => [FeedbackController::class],
            'PlayersController' => [PlayersController::class],
            'MyTeamController' => [MyTeamController::class],
            'SurveyController' => [SurveyController::class],
            'TaskController' => [TaskController::class],
            'CalendarController' => [CalendarController::class],
            'ParticipationController' => [ParticipationController::class],
            'TwoFactorController' => [TwoFactorController::class],
        ];
    }
}
