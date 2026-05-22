<?php

// src/Controller/Api/ContactController.php

namespace App\Controller\Api;

use App\Dto\ContactMessageDto;
use Exception;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\Exception\RfcComplianceException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class ContactController extends AbstractController
{
    #[Route('/api/contact', name: 'api_contact', methods: ['POST'])]
    public function contact(Request $request, MailerInterface $mailer, ValidatorInterface $validator): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $dto = new ContactMessageDto();
        $dto->name = $data['name'] ?? '';
        $dto->email = $data['email'] ?? '';
        $dto->message = $data['message'] ?? '';

        $violations = $validator->validate($dto);
        if (count($violations) > 0) {
            $errors = [];
            foreach ($violations as $violation) {
                $errors[] = $violation->getMessage();
            }

            return new JsonResponse(['error' => implode("\n", $errors)], 400);
        }

        try {
            $contactEmail = $this->getParameter('app.contact_email') ?? 'andreas.kempe@kaderblick.de';
            $mail = (new Email())
                ->from($contactEmail)
                ->replyTo($dto->email)
                ->to($contactEmail)
                ->subject('Kaderblick Kontaktformular: ' . $dto->name)
                ->text("Name: {$dto->name}\nE-Mail: {$dto->email}\n\nNachricht:\n{$dto->message}");

            $mailer->send($mail);
        } catch (RfcComplianceException $e) {
            return new JsonResponse(['error' => $e->getMessage()], 400);
        } catch (Exception $e) {
            return new JsonResponse(['error' => 'Fehler beim Senden der Nachricht. Bitte versuchen Sie es später erneut.'], 400);
        }

        return new JsonResponse(['success' => true]);
    }
}
