import React from 'react';
import LoginForm from '../components/LoginForm';
import ErrorBoundary from '../components/ErrorBoundary';

const Auth: React.FC = () => {
  return (
    <ErrorBoundary>
      <LoginForm 
        variant="auth-page" 
        showLogo={true}
        redirectTo="/dashboard"
      />
    </ErrorBoundary>
  );
};

export default Auth;
