<?php

namespace App\Tests\Unit\Controller;

use App\Controller\VideosController;
use App\Service\VideoTimelineService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class VideosControllerTest extends TestCase
{
    /**
     * Test dass der Controller korrekt initialisiert werden kann mit VideoTimelineService.
     */
    public function testControllerInitialization(): void
    {
        $videoTimelineService = $this->createMock(VideoTimelineService::class);

        $controller = new VideosController($videoTimelineService);

        $this->assertInstanceOf(VideosController::class, $controller);
    }
}
