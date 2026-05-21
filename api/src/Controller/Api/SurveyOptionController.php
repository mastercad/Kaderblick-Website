<?php

namespace App\Controller\Api;

use App\Entity\SurveyOption;
use App\Entity\User;
use App\Repository\SurveyOptionRepository;
use App\Security\Voter\SurveyOptionVoter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_USER')]
#[Route('/api/survey-options', name: 'api_survey_options_')]
class SurveyOptionController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em)
    {
    }

    /**
     * Listet System-Optionen + eigene Optionen des angemeldeten Benutzers auf.
     * Wird beim Erstellen/Bearbeiten einer Umfrage verwendet.
     */
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(SurveyOptionRepository $repo): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $options = $repo->findAvailableForUser($user);

        $data = array_map(fn ($o) => [
            'id' => $o->getId(),
            'optionText' => $o->getOptionText(),
            'isSystem' => $o->isSystemOption(),
            'isOwn' => !$o->isSystemOption() && $o->getCreatedBy()?->getId() === $user->getId(),
        ], $options);

        return $this->json($data);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(SurveyOption $option): JsonResponse
    {
        if (!$this->isGranted(SurveyOptionVoter::VIEW, $option)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        /** @var User $user */
        $user = $this->getUser();

        $data = [
            'id' => $option->getId(),
            'optionText' => $option->getOptionText(),
            'isSystem' => $option->isSystemOption(),
            'isOwn' => !$option->isSystemOption() && $option->getCreatedBy()?->getId() === $user->getId(),
        ];

        return $this->json($data);
    }

    /**
     * Erstellt eine neue benutzerdefinierte Antwortoption.
     */
    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $data = json_decode($request->getContent(), true);
        if (!$data || !isset($data['optionText']) || !trim($data['optionText'])) {
            return $this->json(['error' => 'optionText ist erforderlich'], 400);
        }

        $option = new SurveyOption();
        $option->setOptionText(trim($data['optionText']));
        $option->setCreatedBy($user);

        if (!$this->isGranted(SurveyOptionVoter::CREATE, $option)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $this->em->persist($option);
        $this->em->flush();

        return $this->json([
            'id' => $option->getId(),
            'optionText' => $option->getOptionText(),
            'isSystem' => false,
            'isOwn' => true,
        ], 201);
    }

    /**
     * Löscht eine benutzerdefinierte Antwortoption.
     * System-Optionen können nicht gelöscht werden.
     */
    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(SurveyOption $option): JsonResponse
    {
        if ($option->isSystemOption()) {
            return $this->json(['error' => 'System-Optionen können nicht gelöscht werden'], 403);
        }

        if (!$this->isGranted(SurveyOptionVoter::DELETE, $option)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $this->em->remove($option);
        $this->em->flush();

        return $this->json(['success' => true]);
    }
}
