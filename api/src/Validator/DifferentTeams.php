<?php

namespace App\Validator;

use Attribute;
use Symfony\Component\Validator\Constraint;

#[Attribute]
class DifferentTeams extends Constraint
{
    public string $message = 'Heim- und Auswärts-Team dürfen nicht identisch sein.';

    public function getTargets(): string | array
    {
        return self::CLASS_CONSTRAINT;
    }
}
