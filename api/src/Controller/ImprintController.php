<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class ImprintController extends AbstractController
{
    #[Route('/imprint', name: 'imprint')]
    public function imprint(): Response
    {
        return $this->render('imprint.html.twig');
    }
}
