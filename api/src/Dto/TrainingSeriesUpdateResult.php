<?php

namespace App\Dto;

/**
 * Result of a training-series update operation returned by TrainingSeriesUpdateService.
 */
final class TrainingSeriesUpdateResult
{
    public function __construct(
        public readonly int                    $updatedCount,
        public readonly CalendarEventChangeSet $changeSet,
        public readonly ?string                $oldSeriesEndDate,
        public readonly ?string                $newSeriesEndDate,
    ) {
    }
}
