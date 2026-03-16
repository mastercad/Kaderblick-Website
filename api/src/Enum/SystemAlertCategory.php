<?php

namespace App\Enum;

enum SystemAlertCategory: string
{
    case SERVER_ERROR = 'server_error';
    case LOGIN_FAILURE = 'login_failure';
    case BRUTE_FORCE = 'brute_force';
    case SUSPICIOUS_REQUEST = 'suspicious_request';
    case QUEUE_FAILURE = 'queue_failure';
    case DISK_SPACE = 'disk_space';
    case CRON_FAILURE = 'cron_failure';

    public function label(): string
    {
        return match ($this) {
            self::SERVER_ERROR => 'Server-Fehler',
            self::LOGIN_FAILURE => 'Login-Fehler',
            self::BRUTE_FORCE => 'Brute-Force-Verdacht',
            self::SUSPICIOUS_REQUEST => 'Scan/Hack-Versuch',
            self::QUEUE_FAILURE => 'Queue-Fehler',
            self::DISK_SPACE => 'Festplattenspeicher',
            self::CRON_FAILURE => 'Cron-Ausfall',
        };
    }

    public function icon(): string
    {
        return match ($this) {
            self::SERVER_ERROR => '🔴',
            self::LOGIN_FAILURE => '🔑',
            self::BRUTE_FORCE => '🚨',
            self::SUSPICIOUS_REQUEST => '🔍',
            self::QUEUE_FAILURE => '📭',
            self::DISK_SPACE => '💾',
            self::CRON_FAILURE => '⏰',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::SERVER_ERROR => '#c0392b',
            self::LOGIN_FAILURE => '#e67e22',
            self::BRUTE_FORCE => '#8e44ad',
            self::SUSPICIOUS_REQUEST => '#d84315',
            self::QUEUE_FAILURE => '#1565c0',
            self::DISK_SPACE => '#f57f17',
            self::CRON_FAILURE => '#6d4c41',
        };
    }
}
