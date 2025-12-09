import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CreditProvider } from './contexts/CreditContext';
import { supabase } from './config/supabase';
import Layout from './components/Layout';
import ToastProvider from './components/ToastProvider';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import ImageEnhancement from './pages/ImageEnhancement';
import InteriorDesign from './pages/InteriorDesign';
import ReplaceElements from './pages/ReplaceElements';
import AddFurnitures from './pages/AddFurnitures';
import ExteriorDesign from './pages/ExteriorDesign';
import SmartEffects from './pages/SmartEffects';
import Users from './pages/Users';
import Auth from './pages/Auth';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import Pricing from './pages/Pricing';
import Privacy from './pages/Privacy';
import PaymentSuccess from './pages/PaymentSuccess';
import './App.css';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

// Admin Route Component
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Auth Route Wrapper - allows authenticated users to stay on /auth if showing plan selection
const AuthRouteWrapper: React.FC = () => {
  const { user } = useAuth();
  const [showPlanSelection, setShowPlanSelection] = React.useState<string | null>(
    typeof window !== 'undefined' ? sessionStorage.getItem('show_plan_selection') : null
  );

  React.useEffect(() => {
    // Check sessionStorage when user state changes
    const checkFlag = () => {
      const flag = typeof window !== 'undefined' ? sessionStorage.getItem('show_plan_selection') : null;
      if (flag !== showPlanSelection) {
        console.log('[AuthRouteWrapper] Flag changed:', { old: showPlanSelection, new: flag, userId: user?.id });
        setShowPlanSelection(flag);
      }
    };

    checkFlag();

    // Listen for storage events (when flag changes in other tabs/components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'show_plan_selection') {
        console.log('[AuthRouteWrapper] Storage event:', { newValue: e.newValue, userId: user?.id });
        setShowPlanSelection(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check more frequently in case flag changes in same tab (sessionStorage events don't fire in same tab)
    const interval = setInterval(checkFlag, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user, showPlanSelection]);

  // Log decision for debugging
  React.useEffect(() => {
    if (user) {
      const flag = typeof window !== 'undefined' ? sessionStorage.getItem('show_plan_selection') : null;
      console.log('[AuthRouteWrapper] Route decision:', {
        userId: user.id,
        hasUser: !!user,
        showPlanSelection: flag,
        willRedirect: flag !== 'true' && flag !== 'checking'
      });
    }
  }, [user, showPlanSelection]);

  // If user is authenticated and not showing plan selection (or checking), redirect to dashboard
  // Allow 'checking' state to stay on /auth while we determine if plan selection is needed
  if (user && showPlanSelection !== 'true' && showPlanSelection !== 'checking') {
    console.log('[AuthRouteWrapper] Redirecting to dashboard - no plan selection needed');
    return <Navigate to="/dashboard" replace />;
  }

  return <Auth />;
};

// Auth Callback Handler Component
const AuthCallbackHandler: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Wait for user to be loaded
      if (loading) return;

      // Check for pending payment session from URL params or localStorage
      const urlParams = new URLSearchParams(location.search);
      const sessionId = urlParams.get('session_id') || localStorage.getItem('pending_payment_session');

      // If user is authenticated and there's a pending payment session, add credits
      if (user && sessionId) {
        try {
          const backendUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;

          if (token) {
            const response = await fetch(`${backendUrl}/api/v1/stripe/add-credits-from-session`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                sessionId,
                userId: user.id,
              }),
            });

            if (response.ok) {
              console.log('Credits added successfully from payment session');
            }
          }

          // Clear pending payment session
          localStorage.removeItem('pending_payment_session');
        } catch (error) {
          console.error('Error adding credits from payment session:', error);
          // Don't block navigation - credits may have been added by webhook
        }
      }

      // Handle hash changes for auth callbacks
      if (location.hash && location.hash.includes('access_token')) {
        // User clicked magic link, redirect to dashboard
        navigate('/dashboard', { replace: true });
      }
    };

    handleAuthCallback();
  }, [user, loading, location, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/auth" replace />;
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/auth" element={<AuthRouteWrapper />} />
      <Route path="/auth/callback" element={<AuthCallbackHandler />} />
      
      {/* Protected Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/image-enhancement" element={
        <ProtectedRoute>
          <Layout>
            <ImageEnhancement />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/interior-design" element={
        <ProtectedRoute>
          <Layout>
            <InteriorDesign />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/replace-elements" element={
        <ProtectedRoute>
          <Layout>
            <ReplaceElements />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/add-furnitures" element={
        <ProtectedRoute>
          <Layout>
            <AddFurnitures />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/exterior-design" element={
        <ProtectedRoute>
          <Layout>
            <ExteriorDesign />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/smart-effects" element={
        <ProtectedRoute>
          <Layout>
            <SmartEffects />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <AdminRoute>
          <Layout>
            <Users />
          </Layout>
        </AdminRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Layout>
            <Settings />
          </Layout>
        </ProtectedRoute>
      } />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <AdminRoute>
          <Layout>
            <AdminDashboard />
          </Layout>
        </AdminRoute>
      } />
      <Route path="/admin/generations" element={
        <AdminRoute>
          <Layout>
            <AdminDashboard />
          </Layout>
        </AdminRoute>
      } />
      
      <Route path="/users" element={
        <AdminRoute>
          <Layout>
            <Users />
          </Layout>
        </AdminRoute>
      } />
      
      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CreditProvider>
          <Router>
            <AppRoutes />
            <ToastProvider />
          </Router>
        </CreditProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
