/**
 * App - Main application component with smart routing
 * 
 * Routing logic:
 * 1. If user is loading → show loading state
 * 2. If error and not authenticated → show error screen
 * 3. If not authenticated → show LandingPage
 * 4. If authenticated but no family → show CreateFamilyPage (onboarding)
 * 5. If authenticated with family → show Dashboard
 * 
 * Features:
 * - Authentication-based routing
 * - Profile-based routing
 * - Loading states
 * - Error handling
 */

import { useAuth } from './hooks/useAuth';
import { LandingPage } from './pages/auth/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { UpdatePasswordPage } from './pages/auth/UpdatePasswordPage';
import { DashboardView } from './pages/DashboardView';
import { CreateFamilyPage } from './pages/onboarding/CreateFamilyPage';
import { useState, useEffect, useRef, startTransition } from 'react';

function App() {
  const { isLoading, isAuthenticated, hasFamily, error } = useAuth();
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'register' | 'reset-password' | 'update-password'>(() => {
    // Check if URL contains password reset token on initial render
    const hash = window.location.hash;
    if (hash.includes('type=recovery') && hash.includes('access_token')) {
      return 'update-password';
    }
    // Default to login page (not landing page)
    // Unauthenticated users should see login immediately
    return 'login';
  });
  const prevAuthenticatedRef = useRef(isAuthenticated);

  // Track authentication state changes to show login page after logout
  // This effect synchronizes the view with external auth state changes (logout)
  useEffect(() => {
    const prevAuthenticated = prevAuthenticatedRef.current;
    if (prevAuthenticated && !isAuthenticated) {
      // User just logged out - show login page
      // Using startTransition to mark this as a non-urgent update
      startTransition(() => {
        setCurrentView('login');
      });
    }
    prevAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state (only if not authenticated)
  if (error && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-700 mb-2">
            Authentication Error
          </h2>
          <p className="text-gray-700 mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Not authenticated → show landing/login/register/reset-password/update-password pages
  if (!isAuthenticated) {
    if (currentView === 'login') {
      return (
        <LoginPage
          onRegisterClick={() => setCurrentView('register')}
          onResetPasswordClick={() => setCurrentView('reset-password')}
          onBackClick={() => setCurrentView('landing')}
        />
      );
    }
    
    if (currentView === 'register') {
      return (
        <RegisterPage
          onLoginClick={() => setCurrentView('login')}
          onBackClick={() => setCurrentView('landing')}
        />
      );
    }
    
    if (currentView === 'reset-password') {
      return (
        <ResetPasswordPage
          onLoginClick={() => setCurrentView('login')}
          onBackClick={() => setCurrentView('landing')}
        />
      );
    }
    
    if (currentView === 'update-password') {
      return (
        <UpdatePasswordPage
          onLoginClick={() => setCurrentView('login')}
          onBackClick={() => setCurrentView('landing')}
        />
      );
    }
    
    return (
      <LandingPage
        onLoginClick={() => setCurrentView('login')}
        onRegisterClick={() => setCurrentView('register')}
      />
    );
  }

  // Authenticated but no family → show onboarding
  if (!hasFamily) {
    return <CreateFamilyPage />;
  }

  // Authenticated with family → show dashboard
  return <DashboardView />;
}

export default App
