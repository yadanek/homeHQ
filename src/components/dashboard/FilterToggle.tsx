/**
 * FilterToggle - segmented control dla filtra widoczności wydarzeń
 * Everything (all) | My (private) | Family (shared)
 */

import type { FilterOption } from '@/types/dashboard.types';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface FilterToggleProps {
  activeFilter: FilterOption;
  onChange: (filter: FilterOption) => void;
}

export function FilterToggle({ activeFilter, onChange }: FilterToggleProps) {
  return (
    <ToggleGroup
      value={activeFilter}
      onValueChange={(value) => onChange(value as FilterOption)}
      type="single"
      aria-label="Filter events"
    >
      <ToggleGroupItem value="all" aria-label="Show all events">
        Everything
      </ToggleGroupItem>
      <ToggleGroupItem value="private" aria-label="Show only private events">
        My
      </ToggleGroupItem>
      <ToggleGroupItem value="shared" aria-label="Show only family events">
        Family
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

