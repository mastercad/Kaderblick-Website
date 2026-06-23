# Stripe-Abrechnung einrichten

Diese Anleitung beschreibt konkret, welche beiden Stripe-Geheimnisse Kaderblick
benötigt, wo sie zu finden sind und wie Webhooks lokal sowie auf einem Server
eingerichtet werden.

## Die beiden Secrets sind nicht identisch

Kaderblick benötigt zwei verschiedene Werte:

| Variable | Erwarteter Anfang | Herkunft | Zweck |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_...` oder `sk_live_...` | Stripe-Dashboard, API-Schlüssel | Kaderblick erstellt damit Checkout- und Portal-Sitzungen bei Stripe. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Der konkrete Webhook-Endpunkt im Stripe-Dashboard oder `stripe listen` | Kaderblick prüft damit, ob eingehende Webhooks wirklich von Stripe stammen. |

**Niemals den Wert von `STRIPE_SECRET_KEY` auch als
`STRIPE_WEBHOOK_SECRET` eintragen.** Ein API-Schlüssel mit `sk_...` ist kein
Webhook-Signaturschlüssel. Mit dem falschen Wert lehnt die API alle Stripe-
Webhooks ab; ein begonnenes Abo bleibt dann in Kaderblick auf
„Aktivierung läuft“ (`pending`) stehen.

Secrets niemals committen oder in Screenshots, Logs und Tickets einfügen.

## Lokale Entwicklung

Ein Webhook im Internet kann `localhost` nicht erreichen. Lokal übernimmt
deshalb die Stripe CLI das Weiterleiten. **Die Stripe CLI läuft dabei in einem
separaten Terminal auf dem Host, nicht in einem Kaderblick-Docker-Container.**
Der Host-Prozess leitet die Events an den veröffentlichten API-Port `8081` des
Docker-Containers weiter.

### 1. Stripe-API-Schlüssel holen

1. Im [Stripe-Dashboard](https://dashboard.stripe.com/) den gewünschten
   **Testmodus/Sandbox** auswählen.
2. **Workbench → API keys** öffnen. Bei älteren Dashboard-Ansichten heißt der
   Bereich **Developers → API keys**.
3. Unter **Standard keys** den **Secret key** aufdecken.
4. Den Wert mit Anfang `sk_test_...` in `api/.env.dev.local` eintragen:

   ```dotenv
   STRIPE_SECRET_KEY=sk_test_HIER_DEN_TESTSCHLUESSEL_EINTRAGEN
   ```

Der veröffentlichbare Schlüssel `pk_test_...` ist hierfür nicht geeignet.

### 2. Stripe CLI starten und Webhook-Secret holen

Die [Stripe CLI installieren](https://docs.stripe.com/stripe-cli) und einmalig
anmelden:

```bash
stripe login
```

Danach den Listener **auf dem Host außerhalb von Docker** starten und dieses
Terminal während des gesamten Checkout-Tests geöffnet lassen:

```bash
stripe listen \
  --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed,invoice.payment_action_required \
  --forward-to http://localhost:8081/api/billing/webhook/stripe
```

Direkt nach dem Start zeigt die CLI ungefähr Folgendes an:

```text
Ready! Your webhook signing secret is whsec_...
```

Genau diesen vollständigen `whsec_...`-Wert in `api/.env.dev.local`
eintragen:

```dotenv
STRIPE_WEBHOOK_SECRET=whsec_HIER_DAS_SECRET_AUS_STRIPE_LISTEN_EINTRAGEN
```

Das Secret aus `stripe listen` gehört nur zu diesem lokalen CLI-Listener. Es
ist nicht dasselbe Secret wie das eines im Dashboard angelegten Webhooks. Im
API-Container muss keine Stripe CLI installiert sein; dort läuft nur der
Webhook-Endpunkt, der die vom Host weitergeleiteten HTTP-Anfragen verarbeitet.

Nach einer Änderung der Env-Datei die API und den Worker neu starten:

```bash
docker compose restart api worker
```

### 3. Lokal prüfen

1. `stripe listen ...` muss weiterhin laufen.
2. In Kaderblick als Kassenwart **Abrechnung & Abo** öffnen.
3. Einen Test-Checkout vollständig mit einer
   [Stripe-Testzahlung](https://docs.stripe.com/testing) abschließen.
4. Im CLI-Fenster müssen die Webhook-Aufrufe mit HTTP-Status `200` erscheinen.
5. In Kaderblick darf das Team anschließend nicht dauerhaft auf
   „Aktivierung läuft“ stehen.

Ein `400` beim Webhook bedeutet meist, dass der eingetragene `whsec_...`-Wert
nicht zu dem aktuell laufenden CLI-Listener gehört.

### 4. Abgebrochenen oder hängen gebliebenen Checkout wiederholen

Bleibt ein Team auf „Aktivierung läuft“, zeigt Kaderblick den Button
**Zahlungsabschluss neu starten**:

- Ist die bei Stripe gespeicherte Checkout-Session noch offen, wird genau diese
  Session erneut geöffnet.
- Ist sie abgelaufen, verwirft Kaderblick den lokalen `pending`-Vorgang und
  erstellt einen neuen Checkout für dieselben Teams.
- Ist der Checkout bei Stripe bereits abgeschlossen, wird kein zweites Abo
  erzeugt. In diesem Fall muss der Webhook-Status verarbeitet beziehungsweise
  die Seite neu geladen werden.

Ältere `pending`-Datensätze, die vor Einführung der gespeicherten Stripe-
Checkout-Session angelegt wurden, können ebenfalls über den Button ersetzt
werden, sofern lokal noch keine Stripe-Kunden- oder Abo-ID hinterlegt ist.

## Staging oder Produktion

Für jede öffentlich erreichbare Umgebung wird ein eigener Webhook-Endpunkt im
Stripe-Dashboard angelegt. Staging/Testmodus und Produktion/Livemodus dürfen
nicht dasselbe Webhook-Secret verwenden.

### 1. Richtigen Stripe-Modus auswählen

- **Staging/Demo:** Stripe-Testmodus oder die dafür vorgesehene Sandbox und ein
  dazugehöriger `sk_test_...`-Schlüssel.
- **Produktion:** Stripe-Livemodus und ein `sk_live_...`-Schlüssel.

API-Schlüssel und Webhook müssen immer aus demselben Stripe-Modus bzw. derselben
Sandbox stammen.

### 2. Webhook im Stripe-Dashboard anlegen

1. Im Stripe-Dashboard **Workbench → Webhooks** öffnen. In älteren Ansichten:
   **Developers → Webhooks**.
2. **Create destination** beziehungsweise **Add endpoint** wählen.
3. Als Endpoint-URL die öffentlich erreichbare API-URL der Umgebung eintragen:

   ```text
   https://<API-HOST>/api/billing/webhook/stripe
   ```

   Nicht die Frontend-URL verwenden, falls Frontend und API unterschiedliche
   Hosts besitzen. Stripe benötigt eine öffentlich erreichbare HTTPS-URL;
   `localhost` funktioniert hier nicht.
4. **Events from your account** auswählen und diese Ereignisse abonnieren:

   ```text
   checkout.session.completed
   customer.subscription.created
   customer.subscription.updated
   customer.subscription.deleted
   invoice.paid
   invoice.payment_failed
   invoice.payment_action_required
   ```

5. Den Endpunkt speichern.
6. Den neu angelegten Endpunkt öffnen und bei **Signing secret** auf
   **Reveal** beziehungsweise **Click to reveal** klicken.
7. Den angezeigten Wert mit Anfang `whsec_...` kopieren. Nur dieser Wert gehört
   in `STRIPE_WEBHOOK_SECRET` dieser Umgebung.

### 3. Werte in Infisical hinterlegen

Das Deployment lädt die Anwendungs-Secrets aus dem Infisical-Projekt
`kaderblick-ny-in`. In der passenden Umgebung (`prod`, `staging` oder `demo`)
diese beiden Variablen anlegen beziehungsweise korrigieren:

```dotenv
STRIPE_SECRET_KEY=sk_test_...       # Produktion: sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Danach müssen die Werte an die Composite Action `deploy-env` übergeben werden:

```yaml
stripe_secret_key:     ${{ env.STRIPE_SECRET_KEY }}
stripe_webhook_secret: ${{ env.STRIPE_WEBHOOK_SECRET }}
```

Die Action schreibt sie beim Deployment in die `api/.env` des Releases. Die
Werte nicht zusätzlich im Repository eintragen.

### 4. Stripe-Produkteinstellungen aktivieren

Im Stripe-Dashboard die für das Konto verfügbaren wiederkehrenden
Zahlungsarten aktivieren, zum Beispiel Karte, SEPA-Lastschrift und PayPal.
Apple Pay und Google Pay werden abhängig von Konto, Browser, Gerät und
aktivierten Zahlungsarten angeboten.

Außerdem unter **Settings → Billing → Customer portal** das Kundenportal
konfigurieren. Benötigt werden mindestens:

- Zahlungsmethode ändern
- Rechnungsverlauf anzeigen
- Abonnement kündigen

### 5. Deployment und Funktion prüfen

1. Deployment mit den neuen Infisical-Werten ausführen.
2. Doctrine-Migrationen müssen erfolgreich durchlaufen sein.
3. Prüfen, dass der tägliche Cronjob `app:billing:process` installiert ist.
4. Einen vollständigen Checkout in der betreffenden Stripe-Umgebung ausführen.
5. Im Stripe-Dashboard den Webhook öffnen und unter **Event deliveries** prüfen,
   dass die Ereignisse mit HTTP `200` beantwortet wurden.
6. In Kaderblick kontrollieren, dass das Abo auf „Bezahlt & aktiv“ wechselt und
   Rechnung sowie Kundenportal erreichbar sind.

## Häufige Fehler

### Das Abo bleibt auf „Aktivierung läuft“

Im Stripe-Dashboard unter **Webhooks → Endpoint → Event deliveries** nachsehen:

- `400`: Meist falsches Webhook-Secret. Prüfen, ob `STRIPE_WEBHOOK_SECRET`
  wirklich mit `whsec_` beginnt und exakt zu diesem Endpunkt gehört.
- `404`: Endpoint-URL oder API-Routing ist falsch.
- Keine Zustellversuche: Falscher Stripe-Modus, falsches Konto oder benötigte
  Events wurden am Endpunkt nicht ausgewählt.
- `200`, aber weiterhin `pending`: Prüfen, ob neben
  `checkout.session.completed` auch `customer.subscription.created` und
  `invoice.paid` zugestellt wurden.

### Checkout kann nicht geöffnet werden

Prüfen, ob `STRIPE_SECRET_KEY` gesetzt ist, mit `sk_test_` beziehungsweise
`sk_live_` beginnt und aus demselben Stripe-Modus wie der Checkout stammt.

### Lokaler Webhook liefert plötzlich `400`

Den aktuellen `whsec_...`-Wert aus der Ausgabe von `stripe listen` erneut in
`api/.env.dev.local` eintragen und API/Worker neu starten. Nicht das Secret
eines Dashboard-Endpunkts für von der CLI weitergeleitete Events benutzen.
