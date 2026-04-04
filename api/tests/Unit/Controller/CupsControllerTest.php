<?php

namespace App\Tests\Unit\Controller;

use App\Controller\Api\CupsController;
use App\Repository\GameRepository;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;

class CupsControllerTest extends TestCase
{
    private EntityManagerInterface $entityManager;
    private GameRepository $gameRepository;
    private CupsController $controller;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->gameRepository = $this->createMock(GameRepository::class);
        $this->controller = new CupsController($this->entityManager, $this->gameRepository);
    }

    public function testControllerCanBeInstantiated(): void
    {
        $this->assertInstanceOf(CupsController::class, $this->controller);
    }

    public function testControllerExtendsAbstractController(): void
    {
        $this->assertInstanceOf(AbstractController::class, $this->controller);
    }

    public function testControllerAcceptsEntityManagerDependency(): void
    {
        $em1 = $this->createMock(EntityManagerInterface::class);
        $em2 = $this->createMock(EntityManagerInterface::class);

        $repo1 = $this->createMock(GameRepository::class);
        $repo2 = $this->createMock(GameRepository::class);

        $controller1 = new CupsController($em1, $repo1);
        $controller2 = new CupsController($em2, $repo2);

        $this->assertInstanceOf(CupsController::class, $controller1);
        $this->assertInstanceOf(CupsController::class, $controller2);
        $this->assertNotSame($controller1, $controller2);
    }
}
