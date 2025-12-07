import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
      <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
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
        <Router>
          <AppRoutes />
          <ToastProvider />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
