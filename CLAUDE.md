# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Al's Experiments** is a Next.js 16 application serving as a multi-app gallery showcasing AI-powered experiments and tools. Each app is self-contained in its own directory under `/src/app/[app-slug]/`.

## Development Commands

```bash
# Development server with hot reload
pnpm dev

# Production build
pnpm build

# Production server (after build)
pnpm start

# Lint code
pnpm lint

# Install dependencies
pnpm install
```

**Note**: This project uses **pnpm** as the package manager, not npm or yarn.

## Tech Stack

- **Framework**: Next.js 16 with App Router (Turbopack enabled)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with CSS variables
- **UI Components**: Custom components using Radix UI primitives (shadcn/ui pattern)
- **Database**: PostgreSQL with Drizzle ORM (Neon hosting)
- **AI**: Google Gemini AI (@ai-sdk/google)
- **File Storage**: Vercel Blob
- **Deployment**: Vercel with standalone output

## Architecture

### App Structure Pattern

Each application follows this structure:
```
src/app/[app-slug]/
├── components/       # App-specific components
├── context/         # React context providers
├── hooks/           # Custom React hooks
├── types/           # TypeScript definitions
├── data/            # Static data or examples
├── layout.tsx       # App-specific layout
└── page.tsx         # Main page component
```

App configuration and metadata are centralized in `/src/config/apps.ts`.

### Key Directories

- `/src/app/api/` - API routes (endpoints for each app)
- `/src/app/[app-slug]/` - Individual applications
- `/src/components/ui/` - Shared UI components (34 shadcn/ui components)
- `/src/lib/utils.ts` - Utility functions (cn helper for className merging)
- `/src/config/apps.ts` - App registry with icons, slugs, and descriptions

### URL Structure

- Main gallery: `/`
- Individual apps: `/[app-slug]` (e.g., `/papermap`, `/chat`)
- API routes: `/api/[route]`

## State Management Patterns

- **React Context** for app-wide state (see `/papermap/context/`)
- **Custom hooks** for complex state logic (e.g., `useMindMap`, `useChatMessages`)
- **Local storage** for session persistence where appropriate
- Proper cleanup on page unload to prevent memory leaks

## Component Architecture

- Use existing UI components from `/src/components/ui/` before creating new ones
- Follow Radix UI patterns for accessibility
- Use `cn()` utility from `@/lib/utils` for className merging
- Consistent styling with Tailwind CSS and CSS variables
- Lucide React icons throughout

## AI Integration

Google Gemini AI is integrated via:
- `@ai-sdk/google` package
- Streaming responses for better UX
- Context-aware conversation handling
- File upload support (images, documents)

## File Handling

- Multi-format support: PDF, images, documents
- Size validation: typically 25MB limit
- Base64 and URL-based file processing
- Vercel Blob storage for uploads
- PDF.js for PDF rendering

## Configuration Notes

### TypeScript
- Path alias: `@/*` → `./src/*`
- Strict mode enabled
- No `any` types allowed

### Next.js
- Standalone output for deployment
- External packages: `@google/generative-ai`, `googleapis`
- Turbopack is default in Next.js 16

### Vercel
- 60s max duration for API functions
- 1024MB memory allocation
- Analytics and Speed Insights enabled

### Tailwind
- Dark mode with class strategy
- Custom color scheme via CSS variables
- Space Grotesk font integration
- Custom animations in `tailwind.config.ts`

## Applications Overview

1. **PaperMap** (`/papermap`) - AI-powered mindmap generation from PDFs and text
2. **Inztagram** (`/inztagram`) - Diagram creation tool
3. **Outliner** (`/outliner`) - Research paper drafting
4. **FlowNote** (`/flownote`) - Node-based document authoring
5. **Disposable Chat** (`/chat`) - AI chat with no data storage
6. **Nusantara Timeline** (`/indonesia-history`) - Interactive history timeline
7. **Finance Tracker** (`/finance-tracker`) - Expense management with Excel export
8. **Discourse Extractor** (`/dnanalyzer`) - Automatic discourse extraction

## Development Workflow

1. Apps are registered in `/src/config/apps.ts` to appear in the gallery
2. Each app has its own layout and page components
3. API routes follow Next.js App Router patterns in `/src/app/api/`
4. Use existing UI components and patterns before creating new ones
5. Maintain consistent styling with Tailwind CSS

## Performance Considerations

- Session cleanup on page unload (especially for PaperMap)
- Lazy loading for heavy components
- Optimized PDF processing
- Code splitting via Next.js App Router
