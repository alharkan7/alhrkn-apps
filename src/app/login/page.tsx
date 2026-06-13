'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google'
import { useState, Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  
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
      setError(err.message || 'Failed to authenticate')
    }
  }

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-gray-900">
              Sign in to Apps Gallery
            </h2>
            <p className="mt-3 text-center text-sm text-gray-600">
              Log in to access the experimental apps by @alhrkn.
            </p>
          </div>
          
          <div className="mt-8 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setError('Google Login Failed (Check if browser is blocking popups)')
              }}
              theme="outline"
              size="large"
              text="signin_with"
              shape="rectangular"
            />
          </div>
          
          {error && (
            <p className="text-center text-sm text-red-600 mt-4 bg-red-50 p-2 rounded">
              {error}
            </p>
          )}
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
