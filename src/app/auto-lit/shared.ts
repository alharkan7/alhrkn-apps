export type Paper = {
  id: string
  dbId?: string
  title: string
  authors: string[]
  year: number
  citations: number
  source: string
  abstract: string
  overallScore?: number
  rubrics?: Record<string, number>
  url?: string
}


