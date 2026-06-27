<?php

declare(strict_types=1);

namespace App\Service;

use Aws\S3\S3Client;
use RuntimeException;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class PlayerDocumentStagingStorage
{
    private readonly S3Client $client;
    private readonly string $bucket;
    private readonly ?string $serverSideEncryption;

    public function __construct()
    {
        $endpoint = $_ENV['DOCUMENT_ENDPOINT'] ?? $_SERVER['DOCUMENT_ENDPOINT'] ?? null;
        $accessKey = $_ENV['DOCUMENT_ACCESS_KEY'] ?? $_SERVER['DOCUMENT_ACCESS_KEY'] ?? null;
        $secretKey = $_ENV['DOCUMENT_SECRET_KEY'] ?? $_SERVER['DOCUMENT_SECRET_KEY'] ?? null;
        $this->bucket = $_ENV['DOCUMENT_BUCKET'] ?? $_SERVER['DOCUMENT_BUCKET'] ?? 'kaderblick-documents-development';
        $serverSideEncryption = trim((string) ($_ENV['DOCUMENT_SSE'] ?? $_SERVER['DOCUMENT_SSE'] ?? ''));
        $this->serverSideEncryption = '' !== $serverSideEncryption ? $serverSideEncryption : null;
        if (!$endpoint || !$accessKey || !$secretKey) {
            throw new RuntimeException('Der S3-Dokument-Staging-Speicher ist nicht vollständig konfiguriert.');
        }
        $this->client = new S3Client([
            'version' => 'latest',
            'region' => $_ENV['DOCUMENT_REGION'] ?? $_SERVER['DOCUMENT_REGION'] ?? 'eu-central-1',
            'endpoint' => $endpoint,
            'use_path_style_endpoint' => filter_var($_ENV['DOCUMENT_PATH_STYLE'] ?? $_SERVER['DOCUMENT_PATH_STYLE'] ?? true, FILTER_VALIDATE_BOOL),
            'credentials' => ['key' => $accessKey, 'secret' => $secretKey],
        ]);
    }

    public function upload(UploadedFile $file, string $objectKey): void
    {
        $handle = fopen($file->getPathname(), 'rb');
        if (false === $handle) {
            throw new RuntimeException('Upload-Datei konnte nicht gelesen werden.');
        }
        try {
            $options = [
                'Bucket' => $this->bucket, 'Key' => $objectKey, 'Body' => $handle,
                'ContentType' => $file->getMimeType(),
            ];
            if (null !== $this->serverSideEncryption) {
                $options['ServerSideEncryption'] = $this->serverSideEncryption;
            }
            $this->client->putObject($options);
        } finally {
            if (is_resource($handle)) {
                fclose($handle);
            }
        }
    }

    public function downloadTo(string $objectKey, string $targetPath): void
    {
        if (false === file_put_contents($targetPath, $this->download($objectKey))) {
            throw new RuntimeException('Staging-Datei konnte nicht lokal gespeichert werden.');
        }
    }

    public function download(string $objectKey): string
    {
        $result = $this->client->getObject(['Bucket' => $this->bucket, 'Key' => $objectKey]);

        return (string) $result['Body'];
    }

    public function delete(string $objectKey): void
    {
        $this->client->deleteObject(['Bucket' => $this->bucket, 'Key' => $objectKey]);
    }
}
