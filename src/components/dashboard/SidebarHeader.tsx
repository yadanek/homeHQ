/**
 * SidebarHeader - nagłówek sidebara z zadaniami
 * Pokazuje "Tasks for Today" lub "Tasks for Jan 15" + przycisk dodawania zadania
 */

import { Plus } from 'lucide-react';
import { formatDateForSidebar } from '@/utils/dateHelpers';
import { Button } from '@/components/ui/button';

interface SidebarHeaderProps {
  selectedDate: Date;
  onAddTask: () => void;
}

export function SidebarHeader({ selectedDate, onAddTask }: SidebarHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <h3 className="font-semibold text-lg">
        {formatDateForSidebar(selectedDate)}
      </h3>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onAddTask}
        aria-label="Add task"
      >
        <Plus className="w-5 h-5" />
      </Button>
    </div>
  );
}

