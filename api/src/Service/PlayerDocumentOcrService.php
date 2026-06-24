<?php

namespace App\Service;

use DateTimeImmutable;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

class PlayerDocumentOcrService
{
    /** @return array{text: string, category: string, issuedAt: ?DateTimeImmutable, expiresAt: ?DateTimeImmutable} */
    public function analyse(string $path, string $mimeType): array
    {
        $text = $this->extractText($path, $mimeType);
        $category = $this->detectCategory($text);
        [$issuedAt, $expiresAt] = $this->detectDates($text);

        return compact('text', 'category', 'issuedAt', 'expiresAt');
    }

    public function detectCategory(string $text): string
    {
        $lower = mb_strtolower($text);
        $rules = [
            'medical' => ['attest', 'ärztlich', 'arzt', 'diagnose', 'impfung'],
            'consent' => ['einverständnis', 'einwilligung', 'datenschutz', 'fotoerlaubnis'],
            'contract' => ['vertrag', 'vereinbarung', 'kündigung'],
            'pass' => ['spielerpass', 'personalausweis', 'reisepass', 'passnummer'],
        ];
        foreach ($rules as $category => $keywords) {
            foreach ($keywords as $word) {
                if (str_contains($lower, $word)) {
                    return $category;
                }
            }
        }

        return 'other';
    }

    /** @return array{?DateTimeImmutable, ?DateTimeImmutable} */
    public function detectDates(string $text): array
    {
        $date = '(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})';
        $parse = static function (?string $raw): ?DateTimeImmutable {
            if (!$raw) {
                return null;
            }
            $normal = str_replace(['/', '-'], '.', $raw);
            foreach (['!d.m.Y', '!d.m.y'] as $format) {
                $value = DateTimeImmutable::createFromFormat($format, $normal);
                if ($value) {
                    return $value;
                }
            }

            return null;
        };
        preg_match('/(?:gültig\s+bis|ablauf|expires?|expiry|bis)\s*[:\-]?\s*' . $date . '/iu', $text, $expiry);
        preg_match('/(?:ausgestellt|issued|datum|vom)\s*[:\-]?\s*' . $date . '/iu', $text, $issued);

        return [$parse($issued[1] ?? null), $parse($expiry[1] ?? null)];
    }

    private function extractText(string $path, string $mimeType): string
    {
        $finder = new ExecutableFinder();
        if ('application/pdf' === $mimeType && $finder->find('pdftotext')) {
            $process = new Process(['pdftotext', '-layout', $path, '-']);
            $process->setTimeout(30);
            $process->run();
            if ($process->isSuccessful() && '' !== trim($process->getOutput())) {
                return trim($process->getOutput());
            }
        }
        $ocrPath = $path;
        $temporaryImage = null;
        if ('application/pdf' === $mimeType && $finder->find('pdftoppm')) {
            $prefix = sys_get_temp_dir() . '/document_ocr_' . bin2hex(random_bytes(8));
            $convert = new Process(['pdftoppm', '-f', '1', '-singlefile', '-png', '-r', '200', $path, $prefix]);
            $convert->setTimeout(45);
            $convert->run();
            $temporaryImage = $prefix . '.png';
            if ($convert->isSuccessful() && is_file($temporaryImage)) {
                $ocrPath = $temporaryImage;
            }
        }
        if ((!str_starts_with($mimeType, 'image/') && $ocrPath === $path) || !$finder->find('tesseract')) {
            return '';
        }
        $process = new Process(['tesseract', $ocrPath, 'stdout', '-l', 'deu+eng']);
        $process->setTimeout(60);
        $process->run();
        if ($temporaryImage && is_file($temporaryImage)) {
            @unlink($temporaryImage);
        }

        return $process->isSuccessful() ? trim($process->getOutput()) : '';
    }
}
