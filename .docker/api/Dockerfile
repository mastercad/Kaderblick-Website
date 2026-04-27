# =============================================================================
# Stage: base
# Gemeinsame Grundlage für alle weiteren Stages.
# Enthält: PHP-Extensions, Apache-Config, Xdebug, Composer, Timezone, Scripts.
# =============================================================================
FROM php:8.3-apache AS base

ENV TZ=Europe/Berlin

RUN apt-get update && apt-get install -yqq \
    git \
    unzip \
    curl \
    libicu-dev \
    libonig-dev \
    libzip-dev \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    ca-certificates \
    openssl libssl-dev \
    cron \
    && update-ca-certificates \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install intl pdo pdo_mysql zip opcache bcmath gd

RUN a2enmod rewrite

RUN sed -ri -e 's!/var/www/html!/var/www/symfony/public!g' /etc/apache2/sites-available/000-default.conf

RUN echo "openssl.cafile=/etc/ssl/certs/ca-certificates.crt" > /usr/local/etc/php/conf.d/99-ca-certificates.ini

COPY .docker/api/conf.d/upload-limits.ini /usr/local/etc/php/conf.d/

RUN pecl install xdebug && docker-php-ext-enable xdebug

RUN echo "xdebug.mode=debug" > /usr/local/etc/php/conf.d/xdebug.ini && \
    echo "xdebug.start_with_request=yes" >> /usr/local/etc/php/conf.d/xdebug.ini && \
    echo "xdebug.client_host=host.docker.internal" >> /usr/local/etc/php/conf.d/xdebug.ini && \
    echo "xdebug.client_port=9003" >> /usr/local/etc/php/conf.d/xdebug.ini && \
    echo "xdebug.log=/tmp/xdebug.log" >> /usr/local/etc/php/conf.d/xdebug.ini && \
    echo "xdebug.log_level=10" >> /usr/local/etc/php/conf.d/xdebug.ini

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

COPY .docker/api/cron_wrapper.sh /usr/local/bin/cron_wrapper.sh
COPY .docker/api/entrypoint.sh /entrypoint.sh

RUN chmod +x /usr/local/bin/cron_wrapper.sh \
    && chmod +x /entrypoint.sh

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
RUN echo "date.timezone=$TZ" > /usr/local/etc/php/conf.d/timezone.ini

WORKDIR /var/www/symfony

# Composer-Manifest vorab kopieren – eigener Layer, wird nur bei Lock-Änderungen invalidiert.
COPY api/composer.json api/composer.lock /var/www/symfony/

# =============================================================================
# Stage: test
# Für QA/CI: alle Dependencies inklusive dev (PHPUnit, PHPStan, PHP-CS-Fixer…).
# Kein Cron. Wird NICHT deployed.
# =============================================================================
FROM base AS test

RUN composer install --no-interaction --optimize-autoloader

COPY api/ /var/www/symfony/

RUN mkdir -p var/cache var/log config/secrets/prod config/secrets/staging config/jwt \
    && chown -R www-data:www-data /var/www/symfony \
    && chmod -R 755 vendor/ \
    && chmod -R 775 var/

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "apache2-foreground"]

# =============================================================================
# Stage: prod
# Für Deployment: nur prod-Dependencies, Cron-Jobs aktiv.
# =============================================================================
FROM base AS prod

RUN composer install --no-interaction --optimize-autoloader --no-dev

COPY api/ /var/www/symfony/

RUN mkdir -p var/cache var/log config/secrets/prod config/secrets/staging config/jwt \
    && chown -R www-data:www-data /var/www/symfony \
    && chmod -R 755 vendor/ \
    && chmod -R 775 var/

EXPOSE 80

RUN echo "SHELL=/bin/bash" > /etc/cron.d/symfony-crons \
    && echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" >> /etc/cron.d/symfony-crons \
    && echo "# Collect weather data for events (daily at 3 AM)" >> /etc/cron.d/symfony-crons \
    && echo "0 3 * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:collect-weather-data-for-events' 2>&1" >> /etc/cron.d/symfony-crons \
    && echo "" >> /etc/cron.d/symfony-crons \
    && echo "# Calculate historical XP events (every 5 minutes)" >> /etc/cron.d/symfony-crons \
    && echo "*/5 * * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:xp:process-historical' 2>&1" >> /etc/cron.d/symfony-crons \
    && echo "" >> /etc/cron.d/symfony-crons \
    && echo "# Process pending XP events (every 5 minutes)" >> /etc/cron.d/symfony-crons \
    && echo "*/5 * * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:xp:process-pending' 2>&1" >> /etc/cron.d/symfony-crons \
    && echo "" >> /etc/cron.d/symfony-crons \
    && echo "# Calculate and award titles (daily at 2 AM)" >> /etc/cron.d/symfony-crons \
    && echo "0 2 * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:xp:award-titles' 2>&1" >> /etc/cron.d/symfony-crons \
    && chmod 0644 /etc/cron.d/symfony-crons \
    && echo "# Send unsent Notifications (every 5 minutes)" >> /etc/cron.d/symfony-crons \
    && echo "*/5 * * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:notifications:send-unsent' 2>&1" >> /etc/cron.d/symfony-crons \
    && echo "" >> /etc/cron.d/symfony-crons \
    && echo "# Send survey reminder notifications (every 30 minutes)" >> /etc/cron.d/symfony-crons \
    && echo "*/30 * * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:surveys:send-reminders' 2>&1" >> /etc/cron.d/symfony-crons \
    && echo "" >> /etc/cron.d/symfony-crons \
    && echo "# System health monitor (every 5 minutes)" >> /etc/cron.d/symfony-crons \
    && echo "*/5 * * * * www-data /bin/bash -lc 'cd /var/www/symfony && . /var/www/symfony/.env 2>/dev/null || true && . /var/www/symfony/.env.local 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV 2>/dev/null || true && . /var/www/symfony/.env.$APP_ENV.local 2>/dev/null || true && /usr/local/bin/cron_wrapper.sh app:health:monitor' 2>&1" >> /etc/cron.d/symfony-crons \
    && chmod 0644 /etc/cron.d/symfony-crons

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "cron && apache2-foreground"]