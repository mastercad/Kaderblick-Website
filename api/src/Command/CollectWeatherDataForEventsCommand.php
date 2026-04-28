<?php

namespace App\Command;

use App\Service\WeatherService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Throwable;

#[AsCommand(
    name: 'app:collect-weather-data-for-events',
    description: 'Add a short description for your command',
)]
class CollectWeatherDataForEventsCommand extends AbstractCronCommand
{
    public function __construct(
        private WeatherService $weatherService,
    ) {
        parent::__construct();
    }

    protected function doCronExecute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        try {
            $this->weatherService->retrieveWeatherData();
        } catch (Throwable $e) {
            $io->error('Fehler beim Abrufen der Wetterdaten: ' . $e->getMessage());

            return self::FAILURE;
        }

        $io->success('Weather data has been collected for upcoming events.');

        return self::SUCCESS;
    }
}
