/**
 * SuccessAnimation Component
 * 
 * Animated success feedback displayed after successful family creation.
 * Shows checkmark icon with fade-in/scale-up animation and automatically
 * triggers redirect after a short delay.
 * 
 * Features:
 * - Animated checkmark icon
 * - Success message
 * - Auto-callback after 1.5 seconds
 * - Smooth CSS animations (fade-in, slide-up, scale)
 */

import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { SuccessAnimationProps } from '@/types/onboarding';

/**
 * SuccessAnimation - Animated success feedback
 * 
 * Displays a success message with animated checkmark and automatically
 * calls the onComplete callback after 1.5 seconds.
 * 
 * @param onComplete - Callback invoked after animation completes (1.5s)
 * 
 * @example
 * ```tsx
 * <SuccessAnimation 
 *   onComplete={() => navigate('/dashboard')} 
 * />
 * ```
 */
export function SuccessAnimation({ onComplete }: SuccessAnimationProps) {
  useEffect(() => {
    // Auto-redirect after 1.5 seconds
    const timer = setTimeout(() => {
      onComplete();
    }, 1500);

    // Cleanup timer on unmount
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      className="flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500"
      role="status"
      aria-live="polite"
    >
      {/* Animated Checkmark Icon */}
      <div className="animate-in zoom-in duration-700">
        <CheckCircle2 
          className="w-24 h-24 text-green-500" 
          aria-hidden="true"
        />
      </div>

      {/* Success Message */}
      <div className="text-center space-y-2 animate-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-2xl font-bold text-gray-900">
          Family created successfully!
        </h2>
        <p className="text-gray-600">
          Redirecting to your dashboard...
        </p>
      </div>

      {/* Loading Indicator */}
      <div className="flex gap-2" aria-label="Loading">
        <div 
          className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
          style={{ animationDelay: '0ms' }}
        />
        <div 
          className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
          style={{ animationDelay: '150ms' }}
        />
        <div 
          className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
}
