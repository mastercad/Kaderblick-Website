# =============================================================================
# Stage: vendor-prod
# Isolierter Composer-Install (ohne Dev-Dependencies) – nur vendor/ landet im Image.
# Kein git/unzip/curl im Runtime-Image nötig.
# =============================================================================
FROM composer:2 AS vendor-prod

WORKDIR /app

COPY api/composer.json api/composer.lock ./

RUN composer install \
    --no-dev \
    --no-scripts \
    --prefer-dist \
    --no-interaction \
    --optimize-autoloader

# =============================================================================
# Stage: vendor-dev
# Isolierter Composer-Install inklusive Dev-Dependencies (PHPUnit, PHPStan …).
# =============================================================================
FROM composer:2 AS vendor-dev

WORKDIR /app

COPY api/composer.json api/composer.lock ./

RUN composer install \
    --no-scripts \
    --prefer-dist \
    --no-interaction

# =============================================================================
# Stage: base
# Alpine + PHP-FPM + nginx + supervisor + cronie.
# Kein Xdebug, keine Dev-Tools, kein Apache.
# =============================================================================
FROM php:8.3-fpm-alpine AS base

ENV TZ=Europe/Berlin

# Runtime-Pakete (bleiben dauerhaft im Image)
RUN apk add --no-cache \
    bash \
    ca-certificates \
    cronie \
    freetype \
    icu-libs \
    libjpeg-turbo \
    libpng \
    libzip \
    nginx \
    oniguruma \
    openssl \
    shadow \
    supervisor \
    tzdata \
    && cp /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

# Build-Zeit-Abhängigkeiten: nur für Extension-Kompilierung, danach entfernt
RUN apk add --no-cache --virtual .build-deps \
    $PHPIZE_DEPS \
    freetype-dev \
    icu-dev \
    libjpeg-turbo-dev \
    libpng-dev \
    libzip-dev \
    oniguruma-dev \
    openssl-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) intl pdo pdo_mysql zip opcache bcmath gd \
    && apk del .build-deps

# nginx als www-data ausführen (konsistent mit PHP-FPM-User)
RUN sed -i 's/user nginx;/user www-data;/' /etc/nginx/nginx.conf \
    && mkdir -p /var/lib/nginx/tmp/client_body \
    && chown -R www-data:www-data /var/lib/nginx/tmp

COPY .docker/api/conf.d/ /usr/local/etc/php/conf.d/
COPY .docker/api/nginx.conf /etc/nginx/http.d/default.conf
COPY .docker/api/supervisord.conf /etc/supervisord.conf
COPY .docker/api/cron_wrapper.sh /usr/local/bin/cron_wrapper.sh
COPY .docker/api/entrypoint.sh /entrypoint.sh

RUN chmod +x /usr/local/bin/cron_wrapper.sh /entrypoint.sh \
    && echo "date.timezone=$TZ" > /usr/local/etc/php/conf.d/timezone.ini \
    && echo "openssl.cafile=/etc/ssl/certs/ca-certificates.crt" > /usr/local/etc/php/conf.d/99-ca-certificates.ini

WORKDIR /var/www/symfony

# Cron-Jobs – in base definiert, damit dev und prod automatisch Parität haben.
RUN echo "SHELL=/bin/bash" > /etc/cron.d/symfony-crons \
    && echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" >> /etc/cron.d/symfony-crons \
    && echo "# Collect weather data for events (daily at 3 AM)" >> /etc/cron.d/symfony-crons \
    && echo "0 3 * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:collect-weather-data-for-events' 2>&1" >> /etc/cron.d/symfony-crons \
    && echo "" >> /etc/cron.d/symfony-crons \
    && echo "# Calculate historical XP events (every 5 minutes)" >> /etc/cron.d/symfony-crons \
    && echo "*/5 * * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:xp:process-historical' 2>&1" >> /etc/cron.d/symfony-crons \
    && echo "" >> /etc/cron.d/symfony-crons \
    && echo "# Process pending XP events (every 5 minutes)" >> /etc/cron.d/symfony-crons \
    && echo "*/5 * * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:xp:process-pending' 2>&1" >> /etc/cron.d/symfony-crons \
    && echo "" >> /etc/cron.d/symfony-crons \
    && echo "# Calculate and award titles (daily at 2 AM)" >> /etc/cron.d/symfony-crons \
    && echo "0 2 * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:xp:award-titles' 2>&1" >> /etc/cron.d/symfony-crons \
    && echo "" >> /etc/cron.d/symfony-crons \
    && echo "# Send unsent Notifications (every 5 minutes)" >> /etc/cron.d/symfony-crons \
    && echo "*/5 * * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:notifications:send-unsent' 2>&1" >> /etc/cron.d/symfony-crons \
    && echo "" >> /etc/cron.d/symfony-crons \
    && echo "# Send survey reminder notifications (every 30 minutes)" >> /etc/cron.d/symfony-crons \
    && echo "*/30 * * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:surveys:send-reminders' 2>&1" >> /etc/cron.d/symfony-crons \
    && echo "" >> /etc/cron.d/symfony-crons \
    && echo "# System health monitor (every 5 minutes)" >> /etc/cron.d/symfony-crons \
    && echo "*/5 * * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.\$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:health:monitor' 2>&1" >> /etc/cron.d/symfony-crons \
    && chmod 0644 /etc/cron.d/symfony-crons

# =============================================================================
# Stage: base-dev
# Erweitert base um Xdebug. Wird von dev und test verwendet – NIEMALS von prod.
# =============================================================================
FROM base AS base-dev

RUN apk add --no-cache --virtual .xdebug-deps \
    $PHPIZE_DEPS \
    linux-headers \
    && pecl install xdebug \
    && docker-php-ext-enable xdebug \
    && apk del .xdebug-deps \
    && echo "xdebug.mode=debug" > /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.start_with_request=yes" >> /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.client_host=host.docker.internal" >> /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.client_port=9003" >> /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.log=/tmp/xdebug.log" >> /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.log_level=10" >> /usr/local/etc/php/conf.d/xdebug.ini

# =============================================================================
# Stage: dev
# Lokale Entwicklung: Source-Code und vendor/ kommen via Bind-Mount.
# Cron läuft (paritätisch zu prod!), Xdebug aktiv.
# =============================================================================
FROM base-dev AS dev

RUN mkdir -p var/cache var/log config/secrets/prod config/secrets/staging config/jwt \
    && chown -R www-data:www-data /var/www/symfony

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]

# =============================================================================
# Stage: test
# Für QA/CI: alle Dependencies inklusive dev (PHPUnit, PHPStan, PHP-CS-Fixer…).
# Kein Cron-Daemon (CI überschreibt CMD mit konkreten Test-Kommandos).
# =============================================================================
FROM base-dev AS test

COPY --from=vendor-dev /app/vendor /var/www/symfony/vendor

COPY api/ /var/www/symfony/

RUN mkdir -p var/cache var/log config/secrets/prod config/secrets/staging config/jwt \
    && chown -R www-data:www-data /var/www/symfony \
    && chmod -R 755 vendor/ \
    && chmod -R 775 var/

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]

# =============================================================================
# Stage: prod
# Für Deployment: nur prod-Dependencies, Opcache maximiert, Cron via supervisord.
# =============================================================================
FROM base AS prod

COPY --from=vendor-prod /app/vendor /var/www/symfony/vendor

COPY api/ /var/www/symfony/

RUN mkdir -p var/cache var/log config/secrets/prod config/secrets/staging config/jwt \
    && chown -R www-data:www-data /var/www/symfony \
    && chmod -R 755 vendor/ \
    && chmod -R 775 var/ \
    && echo "opcache.validate_timestamps=0" > /usr/local/etc/php/conf.d/opcache-prod.ini

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
