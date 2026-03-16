<?php

namespace App\Command;

use App\Service\HeartbeatService;
use App\Service\WeatherService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:collect-weather-data-for-events',
    description: 'Add a short description for your command',
)]
class CollectWeatherDataForEventsCommand extends Command
{
    public function __construct(
        private WeatherService $weatherService,
        private HeartbeatService $heartbeatService,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $this->weatherService->retrieveWeatherData();

        $this->heartbeatService->beat('app:collect-weather-data-for-events');
        $io->success('Weather data has been collected for upcoming events.');

        return Command::SUCCESS;
    }
}
