/**
 * RegisterPage - Registration page for new users
 * 
 * Displays registration form with email, password, and password confirmation.
 * Includes link to login page.
 */

import { AuthHeader } from '@/components/auth/AuthHeader';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RegisterPageProps {
  /** Callback when user clicks login link */
  onLoginClick?: () => void;
  /** Callback when user clicks back to landing page */
  onBackClick?: () => void;
}

/**
 * RegisterPage Component
 * 
 * Features:
 * - Registration form with email, password, and confirmation
 * - Password validation and matching
 * - Link to login page
 * - Error handling and display
 * - Accessible form
 */
export function RegisterPage({
  onLoginClick,
  onBackClick,
}: RegisterPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <AuthHeader showBackLink={!!onBackClick} onBackClick={onBackClick} />

        {/* Register Card */}
        <Card>
          <CardHeader>
            <CardTitle>Utwórz konto</CardTitle>
            <CardDescription>
              Zarejestruj się, aby rozpocząć korzystanie z HomeHQ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />

            {/* Links */}
            {onLoginClick && (
              <div className="mt-6 text-center text-sm text-muted-foreground">
                Masz już konto?{' '}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onLoginClick}
                  className="p-0 h-auto text-sm text-primary hover:text-primary/90 underline"
                >
                  Zaloguj się
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
