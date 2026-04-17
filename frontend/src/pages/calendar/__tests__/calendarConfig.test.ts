import { messages, formats } from '../calendarConfig';

describe('calendarConfig – messages', () => {
  it('showMore returns "+ N weitere"', () => {
    expect(messages.showMore(3)).toBe('+ 3 weitere');
    expect(messages.showMore(1)).toBe('+ 1 weitere');
  });
});

describe('calendarConfig – formats', () => {
  it('agendaTimeRangeFormat formats start–end as HH:mm – HH:mm', () => {
    const result = formats.agendaTimeRangeFormat({
      start: new Date('2025-06-15T09:00:00'),
      end:   new Date('2025-06-15T10:30:00'),
    });
    expect(result).toBe('09:00 – 10:30');
  });

  it('dayRangeHeaderFormat formats a date range as DD.MM.YYYY – DD.MM.YYYY', () => {
    const result = formats.dayRangeHeaderFormat({
      start: new Date('2025-06-09T00:00:00'),
      end:   new Date('2025-06-15T00:00:00'),
    });
    expect(result).toBe('09.06.2025 – 15.06.2025');
  });
});
