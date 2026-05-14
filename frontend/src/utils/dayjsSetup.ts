/**
 * Centralized dayjs setup – import this file once before using dayjs anywhere.
 * Replaces moment.js (300KB → 3KB) as calendar dependency.
 */
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import dayOfYear from 'dayjs/plugin/dayOfYear';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';

dayjs.extend(isoWeek);
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(weekOfYear);
dayjs.extend(dayOfYear);
dayjs.extend(customParseFormat);
dayjs.extend(duration);

// Montag als erster Wochentag (ISO-Standard), Deutsch als Standard-Locale
dayjs.locale('de');

export default dayjs;
