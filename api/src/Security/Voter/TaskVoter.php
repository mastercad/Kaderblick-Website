<?php

namespace App\Security\Voter;

use App\Entity\Task;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Task>
 */
final class TaskVoter extends Voter
{
    public const CREATE = 'TASK_CREATE';
    public const EDIT = 'TASK_EDIT';
    public const VIEW = 'TASK_VIEW';
    public const DELETE = 'TASK_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        $result = in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof Task;

        return $result;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var Task $task */
        $task = $subject;

        switch ($attribute) {
            case self::VIEW:
                // Aufgaben können von zugewiesenen Usern, Erstellern oder Admins gesehen werden
                if ($task->getCreatedBy()->getId() === $user->getId()) {
                    return true;
                }
                // Prüfe ob User in einem der Assignments ist
                foreach ($task->getAssignments() as $assignment) {
                    if ($assignment->getUser()->getId() === $user->getId()) {
                        return true;
                    }
                }

                return in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::EDIT:
                // Ersteller, zugewiesene User oder Admins können bearbeiten
                if ($task->getCreatedBy()->getId() === $user->getId()) {
                    return true;
                }
                foreach ($task->getAssignments() as $assignment) {
                    if ($assignment->getUser()->getId() === $user->getId()) {
                        return true;
                    }
                }

                return in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::DELETE:
                if ($task->getCreatedBy()->getId() === $user->getId()) {
                    return true;
                }

                return in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::CREATE:
                if (
                    in_array('ROLE_USER', $user->getRoles())
                    || in_array('ROLE_SUPPORTER', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                ) {
                    return true;
                }
                // no break
            default:
                return false;
        }
    }
}
