/**
 * ResetPasswordPage - Password reset request page
 * 
 * Displays form for requesting password reset email.
 * User enters email and receives reset link.
 */

import { AuthHeader } from '@/components/auth/AuthHeader';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ResetPasswordPageProps {
  /** Callback when user clicks back to login */
  onLoginClick?: () => void;
  /** Callback when user clicks back to landing page */
  onBackClick?: () => void;
}

/**
 * ResetPasswordPage Component
 * 
 * Features:
 * - Email input for password reset
 * - Success message after email is sent
 * - Link back to login page
 * - Error handling and display
 * - Accessible form
 */
export function ResetPasswordPage({
  onLoginClick,
  onBackClick,
}: ResetPasswordPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <AuthHeader showBackLink={!!onBackClick} onBackClick={onBackClick} />

        {/* Reset Password Card */}
        <Card>
          <CardHeader>
            <CardTitle>Reset hasła</CardTitle>
            <CardDescription>
              Wprowadź swój adres email, a wyślemy Ci link do resetu hasła
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm />

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
