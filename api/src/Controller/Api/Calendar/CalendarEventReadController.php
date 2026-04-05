<?php

namespace App\Controller\Api\Calendar;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\User;
use App\Entity\WeatherData;
use App\Repository\CalendarEventRepository;
use App\Security\Voter\CalendarEventVoter;
use App\Service\CalendarEventSerializer;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/calendar', name: 'api_calendar_')]
class CalendarEventReadController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly CalendarEventSerializer $serializer,
    ) {
    }

    #[Route('/events', name: 'events', methods: ['GET'])]
    public function retrieveEvents(Request $request, CalendarEventRepository $calendarEventRepository): JsonResponse
    {
        $start = new \DateTime($request->query->get('start'));
        $end   = new \DateTime($request->query->get('end'));

        $unfilteredEvents = $calendarEventRepository->findBetweenDates($start, $end);
        $calendarEvents   = array_filter(
            $unfilteredEvents,
            fn ($e) => $this->isGranted(CalendarEventVoter::VIEW, $e)
        );

        $tournamentEventType = $this->entityManager->getRepository(CalendarEventType::class)
            ->findOneBy(['name' => 'Turnier']);

        /** @var ?User $user */
        $user = $this->getUser();

        $formattedEvents = array_map(
            fn (CalendarEvent $e) => $this->serializer->serialize($e, $user, $tournamentEventType),
            $calendarEvents
        );

        return $this->json(array_values($formattedEvents));
    }

    #[Route('/event/{id}', name: 'event_show', methods: ['GET'])]
    public function getEvent(CalendarEvent $calendarEvent): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::VIEW, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        /** @var ?User $user */
        $user = $this->getUser();
        $tournamentEventType = $this->entityManager->getRepository(CalendarEventType::class)
            ->findOneBy(['name' => 'Turnier']);

        return $this->json($this->serializer->serialize($calendarEvent, $user, $tournamentEventType));
    }

    #[Route('/upcoming', name: 'upcoming', methods: ['GET'])]
    public function retrieveUpcomingEvents(CalendarEventRepository $calendarEventRepository): JsonResponse
    {
        $calendarEvents = $calendarEventRepository->findUpcoming();

        return $this->json($calendarEvents, 200, [], ['groups' => ['calendar_event:read']]);
    }

    #[Route('/event/{id}/weather-data', name: 'event_weather_data', methods: ['GET'])]
    public function viewEventWeatherData(CalendarEvent $calendarEvent): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::VIEW, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $weatherData = $calendarEvent->getWeatherData();

        if (!$weatherData instanceof WeatherData) {
            return $this->json([
                'dailyWeatherData'  => null,
                'hourlyWeatherData' => null,
            ]);
        }

        $indexStart = $calendarEvent->getStartDate()->format('H');
        $indexEnd   = 23 - (23 - ($calendarEvent->getEndDate() ? (int) $calendarEvent->getEndDate()->format('H') : 0));

        $rawHourlyWeatherData = $weatherData->getHourlyWeatherData();
        $hourlyWeatherData    = [];

        foreach ($rawHourlyWeatherData as $key => $information) {
            foreach ($information as $index => $value) {
                if ($index < (int) $indexStart || $index > (int) $indexEnd) {
                    continue;
                }
                $hourlyWeatherData[$key][$index] = $value;
            }
        }

        return $this->json([
            'dailyWeatherData'  => $weatherData->getDailyWeatherData() ?: [],
            'hourlyWeatherData' => $hourlyWeatherData,
        ]);
    }
}
