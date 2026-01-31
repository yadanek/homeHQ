/**
 * CalendarControls - nagłówek kalendarza
 * Nawigacja miesiąc/rok (← Styczeń 2026 →) + FilterToggle
 */

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { addMonths, subMonths } from 'date-fns';
import type { FilterOption } from '@/types/dashboard.types';
import { formatMonthYear } from '@/utils/dateHelpers';
import { Button } from '@/components/ui/button';
import { FilterToggle } from './FilterToggle';

interface CalendarControlsProps {
  currentMonth: Date;
  activeFilter: FilterOption;
  onMonthChange: (month: Date) => void;
  onFilterChange: (filter: FilterOption) => void;
  onAddEvent: () => void;
}

export function CalendarControls({
  currentMonth,
  activeFilter,
  onMonthChange,
  onFilterChange,
  onAddEvent,
}: CalendarControlsProps) {
  const handlePreviousMonth = () => {
    onMonthChange(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(currentMonth, 1));
  };

  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
      {/* Left side: Month navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePreviousMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <h2 className="text-xl font-semibold min-w-[180px] text-center">
          {formatMonthYear(currentMonth)}
        </h2>

        <Button
          variant="outline"
          size="icon"
          onClick={handleNextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Right side: Filter and Add Event */}
      <div className="flex items-center gap-2 md:gap-4">
        <FilterToggle activeFilter={activeFilter} onChange={onFilterChange} />
        
        {/* Desktop: button with text */}
        <Button onClick={onAddEvent} className="hidden sm:inline-flex gap-2">
          <Plus className="w-4 h-4" />
          Add Event
        </Button>
        
        {/* Mobile: icon only */}
        <Button onClick={onAddEvent} size="icon" className="sm:hidden">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

