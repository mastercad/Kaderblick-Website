<?php

namespace App\Tests\Unit\Controller\Api;

use App\Controller\Api\SurveyResponseController;
use App\Entity\Survey;
use App\Entity\User;
use App\Event\SurveyCompletedEvent;
use App\Repository\SurveyRepository;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Tests that SurveyResponseController::create() dispatches SurveyCompletedEvent
 * for authenticated users, and skips the dispatch for anonymous users.
 */
#[AllowMockObjectsWithoutExpectations]
class SurveyResponseControllerXpTest extends TestCase
{
    private SurveyResponseController $controller;
    private EventDispatcherInterface&MockObject $dispatcher;

    protected function setUp(): void
    {
        $this->dispatcher = $this->createMock(EventDispatcherInterface::class);
        $this->controller = new SurveyResponseController($this->dispatcher);
    }

    public function testDispatchesSurveyCompletedEventForLoggedInUser(): void
    {
        $user = $this->createMock(User::class);
        $survey = $this->createMock(Survey::class);

        $this->wireUser($user);

        $em = $this->createMock(EntityManagerInterface::class);
        $surveyRepo = $this->createMock(SurveyRepository::class);
        $surveyRepo->method('find')->willReturn($survey);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(SurveyCompletedEvent::class));

        $request = new Request(
            content: json_encode(['surveyId' => 1, 'answers' => ['q1' => 'a1']]),
        );

        $this->controller->create($request, $em, $surveyRepo);
    }

    public function testNoEventDispatchedWhenUserIsAnonymous(): void
    {
        $survey = $this->createMock(Survey::class);

        $this->wireUser(null);

        $em = $this->createMock(EntityManagerInterface::class);
        $surveyRepo = $this->createMock(SurveyRepository::class);
        $surveyRepo->method('find')->willReturn($survey);

        $this->dispatcher
            ->expects($this->never())
            ->method('dispatch');

        $request = new Request(
            content: json_encode(['surveyId' => 1, 'answers' => ['q1' => 'a1']]),
        );

        $this->controller->create($request, $em, $surveyRepo);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private function wireUser(?User $user): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $authChecker = $this->createMock(AuthorizationCheckerInterface::class);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $authChecker);

        $this->controller->setContainer($container);
    }
}
