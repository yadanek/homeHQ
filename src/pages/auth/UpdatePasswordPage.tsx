/**
 * UpdatePasswordPage - New password setting page
 * 
 * Displays form for setting new password after clicking reset link in email.
 * User enters new password and confirmation.
 */

import { AuthHeader } from '@/components/auth/AuthHeader';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface UpdatePasswordPageProps {
  /** Callback when user clicks back to login */
  onLoginClick?: () => void;
  /** Callback when user clicks back to landing page */
  onBackClick?: () => void;
}

/**
 * UpdatePasswordPage Component
 * 
 * Features:
 * - New password and confirmation input
 * - Password validation and matching
 * - Link back to login page
 * - Error handling and display
 * - Accessible form
 */
export function UpdatePasswordPage({
  onLoginClick,
  onBackClick,
}: UpdatePasswordPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <AuthHeader showBackLink={!!onBackClick} onBackClick={onBackClick} />

        {/* Update Password Card */}
        <Card>
          <CardHeader>
            <CardTitle>Ustaw nowe hasło</CardTitle>
            <CardDescription>
              Wprowadź nowe hasło dla swojego konta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpdatePasswordForm />

            {/* Links */}
            {onLoginClick && (
              <div className="mt-6 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onLoginClick}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Powrót do logowania
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
