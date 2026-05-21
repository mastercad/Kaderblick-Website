<?php

namespace App\Service;

use App\Entity\PublicHoliday;
use App\Repository\PublicHolidayRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class PublicHolidayService
{
    private const API_URL = 'https://feiertage-api.de/api/';

    public function __construct(
        private readonly PublicHolidayRepository $repository,
        private readonly EntityManagerInterface $entityManager,
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    /**
     * Gibt die Feiertage für Jahr und Bundesland zurück.
     * Beim ersten Aufruf werden sie von feiertage-api.de geladen und in der DB gespeichert.
     * Alle weiteren Aufrufe (auch von anderen Nutzern) lesen direkt aus der DB.
     *
     * @return array<array{name: string, date: string}>
     */
    public function getHolidays(int $year, string $stateCode): array
    {
        $existing = $this->repository->findByYearAndState($year, $stateCode);

        if (!empty($existing)) {
            return $this->format($existing);
        }

        $fetched = $this->fetchAndPersist($year, $stateCode);

        return $this->format($fetched);
    }

    /**
     * @param PublicHoliday[] $holidays
     *
     * @return array<array{name: string, date: string}>
     */
    private function format(array $holidays): array
    {
        return array_map(
            fn (PublicHoliday $h) => [
                'name' => $h->getName(),
                'date' => $h->getDate()->format('Y-m-d'),
            ],
            $holidays,
        );
    }

    /**
     * Lädt die Feiertage von feiertage-api.de und persistiert sie in der DB.
     *
     * @return PublicHoliday[]
     */
    private function fetchAndPersist(int $year, string $stateCode): array
    {
        $response = $this->httpClient->request('GET', self::API_URL, [
            'query' => [
                'jahr' => $year,
                'nur_land' => $stateCode,
            ],
            'timeout' => 10,
        ]);

        /** @var array<string, array{datum: string, hinweis?: string}> $data */
        $data = $response->toArray();

        $holidays = [];

        foreach ($data as $name => $info) {
            $date = DateTimeImmutable::createFromFormat('Y-m-d', $info['datum']);
            if (false === $date) {
                continue;
            }

            $holiday = new PublicHoliday($year, $stateCode, $name, $date);
            $this->entityManager->persist($holiday);
            $holidays[] = $holiday;
        }

        $this->entityManager->flush();

        return $holidays;
    }
}
