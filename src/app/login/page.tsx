'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google'
import { useState, Suspense } from 'react'

const errorMessages: Record<string, string> = {
  'auth/invalid-credential': 'Invalid email or password. Please try again.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/operation-not-allowed': 'Email/password login is not enabled.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
  'auth/internal-error': 'An internal error occurred. Please try again.',
  'auth/invalid-api-key': 'Server configuration error. Please contact support.',
  'auth/unauthenticated-domain': 'This domain is not authorized for login.',
}

const getErrorMessage = (error: any) => {
  if (error?.code && errorMessages[error.code]) {
    return errorMessages[error.code]
  }
  if (error?.message) {
    const message = error.message.toLowerCase()
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection.'
    }
    if (message.includes('timeout')) {
      return 'Request timed out. Please try again.'
    }
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<{ message: string; type: 'error' | 'success' } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  
  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      )

      if (credentialResponse.credential) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: credentialResponse.credential,
        })
        
        if (error) throw error
        
        // Successful login, redirect back to where they came from
        const nextUrl = searchParams.get('next') || '/'
        router.push(nextUrl)
        router.refresh()
      }
    } catch (err: any) {
      setError({ message: err.message || 'Failed to authenticate', type: 'error' })
    }
  }

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
      setError({ message: 'Please fill in all fields.', type: 'error' })
      return
    }

    setIsLoading(true)

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      )

      let { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      
      if (signInError && signInError.message.includes('Invalid login credentials')) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        })
        
        if (signUpError) {
          if (signUpError.message.includes('already registered') || signUpError.message.includes('User already registered')) {
            throw new Error('Invalid password. Please try again.')
          } else {
            throw signUpError
          }
        }
        
        if (signUpData.user?.identities != null && signUpData.user.identities.length === 0) {
          throw new Error('Email already registered. If you used Google to sign in before, please use the "Continue with Google" option, or check your password.')
        }

        if (signUpData.user && !signUpData.session) {
          throw { message: 'Account created! Please check your email to verify and continue logging in.', type: 'success' }
        }
        
      } else if (signInError) {
        throw signInError
      }

      // Successful login - redirect will happen
      const nextUrl = searchParams.get('next') || '/'
      router.push(nextUrl)
      router.refresh()
    } catch (err: any) {
      if (err.type === 'success') {
        setError(err)
      } else {
        console.error("Login error:", err)
        setError({ message: getErrorMessage(err), type: 'error' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[440px] bg-white p-10 sm:p-12 rounded-[1.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.02)] transition-shadow duration-300 hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.02)]">
          <div>
            <h2 className="mt-2 text-center text-[2.25rem] font-[800] tracking-[-0.03em] text-gray-900 font-serif">
              Welcome back
            </h2>
            <p className="mt-2 text-center text-base font-medium text-gray-500 mb-10">
              Sign In to Access the Apps
            </p>
          </div>
          
          <div className="flex flex-col items-center justify-center w-full">
            <div className="w-full flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => {
                  setError({ message: 'Google Login Failed (Check if browser is blocking popups)', type: 'error' })
                }}
                theme="outline"
                size="large"
                text="signin_with"
                shape="rectangular"
              />
            </div>
          </div>

          <div className="mt-8 mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-sm">
                <button
                  type="button"
                  onClick={() => setShowEmailForm(!showEmailForm)}
                  className="bg-white px-3 text-gray-400 font-medium text-[0.875rem] hover:text-gray-700 transition-colors focus:outline-none flex items-center gap-1.5"
                >
                  <span>{showEmailForm ? 'Hide Email Login' : 'Google unavailable? Use Email'}</span>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className={`transition-transform duration-300 ${showEmailForm ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
              showEmailForm ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <form className="space-y-5 pt-1 pb-2" onSubmit={handleEmailLogin}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-[0.875rem] font-semibold text-gray-900 ml-1">
                      Email
                    </label>
                    <div className="mt-1.5">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required={showEmailForm}
                        disabled={isLoading || !showEmailForm}
                        placeholder="you@example.com"
                        className="block w-full appearance-none rounded-[0.875rem] border-[1.5px] border-gray-200 bg-gray-50 px-5 py-[0.875rem] text-gray-900 placeholder-gray-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-600/10 sm:text-base font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:border-teal-600/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-[0.875rem] font-semibold text-gray-900 ml-1">
                      Password
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required={showEmailForm}
                        disabled={isLoading || !showEmailForm}
                        placeholder="Enter your password"
                        className="block w-full appearance-none rounded-[0.875rem] border-[1.5px] border-gray-200 bg-gray-50 px-5 py-[0.875rem] pr-12 text-gray-900 placeholder-gray-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-600/10 sm:text-base font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:border-teal-600/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading || !showEmailForm}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 flex items-center justify-center transition-colors disabled:cursor-not-allowed"
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className={`p-3.5 rounded-xl text-[0.875rem] font-medium text-center border ${
                    error.type === 'success' 
                      ? 'bg-teal-50/50 border-teal-200 text-teal-700' 
                      : 'bg-red-50/50 border-red-200 text-red-500'
                  }`}>
                    {error.message}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || !showEmailForm}
                    className="group relative flex w-full justify-center items-center gap-2 rounded-[0.875rem] border border-transparent bg-gray-900 py-[1rem] px-4 text-[1.05rem] font-bold text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] active:translate-y-0 active:shadow-sm"
                  >
                    {isLoading ? (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <span className="flex items-center gap-2">
                        Sign in
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
