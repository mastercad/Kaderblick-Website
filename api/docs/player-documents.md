# Spielerdokumente: RabbitMQ, Object Storage und Google Drive

## Datenfluss

1. Die API legt den Upload im privaten S3-kompatiblen Staging-Bucket ab (bei Bedarf mit providerseitiger SSE).
2. Der Dokumentdatensatz wird mit `processing_status=pending` gespeichert und bildet gleichzeitig die Outbox.
3. `ProcessPlayerDocumentMessage` wird über RabbitMQ veröffentlicht.
4. Ein beliebig skalierbarer Worker lädt das Objekt, führt OCR aus und speichert das Dokument in Google Drive.
5. Nach erfolgreicher Verarbeitung wird das Staging-Objekt gelöscht.

Der Minutentakt-Job `app:documents:dispatch-pending` stellt nicht versendete Outbox-Einträge erneut zu. Mehrfachzustellungen sind zulässig; der Handler ist idempotent.

## Konfiguration

```dotenv
MESSENGER_TRANSPORT_DSN=amqp://kaderblick:secret@rabbitmq/%2f

DOCUMENT_ENDPOINT=https://s3.example
DOCUMENT_REGION=eu-central-1
DOCUMENT_BUCKET=kaderblick-documents-staging
DOCUMENT_ACCESS_KEY=...
DOCUMENT_SECRET_KEY=...
DOCUMENT_PATH_STYLE=true
# AWS S3: AES256; MinIO ohne KMS: leer
DOCUMENT_SSE=AES256

GOOGLE_DOCUMENTS_FOLDER_ID=...
```

Der Google-Drive-Ordner und der Staging-Bucket dürfen nicht öffentlich freigegeben sein.

## Lokale Infrastruktur

```bash
docker compose -f docker-compose.infrastructure.yml up -d
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

RabbitMQ Management ist standardmäßig unter `http://localhost:15672`, die MinIO-Konsole unter `http://localhost:9001` erreichbar. Zugangsdaten müssen außerhalb lokaler Entwicklung überschrieben werden.

## Skalierung

```bash
docker compose -f docker-compose.yml up -d --scale worker=4
```

API und Worker benötigen weiterhin Zugriff auf die Anwendungsdatenbank, teilen aber weder Container-Dateisystem noch Queue-Tabellen und besitzen keine Startabhängigkeit voneinander.
