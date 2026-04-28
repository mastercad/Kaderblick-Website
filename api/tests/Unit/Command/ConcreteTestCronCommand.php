<?php

declare(strict_types=1);

namespace App\Tests\Unit\Command;

use App\Command\AbstractCronCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Konkrete Testimplementierung von AbstractCronCommand, die das Verhalten
 * von doCronExecute() per Callable konfigurierbar macht.
 */
class ConcreteTestCronCommand extends AbstractCronCommand
{
    public const NAME = 'app:test-cron';

    /** @var callable(InputInterface, OutputInterface): int */
    private $handler;

    /**
     * @param callable(InputInterface, OutputInterface): int $handler
     */
    public function __construct(callable $handler)
    {
        parent::__construct(self::NAME);
        $this->handler = $handler;
    }

    protected function configure(): void
    {
        $this->setName(self::NAME);
    }

    protected function doCronExecute(InputInterface $input, OutputInterface $output): int
    {
        return ($this->handler)($input, $output);
    }
}
