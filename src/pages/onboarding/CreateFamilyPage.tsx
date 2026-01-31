/**
 * CreateFamilyPage - Onboarding view for creating a new family hub
 * 
 * Part of the onboarding process allowing users to create their Family Hub
 * and automatically receive admin role assignment.
 * 
 * Path: /onboarding/create-family
 * 
 * Features:
 * - Single-field form for family name
 * - Automatic display_name retrieval from auth context
 * - Admin benefits explanation
 * - Success animation
 * - Alternative path to join existing family
 */

import { useState } from 'react';
import { useCreateFamily } from '@/hooks/useCreateFamily';
import { useAuth } from '@/hooks/useAuth';
import { CreateFamilyForm } from '@/components/onboarding/CreateFamilyForm';
import { ExplanationCard } from '@/components/onboarding/ExplanationCard';
import { SuccessAnimation } from '@/components/onboarding/SuccessAnimation';
import type { CreateFamilyFormData } from '@/types/onboarding';

/**
 * CreateFamilyPage - Main component for family creation view
 * 
 * Handles the complete flow of family creation including:
 * - Pre-filling family name with user's display name
 * - Form submission and validation
 * - Success animation
 * - Automatic redirect to dashboard after success (via profile refresh)
 */
export function CreateFamilyPage() {
  const { user, refreshProfile } = useAuth();
  const { createFamily, isCreating, error } = useCreateFamily();
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  // Pre-fill family name with user's display name
  const defaultFamilyName = user?.display_name 
    ? `${user.display_name}${String.fromCharCode(8217)}s Family` 
    : '';

  // Handle form submission
  const handleSubmit = async (data: CreateFamilyFormData) => {
    try {
      await createFamily(data);
      setShowSuccess(true);
    } catch (err) {
      // Error is handled by the hook and displayed in the form
      // Silent fail - error already handled by hook
    }
  };

  // Handle success animation completion
  const handleSuccessComplete = async () => {
    // Refresh profile - this will cause App.tsx to re-route to dashboard
    await refreshProfile();
    
    // Force a small delay to ensure state updates propagate
    // Then reload the page to ensure clean state, proper routing, and fresh data
    // This ensures hooks fetch data for the new user's family
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  // Show success animation after family creation
  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <SuccessAnimation onComplete={handleSuccessComplete} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create Your Family Hub
          </h1>
          <p className="text-gray-600">
            Start organizing your family&apos;s life in one place
          </p>
        </div>

        {/* Explanation Card */}
        <ExplanationCard />

        {/* Create Family Form */}
        <CreateFamilyForm
          onSubmit={handleSubmit}
          isSubmitting={isCreating}
          error={error}
          defaultName={defaultFamilyName}
        />
      </div>
    </div>
  );
}
