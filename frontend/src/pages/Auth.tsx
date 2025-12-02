import React from 'react';
import LoginForm from '../components/LoginForm';

const Auth: React.FC = () => {
  return (
    <LoginForm 
      variant="auth-page" 
      showLogo={true}
      redirectTo="/dashboard"
    />
  );
};

export default Auth;
