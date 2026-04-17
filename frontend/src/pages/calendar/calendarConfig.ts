import moment from 'moment';

export const messages = {
  allDay: 'Ganztägig',
  previous: 'Zurück',
  next: 'Weiter',
  today: 'Heute',
  month: 'Monat',
  week: 'Woche',
  day: 'Tag',
  agenda: 'Agenda',
  date: 'Datum',
  time: 'Zeit',
  event: 'Ereignis',
  noEventsInRange:
    'Keine Termine vorhanden. Klicken Sie auf einen Tag, um einen neuen Termin zu erstellen.',
  showMore: (total: number) => `+ ${total} weitere`,
};

export const formats = {
  agendaDateFormat: 'DD.MM.YYYY',
  agendaTimeFormat: 'HH:mm',
  agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format('HH:mm')} – ${moment(end).format('HH:mm')}`,
  monthHeaderFormat: 'MMMM YYYY',
  dayHeaderFormat: 'dddd, DD.MM.YYYY',
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format('DD.MM.YYYY')} – ${moment(end).format('DD.MM.YYYY')}`,
};
