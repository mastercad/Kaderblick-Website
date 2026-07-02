<?php

namespace App\Security\Voter;

use App\Entity\ReportDefinition;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, ReportDefinition>
 */
final class ReportVoter extends Voter
{
    public const CREATE = 'REPORT_CREATE';
    public const EDIT = 'REPORT_EDIT';
    public const VIEW = 'REPORT_VIEW';
    public const DELETE = 'REPORT_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof ReportDefinition;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var ReportDefinition $report */
        $report = $subject;

        switch ($attribute) {
            case self::VIEW:
                // Templates können von allen gesehen werden, user reports nur vom Owner oder Admins
                if ($report->isTemplate()) {
                    return true;
                }

                return $report->getUser() === $user
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::EDIT:
            case self::DELETE:
                // Nur Owner oder Admins
                return $report->getUser() === $user
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::CREATE:
                return true; // Alle authentifizierten User können Reports erstellen
        }

        return false;
    }
}
