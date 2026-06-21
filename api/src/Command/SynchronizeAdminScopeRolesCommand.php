<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\AdminScopeRoleSynchronizer;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:admin-scopes:synchronize-roles',
    description: 'Synchronisiert Team- und Vereinsadmin-Rollen anhand aktuell gültiger Zuständigkeiten.',
)]
class SynchronizeAdminScopeRolesCommand extends AbstractCronCommand
{
    public function __construct(
        private readonly AdminScopeRoleSynchronizer $roleSynchronizer,
    ) {
        parent::__construct();
    }

    protected function doCronExecute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $result = $this->roleSynchronizer->synchronizeAll();
        if ($result['skipped']) {
            $this->suppressHeartbeat();
            $io->note('Eine Synchronisierung läuft bereits. Dieser Lauf wurde ohne Wartezeit übersprungen.');

            return Command::SUCCESS;
        }

        $io->success(sprintf(
            '%d Vereinsadmins aktiviert, %d Teamadmins aktiviert, %d Rollen zurückgesetzt.',
            $result['clubPromotions'],
            $result['teamPromotions'],
            $result['demotions'],
        ));

        return Command::SUCCESS;
    }
}
