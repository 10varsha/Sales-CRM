import { createContext, useContext, useState, ReactNode } from 'react';
import { DateRange } from 'react-day-picker';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

type TimeframeMode = 'day' | 'week' | 'month' | 'custom';

interface DateFilterContextType {
  timeframeMode: TimeframeMode;
  setTimeframeMode: (mode: TimeframeMode) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedWeek: number | undefined;
  setSelectedWeek: (week: number | undefined) => void;
  monthYear: number;
  setMonthYear: (year: number) => void;
  month: number;
  setMonth: (month: number) => void;
  getDateRangeFilter: () => { start: Date; end: Date } | null;
  clearFilters: () => void;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [timeframeMode, setTimeframeMode] = useState<TimeframeMode>('month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  
  // For weekly selection
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>();
  
  // For monthly selection
  const [monthYear, setMonthYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  // Get the actual date range based on current selection
  const getDateRangeFilter = (): { start: Date; end: Date } | null => {
    if (timeframeMode === 'day' && selectedDate) {
      return {
        start: new Date(selectedDate.setHours(0, 0, 0, 0)),
        end: new Date(selectedDate.setHours(23, 59, 59, 999))
      };
    }

    if (timeframeMode === 'week' && selectedWeek !== undefined) {
      const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
      const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
      const weeks = [];
      
      let current = startOfWeek(monthStart, { weekStartsOn: 0 });
      while (current <= monthEnd) {
        weeks.push({
          start: current > monthStart ? current : monthStart,
          end: endOfWeek(current, { weekStartsOn: 0 }) < monthEnd 
            ? endOfWeek(current, { weekStartsOn: 0 }) 
            : monthEnd
        });
        current = new Date(current.setDate(current.getDate() + 7));
      }
      
      return weeks[selectedWeek] || null;
    }

    if (timeframeMode === 'month') {
      return {
        start: startOfMonth(new Date(monthYear, month)),
        end: endOfMonth(new Date(monthYear, month))
      };
    }

    if (timeframeMode === 'custom' && dateRange?.from) {
      return {
        start: dateRange.from,
        end: dateRange.to || dateRange.from
      };
    }

    return null;
  };

  const clearFilters = () => {
    setDateRange(undefined);
    setSelectedDate(undefined);
    setSelectedWeek(undefined);
    setTimeframeMode('month');
  };

  return (
    <DateFilterContext.Provider
      value={{
        timeframeMode,
        setTimeframeMode,
        dateRange,
        setDateRange,
        selectedDate,
        setSelectedDate,
        selectedYear,
        setSelectedYear,
        selectedMonth,
        setSelectedMonth,
        selectedWeek,
        setSelectedWeek,
        monthYear,
        setMonthYear,
        month,
        setMonth,
        getDateRangeFilter,
        clearFilters
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDateFilter() {
  const context = useContext(DateFilterContext);
  if (!context) {
    throw new Error('useDateFilter must be used within DateFilterProvider');
  }
  return context;
}
