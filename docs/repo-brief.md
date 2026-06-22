# Repository Brief: Al's Experiments

## Project Overview
**Al's Experiments** is a collection of personal software experiments and AI-powered applications built with Next.js 15. The repository serves as a playground for exploring various web technologies and AI integrations, with a focus on creating interactive and intelligent applications.

## Project Structure

### Technology Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + CSS Variables
- **UI Components**: Custom components with Radix UI primitives
- **Package Manager**: PNPM
- **Deployment**: Vercel
- **Database**: PostgreSQL with Drizzle ORM

### Key Dependencies
- **AI Integration**: Google Gemini AI, Vercel AI SDK
- **Rich Text Editing**: Lexical Editor, EditorJS
- **Data Visualization**: ReactFlow, D3.js, Dagre, Mermaid
- **PDF Processing**: PDF.js, jsPDF, Puppeteer
- **UI/UX**: Framer Motion, Radix UI, Lucide Icons
- **File Handling**: React PDF, HTML to Image conversion

## Applications & Features

### 1. PaperMap (Main Application)
**Location**: `/papermap`
- **Purpose**: AI-powered mindmap generation from PDF documents and text
- **Key Features**:
  - Upload PDF files and generate interactive mindmaps
  - Text-based mindmap creation
  - Pre-populated example mindmap for immediate interaction
  - Node expansion/collapse and follow-up questions
  - PDF viewer integration with page navigation
  - Export capabilities (PDF, images)
  - Mobile-responsive design

### 2. AI Chat Application
**Location**: `/chat`
- **Features**:
  - Real-time chat interface with AI
  - File upload support (images and documents)
  - Markdown rendering
  - Streaming responses
  - Mobile-responsive design

### 3. Additional Experiments
- **Editor**: Rich text editing capabilities (`/editor`)
- **Finance Tracker**: Personal finance management (`/finance-tracker`)
- **Inztagram**: Social media experiment (`/inztagram`)

## API Structure
**Location**: `/src/app/api/`
- Multiple API endpoints for different applications
- Google AI integration for text generation
- File handling and processing endpoints
- Session management and cleanup

## Architecture Highlights

### State Management
- Custom React hooks for complex state (e.g., `useMindMap`)
- Local storage for session persistence
- Proper cleanup on page unload

### File Handling
- Support for multiple file types (PDF, images)
- File size validation (25MB limit)
- Blob storage integration with Vercel
- Base64 and URL-based file handling

### UI/UX Design
- Dark/Light theme support with `next-themes`
- Responsive design with Tailwind CSS
- Accessible components using Radix UI
- Smooth animations with Framer Motion
- Custom component library in `/src/components/ui/`

### Performance Optimizations
- Next.js 15 App Router for optimal routing
- Code splitting and lazy loading
- Efficient PDF processing
- Session cleanup to prevent memory leaks

## Development Setup
- TypeScript configuration for strict type checking
- ESLint for code quality
- PostCSS with Tailwind CSS
- Component configuration for shadcn/ui
- Git hooks and proper `.gitignore`

## Deployment
- Configured for Vercel deployment
- Custom `vercel.json` configuration
- OpenGraph image generation
- Proper error handling with custom 404 pages

## Notable Implementation Details

### PaperMap Implementation
- Prepopulated example mindmap for better user onboarding
- Support for both PDF uploads and text input
- Interactive mindmap nodes with expandable content
- Integration with PDF viewer for cross-referencing
- Session management for multi-user scenarios

### AI Integration
- Google Gemini AI for intelligent content generation
- Streaming responses for better user experience
- Context-aware conversation handling
- File content analysis capabilities

This repository demonstrates a comprehensive approach to building modern web applications with AI integration, focusing on user experience, performance, and maintainability.