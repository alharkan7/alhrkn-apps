'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { BookOpen, Search, Settings, Sparkles, Database, LoaderCircle, ExternalLink, ChevronDown, Check, Bot, ArrowLeft, ArrowRight, Lightbulb, GraduationCap, Quote, Filter, Paperclip, ArrowUpDown, Download, X, Menu } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AppsHeader } from '@/components/apps-header'
import AppsFooter from '@/components/apps-footer'
import { cn } from '@/lib/utils'

import { Paper } from '../shared'
import { BeeblioHistorySidebar } from './BeeblioHistorySidebar'

const decodeEntities = (str: string) => {
  return str
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#x200B;/g, '')
    .replace(/&amp;/gi, '&'); // Do &amp; last
};

const cleanText = (text: string) => {
  if (!text) return '';
  
  let str = text;
  // Pass 1: Decode entities (e.g. &lt;span&gt; to <span>, &amp;nbsp; to &nbsp;)
  str = decodeEntities(str);
  
  // Pass 2: Strip HTML tags now that they are decoded
  str = str.replace(/<\/?[^>]+(>|$)/g, "");
  
  // Pass 3: Decode again to catch anything that was double-encoded (like &nbsp;)
  str = decodeEntities(str);
  
  return str.replace(/\s\s+/g, ' ').trim();
};

import { toast } from 'sonner'

interface BeeblioClientProps {
  pageId?: string;
  isOwner?: boolean;
}

export default function BeeblioClient({ pageId, isOwner = true }: BeeblioClientProps) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
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
  
  const handleMakeCopy = async () => {
    if (!pageId) return;
    try {
      const res = await fetch(`/api/beeblio/${pageId}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to duplicate');
      const data = await res.json();
      window.location.href = `/beeblio/${data.newId}`;
    } catch (error) {
      console.error('Failed to duplicate document', error);
      toast.error('Failed to copy document. Please try again.');
    }
  };

  const handleInteract = (e?: React.SyntheticEvent | Event) => {
    if (!isOwner) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      toast('View Only', {
        description: "You're not the owner of this search.",
        action: {
          label: 'Make Copy',
          onClick: handleMakeCopy
        }
      });
      return false;
    }
    return true;
  };
  
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
            
            // Clear the attachment after successful search so the badge disappears
            setAttachment(null);
            sessionStorage.removeItem('beeblio_attachment');
          }
          setIsSearching(false);
          
          if (data.isHistory) return; // Skip evaluation if loading from DB
          
          const shouldReview = reviewParam === 'true';
          if (shouldReview && data.papers.length > 0) {
            setIsEvaluating(true);
            try {
              const papersToEval = data.papers.map((p: Paper) => ({
                id: p.id,
                dbId: p.dbId,
                title: p.title,
                abstract: p.abstract
              }));
              
              const evalRes = await fetch('/api/beeblio/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  papers: papersToEval,
                  originalQuery: initialQuery || "Attached File Analysis",
                  criteria: data.structuredQueries?.evaluationCriteria
                })
              });
              
              const reader = evalRes.body?.getReader();
              if (reader) {
                const decoder = new TextDecoder();
                let buffer = '';
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || '';
                  for (const line of lines) {
                    if (line.trim()) {
                      try {
                        const evalData = JSON.parse(line);
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
                        console.error('Failed to parse NDJSON line', e);
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.error("Evaluation failed", e);
            }
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
        try {
          const papersToEval = data.papers.map((p: Paper) => ({
            id: p.id, dbId: p.dbId, title: p.title, abstract: p.abstract
          }));
          
          const evalRes = await fetch('/api/beeblio/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ papers: papersToEval, originalQuery: initialQuery, criteria: structuredQueries?.evaluationCriteria })
          });
          
          const reader = evalRes.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const evalData = JSON.parse(line);
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
                    console.error('Failed to parse NDJSON line', e);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error("Evaluation failed", e);
        }
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
    if (!handleInteract()) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
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
    if (!handleInteract(e)) return;
    if (activeTab === 'context') {
      const file = e.dataTransfer.files?.[0];
      if (file) await uploadFile(file);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getCurrentExportResults = () => {
    return [...results].filter(r => filterSource === 'all' || r.source === filterSource).sort((a, b) => {
      if (sortBy === 'score') return (b.overallScore || 0) - (a.overallScore || 0)
      if (sortBy === 'year') return b.year - a.year
      if (sortBy === 'citations') return b.citations - a.citations
      return 0
    });
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportBibtex = () => {
    const currentResults = getCurrentExportResults();

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
    downloadFile(blob, 'beeblio_export.bib');
  };

  const handleExportJSON = () => {
    const currentResults = getCurrentExportResults();
    const blob = new Blob([JSON.stringify(currentResults, null, 2)], { type: 'application/json' });
    downloadFile(blob, 'beeblio_export.json');
  };

  const handleExportCSV = async () => {
    const currentResults = getCurrentExportResults();
    const Papa = (await import('papaparse')).default;
    const csv = Papa.unparse(currentResults.map(p => ({
      Title: p.title,
      Authors: p.authors.join(', '),
      Year: p.year,
      Journal: p.source,
      Citations: p.citations,
      Abstract: p.abstract,
      URL: p.url,
      Score: p.overallScore || ''
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadFile(blob, 'beeblio_export.csv');
  };

  const handleExportExcel = async () => {
    const currentResults = getCurrentExportResults();
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Papers');
    
    sheet.columns = [
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Authors', key: 'authors', width: 30 },
      { header: 'Year', key: 'year', width: 10 },
      { header: 'Journal', key: 'journal', width: 20 },
      { header: 'Citations', key: 'citations', width: 10 },
      { header: 'Abstract', key: 'abstract', width: 50 },
      { header: 'URL', key: 'url', width: 30 },
      { header: 'Score', key: 'score', width: 10 },
    ];
    
    currentResults.forEach(p => {
      sheet.addRow({
        title: p.title,
        authors: p.authors.join(', '),
        year: p.year,
        journal: p.source,
        citations: p.citations,
        abstract: p.abstract,
        url: p.url,
        score: p.overallScore
      });
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadFile(blob, 'beeblio_export.xlsx');
  };

  const handleSearch = async () => {
    if (!handleInteract()) return;
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
    <PopoverContent
      className="w-80 overflow-hidden rounded-2xl border border-black/[0.07] bg-[#fbfbf9]/95 p-0 shadow-[0_16px_44px_rgba(25,25,24,0.12)] backdrop-blur-xl dark:border-white/[0.09] dark:bg-[#1b1b19]/95 dark:shadow-[0_18px_50px_rgba(0,0,0,0.4)]"
      align="end"
    >
      <div className="p-5 space-y-6">
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-black/42 dark:text-white/40">
            <Sparkles className="h-3.5 w-3.5" />
            AI Pipeline
          </h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between group">
              <div className="space-y-1">
                <label className={cn('text-sm font-medium text-black/75 dark:text-white/75', activeTab === 'context' && 'text-black/40 dark:text-white/38')}>Query Optimizer</label>
                <p className="text-[11px] leading-4 text-black/42 dark:text-white/40">
                  {activeTab === 'context' ? 'Required for Context Search' : 'Rewrite input to strict Boolean logic'}
                </p>
              </div>
              <Switch 
                checked={activeTab === 'context' ? true : aiOptimize} 
                disabled={activeTab === 'context'} 
                onCheckedChange={setAiOptimize} 
                className="data-[state=unchecked]:bg-black/10 data-[state=checked]:bg-[#191918] disabled:cursor-not-allowed disabled:opacity-40 dark:data-[state=unchecked]:bg-white/12 dark:data-[state=checked]:bg-[#f2f2ef]"
              />
            </div>
            <div className="flex items-center justify-between group">
              <div className="space-y-1">
                <label className="text-sm font-medium text-black/75 dark:text-white/75">AI Reviewer</label>
                <p className="text-[11px] leading-4 text-black/42 dark:text-white/40">Evaluate and rank fetched papers</p>
              </div>
              <Switch
                checked={aiReview}
                onCheckedChange={setAiReview}
                className="data-[state=unchecked]:bg-black/10 data-[state=checked]:bg-[#191918] dark:data-[state=unchecked]:bg-white/12 dark:data-[state=checked]:bg-[#f2f2ef]"
              />
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-black/[0.06] dark:bg-white/[0.08]"></div>

        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-black/42 dark:text-white/40">
            <Database className="h-3.5 w-3.5" />
            Databases
          </h4>
          <div className="space-y-3">
            {Object.entries(databases).map(([key, value]) => (
              <div className="flex items-center space-x-3" key={key}>
                <Checkbox 
                  id={`db-${key}`} 
                  checked={value} 
                  onCheckedChange={(c) => setDatabases(prev => ({...prev, [key]: !!c}))} 
                  className="border-black/20 data-[state=checked]:border-[#191918] data-[state=checked]:bg-[#191918] dark:border-white/20 dark:data-[state=checked]:border-[#f2f2ef] dark:data-[state=checked]:bg-[#f2f2ef] dark:data-[state=checked]:text-[#191918]"
                />
                <label htmlFor={`db-${key}`} className="cursor-pointer text-sm font-medium text-black/65 transition-colors hover:text-black dark:text-white/62 dark:hover:text-white">
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

  const sortOptions = [
    { value: 'score', label: 'Sort by: Score' },
    { value: 'year', label: 'Sort by: Year' },
    { value: 'citations', label: 'Sort by: Citations' },
  ] as const
  const currentSortLabel = sortOptions.find((o) => o.value === sortBy)?.label ?? 'Sort by: Score'

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#f7f7f5] font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">
      
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.98),rgba(247,247,245,0.72)_44%,rgba(238,239,235,0.82)_100%)] dark:bg-[radial-gradient(circle_at_50%_35%,rgba(37,37,34,0.72),rgba(16,16,15,1)_62%)]" />
        <div className="absolute inset-0 opacity-[0.3] [background-image:radial-gradient(rgba(25,25,24,0.18)_0.7px,transparent_0.7px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)] dark:opacity-[0.13] dark:[background-image:radial-gradient(rgba(255,255,255,0.35)_0.7px,transparent_0.7px)]" />
        {!pageId && (
          <motion.div
            className="absolute left-1/2 top-[34%] h-72 w-72 -translate-x-1/2 rounded-full bg-blue-400/[0.065] blur-3xl dark:bg-blue-500/[0.075]"
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.07, 1], opacity: [0.4, 0.65, 0.4] }}
            transition={prefersReducedMotion ? undefined : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      <BeeblioHistorySidebar />

      {/* --- Top Navigation --- */}
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-[#f7f7f5]/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10100f]/80">
        <AppsHeader
          leftButton={
            <Button
              variant="ghost"
              size="icon"
              className="sidebar-toggle size-9 rounded-xl text-black/60 hover:bg-black/[0.06] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
              onClick={() => window.dispatchEvent(new Event('toggleBeeblioHistorySidebar'))}
              aria-label="Open search history"
            >
              <Menu size={18} />
            </Button>
          }
          title={
            <Link
              href="/beeblio"
              title="Back to Beeblio"
              className="inline-flex items-center text-sm font-semibold tracking-[-0.01em] text-[#191918] transition-opacity hover:opacity-65 dark:text-[#f2f2ef]"
            >
              Beeblio
            </Link>
          }
        />
        {!isOwner && (
            <div 
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-sans font-medium px-3 py-1 rounded-full shadow-sm hover:shadow-md cursor-pointer select-none transition-all flex items-center gap-1 z-50 whitespace-nowrap" 
                onClick={handleMakeCopy}
            >
                <span>View Only - Make a Copy</span>
            </div>
        )}
      </div>

      <main className={`relative z-10 container mx-auto flex-1 max-w-5xl px-4 pb-20 md:px-8 ${pageId ? 'space-y-6 pt-20' : 'flex flex-col justify-center pt-24 sm:pt-28'}`}>
        
        {/* --- Hero Section (Only show on main landing page) --- */}
        {!pageId && (
          <section className="mx-auto mb-6 max-w-3xl text-center sm:mb-7">
            <motion.div
               initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.2] tracking-[-0.05em] sm:text-5xl sm:leading-[1]">
                Search Scientific Literature
              </h1>
            </motion.div>
          </section>
        )}

        {/* --- Search Interface --- */}
        <motion.section 
          initial={prefersReducedMotion ? false : { opacity: 0, y: pageId ? 12 : 18, scale: pageId ? 1 : 0.985 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.52, delay: pageId ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
          className={`group relative mx-auto ${pageId ? 'w-full' : 'w-full max-w-2xl'}`}
        >
          {!pageId && (
            <>
              <div className="absolute -inset-px rounded-[25px] bg-gradient-to-b from-black/[0.09] to-black/[0.03] dark:from-white/[0.13] dark:to-white/[0.04]" />
              <div className="absolute inset-x-8 -bottom-5 h-14 rounded-full bg-black/[0.08] blur-2xl dark:bg-black/40" />
            </>
          )}
          
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />

          {pageId ? (
            /* --- COMPACT SEARCH BAR (Results Page) --- */
            <div
              className={`relative flex items-center gap-1.5 overflow-hidden rounded-full border bg-white/85 p-1.5 pr-2 shadow-md backdrop-blur-2xl transition-all duration-200 dark:bg-[#1b1b19]/85 ${isDragging && activeTab === 'context' ? 'ring-2 ring-primary border-primary' : ''}`}
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
              {/* <AnimatePresence>
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
              </AnimatePresence> */}

              {/* Search Box */}
              <div className="flex-1 min-w-0 pl-1.5 flex flex-col justify-center">
                <Input
                  placeholder={activeTab === 'keywords' ? "Search for papers, authors, topics..." : "Paste your context or abstract..."}
                  className="bg-transparent border-none text-base md:text-lg shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-10 truncate placeholder:text-muted-foreground/50"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={handleInteract}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={activeTab === 'context' && !!attachment}
                  readOnly={!isOwner}
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
              className={`relative overflow-hidden rounded-[24px] bg-white p-3 shadow-[0_14px_44px_rgba(25,25,24,0.09),0_2px_8px_rgba(25,25,24,0.04)] transition-[box-shadow,transform] duration-300 dark:bg-[#1b1b19] dark:shadow-[0_18px_50px_rgba(0,0,0,0.32)] sm:p-4 ${isDragging && activeTab === 'context' ? 'ring-2 ring-blue-500/40' : ''}`}
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
              <div className="flex flex-row items-center justify-between gap-2 px-1">
                
                {/* Segmented Control for Tabs */}
                <div className="flex w-auto gap-0.5 rounded-xl border border-black/[0.065] bg-black/[0.035] p-1 dark:border-white/[0.08] dark:bg-white/[0.045]">
                  <button
                    onClick={() => setActiveTab('keywords')}
                    className={`relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-200 sm:px-3.5 ${
                      activeTab === 'keywords' ? 'text-white dark:text-[#191918]' : 'text-black/42 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70'
                    }`}
                  >
                    {activeTab === 'keywords' && (
                      <motion.div layoutId="activeTab" className="absolute inset-0 rounded-lg bg-[#191918] shadow-[0_2px_7px_rgba(25,25,24,0.18)] dark:bg-[#f2f2ef] dark:shadow-[0_2px_8px_rgba(0,0,0,0.28)]" transition={{ type: 'spring', stiffness: 440, damping: 34 }} />
                    )}
                    <span className="relative z-10">Keywords</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('context')}
                    className={`relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-200 sm:px-3.5 ${
                      activeTab === 'context' ? 'text-white dark:text-[#191918]' : 'text-black/42 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70'
                    }`}
                  >
                    {activeTab === 'context' && (
                      <motion.div layoutId="activeTab" className="absolute inset-0 rounded-lg bg-[#191918] shadow-[0_2px_7px_rgba(25,25,24,0.18)] dark:bg-[#f2f2ef] dark:shadow-[0_2px_8px_rgba(0,0,0,0.28)]" transition={{ type: 'spring', stiffness: 440, damping: 34 }} />
                    )}
                    <span className="relative z-10">Context</span>
                  </button>
                </div>

                {/* Settings Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-9 flex-shrink-0 rounded-xl border border-transparent text-black/42 shadow-none transition-colors hover:border-black/[0.06] hover:bg-black/[0.045] hover:text-black dark:text-white/42 dark:hover:border-white/[0.08] dark:hover:bg-white/[0.06] dark:hover:text-white">
                      <Settings className="h-4 w-4" />
                      {/* <span className="hidden sm:inline">Settings</span> */}
                    </Button>
                  </PopoverTrigger>
                  {renderSettingsContent()}
                </Popover>
              </div>

              {/* Main Input Area */}
              <div className="px-1 py-2">
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
                        className="h-auto min-h-[92px] border-none bg-transparent px-2 py-3 text-[17px] leading-7 text-[#191918] shadow-none placeholder:text-black/27 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-[#f2f2ef] dark:placeholder:text-white/25 sm:px-3 sm:text-lg"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={handleInteract}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        autoFocus={!pageId}
                        readOnly={!isOwner}
                      />
                    ) : (
                      <div className="relative group">
                        {/* <Quote className="absolute left-2 top-2 h-6 w-6 text-muted-foreground/20" /> */}
                        <Textarea 
                          placeholder="Paste your abstract, research proposal, or brain dump here."
                          className="min-h-[92px] max-h-[180px] resize-none border-none bg-transparent px-2 py-3 text-[17px] leading-7 text-[#191918] shadow-none placeholder:text-black/27 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-[#f2f2ef] dark:placeholder:text-white/25 sm:px-3 sm:text-lg"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onFocus={handleInteract}
                          autoFocus={!pageId}
                          disabled={!!attachment}
                          readOnly={!isOwner}
                        />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between border-t border-black/[0.055] px-1 pt-3 dark:border-white/[0.07]">
                <div className="flex items-center">
                  {/* <AnimatePresence>
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
                  </AnimatePresence> */}
                </div>

                <Button 
                  onClick={handleSearch} 
                  disabled={isSearching || (!query.trim() && !attachment)} 
                  size="lg"
                  className="group h-10 rounded-xl bg-[#191918] px-4 font-semibold text-white shadow-[0_2px_8px_rgba(25,25,24,0.16)] transition-all hover:-translate-y-px hover:bg-black hover:shadow-[0_5px_14px_rgba(25,25,24,0.2)] disabled:translate-y-0 disabled:opacity-30 dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white"
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
                      <ArrowRight className="size-4 rotate-[-45deg] opacity-80 transition-transform group-hover:-translate-y-0.5" />
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
              <div className="absolute inset-0 rounded-full bg-black/5 blur-xl dark:bg-white/5"></div>
              <LoaderCircle className="relative z-10 h-12 w-12 text-[#191918]/70 dark:text-[#f2f2ef]/70" />
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
              <div className="flex flex-row items-center justify-between gap-4 md:gap-2 pb-4 border-b">
                <div className="flex items-center gap-2 md:gap-3">
                  <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
                    <span className="md:hidden">Results</span>
                    <span className="hidden md:inline">Curated Literature</span>
                  </h3>
                  <Badge variant="neutral" className="font-normal whitespace-nowrap">{results.length} Papers</Badge>
                </div>
                
                <div className="flex items-center gap-2 md:gap-3 self-end md:self-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 rounded-full px-3 md:px-4 text-xs font-medium border-muted-foreground/30 hover:bg-muted/50 bg-muted/30 text-muted-foreground hover:text-foreground transition-colors shrink-0">
                        <Download className="h-3.5 w-3.5 md:mr-1.5" /> 
                        <span className="hidden md:inline">Export</span>
                        <ChevronDown className="h-3 w-3 ml-1 md:ml-1.5 hidden md:block opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-15 rounded-xl">
                      <DropdownMenuItem onClick={handleExportBibtex} className="cursor-pointer font-medium">
                        BibTeX
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportJSON} className="cursor-pointer font-medium">
                        JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer font-medium">
                        CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer font-medium">
                        Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-full border-muted-foreground/30 bg-muted/30 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:px-4">
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">{currentSortLabel}</span>
                        <ChevronDown className="hidden h-3 w-3 opacity-70 md:block" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      {sortOptions.map((opt) => (
                        <DropdownMenuItem
                          key={opt.value}
                          onClick={() => setSortBy(opt.value)}
                          className="cursor-pointer font-medium"
                        >
                          <Check className={cn('h-3.5 w-3.5', sortBy === opt.value ? 'opacity-100' : 'opacity-0')} />
                          {opt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-full border-muted-foreground/30 bg-muted/30 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:px-4">
                        <Filter className="h-3.5 w-3.5" />
                        <span className="hidden max-w-[150px] truncate md:inline">{filterSource === 'all' ? 'All Sources' : filterSource}</span>
                        <ChevronDown className="hidden h-3 w-3 opacity-70 md:block" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-[320px] overflow-y-auto rounded-xl">
                      <DropdownMenuItem onClick={() => setFilterSource('all')} className="cursor-pointer font-medium">
                        <Check className={cn('h-3.5 w-3.5', filterSource === 'all' ? 'opacity-100' : 'opacity-0')} />
                        All Sources
                      </DropdownMenuItem>
                      {uniqueSources.map((source) => (
                        <DropdownMenuItem key={source} onClick={() => setFilterSource(source)} className="cursor-pointer font-medium">
                          <Check className={cn('h-3.5 w-3.5', filterSource === source ? 'opacity-100' : 'opacity-0')} />
                          {source}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                    <div className="relative group rounded-3xl border border-black/[0.06] bg-white shadow-sm transition-all duration-500 hover:-translate-y-1 dark:border-white/[0.08] dark:bg-[#1b1b19]">
                      
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
                                      <Badge className="rounded-full border border-amber-500/45 bg-amber-500/10 px-4 py-1.5 text-sm font-extrabold text-amber-800 shadow-sm transition-colors hover:bg-amber-500/15 dark:text-amber-200">
                                        {paper.overallScore.toFixed(1)}
                                      </Badge>
                                      {/* Tooltip */}
                                      {paper.rubrics && (
                                        <div className="absolute top-full right-0 mt-2 w-56 rounded-xl border border-amber-500/30 bg-[#fbfbf9] p-3 text-[#191918] opacity-0 shadow-[0_16px_40px_rgba(25,25,24,0.16)] backdrop-blur-md transition-all invisible group-hover/score:opacity-100 group-hover/score:visible z-[100] dark:bg-[#1b1b19] dark:text-[#f2f2ef]">
                                          <div className="space-y-2">
                                            {Object.entries(paper.rubrics).map(([key, value]) => (
                                              <div key={key} className="flex justify-between items-center text-xs">
                                                <span className="text-muted-foreground font-medium uppercase tracking-wider truncate max-w-[140px]" title={key}>{key}</span>
                                                <span className="font-bold text-foreground shrink-0 pl-2">{typeof value === 'number' ? value.toFixed(1) : value}</span>
                                              </div>
                                            ))}
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
                    className="rounded-full bg-white px-6 dark:bg-[#1b1b19]"
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
                    className="rounded-full bg-white px-6 dark:bg-[#1b1b19]"
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

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/[0.045] bg-[#f7f7f5]/70 py-1 text-center text-xs text-black/45 backdrop-blur-lg dark:border-white/[0.06] dark:bg-[#10100f]/70 dark:text-white/40">
        <div className="flex-none">
          <AppsFooter />
        </div>
      </div>
    </div>
  )
}
