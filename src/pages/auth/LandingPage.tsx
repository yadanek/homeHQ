/**
 * LandingPage - Welcome page for unauthenticated users
 * 
 * Displays app description and call-to-action buttons for login and registration.
 * This is the entry point for users who are not logged in.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LandingPageProps {
  /** Callback when user clicks login button */
  onLoginClick?: () => void;
  /** Callback when user clicks register button */
  onRegisterClick?: () => void;
}

/**
 * LandingPage Component
 * 
 * Features:
 * - App branding and description
 * - Clear call-to-action buttons
 * - Responsive design (mobile-first)
 * - Accessible navigation
 */
export function LandingPage({ onLoginClick, onRegisterClick }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            HomeHQ
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            Centralizuj kalendarz, zadania i notatki swojej rodziny
          </p>
          <p className="text-sm text-gray-500">
            Redukuj mental load rodziców dzięki inteligentnym sugestiom AI
          </p>
        </div>

        {/* Description Card */}
        <Card>
          <CardHeader>
            <CardTitle>Zarządzaj życiem rodzinnym w jednym miejscu</CardTitle>
            <CardDescription>
              HomeHQ pomaga rodzinom organizować się, planować wydarzenia i zarządzać zadaniami.
              Nasz system oparty na regułach automatycznie sugeruje zadania logistyczne na podstawie
              zaplanowanych wydarzeń rodzinnych.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Wspólny kalendarz dla całej rodziny</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Lista zadań z przypisaniem do członków rodziny</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Inteligentne sugestie AI dla zadań logistycznych</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Prywatne notatki i wydarzenia</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Call-to-Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={onLoginClick}
            className="w-full"
            size="lg"
          >
            Zaloguj się
          </Button>
          <Button
            onClick={onRegisterClick}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Utwórz konto
          </Button>
        </div>
      </div>
    </div>
  );
}
