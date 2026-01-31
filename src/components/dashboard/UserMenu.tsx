/**
 * UserMenu - User menu component for Dashboard header
 * 
 * Displays user email and provides logout option.
 * Located in the top-right corner of the Dashboard.
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

/**
 * UserMenu Component
 * 
 * Features:
 * - Displays user email
 * - Dropdown menu with logout option
 * - Accessible keyboard navigation
 * - Click outside to close
 */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    try {
      setIsOpen(false);
      await signOut();
      // Navigation will be handled by App.tsx based on auth state change
    } catch (error) {
      console.error('[UserMenu] Sign out error:', error);
      // Keep menu open if there was an error so user can try again
      setIsOpen(true);
    }
  };

  const userInitials = user?.email
    ? user.email
        .split('@')[0]
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <div className="relative" ref={menuRef}>
      {/* User Button */}
      <Button
        variant="outline"
        size="default"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User menu"
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">{user?.email || 'User'}</span>
        <span className="sm:hidden">{userInitials}</span>
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-1">
            {/* User Email */}
            <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
              <p className="font-medium">{user?.email || 'User'}</p>
            </div>

            {/* Logout Option */}
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
