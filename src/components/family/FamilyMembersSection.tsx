/**
 * Family Members Section Component
 * 
 * Allows users to add and manage family members without accounts.
 * Uses React 19 patterns with Result/Either for error handling.
 */

import { useState, useCallback, useId } from 'react';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trash2, UserPlus, AlertCircle } from 'lucide-react';

/**
 * FamilyMembersSection - Component for managing family members
 * 
 * Features:
 * - Quick add form with validation
 * - List of existing members
 * - Delete functionality with confirmation
 * - Loading states
 * - Error handling with ApiError format
 * - Accessibility (ARIA labels, keyboard support)
 */
export function FamilyMembersSection() {
  const { members, isLoading, error, addMember, deleteMember } = useFamilyMembers();
  const [name, setName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Generate unique IDs for accessibility
  const nameInputId = useId();
  const isAdminCheckboxId = useId();

  /**
   * Validate name input
   */
  const validateName = useCallback((value: string): string | null => {
    const trimmed = value.trim();
    
    if (trimmed.length === 0) {
      return 'Name is required';
    }
    
    if (trimmed.length > 100) {
      return 'Name must be less than 100 characters';
    }
    
    return null;
  }, []);

  /**
   * Handle add member
   * Uses Result pattern from hook
   */
  const handleAdd = useCallback(async () => {
    // Validate
    const error = validateName(name);
    if (error) {
      setValidationError(error);
      return;
    }

    setIsAdding(true);
    setValidationError(null);

    const member = await addMember({ 
      name: name.trim(), 
      is_admin: isAdmin 
    });

    setIsAdding(false);

    if (member) {
      // Success - clear form
      setName('');
      setIsAdmin(false);
    }
    // Error is handled by hook and displayed via error state
  }, [name, isAdmin, addMember, validateName]);

  /**
   * Handle delete member
   * Uses Result pattern from hook
   */
  const handleDelete = useCallback(async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from your family?`)) {
      return;
    }

    const success = await deleteMember(memberId);
    // Success/error handled by hook
  }, [deleteMember]);

  /**
   * Handle name input change
   */
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    // Clear validation error when user types
    if (validationError) {
      setValidationError(null);
    }
  }, [validationError]);

  /**
   * Handle Enter key in input
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && name.trim() && !isAdding) {
      handleAdd();
    }
  }, [name, isAdding, handleAdd]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Family Members</CardTitle>
        <CardDescription>
          Add family members who don&apos;t need their own account (like children)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Member Form */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor={nameInputId} className="sr-only">
                Member name
              </Label>
              <Input
                id={nameInputId}
                type="text"
                placeholder="Name (e.g., Emma, Max)"
                value={name}
                onChange={handleNameChange}
                onKeyDown={handleKeyDown}
                disabled={isAdding}
                maxLength={100}
                aria-invalid={validationError ? 'true' : 'false'}
                aria-describedby={validationError ? `${nameInputId}-error` : undefined}
                className={validationError ? 'border-destructive' : ''}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={isAdminCheckboxId}
                checked={isAdmin}
                onCheckedChange={(checked) => setIsAdmin(checked as boolean)}
                disabled={isAdding}
              />
              <Label 
                htmlFor={isAdminCheckboxId} 
                className="text-sm cursor-pointer"
              >
                Adult
              </Label>
            </div>
            <Button 
              onClick={handleAdd} 
              disabled={!name.trim() || isAdding}
              size="sm"
              aria-label="Add family member"
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
                  Add
                </>
              )}
            </Button>
          </div>

          {/* Validation Error */}
          {validationError && (
            <p 
              id={`${nameInputId}-error`}
              className="text-sm text-destructive flex items-center gap-1"
              role="alert"
            >
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              {validationError}
            </p>
          )}
        </div>

        {/* API Error Message */}
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error.error.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Members List */}
        {isLoading && members.length === 0 ? (
          <div 
            className="flex items-center justify-center py-8 text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
            Loading members...
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No family members yet.</p>
            <p className="text-xs mt-1">Add children or other family members above.</p>
          </div>
        ) : (
          <div className="space-y-2" role="list">
            {members.map((member) => (
              <div
                key={member.id}
                role="listitem"
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">
                    {member.is_admin ? '👤' : '👶'}
                  </span>
                  <div>
                    <div className="font-medium">{member.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {member.is_admin ? 'Adult' : 'Child'}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(member.id, member.name)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${member.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Helper Text */}
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-xs text-muted-foreground">
            <strong>💡 Tip:</strong> Mark as &quot;Adult&quot; for parents, grandparents, etc. 
            Leave unchecked for children. This helps AI suggest relevant tasks 
            (like booking a babysitter for adult-only events).
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
