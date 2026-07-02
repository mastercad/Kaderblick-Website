<?php

namespace App\Security\Voter;

use App\Entity\CalendarEvent;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, CalendarEvent>
 */
class EventVoter extends Voter
{
    public function __construct(private Security $security)
    {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, ['EVENT_SHOW', 'EVENT_CREATE', 'EVENT_EDIT', 'EVENT_DELETE'])
            && ($subject instanceof CalendarEvent || null === $subject);
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        return $this->security->isGranted('ROLE_SUPERADMIN');
    }
}
