import { Flower, Clock, PenTool, Sparkles, Languages, LucideIcon, Infinity, Wallet, Waypoints, Feather, SquareKanban, Network, Snowflake, LibraryBig, BookOpen, LineChart, GraduationCap, Presentation } from 'lucide-react'

export interface AppConfig {
  name: string
  icon: LucideIcon
  slug: string
  description: string
  type: string
}

export const apps: AppConfig[] = [
  {
    name: 'Papermap',
    icon: Waypoints,
    slug: 'papermap',
    description: 'Learn Anything with Interactive Mindmap',
    type: 'academic'
  },
  {
    name: 'Beeblio',
    icon: BookOpen,
    slug: 'beeblio',
    description: 'Automated Scientific Literature Search',
    type: 'academic'
  },
  {
    name: 'Inztagram',
    icon: SquareKanban,
    slug: 'inztagram',
    description: 'Create Any Diagram in Seconds',
    type: 'academic'
  },
  {
    name: 'Outliner',
    icon: Feather,
    slug: 'outliner',
    description: 'Quickly Draft Research Paper',
    type: 'academic'
  },
  {
    name: 'Primer',
    icon: GraduationCap,
    slug: 'primer',
    description: 'Learn Anything via Interactive Lessons',
    type: 'academic'
  },
  {
    name: 'Posterly',
    icon: Presentation,
    slug: 'posterly',
    description: 'Turn Scientific Papers into Conference Posters',
    type: 'academic'
  },
  {
    name: 'Motion Chart',
    icon: LineChart,
    slug: 'animachart',
    description: 'Turn Boring Chart into Animated One',
    type: 'academic'
  },
  {
    name: 'FlowNote',
    icon: PenTool,
    slug: 'flownote',
    description: 'A Node-based Document Authoring System',
    type: 'academic'
  },
  {
    name: 'Disposable Chat',
    icon: Sparkles,
    slug: 'chat',
    description: 'Simple Chat App with AI',
    type: 'academic'
  },
  {
    name: 'Discourse Extractor',
    icon: Network,
    slug: 'dnanalyzer',
    description: 'Automatic Discourse Extractor for DNAnalyzer',
    type: 'academic'
  },
  {
    name: 'Wiki Reels',
    icon: LibraryBig,
    slug: 'https://goodreels.vercel.app',
    description: 'Wikipedia Pages with TikTok UX + Games',
    type: 'general'
  },
  {
    name: 'Enaiblr Apps',
    icon: Infinity,
    slug: 'https://enaiblr.org',
    description: 'Free Mini AI Apps',
    type: 'general'
  }
]
