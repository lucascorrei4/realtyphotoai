import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Sun,
  Moon,
  Sparkles,
  Camera,
  Home,
  Palette,
  Wand2,
  Star,
  ChevronRight,
  Play,
  Shield,
  Zap,
  Users,
  Award
} from 'lucide-react';
import packageJson from '../../package.json';

const LandingPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [showAuth, setShowAuth] = useState(false);

  const { sendCode, signIn } = useAuth();
  const { theme, toggleTheme } = useTheme();
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

  const scrollToAuth = () => {
    setShowAuth(true);
    setTimeout(() => {
      document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img
                src={theme === 'dark' ? '/logo_white.png' : '/logo_black.png'}
                alt="RealVision AI"
                className="h-16 w-auto"
              />
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                onClick={scrollToAuth}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center px-3 py-2 sm:px-4 sm:py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs sm:text-sm font-medium mb-6 sm:mb-8">
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span className="hidden sm:inline">AI-Powered Real Estate Photography</span>
              <span className="sm:hidden">AI Real Estate Photography</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 leading-tight">
              Transform Your
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> Property Photos</span>
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>
              with AI Magic
            </h1>

            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 dark:text-gray-300 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-4 sm:px-0">
              Professional-grade real estate photography enhancement powered by cutting-edge AI.
              Turn ordinary property photos into stunning, market-ready visuals that sell faster.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-12 sm:mb-16 px-4 sm:px-0">
              <button
                onClick={scrollToAuth}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-base sm:text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-base sm:text-lg font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center space-x-2">
                <Play className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Watch Demo</span>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">10K+</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Photos Enhanced</div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">500+</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Happy Clients</div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">99.9%</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-white/50 dark:bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
              Powerful AI Features
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4 sm:px-0">
              Our advanced AI technology transforms your property photos with professional-grade enhancements
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 sm:mb-6">
                <Camera className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Image Enhancement</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 text-sm sm:text-base">
                Automatically enhance lighting, colors, and clarity to make your property photos look professional and inviting.
              </p>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm sm:text-base">
                <span>Learn more</span>
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 sm:mb-6">
                <Home className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Interior Design</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 text-sm sm:text-base">
                Transform empty rooms into beautifully furnished spaces with AI-generated furniture and decor.
              </p>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm sm:text-base">
                <span>Learn more</span>
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 sm:mb-6">
                <Wand2 className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Element Replacement</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 text-sm sm:text-base">
                Replace or remove unwanted elements from your photos while maintaining natural, realistic results.
              </p>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm sm:text-base">
                <span>Learn more</span>
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Before/After Showcase */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
              See the Magic in Action
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4 sm:px-0">
              Transform ordinary property photos into stunning, market-ready visuals
            </p>
          </div>

          <div className="space-y-16">
            {/* Interior Design Showcase */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Palette className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Interior Design</h3>
                </div>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">Transform empty rooms into beautifully furnished spaces with AI-generated furniture and decor</p>
              </div>

              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* Interior Design Example 1 */}
                  <div className="space-y-4">
                    <div className="relative group">
                      <img
                        src="/interior_design_before_1.jpg"
                        alt="Empty room before interior design"
                        className="w-full h-40 sm:h-48 object-cover rounded-lg shadow-md group-hover:shadow-lg transition-shadow"
                      />
                      <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                        Before
                      </div>
                    </div>
                    <div className="relative group">
                      <img
                        src="/interior_design_after_1.jpg"
                        alt="Beautifully furnished room after AI interior design"
                        className="w-full h-40 sm:h-48 object-cover rounded-lg shadow-md group-hover:shadow-lg transition-shadow"
                      />
                      <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                        After
                      </div>
                    </div>
                  </div>

                  {/* Interior Design Example 2 */}
                  <div className="space-y-4">
                    <div className="relative group">
                      <img
                        src="/interior_design_before_2.jpg"
                        alt="Empty room before interior design"
                        className="w-full h-40 sm:h-48 object-cover rounded-lg shadow-md group-hover:shadow-lg transition-shadow"
                      />
                      <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                        Before
                      </div>
                    </div>
                    <div className="relative group">
                      <img
                        src="/interior_design_after_2.jpg"
                        alt="Beautifully furnished room after AI interior design"
                        className="w-full h-40 sm:h-48 object-cover rounded-lg shadow-md group-hover:shadow-lg transition-shadow"
                      />
                      <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                        After
                      </div>
                    </div>
                  </div>

                  {/* Interior Design Example 3 */}
                  <div className="space-y-4">
                    <div className="relative group">
                      <img
                        src="/interior_design_before_3.jpg"
                        alt="Empty room before interior design"
                        className="w-full h-40 sm:h-48 object-cover rounded-lg shadow-md group-hover:shadow-lg transition-shadow"
                      />
                      <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                        Before
                      </div>
                    </div>
                    <div className="relative group">
                      <img
                        src="/interior_design_after_3.jpg"
                        alt="Beautifully furnished room after AI interior design"
                        className="w-full h-40 sm:h-48 object-cover rounded-lg shadow-md group-hover:shadow-lg transition-shadow"
                      />
                      <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                        After
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Element Replacement Showcase */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                    <Wand2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Element Replacement</h3>
                </div>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">Replace or remove unwanted elements from your photos while maintaining natural, realistic results</p>
              </div>

              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
                  {/* Before */}
                  <div className="space-y-4">
                    <div className="relative group">
                      <img
                        src="/element_replacement_before_1.jpg"
                        alt="Original image before element replacement"
                        className="w-full h-56 sm:h-64 object-cover rounded-lg shadow-md group-hover:shadow-lg transition-shadow"
                      />
                      <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                        Before
                      </div>
                    </div>
                    <p className="text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Original image with unwanted elements
                    </p>
                  </div>

                  {/* After */}
                  <div className="space-y-4">
                    <div className="relative group">
                      <img
                        src="/element_replacement_after_1.jpg"
                        alt="Enhanced image after element replacement"
                        className="w-full h-56 sm:h-64 object-cover rounded-lg shadow-md group-hover:shadow-lg transition-shadow"
                      />
                      <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                        After
                      </div>
                    </div>
                    <p className="text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      AI-enhanced image with elements replaced
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6">
              Why Choose RealVision AI?
            </h2>
            <p className="text-lg sm:text-xl text-blue-100 max-w-3xl mx-auto px-4 sm:px-0">
              Join thousands of real estate professionals who trust our AI to enhance their property photos
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Lightning Fast</h3>
              <p className="text-sm sm:text-base text-blue-100">Process photos in seconds, not hours</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Secure & Private</h3>
              <p className="text-sm sm:text-base text-blue-100">Your photos are protected with enterprise-grade security</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Award className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Professional Quality</h3>
              <p className="text-sm sm:text-base text-blue-100">Results that rival expensive professional photographers</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Trusted by Pros</h3>
              <p className="text-sm sm:text-base text-blue-100">Used by top real estate agencies worldwide</p>
            </div>
          </div>
        </div>
      </section>

      {/* Authentication Section */}
      <section id="auth-section" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <div className="mx-auto h-12 w-12 sm:h-16 sm:w-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <Mail className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {step === 'email' ? 'Get Started Today' : 'Enter Code'}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 px-4 sm:px-0">
              {step === 'email'
                ? 'Enter your email to receive a login code'
                : `We sent a 6-digit code to ${email}`
              }
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
            {step === 'email' ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      placeholder="Enter your email"
                      disabled={loading}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSendCode}
                  disabled={loading || !email}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
              <div className="space-y-4">
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Verification Code
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="code"
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-center text-lg font-mono tracking-widest bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      placeholder="000000"
                      maxLength={6}
                      disabled={loading}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Enter the 6-digit code sent to your email
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleBackToEmail}
                    disabled={loading}
                    className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerifyCode}
                    disabled={loading || code.length !== 6}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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

            {/* Message Display */}
            {message && (
              <div className={`p-4 rounded-lg flex items-center space-x-3 ${messageType === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                }`}>
                {messageType === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                <span className="text-sm font-medium">{message}</span>
              </div>
            )}
          </div>

          <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
            <p>
              {step === 'email' ? (
                "Don't have an account? No problem! Just enter your email and we'll create one for you."
              ) : (
                "Didn't receive the code? Check your spam folder or go back to resend."
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-slate-900 text-white py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center space-x-3 mb-4">
                <img src="/logo_white.png" alt="RealVision AI" className="h-6 sm:h-8 w-auto" />
                <span className="text-lg sm:text-xl font-bold">RealVision AI</span>
              </div>
              <p className="text-sm sm:text-base text-gray-400">
                Transform your property photos with cutting-edge AI technology.
              </p>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Product</h3>
              <ul className="space-y-2 text-sm sm:text-base text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Company</h3>
              <ul className="space-y-2 text-sm sm:text-base text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Support</h3>
              <ul className="space-y-2 text-sm sm:text-base text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-6 sm:mt-8 pt-6 sm:pt-8 text-center text-sm sm:text-base text-gray-400">
            <p>&copy; 2025 RealVision AI. All rights reserved.</p>
            <small className="text-xs text-gray-500 dark:text-gray-400 px-3 text-center block">RealVision AI {packageJson.version}</small>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
