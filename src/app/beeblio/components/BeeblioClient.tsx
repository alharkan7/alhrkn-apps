'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Search, Settings, Sparkles, Database, LoaderCircle, ExternalLink, ChevronDown, Bot, ArrowLeft, ArrowRight, Lightbulb, GraduationCap, Quote, Filter, Paperclip, ArrowUpDown, Download, X, Menu } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AppsHeader } from '@/components/apps-header'
import AppsFooter from '@/components/apps-footer'

import { Paper } from '../shared'
import { BeeblioHistorySidebar } from './BeeblioHistorySidebar'

const cleanText = (text: string) => {
  if (!text) return '';
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/\s\s+/g, ' ')
    .trim();
};

interface BeeblioClientProps {
  pageId?: string
}

export default function BeeblioClient({ pageId }: BeeblioClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams?.get('q') || ''

  const [activeTab, setActiveTab] = useState<'keywords' | 'context'>('keywords')
  const [sortBy, setSortBy] = useState<'score' | 'year' | 'citations'>('score')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [query, setQuery] = useState(initialQuery)
  const [isSearching, setIsSearching] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [attachment, setAttachment] = useState<{ id: string; url: string; name: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('beeblio_attachment');
      if (stored) return JSON.parse(stored);
    }
    return null;
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchRequestedRef = useRef<string | null>(null)
  const [results, setResults] = useState<Paper[]>([])
  const [mounted, setMounted] = useState(false)
  
  // Settings State
  const [aiOptimize, setAiOptimize] = useState(false)
  const [aiReview, setAiReview] = useState(true)
  const [databases, setDatabases] = useState({
    openalex: true,
    crossref: true,
    semanticScholar: false
  })

  // Expandable cards state
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  // Pagination State
  const [searchId, setSearchId] = useState<string | null>(null)
  const [structuredQueries, setStructuredQueries] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [pagesCache, setPagesCache] = useState<Record<number, Paper[]>>({})
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Sync evaluations/results to pages cache automatically
  useEffect(() => {
    if (results.length > 0) {
      setPagesCache(prev => ({ ...prev, [page]: results }))
    }
  }, [results, page])

  useEffect(() => {
    setMounted(true)
    
    const tabParam = searchParams?.get('tab') as 'keywords' | 'context' | null;
    const optimizeParam = searchParams?.get('optimize');
    const reviewParam = searchParams?.get('review');
    
    if (tabParam) setActiveTab(tabParam);
    if (optimizeParam) setAiOptimize(optimizeParam === 'true');
    if (reviewParam) setAiReview(reviewParam === 'true');

    const isUuid = pageId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageId) : false;

    if (pageId && (isUuid || searchParams?.has('q'))) {
      const reqKey = `${pageId}-${initialQuery}`;
      if (searchRequestedRef.current === reqKey) return;
      searchRequestedRef.current = reqKey;

      const runSearch = async () => {
        setIsSearching(true)
        setSearchError(null)
        try {
          let data;

          if (isUuid) {
            const res = await fetch(`/api/beeblio/search/${pageId}`);
            data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load search history');
          } else {
            const res = await fetch('/api/beeblio/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: initialQuery,
                aiOptimize: tabParam === 'context' ? true : (optimizeParam === 'true'),
                contextMode: tabParam === 'context',
                databases: databases,
                attachmentUrl: attachment?.url
              })
            });
            data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to search');
          }
          
          if (!data.papers) throw new Error('No papers returned');
          
          setStructuredQueries(data.structuredQueries);
          setSearchId(data.searchId);
          setPage(1);
          setPagesCache({}); // Clear cache for new query
          setResults(data.papers);

          // Update the search bar text if loading from history
          if (isUuid && data.originalQuery) {
            setQuery(data.originalQuery);
            setActiveTab('keywords');
          } else if (isUuid && data.contextText) {
            setQuery(data.contextText);
            setActiveTab('context');
          }

          if (data.searchId && !isUuid) {
            const newUrl = `/beeblio/${data.searchId}?q=${encodeURIComponent(initialQuery)}&tab=${tabParam || 'keywords'}&optimize=${optimizeParam || 'false'}&review=${reviewParam || 'true'}`;
            window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
          }
          setIsSearching(false);
          
          if (data.isHistory) return; // Skip evaluation if loading from DB
          
          const shouldReview = reviewParam === 'true';
          if (shouldReview && data.papers.length > 0) {
            setIsEvaluating(true);
            let currentPapersToEval = data.papers.map((p: Paper) => ({
              id: p.id,
              dbId: p.dbId,
              title: p.title,
              abstract: p.abstract
            }));
            
            // Parallel Chunking (Batches of 5)
            const CHUNK_SIZE = 5;
            const chunks = [];
            for (let i = 0; i < currentPapersToEval.length; i += CHUNK_SIZE) {
              chunks.push(currentPapersToEval.slice(i, i + CHUNK_SIZE));
            }

            const evalPromises = chunks.map(async (chunk) => {
              try {
                const evalRes = await fetch('/api/beeblio/evaluate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    papers: chunk,
                    originalQuery: initialQuery || "Attached File Analysis"
                  })
                });
                const evalData = await evalRes.json();
                
                if (evalData.evaluations && evalData.evaluations.length > 0) {
                  setResults(currentResults => {
                    const resultsCopy = [...currentResults];
                    evalData.evaluations.forEach((evaluation: any) => {
                      const paperIndex = resultsCopy.findIndex(p => p.id === evaluation.id);
                      if (paperIndex !== -1) {
                        resultsCopy[paperIndex] = {
                          ...resultsCopy[paperIndex],
                          overallScore: evaluation.overallScore,
                          rubrics: evaluation.rubrics
                        };
                      }
                    });
                    return resultsCopy;
                  });
                }
              } catch (e) {
                console.error("Chunk evaluation failed", e);
              }
            });

            await Promise.all(evalPromises);
            setIsEvaluating(false);
          }
        } catch (error: any) {
          console.error("Search pipeline failed:", error);
          setSearchError(error.message || "An unexpected error occurred");
          setIsSearching(false);
          setIsEvaluating(false);
        }
      }
      runSearch();
    } else if (!pageId) {
      setResults([])
    }
  }, [pageId, initialQuery, databases.openalex, databases.crossref, databases.semanticScholar])

  const goToNextPage = async () => {
    const nextPage = page + 1;
    if (pagesCache[nextPage] && pagesCache[nextPage].length > 0) {
      setPage(nextPage);
      setResults(pagesCache[nextPage]);
      return;
    }

    setIsLoadingMore(true);
    setPage(nextPage);
    try {
      const res = await fetch('/api/beeblio/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: initialQuery,
          aiOptimize: false, // Already optimized, use cached queries
          contextMode: false,
          databases: databases,
          page: nextPage,
          structuredQueries: structuredQueries,
          searchId: searchId,
          attachmentUrl: attachment?.url
        })
      });
      const data = await res.json();
      if (!data.papers) throw new Error('No papers returned');

      // Replace results for the next page
      setResults(data.papers);
      
      const shouldReview = searchParams?.get('review') === 'true';
      if (shouldReview && data.papers.length > 0) {
        setIsEvaluating(true);
        let newPapersToEval = data.papers.map((p: Paper) => ({
          id: p.id, dbId: p.dbId, title: p.title, abstract: p.abstract
        }));
        
        const CHUNK_SIZE = 5;
        const chunks = [];
        for (let i = 0; i < newPapersToEval.length; i += CHUNK_SIZE) {
          chunks.push(newPapersToEval.slice(i, i + CHUNK_SIZE));
        }

        const evalPromises = chunks.map(async (chunk) => {
          try {
            const evalRes = await fetch('/api/beeblio/evaluate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ papers: chunk, originalQuery: initialQuery })
            });
            const evalData = await evalRes.json();
            
            if (evalData.evaluations && evalData.evaluations.length > 0) {
              setResults(currentResults => {
                const resultsCopy = [...currentResults];
                evalData.evaluations.forEach((evaluation: any) => {
                  const paperIndex = resultsCopy.findIndex(p => p.id === evaluation.id);
                  if (paperIndex !== -1) {
                    resultsCopy[paperIndex] = {
                      ...resultsCopy[paperIndex],
                      overallScore: evaluation.overallScore,
                      rubrics: evaluation.rubrics
                    };
                  }
                });
                return resultsCopy;
              });
            }
          } catch (e) { console.error("Chunk eval failed", e); }
        });
        await Promise.all(evalPromises);
        setIsEvaluating(false);
      }
    } catch (e) {
      console.error(e);
      setPage(page); // Revert page on failure
    }
    setIsLoadingMore(false);
  };

  const goToPrevPage = () => {
    if (page > 1) {
      const prevPage = page - 1;
      setPage(prevPage);
      if (pagesCache[prevPage]) {
        setResults(pagesCache[prevPage]);
      }
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/beeblio/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        setAttachment({
          id: data.file.id,
          url: data.file.fileUrl,
          name: data.file.fileName
        });
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("Upload failed", err);
    }
    setIsUploading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (activeTab === 'context') setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (activeTab === 'context') {
      const file = e.dataTransfer.files?.[0];
      if (file) await uploadFile(file);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleExportBibtex = () => {
    const currentResults = [...results].filter(r => filterSource === 'all' || r.source === filterSource).sort((a, b) => {
      if (sortBy === 'score') return (b.overallScore || 0) - (a.overallScore || 0)
      if (sortBy === 'year') return b.year - a.year
      if (sortBy === 'citations') return b.citations - a.citations
      return 0
    });

    const bibtex = currentResults.map(paper => {
      const firstAuthor = paper.authors[0] ? paper.authors[0].split(' ').pop() : 'Unknown';
      const key = `${firstAuthor}${paper.year}`.replace(/[^a-zA-Z0-9]/g, '');
      return `@article{${key},
  title={${paper.title}},
  author={${paper.authors.join(' and ')}},
  year={${paper.year}},
  journal={${paper.source}},
  abstract={${paper.abstract || ''}},
  url={${paper.url || ''}}
}`;
    }).join('\n\n');

    const blob = new Blob([bibtex], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'beeblio_export.bib';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSearch = async () => {
    if (!query.trim() && !attachment) return

    if (attachment) {
      sessionStorage.setItem('beeblio_attachment', JSON.stringify(attachment));
    } else {
      sessionStorage.removeItem('beeblio_attachment');
    }

    router.push(`/beeblio/new?q=${encodeURIComponent(query)}&tab=${activeTab}&optimize=${aiOptimize}&review=${aiReview}`)
  }

  if (!mounted) return null

  const renderSettingsContent = () => (
    <PopoverContent className="w-80 p-0 rounded-2xl border bg-card/95 backdrop-blur-xl shadow-2xl" align="end">
      <div className="p-5 space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
            AI Pipeline
          </h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between group">
              <div className="space-y-1">
                <label className={`text-sm font-medium transition-colors ${activeTab === 'context' ? 'text-muted-foreground' : 'group-hover:text-indigo-500'}`}>Query Optimizer</label>
                <p className="text-[11px] text-muted-foreground">
                  {activeTab === 'context' ? 'Required for Context Search' : 'Rewrite input to strict Boolean logic'}
                </p>
              </div>
              <Switch 
                checked={activeTab === 'context' ? true : aiOptimize} 
                disabled={activeTab === 'context'} 
                onCheckedChange={setAiOptimize} 
                className="data-[state=checked]:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" 
              />
            </div>
            <div className="flex items-center justify-between group">
              <div className="space-y-1">
                <label className="text-sm font-medium group-hover:text-amber-500 transition-colors">AI Reviewer</label>
                <p className="text-[11px] text-muted-foreground">Evaluate and rank fetched papers</p>
              </div>
              <Switch checked={aiReview} onCheckedChange={setAiReview} className="data-[state=checked]:bg-amber-500" />
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-border"></div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
            Databases
          </h4>
          <div className="space-y-3">
            {Object.entries(databases).map(([key, value]) => (
              <div className="flex items-center space-x-3" key={key}>
                <Checkbox 
                  id={`db-${key}`} 
                  checked={value} 
                  onCheckedChange={(c) => setDatabases(prev => ({...prev, [key]: !!c}))} 
                  className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                />
                <label htmlFor={`db-${key}`} className="text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer">
                  {key === 'semanticScholar' ? 'Semantic Scholar' : key === 'openalex' ? 'OpenAlex' : 'Crossref'}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PopoverContent>
  )

  const uniqueSources = Array.from(new Set(results.map(r => r.source))).filter(Boolean)

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative font-sans flex flex-col">
      
      {/* --- Ambient Background --- */}
      <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none overflow-hidden">
        {/* Animated Orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-900/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-900/20 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-cyan-500/10 dark:bg-cyan-900/10 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
        
        {/* Subtle Grid overlay - Matches the root page */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      </div>

      <BeeblioHistorySidebar />

      {/* --- Top Navigation --- */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b">
        <AppsHeader 
          leftButton={
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="sidebar-toggle hover:bg-black/5 dark:hover:bg-white/10" onClick={() => window.dispatchEvent(new Event('toggleBeeblioHistorySidebar'))}>
                <Menu size={20} />
              </Button>
              {pageId && (
                <Link href="/beeblio" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Link>
              )}
            </div>
          }
        />
      </div>

      <main className={`relative z-10 flex-1 container mx-auto max-w-5xl px-4 md:px-8 pt-20 pb-20 ${pageId ? 'space-y-6' : 'space-y-12'}`}>
        
        {/* --- Hero Section (Only show on main landing page) --- */}
        {!pageId && (
          <section className="text-center space-y-6 max-w-3xl mx-auto mt-4">
            <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
                Auto
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 animate-gradient-x">Scholar</span>
              </h1>
            </motion.div>
            <motion.p 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
               className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto font-light leading-relaxed"
            >
              Beeblio sifts through millions of papers to find exactly what matters to you.
            </motion.p>
          </section>
        )}

        {/* --- Search Interface --- */}
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: pageId ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={`mx-auto relative group ${pageId ? 'w-full' : 'max-w-4xl mt-4'}`}
        >
          {/* Glowing aura behind the search box */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 dark:from-indigo-500/30 dark:to-cyan-500/30 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-80 transition duration-1000 group-hover:duration-200"></div>
          
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />

          {pageId ? (
            /* --- COMPACT SEARCH BAR (Results Page) --- */
            <div 
              className={`relative rounded-full border bg-background/80 backdrop-blur-2xl shadow-md flex items-center p-1.5 pr-2 gap-1.5 overflow-hidden transition-all duration-200 ${isDragging && activeTab === 'context' ? 'ring-2 ring-primary border-primary' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && activeTab === 'context' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-primary font-medium border-2 border-dashed border-primary/50 rounded-full w-[calc(100%-8px)] h-[calc(100%-8px)] justify-center bg-primary/5 pointer-events-none">
                    <Download className="h-5 w-5 animate-bounce" />
                    <span>Drop file to attach</span>
                  </div>
                </div>
              )}
              
              {/* Keyword/Context Toggle (Icons Only) */}
              <div className="flex bg-muted/50 rounded-full border p-1 shrink-0">
                <button
                  onClick={() => setActiveTab('keywords')}
                  className={`relative p-2 rounded-full transition-all ${activeTab === 'keywords' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Keywords"
                >
                  {activeTab === 'keywords' && <motion.div layoutId="activeTabCompact" className="absolute inset-0 bg-background rounded-full border shadow-sm" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
                  <Search className="w-4.5 h-4.5 relative z-10" />
                </button>
                <button
                  onClick={() => setActiveTab('context')}
                  className={`relative p-2 rounded-full transition-all ${activeTab === 'context' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Context"
                >
                  {activeTab === 'context' && <motion.div layoutId="activeTabCompact" className="absolute inset-0 bg-background rounded-full border shadow-sm" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
                  <Lightbulb className="w-4.5 h-4.5 relative z-10" />
                </button>
              </div>

              {/* Attachment Button (Context mode only) */}
              <AnimatePresence>
                {activeTab === 'context' && (
                  <motion.div
                    initial={{ opacity: 0, width: 0, scale: 0.8 }}
                    animate={{ opacity: 1, width: 'auto', scale: 1 }}
                    exit={{ opacity: 0, width: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden flex items-center shrink-0 -mr-0.5"
                  >
                    <Button 
                      variant="ghost" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className={`rounded-full transition-colors ${attachment ? 'text-primary bg-primary/10 px-3' : 'hover:bg-muted h-9 w-9 p-0 text-muted-foreground hover:text-foreground'}`}
                    >
                      {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                      {attachment && <span className="ml-2 text-xs truncate max-w-[80px]">{attachment.name}</span>}
                    </Button>
                    {attachment && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => { e.stopPropagation(); setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} 
                        className="rounded-full h-8 w-8 ml-0.5 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Search Box */}
              <div className="flex-1 min-w-0 pl-1.5 flex flex-col justify-center">
                <Input
                  placeholder={activeTab === 'keywords' ? "Search for papers, authors, topics..." : "Paste your context or abstract..."}
                  className="bg-transparent border-none text-base md:text-lg shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-10 truncate placeholder:text-muted-foreground/50"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={activeTab === 'context' && !!attachment}
                />

              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-muted h-10 w-10 transition-colors">
                      <Settings className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  {renderSettingsContent()}
                </Popover>

                <Button 
                  onClick={handleSearch} 
                  disabled={isSearching || (!query.trim() && !attachment)} 
                  size="icon"
                  className="rounded-full h-11 w-11 shadow-md transition-all disabled:opacity-50 shrink-0"
                >
                  {isSearching ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                      <LoaderCircle className="h-5 w-5 text-amber-300" />
                    </motion.div>
                  ) : (
                    <ArrowRight className="h-5 w-5 rotate-135" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* --- LARGE SEARCH INTERFACE (Landing Page) --- */
            <div 
              className={`relative rounded-[2rem] border bg-background/80 backdrop-blur-2xl shadow-xl overflow-hidden transition-all duration-200 ${isDragging && activeTab === 'context' ? 'ring-2 ring-primary border-primary' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && activeTab === 'context' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm pointer-events-none">
                  <div className="flex flex-col items-center justify-center gap-3 text-primary font-medium border-2 border-dashed border-primary/50 rounded-[calc(2rem-4px)] m-1 absolute inset-0 bg-primary/5">
                    <div className="p-4 bg-primary/10 rounded-full animate-bounce">
                      <Download className="h-8 w-8" />
                    </div>
                    <span className="text-lg">Drop file here to attach</span>
                  </div>
                </div>
              )}
              
              {/* Top Bar inside Search: Tabs & Settings */}
              <div className="flex flex-row justify-between items-center px-4 pt-4 sm:px-6 sm:pt-6 gap-2">
                
                {/* Segmented Control for Tabs */}
                <div className="flex p-1 space-x-1 bg-muted/50 rounded-full border backdrop-blur-md w-full sm:w-auto">
                  <button
                    onClick={() => setActiveTab('keywords')}
                    className={`relative px-4 sm:px-6 py-2 flex-1 sm:flex-none text-xs sm:text-sm font-medium rounded-full transition-all duration-300 ${
                      activeTab === 'keywords' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {activeTab === 'keywords' && (
                      <motion.div layoutId="activeTab" className="absolute inset-0 bg-background rounded-full border shadow-sm" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2"><Search className="w-3.5 h-3.5 sm:w-4 sm:h-4"/> Keywords</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('context')}
                    className={`relative px-4 sm:px-6 py-2 flex-1 sm:flex-none text-xs sm:text-sm font-medium rounded-full transition-all duration-300 ${
                      activeTab === 'context' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {activeTab === 'context' && (
                      <motion.div layoutId="activeTab" className="absolute inset-0 bg-background rounded-full border shadow-sm" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2"><Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4"/> Context</span>
                  </button>
                </div>

                {/* Settings Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-muted gap-2 p-0 w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2 border border-transparent hover:border-border transition-all flex-shrink-0">
                      <Settings className="h-4 w-4" />
                      {/* <span className="hidden sm:inline">Settings</span> */}
                    </Button>
                  </PopoverTrigger>
                  {renderSettingsContent()}
                </Popover>
              </div>

              {/* Main Input Area */}
              <div className="p-4 sm:p-6 pb-2">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, filter: 'blur(4px)', y: 10 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                    exit={{ opacity: 0, filter: 'blur(4px)', y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'keywords' ? (
                      <Input 
                        placeholder="e.g. attention mechanism, transformers, neuroscience..." 
                        className="bg-transparent border-none text-xl placeholder:text-muted-foreground/50 text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 px-2 shadow-none py-8"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        autoFocus={!pageId}
                      />
                    ) : (
                      <div className="relative group">
                        {/* <Quote className="absolute left-2 top-2 h-6 w-6 text-muted-foreground/20" /> */}
                        <Textarea 
                          placeholder="Paste your abstract, research proposal, or brain dump here."
                          className="min-h-[140px] bg-transparent border-none text-lg md:text-xl placeholder:text-muted-foreground/50 text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 px-2 shadow-none py-2 resize-none scrollbar-thin scrollbar-thumb-muted"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          autoFocus={!pageId}
                          disabled={!!attachment}
                        />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Action Bar */}
              <div className="p-4 sm:p-6 pt-2 flex justify-between items-center">
                <div className="flex items-center">
                  <AnimatePresence>
                    {activeTab === 'context' && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center"
                      >
                        <Button 
                          variant="outline" 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className={`rounded-full gap-2 ${attachment ? 'border-primary text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                          {attachment ? (
                            <span className="truncate max-w-[150px]">{attachment.name}</span>
                          ) : (
                            <span className="hidden sm:inline">Attach</span>
                          )}
                        </Button>
                        {attachment && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => { e.stopPropagation(); setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} 
                            className="rounded-full h-9 w-9 ml-1 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Button 
                  onClick={handleSearch} 
                  disabled={isSearching || (!query.trim() && !attachment)} 
                  size="lg"
                  className="rounded-full font-semibold shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all duration-300 disabled:opacity-50 disabled:shadow-none"
                >
                  {isSearching ? (
                    <span className="flex items-center gap-3">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                        <LoaderCircle className="h-5 w-5 text-amber-300" />
                      </motion.div>
                      Synthesizing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-3">
                      Search
                      <ArrowRight className="h-5 w-5 rotate-135 opacity-70" />
                    </span>
                  )}
                </Button>
              </div>
              
            </div>
          )}
        </motion.section>

        {/* --- Results Loading Skeleton (While Searching) --- */}
        {isSearching && pageId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 space-y-6"
          >
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="relative"
            >
              <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full"></div>
              <LoaderCircle className="h-12 w-12 text-indigo-500 relative z-10" />
            </motion.div>
            <h3 className="text-xl font-medium text-muted-foreground animate-pulse">Extracting from Scientific Databases...</h3>
          </motion.div>
        )}

        {/* --- Error Message --- */}
        {searchError && !isSearching && (
          <div className="w-full max-w-5xl mx-auto px-4 mt-8">
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className="bg-destructive/20 p-3 rounded-full">
                <X className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg">Search Failed</h3>
              <p className="text-sm opacity-90 max-w-2xl">{searchError}</p>
            </div>
          </div>
        )}

        {/* --- Results Section --- */}
        <AnimatePresence>
          {!isSearching && results.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8 relative z-20"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-2 pb-4 border-b">
                <div className="flex items-center gap-2 md:gap-3">
                  <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
                    <span className="md:hidden">Results</span>
                    <span className="hidden md:inline">Curated Literature</span>
                  </h3>
                  <Badge variant="neutral" className="font-normal whitespace-nowrap">{results.length} Papers</Badge>
                </div>
                
                <div className="flex items-center gap-2 md:gap-3 self-end md:self-auto">
                  <Button variant="outline" size="sm" onClick={handleExportBibtex} className="h-8 rounded-full px-3 md:px-4 text-xs font-medium border-muted-foreground/30 hover:bg-muted/50 bg-muted/30 text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    <Download className="h-3.5 w-3.5 md:mr-1.5" /> 
                    <span className="hidden md:inline">BibTeX</span>
                  </Button>
                  <div className="relative">
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="appearance-none bg-muted/30 border text-transparent md:text-muted-foreground hover:md:text-foreground text-sm font-medium rounded-full pl-8 pr-2 md:pl-9 md:pr-8 py-1.5 hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer w-[76px] md:w-auto"
                    >
                      <option value="score" className="text-foreground">Sort by: Score</option>
                      <option value="year" className="text-foreground">Sort by: Year</option>
                      <option value="citations" className="text-foreground">Sort by: Citations</option>
                    </select>
                    {/* Fake Label for Mobile */}
                    <div className="absolute inset-0 flex items-center pl-8 pointer-events-none md:hidden text-sm font-medium text-muted-foreground">
                      Sort
                    </div>
                    <ArrowUpDown className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none hidden md:block" />
                  </div>
                  <div className="relative">
                    <select 
                      value={filterSource}
                      onChange={(e) => setFilterSource(e.target.value)}
                      className="appearance-none bg-muted/30 border text-transparent md:text-muted-foreground hover:md:text-foreground text-sm font-medium rounded-full pl-8 pr-2 md:pl-9 md:pr-8 py-1.5 hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer w-[150px] md:max-w-60 text-ellipsis overflow-hidden whitespace-nowrap"
                    >
                      <option value="all" className="text-foreground">All Sources</option>
                      {uniqueSources.map(source => (
                        <option key={source} value={source} className="text-foreground">{source}</option>
                      ))}
                    </select>
                    {/* Fake Label for Mobile */}
                    <div className="absolute inset-0 flex items-center pl-8 pointer-events-none md:hidden text-sm font-medium text-muted-foreground">
                      Publisher
                    </div>
                    <Filter className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none hidden md:block" />
                  </div>
                </div>
              </div>

              <div className="grid gap-6">
                {[...results].filter(r => filterSource === 'all' || r.source === filterSource).sort((a, b) => {
                  if (sortBy === 'score') return (b.overallScore || 0) - (a.overallScore || 0)
                  if (sortBy === 'year') return b.year - a.year
                  if (sortBy === 'citations') return b.citations - a.citations
                  return 0
                }).map((paper, idx) => (
                  <motion.div 
                    layout
                    key={paper.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ layout: { type: "spring", stiffness: 300, damping: 30 }, opacity: { delay: idx * 0.05 }, y: { delay: idx * 0.05 } }}
                    className="min-w-0 w-full"
                  >
                    <div className="relative group rounded-3xl transition-all duration-500 hover:-translate-y-1 border shadow-sm bg-card">
                      
                      {/* Inner Card */}
                      <div className="relative h-full rounded-3xl p-6 sm:p-8 flex flex-col gap-5">

                        <div className="flex items-start justify-between gap-6 relative z-10">
                          <div className="space-y-4 w-full min-w-0">
                            
                            <div className="flex items-center justify-between gap-3 mb-2 w-full min-w-0">
                              <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                <Badge variant="neutral" className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1 font-normal whitespace-nowrap shrink-0">{paper.year}</Badge>
                                <Badge variant="neutral" className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1 font-normal whitespace-nowrap shrink-0">{new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(paper.citations)} Citations</Badge>
                                <Badge variant="neutral" className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1 font-normal whitespace-nowrap shrink-0">{paper.source}</Badge>
                              </div>
                              
                              {aiReview && (
                                <div className="relative group/score shrink-0 cursor-default">
                                  {paper.overallScore != null ? (
                                    <>
                                      <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-500/60 shadow-md hover:bg-indigo-500/20 px-4 py-1.5 rounded-full font-extrabold text-sm transition-colors">
                                        {paper.overallScore.toFixed(1)}
                                      </Badge>
                                      {/* Tooltip */}
                                      {paper.rubrics && (
                                        <div className="absolute top-full right-0 mt-2 w-48 p-3 rounded-xl bg-popover text-popover-foreground shadow-[0_10px_30px_rgba(99,102,241,0.2)] border-2 border-indigo-500/50 opacity-0 invisible group-hover/score:opacity-100 group-hover/score:visible transition-all z-[100] backdrop-blur-md">
                                          <div className="space-y-2">
                                            <div className="flex justify-between items-center text-xs">
                                              <span className="text-muted-foreground font-medium uppercase tracking-wider">Relevance</span>
                                              <span className="font-bold text-foreground">{paper.rubrics.relevance.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                              <span className="text-muted-foreground font-medium uppercase tracking-wider">Methodology</span>
                                              <span className="font-bold text-foreground">{paper.rubrics.methodology.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                              <span className="text-muted-foreground font-medium uppercase tracking-wider">Novelty</span>
                                              <span className="font-bold text-foreground">{paper.rubrics.novelty.toFixed(1)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  ) : isEvaluating ? (
                                    <Badge variant="neutral" className="bg-transparent border text-muted-foreground border-muted-foreground/30 px-3 py-1.5 rounded-full text-xs font-medium gap-1.5 flex items-center shadow-sm">
                                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                      <span className="hidden sm:inline">AI Reviewing</span>
                                    </Badge>
                                  ) : null}
                                </div>
                              )}
                            </div>

                            <h4 className="text-2xl font-bold leading-snug text-foreground group-hover:text-primary transition-colors break-words">
                              {paper.url ? (
                                <a href={paper.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors inline">
                                  {cleanText(paper.title)} 
                                </a>
                              ) : (
                                cleanText(paper.title)
                              )}
                            </h4>
                            
                            <p className="text-muted-foreground text-base break-words">
                              {paper.authors.join(' • ')}
                            </p>
                            
                            <div className="relative z-10 text-muted-foreground text-sm sm:text-base leading-relaxed">
                              {expandedCards[paper.id] ? (
                                <span>
                                  {cleanText(paper.abstract)}{' '}
                                  <button onClick={() => toggleExpand(paper.id)} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                                    Show less <ChevronDown className="h-3 w-3 rotate-180" />
                                  </button>
                                </span>
                              ) : (
                                <span>
                                  <span className="md:hidden">
                                    {cleanText(paper.abstract).length > 100 ? `${cleanText(paper.abstract).slice(0, 100).trim()}... ` : `${cleanText(paper.abstract)} `}
                                    {cleanText(paper.abstract).length > 100 && (
                                      <button onClick={() => toggleExpand(paper.id)} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                                        Show more <ChevronDown className="h-3 w-3" />
                                      </button>
                                    )}
                                  </span>
                                  <span className="hidden md:inline">
                                    {cleanText(paper.abstract).length > 180 ? `${cleanText(paper.abstract).slice(0, 180).trim()}... ` : `${cleanText(paper.abstract)} `}
                                    {cleanText(paper.abstract).length > 180 && (
                                      <button onClick={() => toggleExpand(paper.id)} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                                        Show more <ChevronDown className="h-3 w-3" />
                                      </button>
                                    )}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {results.length > 0 && !isSearching && (
                <div className="mt-8 flex justify-center items-center gap-4 pb-8">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={goToPrevPage} 
                    disabled={page === 1 || isLoadingMore || isEvaluating}
                    className="rounded-full px-6 bg-card"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                  </Button>
                  
                  <span className="text-sm font-medium text-muted-foreground w-16 text-center">
                    Page {page}
                  </span>

                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={goToNextPage} 
                    disabled={isLoadingMore || isEvaluating}
                    className="rounded-full px-6 bg-card"
                  >
                    {isLoadingMore ? (
                      <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Loading...</>
                    ) : (
                      <>Next <ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <div className="fixed bottom-0 left-0 right-0 py-1 px-0 text-center text-gray-600 text-xs bg-background/60 backdrop-blur-md z-50">
        <div className="flex-none">
          <AppsFooter />
        </div>
      </div>
    </div>
  )
}
