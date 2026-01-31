/**
 * SidebarEmptyState - pusty stan sidebara
 * Wyświetlany gdy brak zadań dla wybranej daty
 */

import { CheckCircle } from 'lucide-react';

export function SidebarEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-4">
      <CheckCircle className="w-12 h-12 text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-muted-foreground mb-1">
        No tasks for this day
      </p>
      <p className="text-xs text-muted-foreground">
        Click &apos;+&apos; to add a task
      </p>
    </div>
  );
}

