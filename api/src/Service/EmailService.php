<?php

namespace App\Service;

use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\Mailer\MailerInterface;

class EmailService
{
    public function __construct(
        private readonly MailerInterface $mailer,
        private readonly ParameterBagInterface $params,
    ) {
    }

    /**
     * @param string|array<int, string> $to
     * @param array<string, mixed>      $context
     */
    public function sendTemplatedEmail(
        string | array $to,
        string $subject,
        string $template,
        array $context = []
    ): void {
        $baseContext = [
            'website_name' => $this->params->get('website_name'),
            'current_year' => date('Y')
        ];

        $email = (new TemplatedEmail())
            ->from($this->params->get('mailer_from'))
            ->to($to)
            ->subject($subject)
            ->htmlTemplate("emails/$template.html.twig")
            ->textTemplate("emails/$template.txt.twig")
            ->context(array_merge($baseContext, $context));

        $this->mailer->send($email);
    }
}
