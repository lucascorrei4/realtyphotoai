import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, CheckCircle, AlertCircle, MailCheck, Clock, Copy, Bell } from 'lucide-react';

export interface LoginFormProps {
  variant?: 'landing' | 'auth-page';
  showLogo?: boolean;
  onSuccess?: () => void;
  redirectTo?: string;
  className?: string;
}

const LoginForm: React.FC<LoginFormProps> = ({
  variant = 'landing',
  showLogo = false,
  onSuccess,
  redirectTo = '/dashboard',
  className = ''
}) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [codeEnteredTime, setCodeEnteredTime] = useState<number | null>(null);
  const [autoSubmitAttempted, setAutoSubmitAttempted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [codeSentTime, setCodeSentTime] = useState<number | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { sendCode, signIn } = useAuth();
  const navigate = useNavigate();

  // Auto-focus code input when step changes
  useEffect(() => {
    if (step === 'code' && codeInputRef.current) {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        codeInputRef.current?.focus();
      }, 100);
    }
  }, [step]);

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (step === 'code' && code.length === 6 && !loading && !autoSubmitAttempted) {
      setAutoSubmitAttempted(true);
      // Small delay for better UX (user can see all digits entered)
      const timer = setTimeout(async () => {
        if (!code || code.length !== 6) return;
        
        setLoading(true);
        setMessage('');
        
        try {
          const result = await signIn(email, code);
          if (result.success) {
            setMessage(result.message);
            setMessageType('success');
            
            if (onSuccess) {
              onSuccess();
            }
            
            setTimeout(() => {
              navigate(redirectTo);
            }, 500);
          } else {
            setMessage(result.message);
            setMessageType('error');
            setAutoSubmitAttempted(false);
          }
        } catch (error) {
          setMessage('Authentication failed. Please try again.');
          setMessageType('error');
          setAutoSubmitAttempted(false);
        } finally {
          setLoading(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else if (code.length < 6) {
      setAutoSubmitAttempted(false);
    }
  }, [code, step, loading, email, signIn, navigate, redirectTo, onSuccess]);

  // Track when code was entered for reminder
  useEffect(() => {
    if (step === 'code' && code.length > 0) {
      if (codeEnteredTime === null) {
        setCodeEnteredTime(Date.now());
      }
    }
  }, [code, step, codeEnteredTime]);

  // Countdown timer when code step is active
  useEffect(() => {
    if (step === 'code' && codeSentTime) {
      const COUNTDOWN_DURATION = 2 * 60 * 1000; // 2 minutes
      const updateCountdown = () => {
        const elapsed = Date.now() - codeSentTime;
        const remaining = Math.max(0, COUNTDOWN_DURATION - elapsed);
        setCountdown(remaining);
        
        if (remaining === 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
        }
      };

      updateCountdown();
      countdownIntervalRef.current = setInterval(updateCountdown, 1000);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      };
    } else {
      setCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
  }, [step, codeSentTime]);

  // Update browser tab title when code is sent
  useEffect(() => {
    const originalTitle = document.title;
    
    if (step === 'code' && countdown !== null) {
      const minutes = Math.floor(countdown / 60000);
      const seconds = Math.floor((countdown % 60000) / 1000);
      const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      document.title = `⏰ ${timeString} - Enter your code | ${originalTitle.split('|')[1] || 'RealVision AI'}`;
    } else {
      document.title = originalTitle;
    }

    return () => {
      document.title = originalTitle;
    };
  }, [step, countdown]);

  // Browser notification when code is sent (if user allows)
  useEffect(() => {
    if (step === 'code' && codeSentTime && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Check your email!', {
        body: `We sent a 6-digit code to ${email}. Please enter it to continue.`,
        icon: '/logo_white.png',
        tag: 'verification-code',
        requireInteraction: false,
      });
    }
  }, [step, codeSentTime, email]);

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
        setCodeEnteredTime(null);
        setAutoSubmitAttempted(false);
        setCodeSentTime(Date.now());
        
        // Request notification permission
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission();
        }
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
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess();
        }
        
        // Small delay to show success message before redirect
        setTimeout(() => {
          navigate(redirectTo);
        }, 500);
      } else {
        setMessage(result.message);
        setMessageType('error');
        setAutoSubmitAttempted(false);
      }
    } catch (error) {
      setMessage('Authentication failed. Please try again.');
      setMessageType('error');
      setAutoSubmitAttempted(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setCode('');
    setMessage('');
    setCodeEnteredTime(null);
    setAutoSubmitAttempted(false);
    setCodeSentTime(null);
    setCountdown(null);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(email).then(() => {
      // Brief feedback could be shown here
    });
  };

  const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  };

  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && code.length === 6 && !loading) {
      handleVerifyCode();
    }
  };

  const handleResendCode = async () => {
    setCode('');
    setMessage('');
    setCodeEnteredTime(null);
    setAutoSubmitAttempted(false);
    setCodeSentTime(null);
    setCountdown(null);
    await handleSendCode();
  };

  const isAuthPageVariant = variant === 'auth-page';

  // Calculate countdown display
  const countdownMinutes = countdown ? Math.floor(countdown / 60000) : 0;
  const countdownSeconds = countdown ? Math.floor((countdown % 60000) / 1000) : 0;
  const isCountdownActive = countdown !== null && countdown > 0;
  const isCountdownLow = countdown !== null && countdown < 60000; // Less than 1 minute

  // Render based on variant
  if (isAuthPageVariant) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-all duration-500 ${
        step === 'code' 
          ? 'bg-gradient-to-br from-blue-950 via-indigo-950 to-purple-950' 
          : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
      } ${className}`}>
        <div className="max-w-md w-full space-y-8">
          {/* Logo */}
          {showLogo && (
            <div className="text-center mb-4">
              <img 
                src="https://realvisionaire.com/logo_white.png" 
                alt="Real Vision AI Logo" 
                className="mx-auto h-32 w-auto object-contain"
              />
            </div>
          )}

          {/* Step Indicator */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className={`flex items-center space-x-2 transition-all duration-300 ${
              step === 'email' ? 'scale-105' : ''
            }`}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300 ${
                step === 'email'
                  ? 'bg-blue-500 text-white ring-4 ring-blue-500/30'
                  : step === 'code'
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-600 text-gray-300'
              }`}>
                {step === 'code' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  '1'
                )}
              </div>
              <span className={`text-sm font-medium transition-colors ${
                step === 'email' ? 'text-white' : step === 'code' ? 'text-green-400' : 'text-gray-400'
              }`}>
                Add your email
              </span>
            </div>
            
            {/* Connector Line */}
            <div className={`h-0.5 w-12 transition-all duration-300 ${
              step === 'code' ? 'bg-blue-500' : 'bg-slate-600'
            }`}></div>
            
            <div className={`flex items-center space-x-2 transition-all duration-300 ${
              step === 'code' ? 'scale-105' : ''
            }`}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300 ${
                step === 'code'
                  ? 'bg-blue-500 text-white ring-4 ring-blue-500/30 animate-pulse'
                  : 'bg-slate-600 text-gray-300'
              }`}>
                2
              </div>
              <span className={`text-sm font-medium transition-colors ${
                step === 'code' ? 'text-white' : 'text-gray-400'
              }`}>
                Confirm the code
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center">
            {step === 'code' && (
              <div className="mb-6 p-5 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 border-2 border-blue-500/50 rounded-xl backdrop-blur-sm animate-pulse">
                <div className="flex items-center justify-center mb-3">
                  <MailCheck className="h-6 w-6 text-blue-400 mr-2 animate-pulse" />
                  <h3 className="text-lg font-semibold text-blue-300">📧 Check Your Email!</h3>
                </div>
                <p className="text-sm text-gray-300 mb-2">
                  We sent a 6-digit code to
                </p>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <p className="text-sm font-medium text-blue-300 break-all">
                    {email}
                  </p>
                  <button
                    onClick={handleCopyEmail}
                    className="p-1 hover:bg-blue-500/30 rounded transition-colors"
                    title="Copy email"
                  >
                    <Copy className="h-4 w-4 text-blue-400" />
                  </button>
                </div>
                {isCountdownActive && (
                  <div className={`mt-3 p-2 rounded-lg ${
                    isCountdownLow 
                      ? 'bg-red-500/20 border border-red-500/50' 
                      : 'bg-blue-500/10 border border-blue-500/30'
                  }`}>
                    <div className="flex items-center justify-center gap-2">
                      <Clock className={`h-4 w-4 ${isCountdownLow ? 'text-red-400 animate-pulse' : 'text-blue-400'}`} />
                      <span className={`text-xs font-semibold ${isCountdownLow ? 'text-red-300' : 'text-blue-300'}`}>
                        {isCountdownLow ? '⏰ Hurry! ' : ''}
                        {formatTime(countdown)} remaining to enter your code
                      </span>
                    </div>
                  </div>
                )}
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
                      onKeyDown={(e) => e.key === 'Enter' && !loading && email && handleSendCode()}
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
                {/* Reminder banner positioned above Verification Code */}
                <div className={`p-4 rounded-xl border-2 backdrop-blur-sm animate-pulse ${
                  isCountdownLow
                    ? 'bg-gradient-to-r from-red-500/20 via-orange-500/20 to-yellow-500/20 border-red-400'
                    : 'bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 border-yellow-300 dark:border-yellow-400'
                }`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <Bell className={`h-5 w-5 ${isCountdownLow ? 'text-red-400 animate-pulse' : 'text-yellow-500'}`} />
                      <span className={`text-sm font-semibold text-center ${isCountdownLow ? 'text-red-300' : 'text-yellow-200'}`}>
                        {isCountdownLow ? '⚠️ Check your email for the verification code.' : '📧 '}
                        Take a look in the SPAM folder if you don't see it.
                      </span>
                    </div>
                    {isCountdownActive && (
                      <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg ${
                        isCountdownLow ? 'bg-red-500/30' : 'bg-yellow-500/30'
                      }`}>
                        <Clock className={`h-5 w-5 ${isCountdownLow ? 'text-red-300 animate-pulse' : 'text-yellow-300'}`} />
                        <span className={`text-base font-bold ${isCountdownLow ? 'text-red-200' : 'text-yellow-200'}`}>
                          {formatTime(countdown)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label htmlFor="code" className="block text-sm font-semibold text-gray-200 mb-3 flex items-center">
                    <Lock className="h-4 w-4 mr-2 text-blue-400" />
                    Verification Code
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-blue-400" />
                    <input
                      ref={codeInputRef}
                      id="code"
                      type="text"
                      value={code}
                      onChange={handleCodeChange}
                      onKeyDown={handleCodeKeyDown}
                      className="w-full pl-14 pr-4 py-4 bg-slate-700/50 border-2 border-blue-500/50 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-center text-2xl font-mono tracking-[0.5em] font-semibold shadow-lg shadow-blue-500/20"
                      placeholder="000000"
                      maxLength={6}
                      disabled={loading}
                      autoFocus
                      inputMode="numeric"
                    />
                  </div>
                  {/* Progress dots indicator */}
                  <div className="mt-3 flex items-center justify-center space-x-2">
                    {[1, 2, 3, 4, 5, 6].map((digit) => (
                      <div
                        key={digit}
                        className={`h-2 w-2 rounded-full transition-all duration-200 ${
                          code.length >= digit ? 'bg-blue-500 scale-125' : 'bg-slate-600'
                        }`}
                      ></div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-center text-gray-400">
                    {code.length === 0 
                      ? 'Enter the 6-digit code sent to your email'
                      : code.length < 6
                        ? `${code.length}/6 digits entered • Auto-verifying when complete...`
                        : 'Verifying code...'
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
                    onClick={handleResendCode}
                    disabled={loading}
                    className="flex-1 py-3 px-4 border border-slate-600 text-gray-300 rounded-lg font-medium hover:bg-slate-700 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Resend
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
                <p className={`font-semibold ${isCountdownLow ? 'text-red-300 animate-pulse' : 'text-gray-300'}`}>
                  {isCountdownLow ? '⏰ Time is running out! ' : ''}
                  Didn't receive the code?
                </p>
                <p>
                  Check your spam folder or click "Resend" to get a new code.
                </p>
                {isCountdownActive && (
                  <p className="text-xs text-gray-400 mt-2">
                    Code expires in {formatTime(countdown)} • Check your email now!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Landing page variant
  return (
    <div className={className}>

      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4 mb-6">
        <div className={`flex items-center space-x-2 transition-all duration-300 ${
          step === 'email' ? 'scale-105' : ''
        }`}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300 ${
            step === 'email'
              ? 'bg-blue-600 text-white ring-4 ring-blue-600/30 dark:bg-blue-500'
              : step === 'code'
                ? 'bg-green-500 text-white'
                : 'bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
          }`}>
            {step === 'code' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              '1'
            )}
          </div>
          <span className={`text-sm font-medium transition-colors ${
            step === 'email' 
              ? 'text-blue-600 dark:text-blue-400 font-semibold' 
              : step === 'code' 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-gray-500 dark:text-gray-400'
          }`}>
            Add your email
          </span>
        </div>
        
        {/* Connector Line */}
        <div className={`h-0.5 w-12 transition-all duration-300 ${
          step === 'code' 
            ? 'bg-blue-600 dark:bg-blue-500' 
            : 'bg-gray-300 dark:bg-gray-600'
        }`}></div>
        
        <div className={`flex items-center space-x-2 transition-all duration-300 ${
          step === 'code' ? 'scale-105' : ''
        }`}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300 ${
            step === 'code'
              ? 'bg-blue-600 text-white ring-4 ring-blue-600/30 animate-pulse dark:bg-blue-500'
              : 'bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
          }`}>
            2
          </div>
          <span className={`text-sm font-medium transition-colors ${
            step === 'code' 
              ? 'text-blue-600 dark:text-blue-400 font-semibold' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            Confirm the code
          </span>
        </div>
      </div>

      <div className="mb-6 text-center sm:mb-8">
        <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-500 sm:h-16 sm:w-16 ${
          step === 'code'
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 animate-pulse scale-110'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600'
        }`}>
          {step === 'code' ? (
            <MailCheck className="h-6 w-6 text-white sm:h-8 sm:w-8 animate-pulse" />
          ) : (
            <Mail className="h-6 w-6 text-white sm:h-8 sm:w-8" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
          {step === 'email' ? 'Get Started Today' : '📧 Enter Your Code'}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {step === 'email'
            ? 'Enter your email to receive a secure login code.'
            : (
              <div className="space-y-2">
                <p>We sent a 6-digit code to</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-semibold text-blue-600 dark:text-blue-400 break-all">{email}</span>
                  <button
                    onClick={handleCopyEmail}
                    className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                    title="Copy email"
                  >
                    <Copy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </button>
                </div>
                {isCountdownActive && (
                  <p className={`text-xs font-semibold ${isCountdownLow ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    ⏰ {formatTime(countdown)} remaining • Don't forget to check your inbox!
                  </p>
                )}
              </div>
            )}
        </p>
      </div>

      <div className={`space-y-6 rounded-2xl p-6 shadow-xl ring-offset-2 transition-all duration-500 ${
        step === 'code'
          ? 'bg-white dark:bg-slate-800 ring-4 ring-blue-500/60 shadow-2xl shadow-blue-500/30'
          : 'bg-white dark:bg-slate-800 ring-offset-white dark:ring-offset-slate-950'
      }`}>
        {step === 'email' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="email-landing" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="email-landing"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !loading && email && handleSendCode()}
                  className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700 dark:text-white"
                  placeholder="you@agency.com"
                  disabled={loading}
                />
              </div>
            </div>
            <button
              onClick={handleSendCode}
              disabled={loading || !email}
              className="flex w-full items-center justify-center space-x-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-medium text-white transition-all hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
              ) : (
                <>
                  <span>Send Code</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Reminder banner positioned above Verification Code */}
            <div className={`p-4 rounded-xl border-2 backdrop-blur-sm animate-pulse ${
              isCountdownLow
                ? 'bg-gradient-to-r from-red-500/20 via-orange-500/20 to-yellow-500/20 border-red-500'
                : 'bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-orange-500/20 border-yellow-400'
            }`}>
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Bell className={`h-5 w-5 ${isCountdownLow ? 'text-red-400 animate-pulse' : 'text-yellow-500'}`} />
                  <span className={`text-sm font-semibold text-center ${isCountdownLow ? 'text-red-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                    {isCountdownLow ? '⚠️ Check now in your email for the verification code! ' : '📧 '}
                    Take a look in the SPAM folder if you don't see it.
                  </span>
                </div>
                {isCountdownActive && (
                  <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg ${
                    isCountdownLow ? 'bg-red-500/30' : 'bg-yellow-500/30'
                  }`}>
                    <Clock className={`h-5 w-5 ${isCountdownLow ? 'text-red-300 animate-pulse' : 'text-yellow-600 dark:text-yellow-400'}`} />
                    <span className={`text-base font-bold ${isCountdownLow ? 'text-red-200' : 'text-yellow-700 dark:text-yellow-300'}`}>
                      {formatTime(countdown)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <label htmlFor="code-landing" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Verification Code
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  ref={codeInputRef}
                  id="code-landing"
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  onKeyDown={handleCodeKeyDown}
                  className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-center text-lg font-mono tracking-widest text-gray-900 transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700 dark:text-white"
                  placeholder="000000"
                  maxLength={6}
                  disabled={loading}
                  autoFocus
                  inputMode="numeric"
                />
              </div>
              {/* Progress indicator */}
              <div className="mt-3 flex items-center justify-center space-x-2">
                {[1, 2, 3, 4, 5, 6].map((digit) => (
                  <div
                    key={digit}
                    className={`h-2 w-2 rounded-full transition-all duration-200 ${
                      code.length >= digit 
                        ? 'bg-blue-500 scale-125' 
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  ></div>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {code.length === 0
                  ? 'Enter the 6-digit code sent to your email'
                  : code.length < 6
                    ? `${code.length}/6 digits entered • Auto-verifying when complete...`
                    : 'Verifying code...'
                }
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleBackToEmail}
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-300 py-3 text-gray-700 transition hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Back
              </button>
              <button
                onClick={handleResendCode}
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-300 py-3 text-gray-700 transition hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Resend
              </button>
              <button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
                className={`flex flex-1 items-center justify-center space-x-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-3 font-medium text-white transition-all hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                  code.length === 6 ? 'ring-2 ring-blue-400 ring-offset-2' : ''
                }`}
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                ) : (
                  <>
                    <span>Verify</span>
                    <CheckCircle className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {message && (
          <div className={`flex items-center space-x-3 rounded-lg p-4 ${
            messageType === 'success'
              ? 'border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200'
              : 'border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'
          }`}>
            {messageType === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-300" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-300" />
            )}
            <span className="text-sm font-medium">{message}</span>
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        {step === 'email' ? (
          <p>Don't have an account? Enter your email and we'll create one instantly.</p>
        ) : (
          <div className="space-y-2">
            <p className={`font-semibold ${isCountdownLow ? 'text-red-600 dark:text-red-400 animate-pulse' : ''}`}>
              {isCountdownLow ? '⏰ Hurry! ' : ''}
              Didn't receive the code?
            </p>
            <p>Check spam or click 'Resend' to get a new code.</p>
            {isCountdownActive && (
              <p className="text-xs mt-2">
                Code expires in {formatTime(countdown)} • Check your email now!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginForm;

