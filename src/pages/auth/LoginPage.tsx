/**
 * LoginPage - Login page for authenticated users
 * 
 * Displays login form with email and password fields.
 * Includes links to password reset and registration.
 */

import { AuthHeader } from '@/components/auth/AuthHeader';
import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface LoginPageProps {
  /** Callback when user clicks register link */
  onRegisterClick?: () => void;
  /** Callback when user clicks reset password link */
  onResetPasswordClick?: () => void;
  /** Callback when user clicks back to landing page */
  onBackClick?: () => void;
}

/**
 * LoginPage Component
 * 
 * Features:
 * - Login form with email and password
 * - Links to password reset and registration
 * - Error handling and display
 * - Accessible form
 */
export function LoginPage({
  onRegisterClick,
  onResetPasswordClick,
  onBackClick,
}: LoginPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <AuthHeader showBackLink={!!onBackClick} onBackClick={onBackClick} />

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle>Zaloguj się</CardTitle>
            <CardDescription>
              Wprowadź swoje dane, aby uzyskać dostęp do konta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />

            {/* Links */}
            <div className="mt-6 space-y-3 text-center">
              {onResetPasswordClick && (
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onResetPasswordClick}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Zapomniałeś hasła?
                  </Button>
                </div>
              )}
              {onRegisterClick && (
                <div className="text-sm text-muted-foreground">
                  Nie masz konta?{' '}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onRegisterClick}
                    className="p-0 h-auto text-sm text-primary hover:text-primary/90 underline"
                  >
                    Zarejestruj się
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
