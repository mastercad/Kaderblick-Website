<?php

namespace App\Service;

use DateTime;
use Dompdf\Dompdf;
use Dompdf\Options;
use Twig\Environment;

class SizeGuidePdfService
{
    public function __construct(
        private readonly Environment $twig,
        private readonly string $projectDir,
    ) {
    }

    /**
     * @param array<array{
     *      id: int,
     *      name: string,
     *      shorts_size: string|null,
     *      shirt_size: string|null,
     *      shoe_size: string|null,
     *      socks_size: string|null,
     *      jacket_size: string|null
     * }> $players
     */
    public function generatePdf(string $teamName, array $players): string
    {
        $data = $this->buildTemplateData($teamName, $players);

        $html = $this->twig->render('pdf/size_guide.html.twig', $data);

        $options = new Options();
        $options->set('isRemoteEnabled', true);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('defaultFont', 'Helvetica');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'landscape');
        $dompdf->render();

        return (string) $dompdf->output();
    }

    /**
     * @param array<array<string, mixed>> $players
     *
     * @return array<string, mixed>
     */
    private function buildTemplateData(string $teamName, array $players): array
    {
        // Sort players by name
        usort($players, static fn ($a, $b) => strnatcasecmp((string) $a['name'], (string) $b['name']));

        // Aggregate summaries per size type
        $summaries = [
            'shirt' => $this->aggregate($players, 'shirt_size'),
            'shorts' => $this->aggregate($players, 'shorts_size'),
            'jacket' => $this->aggregate($players, 'jacket_size'),
            'socks' => $this->aggregate($players, 'socks_size'),
            'shoes' => $this->aggregate($players, 'shoe_size'),
        ];

        $logoPath = $this->projectDir . '/public/images/logo.png';
        $logoBase64 = null;
        if (file_exists($logoPath)) {
            $logoData = file_get_contents($logoPath);
            if (false !== $logoData) {
                $logoBase64 = 'data:image/png;base64,' . base64_encode($logoData);
            }
        }

        return [
            'teamName' => $teamName,
            'players' => $players,
            'summaries' => $summaries,
            'generatedAt' => (new DateTime())->format('d.m.Y H:i'),
            'logoBase64' => $logoBase64,
            'totalPlayers' => count($players),
            'missingAny' => array_filter($players, static fn ($p) => null === $p['shirt_size'] || '' === $p['shirt_size']
                || null === $p['shorts_size'] || '' === $p['shorts_size']
                || null === $p['shoe_size'] || '' === $p['shoe_size']),
        ];
    }

    /**
     * @param array<array<string, mixed>> $players
     *
     * @return array<array-key, int>
     */
    private function aggregate(array $players, string $key): array
    {
        $result = [];
        foreach ($players as $player) {
            $val = isset($player[$key]) ? (string) $player[$key] : '';
            if ('' === $val || '0' === $val) {
                continue;
            }
            $result[$val] = ($result[$val] ?? 0) + 1;
        }
        uksort($result, static function (string $a, string $b): int {
            $order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
            $ai = array_search(strtoupper($a), $order, true);
            $bi = array_search(strtoupper($b), $order, true);
            if (false !== $ai && false !== $bi) {
                return $ai <=> $bi;
            }
            if (false !== $ai) {
                return -1;
            }
            if (false !== $bi) {
                return 1;
            }
            $na = (float) $a;
            $nb = (float) $b;
            if (is_numeric($a) && is_numeric($b)) {
                return $na <=> $nb;
            }

            return strnatcasecmp($a, $b);
        });

        return $result;
    }
}
