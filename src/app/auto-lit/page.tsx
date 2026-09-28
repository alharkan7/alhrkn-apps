import { Suspense } from 'react'
import AutoLitClient from './components/AutoLitClient'

export default function AutoLitLandingPage() {
  return (
    <Suspense fallback={<div>Loading engine...</div>}>
      <AutoLitClient />
    </Suspense>
  )
}
