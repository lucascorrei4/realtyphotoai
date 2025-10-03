import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import ImageEnhancement from './pages/ImageEnhancement';
import InteriorDesign from './pages/InteriorDesign';
import ReplaceElements from './pages/ReplaceElements';
import AddFurnitures from './pages/AddFurnitures';
import ExteriorDesign from './pages/ExteriorDesign';
import Users from './pages/Users';
import Auth from './pages/Auth';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
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

  useEffect(() => {
    // Handle hash changes for auth callbacks
    const handleHashChange = () => {
      if (location.hash && location.hash.includes('access_token')) {
        // User clicked magic link, redirect to dashboard
        window.location.href = '/dashboard';
      }
    };

    handleHashChange();
  }, [location]);

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
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
