import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, CheckCircle, AlertCircle, MailCheck } from 'lucide-react';

const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const { sendCode, signIn } = useAuth();
  const navigate = useNavigate();

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      setMessage('Please enter a valid email address');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await sendCode(email);
      if (result.success) {
        setMessage(result.message);
        setMessageType('success');
        setStep('code');
      } else {
        setMessage(result.message);
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Failed to send code. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      setMessage('Please enter the 6-digit code');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await signIn(email, code);
      if (result.success) {
        setMessage(result.message);
        setMessageType('success');
        // Redirect to dashboard immediately after successful login
        navigate('/dashboard');
      } else {
        setMessage(result.message);
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Authentication failed. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setCode('');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="text-center mb-4">
          <img 
            src="https://realvisionaire.com/logo_white.png" 
            alt="Real Vision AI Logo" 
            className="mx-auto h-32 w-auto object-contain"
          />
        </div>

        {/* Header */}
        <div className="text-center">
          {step === 'code' && (
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl backdrop-blur-sm">
              <div className="flex items-center justify-center mb-3">
                <MailCheck className="h-6 w-6 text-blue-400 mr-2 animate-pulse" />
                <h3 className="text-lg font-semibold text-blue-300">Check Your Email!</h3>
              </div>
              <p className="text-sm text-gray-300">
                We sent a 6-digit code to
              </p>
              <p className="text-sm font-medium text-blue-300 mt-1 break-all">
                {email}
              </p>
            </div>
          )}
          <h2 className={`text-3xl font-bold ${
            step === 'email' 
              ? 'text-white' 
              : 'bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent animate-pulse'
          }`}>
            {step === 'email' ? 'Welcome Back' : 'We Sent You The Code Confirmation'}
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            {step === 'email' 
              ? 'Enter your email to receive a login code'
              : 'Enter the 6-digit verification code below'
            }
          </p>
        </div>

        {/* Form */}
        <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 space-y-6">
          {step === 'email' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Enter your email"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                onClick={handleSendCode}
                disabled={loading || !email}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/30"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <span>Send Code</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label htmlFor="code" className="block text-sm font-semibold text-gray-200 mb-3 flex items-center">
                  <Lock className="h-4 w-4 mr-2 text-blue-400" />
                  Verification Code
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-blue-400" />
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full pl-14 pr-4 py-4 bg-slate-700/50 border-2 border-blue-500/50 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-center text-2xl font-mono tracking-[0.5em] font-semibold shadow-lg shadow-blue-500/20"
                    placeholder="000000"
                    maxLength={6}
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <div className="mt-3 flex items-center justify-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${code.length >= 1 ? 'bg-blue-500' : 'bg-slate-600'}`}></div>
                  <div className={`h-2 w-2 rounded-full ${code.length >= 2 ? 'bg-blue-500' : 'bg-slate-600'}`}></div>
                  <div className={`h-2 w-2 rounded-full ${code.length >= 3 ? 'bg-blue-500' : 'bg-slate-600'}`}></div>
                  <div className={`h-2 w-2 rounded-full ${code.length >= 4 ? 'bg-blue-500' : 'bg-slate-600'}`}></div>
                  <div className={`h-2 w-2 rounded-full ${code.length >= 5 ? 'bg-blue-500' : 'bg-slate-600'}`}></div>
                  <div className={`h-2 w-2 rounded-full ${code.length >= 6 ? 'bg-blue-500' : 'bg-slate-600'}`}></div>
                </div>
                <p className="mt-3 text-xs text-center text-gray-400">
                  {code.length === 0 
                    ? 'Enter the 6-digit code sent to your email'
                    : `${code.length}/6 digits entered`
                  }
                </p>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={handleBackToEmail}
                  disabled={loading}
                  className="flex-1 py-3 px-4 border border-slate-600 text-gray-300 rounded-lg font-medium hover:bg-slate-700 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
                <button
                  onClick={handleVerifyCode}
                  disabled={loading || code.length !== 6}
                  className={`flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg ${
                    code.length === 6 
                      ? 'shadow-blue-500/50 scale-105' 
                      : 'shadow-blue-500/30'
                  }`}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <span>Verify Code</span>
                      <CheckCircle className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div className={`p-4 rounded-lg flex items-center space-x-3 ${
              messageType === 'success' 
                ? 'bg-green-900/30 text-green-300 border border-green-700/50' 
                : 'bg-red-900/30 text-red-300 border border-red-700/50'
            }`}>
              {messageType === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400" />
              )}
              <span className="text-sm font-medium">{message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-400">
          {step === 'email' ? (
            <p>
              Don't have an account? No problem! Just enter your email and we'll create one for you.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="font-medium text-gray-300">
                Didn't receive the code?
              </p>
              <p>
                Check your spam folder or click "Back" to resend.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
