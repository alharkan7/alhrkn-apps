import { Suspense } from 'react'
import BeeblioClient from '../components/BeeblioClient'

export default async function BeeblioResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  return (
    <Suspense fallback={<div>Loading results...</div>}>
      <BeeblioClient pageId={resolvedParams.id} />
    </Suspense>
  )
}
