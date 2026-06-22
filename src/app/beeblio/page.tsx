import { Suspense } from 'react'
import BeeblioClient from './components/BeeblioClient'

export default function BeeblioLandingPage() {
  return (
    <Suspense fallback={<div>Loading engine...</div>}>
      <BeeblioClient />
    </Suspense>
  )
}
