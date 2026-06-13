'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
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
        
        // Successful login, redirect to dashboard
        router.push('/')
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
              Sign in to Beeblio
            </h2>
            <p className="mt-3 text-center text-sm text-gray-600">
              AI-powered research assistant for academic writing and analysis.
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
