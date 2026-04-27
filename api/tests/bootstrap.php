<?php

error_reporting(E_ALL);
ini_set('display_errors', '1');

use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__) . '/vendor/autoload.php';

if (file_exists(dirname(__DIR__) . '/.env')) {
    (new Dotenv())->load(dirname(__DIR__) . '/.env');
}

if (file_exists(dirname(__DIR__) . '/.env.test')) {
    (new Dotenv())->load(dirname(__DIR__) . '/.env.test');
}

echo "Initialisiere Testdatenbank...\n";
$projectDir = dirname(__DIR__);

echo "Drop Database if exists...\n";
passthru(sprintf(
    'php "%s/bin/console" doctrine:database:drop --force --if-exists --env=test --ansi 2>&1',
    $projectDir
));

echo "Create Database...\n";
passthru(sprintf(
    'php "%s/bin/console" doctrine:database:create --env=test --ansi 2>&1',
    $projectDir
));

echo "Run Migrations...\n";
passthru(sprintf(
    'php "%s/bin/console" doctrine:migrations:migrate --no-interaction --env=test --ansi 2>&1',
    $projectDir
));

echo "Clear Cache...\n";
passthru(sprintf(
    'php "%s/bin/console" cache:clear --env=test --no-warmup --ansi 2>&1',
    $projectDir
));

echo "Load Fixtures...\n";
passthru(sprintf(
    'php "%s/bin/console" doctrine:fixtures:load --no-interaction --group=master --group=test --env=test --ansi 2>&1',
    $projectDir
));

echo "Testdatenbank erfolgreich initialisiert!\n\n";
