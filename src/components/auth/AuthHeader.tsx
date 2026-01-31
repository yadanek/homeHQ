/**
 * AuthHeader - Header component for authentication pages
 * 
 * Displays logo and app name with optional back link to landing page.
 * Used across all authentication pages for consistent branding.
 */

import { Home } from 'lucide-react';

interface AuthHeaderProps {
  /** Whether to show back link to landing page */
  showBackLink?: boolean;
  /** Callback when back link is clicked */
  onBackClick?: () => void;
}

/**
 * AuthHeader Component
 * 
 * Features:
 * - Consistent branding across auth pages
 * - Optional back navigation
 * - Responsive design
 */
export function AuthHeader({ showBackLink = false, onBackClick }: AuthHeaderProps) {
  return (
    <header className="w-full py-6">
      <div className="flex items-center justify-between max-w-md mx-auto px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">HomeHQ</h1>
        </div>
        {showBackLink && onBackClick && (
          <button
            type="button"
            onClick={onBackClick}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            aria-label="Back to home"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </button>
        )}
      </div>
    </header>
  );
}
