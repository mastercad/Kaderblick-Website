<?php

namespace App\Controller;

use App\Entity\User;
use App\Entity\UserRelation;
use App\Service\UserContactService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/users', name: 'api_users_', methods: ['GET'])]
class UserController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private UserContactService $userContactService,
    ) {
    }

    #[Route('', name: 'list', methods: ['GET'])]
    public function listUsers(): JsonResponse
    {
        $users = $this->entityManager->getRepository(User::class)
            ->createQueryBuilder('u')
            ->where('u.isEnabled = true')
            ->andWhere('u.isVerified = true')
            ->andWhere('u != :currentUser')
            ->orderBy('u.firstName', 'ASC')
            ->addOrderBy('u.lastName', 'ASC')
            ->setParameter('currentUser', $this->getUser())
            ->getQuery()
            ->getResult();

        return $this->json([
            'users' => array_map(fn (User $user) => [
                'id' => $user->getId(),
                'fullName' => $user->getFullName(),
            ], $users)
        ]);
    }

    /**
     * Returns only users that share an active team or club assignment with the
     * current user (via any of the four assignment types). No email addresses
     * are exposed. Each result carries a `context` hint (role + team/club name)
     * so that users with identical names can be visually distinguished.
     * ROLE_SUPERADMIN receives all active users without restriction.
     */
    #[Route('/contacts', name: 'contacts', methods: ['GET'])]
    public function contacts(): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();

        if ($this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['users' => $this->userContactService->findAllUsers($me)]);
        }

        return $this->json(['users' => $this->userContactService->findContacts($me)]);
    }

    #[Route('/relations', name: 'relations', methods: ['GET'])]
    public function relations(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        return $this->json(
            array_map(fn (UserRelation $userRelation) => [
                'id' => $userRelation->getId(),
                'fullName' => $userRelation->getPlayer() ? $userRelation->getPlayer()->getFullname() :
                    ($userRelation->getCoach() ? $userRelation->getCoach()->getFullname() : 'N/A'),
                'name' => $userRelation->getRelationType()->getName(),
                'identifier' => $userRelation->getRelationType()->getIdentifier(),
                'category' => $userRelation->getRelationType()->getCategory()
            ], $user->getUserRelations()->toArray())
        );
    }

    #[Route('/upload-avatar', name: 'upload_avatar', methods: ['POST'])]
    public function uploadAvatar(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $file = $request->files->get('file');
        if (!$file) {
            return $this->json(['error' => 'No file uploaded'], 400);
        }

        // Zielverzeichnis (z.B. public/uploads/avatar/)
        $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/avatar';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        // Dateiname generieren (z.B. avatar_USERID_TIMESTAMP.EXT)
        $ext = $file->guessExtension() ?: 'png';
        $filename = 'avatar_' . $user->getId() . '_' . time() . '.' . $ext;
        $file->move($uploadDir, $filename);

        // Altes Avatar ggf. löschen
        $old = $user->getAvatarFilename();
        if ($old && file_exists($uploadDir . '/' . $old)) {
            @unlink($uploadDir . '/' . $old);
        }

        // User-Entity aktualisieren
        $user->setAvatarFilename($filename);
        $user->setUseGoogleAvatar(false); // manual upload overrides Google avatar
        $this->entityManager->flush();

        // URL für Frontend
        $url = '/uploads/avatar/' . $filename;

        return $this->json(['url' => $url]);
    }

    #[Route('/remove-avatar', name: 'remove_avatar', methods: ['DELETE'])]
    public function removeAvatar(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/avatar';
        $old = $user->getAvatarFilename();

        if ($old && file_exists($uploadDir . '/' . $old)) {
            @unlink($uploadDir . '/' . $old);
            $user->setAvatarFilename(null);
            $this->entityManager->flush();
        }

        return $this->json(['success' => true]);
    }
}
