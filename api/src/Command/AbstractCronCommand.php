<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\HeartbeatService;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Contracts\Service\Attribute\Required;
use Throwable;

/**
 * Basisklasse für alle als Cron-Job betriebenen Symfony-Commands.
 *
 * Stellt sicher, dass nach jeder Ausführung:
 *   – der „Running"-Status im Cache gelöscht wird (egal ob Erfolg oder Fehler)
 *   – bei erfolgreichem Lauf (Command::SUCCESS) ein Heartbeat registriert wird
 *
 * Unterklassen implementieren doCronExecute() statt execute().
 *
 * Soll kein automatischer Heartbeat gesetzt werden (z. B. bei --dry-run),
 * kann suppressHeartbeat() innerhalb von doCronExecute() aufgerufen werden.
 *
 * Neue Cron-Commands MÜSSEN diese Klasse erweitern, damit der Heartbeat
 * garantiert und der Running-State korrekt verwaltet wird.
 */
abstract class AbstractCronCommand extends Command
{
    protected HeartbeatService $heartbeatService;

    private bool $suppressBeat = false;

    /**
     * Wird vom DI-Container via Setter-Injection gesetzt.
     * In Tests muss $command->setHeartbeatService($mock) manuell aufgerufen werden.
     */
    #[Required]
    public function setHeartbeatService(HeartbeatService $heartbeatService): void
    {
        $this->heartbeatService = $heartbeatService;
    }

    /**
     * Unterdrückt den automatischen Heartbeat am Ende dieser Ausführung.
     * Nützlich für Dry-Run-Modi, bei denen keine echte Arbeit geleistet wird.
     */
    protected function suppressHeartbeat(): void
    {
        $this->suppressBeat = true;
    }

    final protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->suppressBeat = false;
        $commandName = (string) $this->getName();

        try {
            $result = $this->doCronExecute($input, $output);
        } catch (Throwable $e) {
            // Fehler im Heartbeat-Service persistieren, damit die Admin-UI ihn anzeigen kann
            $this->heartbeatService->beatError(
                $commandName,
                get_class($e) . ': ' . $e->getMessage()
            );
            throw $e;
        } finally {
            // Running-State immer löschen – unabhängig von Erfolg, Fehler oder Exception
            // (beatError/beat rufen clearRunning intern ebenfalls auf – doppeltes Löschen ist harmlos)
            $this->heartbeatService->clearRunning($commandName);
        }

        if (Command::SUCCESS === $result && !$this->suppressBeat) { // @phpstan-ignore booleanNot.alwaysTrue
            $this->heartbeatService->beat($commandName);
        } elseif (Command::SUCCESS !== $result) {
            $this->heartbeatService->beatError($commandName, 'Job beendet mit Fehler-Statuscode.');
        }

        return $result;
    }

    abstract protected function doCronExecute(InputInterface $input, OutputInterface $output): int;
}
