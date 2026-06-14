import { Flower, Clock, PenTool, Sparkles, Languages, LucideIcon, Infinity, Wallet, Waypoints, Feather, SquareKanban, Network, Snowflake, LibraryBig } from 'lucide-react'

export interface AppConfig {
  name: string
  icon: LucideIcon
  slug: string
  description: string
}

export const apps: AppConfig[] = [
  {
    name: 'Papermap',
    icon: Waypoints,
    slug: 'papermap',
    description: 'Learn Anything with Interactive Mindmap',
  },
  {
    name: 'Inztagram',
    icon: SquareKanban,
    slug: 'inztagram',
    description: 'Create Any Diagram in Seconds',
  },
  {
    name: 'Outliner',
    icon: Feather,
    slug: 'outliner',
    description: 'Quickly Draft Research Paper',
  },
  {
    name: 'FlowNote',
    icon: PenTool,
    slug: 'flownote',
    description: 'A Node-based Document Authoring System',
  },
  {
    name: 'Vast Timeline',
    icon: Clock,
    slug: 'vast-timeline',
    description: 'Visualize Vast Timeline in an Interactive Way',
  },
  {
    name: 'Good News Garden',
    icon: Flower,
    slug: 'goodnews-garden',
    description: 'Explore Good News as a Blooming Garden',
  },
  {
    name: 'Wiki Reels',
    icon: LibraryBig,
    slug: 'https://goodreels.vercel.app',
    description: 'Wikipedia Pages with TikTok UX + Games',
  },
  {
    name: 'Hoax Network',
    icon: Snowflake,
    slug: 'hoax-network',
    description: 'Explore Hoaxes Data in Interactive Viz',
  },
  {
    name: 'Disposable Chat',
    icon: Sparkles,
    slug: 'chat',
    description: 'Simple Chat App with AI',
  },
  {
    name: 'Discourse Extractor',
    icon: Network,
    slug: 'dnanalyzer',
    description: 'Automatic Discourse Extractor for DNAnalyzer',
  },
  {
    name: 'More Apps',
    icon: Infinity,
    slug: 'https://enaiblr.org',
    description: 'Access Enaiblr Apps',
  },
]
