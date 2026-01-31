/**
 * DeleteEventButton Component
 * 
 * Provides a button with confirmation dialog for deleting events.
 * Includes loading state, error handling, and toast notifications.
 * 
 * Features:
 * - Confirmation dialog before deletion
 * - Loading state during deletion
 * - Success/error toast notifications
 * - Full accessibility support
 * - Only visible to event creator
 */

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Toast } from '@/components/ui/toast';
import { useDeleteEvent } from '@/hooks/useEvents';

interface DeleteEventButtonProps {
  /** UUID of the event to delete */
  eventId: string;
  /** Title of the event (displayed in confirmation dialog) */
  eventTitle: string;
  /** Callback function called after successful deletion */
  onDeleted?: () => void;
  /** Button variant (defaults to 'destructive') */
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  /** Button size (defaults to 'sm') */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Custom className for the button */
  className?: string;
}

/**
 * Button component for deleting events with confirmation dialog
 * 
 * @example
 * ```tsx
 * <DeleteEventButton
 *   eventId="uuid-123"
 *   eventTitle="Doctor Appointment"
 *   onDeleted={() => router.push('/events')}
 * />
 * ```
 */
export function DeleteEventButton({
  eventId,
  eventTitle,
  onDeleted,
  variant = 'destructive',
  size = 'sm',
  className
}: DeleteEventButtonProps) {
  const { deleteEvent, isDeleting, error, reset } = useDeleteEvent();
  const [isOpen, setIsOpen] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  /**
   * Handles the delete action
   * Called when user confirms deletion in the dialog
   */
  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent dialog from closing automatically
    
    const result = await deleteEvent(eventId);
    
    if (result.success) {
      // Close dialog
      setIsOpen(false);
      
      // Show success toast
      setShowSuccessToast(true);
      
      // Call onDeleted callback after a brief delay (for UX)
      setTimeout(() => {
        onDeleted?.();
      }, 500);
    }
    // Error is handled by the hook and displayed in toast
  };

  /**
   * Handles dialog close
   * Resets error state when dialog is closed
   */
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      reset(); // Clear any errors when closing
    }
  };

  return (
    <>
      <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger asChild>
          <Button 
            variant={variant} 
            size={size}
            className={className}
            aria-label={`Delete event: ${eventTitle}`}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </AlertDialogTrigger>
        
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the event <strong>"{eventTitle}"</strong>. 
              This action can be undone by contacting support.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Display error in dialog if deletion failed */}
          {error && (
            <div 
              className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
              role="alert"
            >
              <p className="text-sm text-destructive">
                {error.error.message}
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Event'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Toast */}
      {showSuccessToast && (
        <Toast
          message="Event deleted successfully"
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}

      {/* Error Toast - shown when error occurs outside dialog */}
      {error && !isOpen && (
        <Toast
          message={error.error.message}
          type="error"
          onClose={reset}
        />
      )}
    </>
  );
}

/**
 * Compact icon-only version for use in tight spaces
 * 
 * @example
 * ```tsx
 * <DeleteEventIconButton
 *   eventId="uuid-123"
 *   eventTitle="Doctor Appointment"
 * />
 * ```
 */
export function DeleteEventIconButton({
  eventId,
  eventTitle,
  onDeleted,
  className
}: Omit<DeleteEventButtonProps, 'variant' | 'size'>) {
  return (
    <DeleteEventButton
      eventId={eventId}
      eventTitle={eventTitle}
      onDeleted={onDeleted}
      variant="ghost"
      size="icon"
      className={className}
    />
  );
}

