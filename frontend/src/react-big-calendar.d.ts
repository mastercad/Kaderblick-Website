declare module 'react-big-calendar' {
  import { ComponentType, CSSProperties } from 'react';

  export interface CalendarProps<TEvent extends object = Event> {
    localizer: any;
    events?: TEvent[];
    startAccessor?: string | ((event: TEvent) => Date);
    endAccessor?: string | ((event: TEvent) => Date);
    titleAccessor?: string | ((event: TEvent) => string);
    allDayAccessor?: string | ((event: TEvent) => boolean);
    resourceAccessor?: string | ((event: TEvent) => any);
    view?: string;
    views?: string[] | Record<string, boolean | ComponentType<any>>;
    defaultView?: string;
    defaultDate?: Date;
    date?: Date;
    onNavigate?: (date: Date, view: string, action: string) => void;
    onView?: (view: string) => void;
    onSelectEvent?: (event: TEvent, e: React.SyntheticEvent) => void;
    onSelectSlot?: (slotInfo: { start: Date; end: Date; slots: Date[]; action: string }) => void;
    onRangeChange?: (range: Date[] | { start: Date; end: Date }, view?: string) => void;
    selectable?: boolean | 'ignoreEvents';
    longPressThreshold?: number;
    step?: number;
    timeslots?: number;
    min?: Date;
    max?: Date;
    messages?: Record<string, string | ((total: number) => string)>;
    formats?: Record<string, any>;
    culture?: string;
    components?: Record<string, ComponentType<any> | (() => null) | null | undefined>;
    eventPropGetter?: (event: TEvent, start: Date, end: Date, isSelected: boolean) => { className?: string; style?: CSSProperties };
    dayPropGetter?: (date: Date) => { className?: string; style?: CSSProperties };
    slotPropGetter?: (date: Date) => { className?: string; style?: CSSProperties };
    style?: CSSProperties;
    className?: string;
    popup?: boolean;
    toolbar?: boolean;
    scrollToTime?: Date;
    showMultiDayTimes?: boolean;
    getNow?: () => Date;
    length?: number;
    [key: string]: any;
  }

  export interface Event {
    title?: string;
    start?: Date;
    end?: Date;
    allDay?: boolean;
    resource?: any;
  }

  export const Calendar: ComponentType<CalendarProps<any>>;
  export const Views: Record<string, string>;
  export function momentLocalizer(moment: any): any;
  export function dayjsLocalizer(dayjs: any): any;
  export function dateFnsLocalizer(config: any): any;
  export function globalizeLocalizer(globalize: any): any;

  export default Calendar;
}
