/**
 * CreateTaskDialog - Modal for creating new manual tasks
 * 
 * Displays a task creation form in a dialog overlay.
 * After creating a task, automatically refreshes the task list.
 */

import { useState, useEffect } from 'react';
import { useCreateTask } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AssigneePicker } from '@/components/family/AssigneePicker';
import { TaskTitleInput } from '@/components/tasks/TaskTitleInput';
import { TaskDueDatePicker } from '@/components/tasks/TaskDueDatePicker';
import { ErrorDisplay } from '@/components/tasks/ErrorDisplay';
import { X, CheckCircle2 } from 'lucide-react';
import type { CreateTaskRequest, ProfileSummary } from '@/types';
import { createClient } from '@/db/supabase.client';
import { logError } from '@/utils/response.utils';

interface CreateTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultDueDate?: Date;
  defaultAssignedTo?: string;
}

/**
 * Dialog component for creating manual tasks
 */
export function CreateTaskDialog({ 
  isOpen, 
  onClose, 
  onSuccess,
  defaultDueDate,
  defaultAssignedTo
}: CreateTaskDialogProps) {
  const { createTask, isLoading, error, data, reset } = useCreateTask();
  const { profile, user } = useAuth();
  
  // Form state
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(
    defaultDueDate 
      ? new Date(defaultDueDate).toISOString().slice(0, 10)
      : ''
  );
  const [assignedTo, setAssignedTo] = useState(defaultAssignedTo || '');
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  useEffect(() => {
    const loadProfiles = async () => {
      if (!profile?.family_id) return;
      setIsLoadingProfiles(true);

      try {
        const supabase = createClient();
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, role, created_at')
          .eq('family_id', profile.family_id)
          .order('display_name');

        if (profilesError) {
          logError(profilesError, { scope: 'CreateTaskDialog', familyId: profile.family_id });
          return;
        }

        setProfiles(data ?? []);
      } catch (err) {
        logError(err, { scope: 'CreateTaskDialog', familyId: profile?.family_id });
      } finally {
        setIsLoadingProfiles(false);
      }
    };

    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen, profile?.family_id]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDueDate(defaultDueDate ? new Date(defaultDueDate).toISOString().slice(0, 10) : '');
      setAssignedTo(defaultAssignedTo || '');
      reset();
    }
  }, [isOpen, defaultDueDate, defaultAssignedTo, reset]);

  // Close dialog after successful creation
  useEffect(() => {
    if (data) {
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000); // Show success message briefly before closing
    }
  }, [data, onSuccess, onClose]);

  // Handle ESC key to close dialog
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    const request: CreateTaskRequest = {
      title: title.trim(),
      // Convert date string (YYYY-MM-DD) to ISO 8601 at midnight UTC
      due_date: dueDate ? new Date(dueDate + 'T00:00:00').toISOString() : null,
      assigned_to: assignedTo || null,
      is_private: false
    };

    await createTask(request);
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Close on backdrop click (but not when clicking inside card)
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return (
    <div 
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <Card 
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4 p-6 bg-white shadow-xl animate-in zoom-in-95 duration-200 sm:max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 id="dialog-title" className="text-2xl font-bold">Create New Task</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100"
            disabled={isLoading}
            aria-label="Close dialog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Success Message */}
        {data && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">Task created successfully!</p>
              <p className="text-sm text-green-700">{data.title}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        <ErrorDisplay error={error?.error?.message || null} />

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <TaskTitleInput
            value={title}
            onChange={setTitle}
            disabled={isLoading}
          />

          {/* Due Date */}
          <TaskDueDatePicker
            value={dueDate ? dueDate + 'T00:00:00.000Z' : null}
            onChange={(isoValue) => {
              // Convert ISO 8601 to date format (YYYY-MM-DD) for state
              setDueDate(isoValue ? isoValue.slice(0, 10) : '');
            }}
            disabled={isLoading}
          />

          {/* Assign To */}
          <AssigneePicker
            label="Assign To"
            description="Choose who should complete this task."
            options={profiles}
            selectionMode="single"
            value={assignedTo || null}
            onChange={(nextValue) => setAssignedTo(nextValue ?? '')}
            currentUserId={user?.id}
            isDisabled={isLoading || isLoadingProfiles}
            allowEmpty
            emptyLabel="Unassigned"
          />

          {/* Action Buttons */}
          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !title.trim()}
              className="flex-1"
            >
              {isLoading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
