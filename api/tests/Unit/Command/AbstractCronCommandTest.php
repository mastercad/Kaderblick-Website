<?php

declare(strict_types=1);

namespace App\Tests\Unit\Command;

use App\Service\HeartbeatService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Tester\CommandTester;

#[AllowMockObjectsWithoutExpectations]
class AbstractCronCommandTest extends TestCase
{
    private HeartbeatService&MockObject $heartbeatService;

    /**
     * Erzeugt eine Command-Instanz mit dem gegebenen Handler und einem
     * fertig konfigurierten CommandTester.
     *
     * @param callable(InputInterface, OutputInterface): int $handler
     */
    private function buildTester(callable $handler): CommandTester
    {
        $command = new ConcreteTestCronCommand($handler);
        $command->setHeartbeatService($this->heartbeatService);

        $app = new Application();
        $app->addCommand($command);

        return new CommandTester($command);
    }

    protected function setUp(): void
    {
        $this->heartbeatService = $this->createMock(HeartbeatService::class);
    }

    // ── SUCCESS + Heartbeat ──────────────────────────────────────────────────

    public function testBeatCalledOnSuccess(): void
    {
        $this->heartbeatService
            ->expects($this->once())
            ->method('beat')
            ->with(ConcreteTestCronCommand::NAME);

        $tester = $this->buildTester(static fn () => Command::SUCCESS);
        $tester->execute([]);
    }

    public function testBeatErrorNotCalledOnSuccess(): void
    {
        $this->heartbeatService
            ->expects($this->never())
            ->method('beatError');

        $tester = $this->buildTester(static fn () => Command::SUCCESS);
        $tester->execute([]);
    }

    public function testExitCodeIsReturnedOnSuccess(): void
    {
        $tester = $this->buildTester(static fn () => Command::SUCCESS);
        $exitCode = $tester->execute([]);
        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    // ── SUCCESS + suppressHeartbeat ──────────────────────────────────────────

    public function testBeatNotCalledWhenSuppressed(): void
    {
        $this->heartbeatService
            ->expects($this->never())
            ->method('beat');

        $tester = $this->buildTester(static function (InputInterface $input, OutputInterface $output): int {
            return Command::SUCCESS;
        });

        // Separater Aufbau um suppressHeartbeat aufzurufen
        $command = new class (static function () {
        }) extends ConcreteTestCronCommand {
            public function __construct(callable $h)
            {
                parent::__construct($h);
            }

            protected function doCronExecute(InputInterface $input, OutputInterface $output): int
            {
                $this->suppressHeartbeat();

                return Command::SUCCESS;
            }
        };
        $command->setHeartbeatService($this->heartbeatService);

        $app = new Application();
        $app->addCommand($command);
        $t = new CommandTester($command);
        $t->execute([]);
    }

    public function testBeatErrorNotCalledWhenSuppressedOnSuccess(): void
    {
        $this->heartbeatService
            ->expects($this->never())
            ->method('beatError');

        $command = new class (static function (InputInterface $input, OutputInterface $output): int {
            return Command::SUCCESS;
        }) extends ConcreteTestCronCommand {
            protected function doCronExecute(InputInterface $input, OutputInterface $output): int
            {
                $this->suppressHeartbeat();

                return Command::SUCCESS;
            }
        };
        $command->setHeartbeatService($this->heartbeatService);

        $app = new Application();
        $app->addCommand($command);
        (new CommandTester($command))->execute([]);
    }

    // ── FAILURE ──────────────────────────────────────────────────────────────

    public function testBeatErrorCalledOnFailure(): void
    {
        $this->heartbeatService
            ->expects($this->once())
            ->method('beatError')
            ->with(ConcreteTestCronCommand::NAME, 'Job beendet mit Fehler-Statuscode.');

        $tester = $this->buildTester(static fn () => Command::FAILURE);
        $tester->execute([]);
    }

    public function testBeatNotCalledOnFailure(): void
    {
        $this->heartbeatService
            ->expects($this->never())
            ->method('beat');

        $tester = $this->buildTester(static fn () => Command::FAILURE);
        $tester->execute([]);
    }

    public function testExitCodeIsReturnedOnFailure(): void
    {
        $tester = $this->buildTester(static fn () => Command::FAILURE);
        $exitCode = $tester->execute([]);
        $this->assertSame(Command::FAILURE, $exitCode);
    }

    // ── clearRunning ─────────────────────────────────────────────────────────

    public function testClearRunningCalledOnSuccess(): void
    {
        $this->heartbeatService
            ->expects($this->once())
            ->method('clearRunning')
            ->with(ConcreteTestCronCommand::NAME);

        $tester = $this->buildTester(static fn () => Command::SUCCESS);
        $tester->execute([]);
    }

    public function testClearRunningCalledOnFailure(): void
    {
        $this->heartbeatService
            ->expects($this->once())
            ->method('clearRunning')
            ->with(ConcreteTestCronCommand::NAME);

        $tester = $this->buildTester(static fn () => Command::FAILURE);
        $tester->execute([]);
    }

    public function testClearRunningCalledEvenOnException(): void
    {
        $this->heartbeatService
            ->expects($this->once())
            ->method('clearRunning')
            ->with(ConcreteTestCronCommand::NAME);

        // beatError wird bei Exception aufgerufen (kein Fehler wenn es zusätzlich aufgerufen wird)
        $tester = $this->buildTester(static function (): int {
            throw new RuntimeException('Test-Ausnahme');
        });

        try {
            $tester->execute([]);
        } catch (RuntimeException) {
            // erwartet
        }
    }

    // ── Exception ────────────────────────────────────────────────────────────

    public function testBeatErrorCalledWithExceptionMessageOnException(): void
    {
        $this->heartbeatService
            ->expects($this->once())
            ->method('beatError')
            ->with(
                ConcreteTestCronCommand::NAME,
                'RuntimeException: Test-Ausnahme'
            );

        $tester = $this->buildTester(static function (): int {
            throw new RuntimeException('Test-Ausnahme');
        });

        try {
            $tester->execute([]);
        } catch (RuntimeException) {
            // erwartet
        }
    }

    public function testExceptionIsRethrown(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Test-Ausnahme');

        $tester = $this->buildTester(static function (): int {
            throw new RuntimeException('Test-Ausnahme');
        });

        $tester->execute([]);
    }

    public function testBeatNotCalledOnException(): void
    {
        $this->heartbeatService
            ->expects($this->never())
            ->method('beat');

        $tester = $this->buildTester(static function (): int {
            throw new RuntimeException('Test-Ausnahme');
        });

        try {
            $tester->execute([]);
        } catch (RuntimeException) {
            // erwartet
        }
    }

    // ── suppressBeat wird pro execute() zurückgesetzt ─────────────────────────

    public function testSuppressBeatResetBetweenExecutions(): void
    {
        // Erster Lauf: suppressiert → kein beat
        // Zweiter Lauf: nicht suppressiert → beat wird aufgerufen
        $command = new class (static function (InputInterface $input, OutputInterface $output): int {
            return Command::SUCCESS;
        }) extends ConcreteTestCronCommand {
            private int $runCount = 0;

            protected function doCronExecute(InputInterface $input, OutputInterface $output): int
            {
                if (0 === $this->runCount) {
                    $this->suppressHeartbeat();
                }
                ++$this->runCount;

                return Command::SUCCESS;
            }
        };

        $this->heartbeatService
            ->expects($this->once())   // nur beim zweiten Lauf
            ->method('beat');

        $command->setHeartbeatService($this->heartbeatService);
        $app = new Application();
        $app->addCommand($command);
        $t = new CommandTester($command);
        $t->execute([]);
        $t->execute([]);
    }
}
