#!/bin/bash
set -e

# Symfony Projektpfad
APP_DIR="/var/www/symfony"
APP_ENV="${APP_ENV:-prod}"

cd "$APP_DIR"

# .env-Dateien in der richtigen Symfony-Reihenfolge laden
# Siehe: https://symfony.com/doc/current/configuration.html#configuration-environments
# Use POSIX-compatible dot (.) instead of `source` so cron's /bin/sh can execute it
load_env_file() {
  local file="$1"
  if [ -f "$file" ]; then
    # Variablen direkt in die aktuelle Shell exportieren (nicht in Subshell)
    set -a  # Automatisch alle Variablen exportieren
    . "$file"
    set +a
  fi
}

# Small diagnostics to help debugging when cron runs in container.
# Writes minimal info to /var/log/cron_wrapper.log (may contain DB host, but avoid excessive secrets).
log_diagnostics() {
  # write to symfony var/log which is created and owned by www-data in the Dockerfile
  local logfile="/var/www/symfony/var/log/cron_wrapper.log"
  mkdir -p "$(dirname "$logfile")"
  echo "----------------------------------------" >> "$logfile"
  echo "DATE: $(date +"%Y-%m-%dT%H:%M:%S%z")" >> "$logfile"
  echo "USER: $(whoami)" >> "$logfile"
  echo "PWD: $(pwd)" >> "$logfile"
  echo "APP_ENV: ${APP_ENV:-unset}" >> "$logfile"
  if [ -n "$DATABASE_URL" ]; then
    # try to parse host from DATABASE_URL (formats like: mysql://user:pass@host:port/db)
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's#.*@\([^:/]*\).*#\1#p')
    echo "DATABASE_HOST: ${DB_HOST:-unknown}" >> "$logfile"
  else
    echo "DATABASE_URL: (not set)" >> "$logfile"
  fi
}

# Baseline
load_env_file ".env"
# Environment-spezifische Overrides
load_env_file ".env.local"
load_env_file ".env.$APP_ENV"
load_env_file ".env.$APP_ENV.local"

# dump a small diagnostics snapshot so we can see what cron saw
log_diagnostics

# PHP-Konsole mit allen übergebenen Parametern aufrufen
exec /usr/local/bin/php bin/console "$@"
