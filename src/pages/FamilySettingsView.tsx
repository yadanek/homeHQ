/**
 * FamilySettingsView - Dialog for managing family settings
 * 
 * Features:
 * - Manage family members without accounts (children, etc.)
 * - Generate invitation codes for new family members
 * - View and manage active invitations
 */

import { useCallback } from 'react';
import { FamilyMembersSection } from '@/components/family/FamilyMembersSection';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';

interface FamilySettingsViewProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Dialog component for family settings
 * Uses overlay pattern consistent with CreateEventDialog
 */
export function FamilySettingsView({ isOpen, onClose }: FamilySettingsViewProps) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div 
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <Card 
        role="dialog"
        aria-modal="true"
        aria-labelledby="family-settings-title"
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b">
            <div>
              <h2 id="family-settings-title" className="text-2xl font-bold">
                Family Settings
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your family members and invitations
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Close family settings"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="space-y-8">
            {/* Family Members Section */}
            <section aria-labelledby="family-members-heading">
              <FamilyMembersSection />
            </section>

            {/* Invitation Codes Section - Placeholder */}
            <section 
              aria-labelledby="invitations-heading"
              className="pt-6 border-t"
            >
              <div className="mb-4">
                <h3 id="invitations-heading" className="text-lg font-semibold">
                  Invite Family Members
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Generate invitation codes to add family members with accounts
                </p>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-6 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Invitation system coming soon. Family members can be invited via unique codes.
                </p>
                <Button variant="outline" disabled>
                  Generate Invitation Code
                </Button>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t flex justify-end">
            <Button onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
