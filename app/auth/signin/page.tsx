'use client'

import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { ArrowLeft, Users, Video, MessageCircle, Sparkles, Play, Star, Mail, Eye, EyeOff } from 'lucide-react'

function SignInContent() {
  const searchParams = useSearchParams()
  const urlUserType = searchParams.get('userType') as 'fan' | 'creator' | null
  const callbackUrl = searchParams.get('callbackUrl') || (urlUserType === 'fan' ? '/creator' : '/onboarding')
  const [userType, setUserType] = useState<'fan' | 'creator' | null>(urlUserType)
  const [emailForm, setEmailForm] = useState<'signin' | 'signup'>('signin')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  })
  const [error, setError] = useState('')

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        action: emailForm,
        callbackUrl: `${callbackUrl}?userType=${userType}`,
        redirect: false
      })

      if (result?.error) {
        setError(result.error)
      } else if (result?.url) {
        window.location.href = result.url
      }
    } catch (error) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialAuth = async (provider: string) => {
    try {
      const response = await fetch('/api/auth/validate-user-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType })
      })
      
      if (response.ok) {
        signIn(provider, { 
          callbackUrl: `${callbackUrl}?userType=${userType}`
        })
      } else {
        const error = await response.json()
        alert(error.message || 'Sign-in validation failed')
      }
    } catch (error) {
      console.error('Sign-in validation error:', error)
      signIn(provider, { 
        callbackUrl: `${callbackUrl}?userType=${userType}`
      })
    }
  }

  if (!userType) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 lg:grid lg:grid-cols-2">
        {/* Left side - Hero content */}
        <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-sm lg:w-96">
            {/* Logo */}
            <div>
              <Link href="/" className="flex items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-600">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="ml-2 text-2xl font-bold text-gray-900 dark:text-white">Aitrion</span>
              </Link>
            </div>

            <div className="mt-8">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                Welcome to Aitrion
              </h2>
              <p className="mt-3 text-sm text-gray-600 dark:text-neutral-400">
                The platform where creators and fans connect through AI
              </p>
            </div>

            <div className="mt-10">
              <div className="space-y-4">
                {/* Fan Option */}
                <button
                  onClick={() => setUserType('fan')}
                  className="group relative flex w-full items-center justify-start space-x-4 rounded-xl border-2 border-transparent bg-gray-50 dark:bg-neutral-900 p-6 text-left transition-all hover:border-blue-200 hover:bg-blue-50 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                    <MessageCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      I'm a Fan
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-neutral-400">
                      Chat with AI versions of your favorite creators
                    </p>
                  </div>
                  <div className="opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                  </div>
                </button>

                {/* Creator Option */}
                <button
                  onClick={() => setUserType('creator')}
                  className="group relative flex w-full items-center justify-start space-x-4 rounded-xl border-2 border-transparent bg-gray-50 dark:bg-neutral-900 p-6 text-left transition-all hover:border-purple-200 hover:bg-purple-50 dark:hover:border-purple-800 dark:hover:bg-purple-950/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50">
                    <Video className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                      I'm a Creator
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-neutral-400">
                      Create an AI version of yourself for fans
                    </p>
                  </div>
                  <div className="opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="h-2 w-2 rounded-full bg-purple-600"></div>
                  </div>
                </button>
              </div>

              <div className="mt-8">
                <p className="text-center text-xs text-gray-500 dark:text-neutral-500">
                  Join thousands of creators and millions of fans already on Aitrion
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Visual */}
        <div className="hidden lg:block relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-700 to-indigo-800"></div>
          <div className="relative h-full flex flex-col justify-center items-center p-12 text-white">
            <div className="max-w-md text-center">
              <div className="mb-8 flex justify-center">
                <div className="relative">
                  <div className="h-24 w-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Sparkles className="h-12 w-12 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-yellow-400 flex items-center justify-center">
                    <Star className="h-4 w-4 text-yellow-800" />
                  </div>
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-4">
                Transform Your Content Into Conversations
              </h3>
              <p className="text-white/80 mb-8">
                Whether you're a fan looking to connect or a creator ready to engage, 
                Aitrion brings authentic AI-powered interactions to life.
              </p>
              <div className="space-y-4">
                <div className="flex items-center text-sm">
                  <div className="h-2 w-2 rounded-full bg-white/60 mr-3"></div>
                  <span>24/7 AI conversations with your favorite creators</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className="h-2 w-2 rounded-full bg-white/60 mr-3"></div>
                  <span>Turn your content into passive income</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className="h-2 w-2 rounded-full bg-white/60 mr-3"></div>
                  <span>Connect authentically with your audience</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 lg:grid lg:grid-cols-2">
      {/* Left side - Form */}
      <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          {/* Back button */}
          <button
            onClick={() => setUserType(null)}
            className="mb-8 inline-flex items-center text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </button>

          {/* Logo */}
          <div>
            <Link href="/" className="flex items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-600">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="ml-2 text-2xl font-bold text-gray-900 dark:text-white">Aitrion</span>
            </Link>
          </div>

          <div className="mt-8">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {userType === 'fan' ? 'Join as a Fan' : 'Start Creating'}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-neutral-400">
              {userType === 'fan' 
                ? 'Connect with your favorite creators through AI conversations' 
                : 'Create your AI replica and monetize your expertise'
              }
            </p>
          </div>

          <div className="mt-8">
            <div className="space-y-4">
              {/* Social Login Buttons */}
              <Button
                onClick={() => handleSocialAuth('google')}
                className="w-full h-12 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-neutral-700 font-medium"
              >
                <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC04"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              <Button
                onClick={() => handleSocialAuth('facebook')}
                className="w-full h-12 bg-[#1877F2] hover:bg-[#166FE5] text-white font-medium"
              >
                <svg className="mr-3 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M20 10C20 4.477 15.523 0 10 0S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z"
                    clipRule="evenodd"
                  />
                </svg>
                Continue with Facebook
              </Button>

              <Button
                onClick={() => handleSocialAuth('apple')}
                className="w-full h-12 bg-black hover:bg-gray-800 text-white font-medium"
              >
                <svg className="mr-3 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                  />
                </svg>
                Continue with Apple
              </Button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-neutral-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white dark:bg-neutral-950 px-2 text-gray-500 dark:text-neutral-500">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {emailForm === 'signup' && (
                <div>
                  <Label htmlFor="name" className="text-gray-900 dark:text-white">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 h-12"
                    required
                    placeholder="Enter your full name"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="email" className="text-gray-900 dark:text-white">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 h-12"
                  required
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-gray-900 dark:text-white">
                  Password
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-12 pr-12"
                    required
                    placeholder="Enter your password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className={`w-full h-12 ${
                  userType === 'fan'
                    ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                    : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                } text-white font-medium disabled:opacity-50`}
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {emailForm === 'signup' ? 'Creating Account...' : 'Signing In...'}
                  </div>
                ) : (
                  emailForm === 'signup' ? 'Create Account' : 'Sign In'
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setEmailForm(emailForm === 'signin' ? 'signup' : 'signin')
                    setFormData({ name: '', email: '', password: '' })
                    setError('')
                  }}
                  className="text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {emailForm === 'signin' 
                    ? "Don't have an account? Sign up" 
                    : "Already have an account? Sign in"}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-neutral-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-neutral-950 px-2 text-gray-500 dark:text-neutral-500">
                    {userType === 'fan' ? 'Join thousands of fans' : 'Join hundreds of creators'}
                  </span>
                </div>
              </div>
            </div>

            {/* Role switch */}
            <div className="text-center mt-6">
              <button
                onClick={() => setUserType(userType === 'fan' ? 'creator' : 'fan')}
                className="text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
              >
                {userType === 'fan' ? 'Not a fan? Join as a creator' : 'Not a creator? Join as a fan'}
              </button>
            </div>

            <div className="mt-8">
              <p className="text-xs text-gray-600 dark:text-neutral-400 text-center">
                {userType === 'fan'
                  ? 'By continuing, you agree to our Terms of Service and Privacy Policy. Start chatting with AI creators instantly.'
                  : 'By continuing, you agree to our Terms of Service and Privacy Policy. Connect your YouTube and start earning.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Visual for signed in state */}
      <div className="hidden lg:block relative">
        <div className={`absolute inset-0 ${
          userType === 'fan'
            ? 'bg-gradient-to-br from-blue-600 via-cyan-700 to-teal-800'
            : 'bg-gradient-to-br from-purple-600 via-pink-700 to-rose-800'
        }`}></div>
        <div className="relative h-full flex flex-col justify-center items-center p-12 text-white">
          <div className="max-w-md text-center">
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <div className="h-24 w-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  {userType === 'fan' ? (
                    <MessageCircle className="h-12 w-12 text-white" />
                  ) : (
                    <Video className="h-12 w-12 text-white" />
                  )}
                </div>
                <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-yellow-400 flex items-center justify-center">
                  <Play className="h-4 w-4 text-yellow-800" />
                </div>
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-4">
              {userType === 'fan' 
                ? 'Chat With Your Heroes' 
                : 'Monetize Your Expertise'
              }
            </h3>
            <p className="text-white/80 mb-8">
              {userType === 'fan'
                ? 'Get instant access to AI versions of your favorite creators. Ask questions, get advice, and have meaningful conversations anytime.'
                : 'Turn your knowledge into passive income. Your AI works 24/7, engaging fans while you focus on creating amazing content.'
              }
            </p>
            <div className="space-y-4">
              {userType === 'fan' ? (
                <>
                  <div className="flex items-center text-sm">
                    <div className="h-2 w-2 rounded-full bg-white/60 mr-3"></div>
                    <span>Instant AI conversations with creators</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <div className="h-2 w-2 rounded-full bg-white/60 mr-3"></div>
                    <span>Get personalized advice and insights</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <div className="h-2 w-2 rounded-full bg-white/60 mr-3"></div>
                    <span>Support creators you love</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center text-sm">
                    <div className="h-2 w-2 rounded-full bg-white/60 mr-3"></div>
                    <span>AI trained on your YouTube content</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <div className="h-2 w-2 rounded-full bg-white/60 mr-3"></div>
                    <span>Earn while you sleep</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <div className="h-2 w-2 rounded-full bg-white/60 mr-3"></div>
                    <span>5-minute setup process</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <SignInContent />
    </Suspense>
  )
}