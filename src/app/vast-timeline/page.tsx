'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Timeline from './components/Timeline';
import Navigator from './components/Navigator';
import JsonSidebar from './components/JsonSidebar';
import { PERIODS } from './constants';
import { HistoricalEvent, HistoricalPeriod, ViewState } from './types';
import * as d3 from 'd3';
import { AppsGrid } from '@/components/ui/apps-grid';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Menu, X, Edit, Save, Play, Square, ChevronLeft, ChevronRight } from 'lucide-react';
import historyDataJson from './history-data.json';

const IndonesiaHistoryPage: React.FC = () => {
  // highlightedEvent controls the visual focus on Timeline and Navigator (with popover)
  const [highlightedEvent, setHighlightedEvent] = useState<HistoricalEvent | null>(null);

  const [viewport, setViewport] = useState({ width: 1200, height: 800 }); // Default values for SSR
  const [viewState, setViewState] = useState<ViewState | null>(null);

  // Sidebar and JSON upload states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveRequested, setSaveRequested] = useState(false);
  const [jsonData, setJsonData] = useState(historyDataJson);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Presentation mode states
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  // presentingPeriodIdx starts at the LAST period (most recent) and decrements toward 0
  const [presentingPeriodIdx, setPresentingPeriodIdx] = useState(PERIODS.length - 1);
  // presentingEventIdx is into the period's events sorted DESC by year (latest first)
  const [presentingEventIdx, setPresentingEventIdx] = useState(0);
  // Tracks the previous period index so we can detect period-boundary transitions
  const prevPresentingPeriodIdxRef = useRef<number>(PERIODS.length - 1);

  // Flatten events for Navigator and Search
  const allEvents = useMemo(() => PERIODS.flatMap(p => p.events), []);

  // Validate JSON structure
  const validateJSON = (data: any): { valid: boolean; error?: string } => {
    try {
      if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid JSON: Must be an object' };
      }

      // Title is optional, but if provided must be a string
      if (data.title !== undefined && typeof data.title !== 'string') {
        return { valid: false, error: 'Invalid JSON: "title" must be a string' };
      }

      // Data source URL is optional, but if provided must be a string
      if (data.dataSourceUrl !== undefined && typeof data.dataSourceUrl !== 'string') {
        return { valid: false, error: 'Invalid JSON: "dataSourceUrl" must be a string' };
      }

      if (!data.rawData || !Array.isArray(data.rawData)) {
        return { valid: false, error: 'Invalid JSON: Missing or invalid "rawData" array' };
      }

      for (let i = 0; i < data.rawData.length; i++) {
        const period = data.rawData[i];

        if (!period.period_title || typeof period.period_title !== 'string') {
          return { valid: false, error: `Invalid JSON: Period ${i} missing "period_title"` };
        }

        if (typeof period.start_year !== 'number' || typeof period.end_year !== 'number') {
          return { valid: false, error: `Invalid JSON: Period "${period.period_title}" has invalid year values` };
        }

        if (!period.events || !Array.isArray(period.events)) {
          return { valid: false, error: `Invalid JSON: Period "${period.period_title}" missing "events" array` };
        }

        for (let j = 0; j < period.events.length; j++) {
          const event = period.events[j];

          if (!event.title || typeof event.title !== 'string') {
            return { valid: false, error: `Invalid JSON: Event ${j} in period "${period.period_title}" missing "title"` };
          }

          if (typeof event.year !== 'number') {
            return { valid: false, error: `Invalid JSON: Event "${event.title}" has invalid "year" value` };
          }
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  };

  // Handle JSON update (from file upload or direct edit)
  const handleJsonUpdate = (newData: any) => {
    const validation = validateJSON(newData);
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid JSON format');
      return;
    }

    setJsonData(newData);
    setUploadError(null);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        handleJsonUpdate(parsedData);
      } catch (error) {
        setUploadError('Failed to parse JSON file. Please check the file format.');
      }
    };

    reader.onerror = () => {
      setUploadError('Failed to read file');
    };

    reader.readAsText(file);

    // Reset the input
    event.target.value = '';
  };

  // Handle sidebar error
  const handleSidebarError = (error: string) => {
    setUploadError(error);
    setTimeout(() => setUploadError(null), 5000);
  };

  // Initialize viewport and set up resize handler
  useEffect(() => {
    // Set initial viewport size
    setViewport({ width: window.innerWidth, height: window.innerHeight });

    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleJumpToEvent = useCallback((event: HistoricalEvent) => {
    const timelineWidth = viewport.width;

    const minYear = d3.min(PERIODS, d => d.start_year) ?? -1600000;
    const maxYear = d3.max(PERIODS, d => d.visual_end_year) ?? 2024;
    const padding = Math.abs(maxYear - minYear) * 0.05;
    const domainStart = minYear;
    const domainEnd = maxYear + padding;

    // Center the event
    // Heuristic: Show a context window based on event age
    let viewWindow = 200; // Default 200 years context
    if (Math.abs(event.year) > 10000) viewWindow = 5000;
    if (Math.abs(event.year) > 100000) viewWindow = 50000;
    if (Math.abs(event.year) > 1000000) viewWindow = 500000;

    const domainWidth = domainEnd - domainStart;
    const k = domainWidth / viewWindow;

    const scaleRef = d3.scaleLinear().domain([domainStart, domainEnd]).range([0, timelineWidth]);
    const eventPixelPosUnzoomed = scaleRef(event.year);

    // Center it: ScreenCenter = eventX * k + x
    const x = (timelineWidth / 2) - (eventPixelPosUnzoomed * k);

    setViewState({ k, x });

    // Highlight the event without opening the drawer
    setHighlightedEvent(event);
  }, [viewport.width]);

  /**
   * Zoom to fit an entire period's time span in the viewport (used when a new
   * period is first revealed in presentation mode). Adds 20% padding on each
   * side so the period blocks sit comfortably inside the window.
   */
  const handleJumpToPeriod = useCallback((period: HistoricalPeriod, eventToHighlight?: HistoricalEvent) => {
    const timelineWidth = viewport.width;

    const minYear = d3.min(PERIODS, d => d.start_year) ?? -1600000;
    const maxYear = d3.max(PERIODS, d => d.visual_end_year) ?? 2024;
    const domainPadding = Math.abs(maxYear - minYear) * 0.05;
    const domainStart = minYear;
    const domainEnd = maxYear + domainPadding;
    const domainWidth = domainEnd - domainStart;

    // Span from the start of the chosen period to the end of the entire timeline
    const viewSpan = Math.abs(maxYear - period.start_year);
    // Add 10% padding (5% on each side) so it fits comfortably
    const viewWindow = Math.max(viewSpan * 1.1, 1); // guard against zero-span

    const k = domainWidth / viewWindow;

    const scaleRef = d3.scaleLinear().domain([domainStart, domainEnd]).range([0, timelineWidth]);
    // The center should be exactly halfway between the period start and the timeline end
    const viewCenter = (period.start_year + maxYear) / 2;
    const viewCenterPx = scaleRef(viewCenter);

    // Center this span in the viewport
    const x = (timelineWidth / 2) - (viewCenterPx * k);

    setViewState({ k, x });

    if (eventToHighlight) {
      setHighlightedEvent(eventToHighlight);
    }
  }, [viewport.width]);

  const handleTimelineEventClick = (event: HistoricalEvent) => {
    setHighlightedEvent(event);
  };

  const handleTimelineViewChange = (k: number, x: number) => {
    // Optional: Update URL or state
  };

  const handleDeselect = () => {
    setHighlightedEvent(null);
  };

  // ─── Presentation Mode ────────────────────────────────────────────────────

  // Periods currently visible in presentation mode:
  // all periods from presentingPeriodIdx to the end (most recent)
  const presentationVisiblePeriods = useMemo(() => {
    if (!isPresentationMode) return undefined;
    return new Set(
      Array.from({ length: PERIODS.length - presentingPeriodIdx }, (_, i) => presentingPeriodIdx + i)
    );
  }, [isPresentationMode, presentingPeriodIdx]);

  // Events of the currently-being-introduced period, sorted newest → oldest
  const presentationSortedEvents = useMemo(() => {
    if (!isPresentationMode) return [];
    return [...PERIODS[presentingPeriodIdx].events].sort((a, b) => b.year - a.year);
  }, [isPresentationMode, presentingPeriodIdx]);

  const presentationCurrentEvent = useMemo(() => {
    if (!isPresentationMode || presentationSortedEvents.length === 0) return null;
    return presentationSortedEvents[presentingEventIdx] ?? null;
  }, [isPresentationMode, presentationSortedEvents, presentingEventIdx]);

  // Auto-jump and highlight whenever the presentation event changes.
  // • Period boundary: zoom to fit the ENTIRE new period in the viewport.
  // • Within-period event step: keep the current zoom (period-fit), only
  //   update the highlighted event. All events are already on-screen at the
  //   period-fit zoom level, so re-zooming would just undo the period fit.
  useEffect(() => {
    if (!isPresentationMode || !presentationCurrentEvent) return;

    const periodChanged = prevPresentingPeriodIdxRef.current !== presentingPeriodIdx;
    prevPresentingPeriodIdxRef.current = presentingPeriodIdx;

    if (periodChanged) {
      // New period just unlocked — zoom to fit its whole span
      handleJumpToPeriod(PERIODS[presentingPeriodIdx], presentationCurrentEvent);
    } else {
      // Same period — just move the highlight; leave the zoom untouched
      setHighlightedEvent(presentationCurrentEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresentationMode, presentationCurrentEvent, presentingPeriodIdx]);

  // Keyboard navigation for presentation mode
  useEffect(() => {
    if (!isPresentationMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ArrowLeft = go to next (older/earlier) event — moves left on the timeline
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const sorted = [...PERIODS[presentingPeriodIdx].events].sort((a, b) => b.year - a.year);
        if (presentingEventIdx < sorted.length - 1) {
          setPresentingEventIdx(prev => prev + 1);
        } else if (presentingPeriodIdx > 0) {
          setPresentingPeriodIdx(prev => prev - 1);
          setPresentingEventIdx(0);
        }
      // ArrowRight = go back to previous (newer/later) event — moves right on the timeline
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (presentingEventIdx > 0) {
          setPresentingEventIdx(prev => prev - 1);
        } else if (presentingPeriodIdx < PERIODS.length - 1) {
          const prevSorted = [...PERIODS[presentingPeriodIdx + 1].events].sort((a, b) => b.year - a.year);
          setPresentingPeriodIdx(prev => prev + 1);
          setPresentingEventIdx(prevSorted.length - 1);
        }
      // ArrowUp = jump to the next (older/earlier) period
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (presentingPeriodIdx > 0) {
          setPresentingPeriodIdx(prev => prev - 1);
          setPresentingEventIdx(0);
        }
      // ArrowDown = jump back to the previous (newer/later) period
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (presentingPeriodIdx < PERIODS.length - 1) {
          const prevSorted = [...PERIODS[presentingPeriodIdx + 1].events].sort((a, b) => b.year - a.year);
          setPresentingPeriodIdx(prev => prev + 1);
          // Jump to the most recent event of the newer period
          setPresentingEventIdx(prevSorted.length - 1);
        }
      } else if (e.key === 'Escape') {
        setIsPresentationMode(false);
        setHighlightedEvent(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresentationMode, presentingPeriodIdx, presentingEventIdx]);

  const enterPresentationMode = () => {
    setPresentingPeriodIdx(PERIODS.length - 1);
    setPresentingEventIdx(0);
    prevPresentingPeriodIdxRef.current = -1; // sentinel → forces period-fit zoom on first display
    setIsPresentationMode(true);
    setIsSidebarOpen(false);
  };

  const exitPresentationMode = () => {
    setIsPresentationMode(false);
    setHighlightedEvent(null);
    // Animate back to the default full-view zoom (identity transform)
    setViewState({ k: 1, x: 0 });
  };

  const presentationNext = () => {
    const sorted = [...PERIODS[presentingPeriodIdx].events].sort((a, b) => b.year - a.year);
    if (presentingEventIdx < sorted.length - 1) {
      setPresentingEventIdx(prev => prev + 1);
    } else if (presentingPeriodIdx > 0) {
      setPresentingPeriodIdx(prev => prev - 1);
      setPresentingEventIdx(0);
    }
  };

  const presentationPrev = () => {
    if (presentingEventIdx > 0) {
      setPresentingEventIdx(prev => prev - 1);
    } else if (presentingPeriodIdx < PERIODS.length - 1) {
      const prevSorted = [...PERIODS[presentingPeriodIdx + 1].events].sort((a, b) => b.year - a.year);
      setPresentingPeriodIdx(prev => prev + 1);
      setPresentingEventIdx(prevSorted.length - 1);
    }
  };

  const isAtPresentationStart =
    presentingPeriodIdx === PERIODS.length - 1 && presentingEventIdx === 0;
  const isAtPresentationEnd =
    presentingPeriodIdx === 0 &&
    presentingEventIdx === ([...PERIODS[0].events].sort((a, b) => b.year - a.year).length - 1);

  // Overall presentation progress (0–100)
  const presentationProgress = useMemo(() => {
    if (!isPresentationMode) return 0;
    const stepsDone = PERIODS.slice(presentingPeriodIdx + 1).reduce(
      (sum, p) => sum + p.events.length, 0
    ) + presentingEventIdx;
    const totalSteps = PERIODS.reduce((sum, p) => sum + p.events.length, 0);
    return totalSteps > 0 ? Math.round((stepsDone / totalSteps) * 100) : 0;
  }, [isPresentationMode, presentingPeriodIdx, presentingEventIdx]);

  // ─── End Presentation Mode ────────────────────────────────────────────────

  // Responsive height calculations
  const headerHeight = 64; // Approximate header height including padding
  const footerHeight = viewport.width < 640 ? 80 : viewport.width < 768 ? 100 : 120;
  const timelineHeight = viewport.height - headerHeight - footerHeight;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900">

        {/* Header Row with Sidebar Header and Main Header */}
        <div className="sticky top-0 z-30 flex">
          {/* Sidebar Header - Animated with sidebar */}
          <div
            className="absolute left-0 bg-slate-900 border-b border-slate-700 flex items-center justify-between transition-all duration-300 overflow-hidden z-40"
            style={{
              width: isSidebarOpen ? (viewport.width < 640 ? '320px' : '384px') : '0',
              height: '64px', // Match main header height
              paddingLeft: viewport.width < 640 ? '12px' : '16px',
              paddingRight: viewport.width < 640 ? '12px' : '16px',
              opacity: isSidebarOpen ? 1 : 0,
            }}
          >
            <h2 className="text-sm sm:text-base font-semibold text-slate-100 whitespace-nowrap">Timeline Data</h2>
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 h-7 px-2 bg-slate-800 hover:bg-slate-700 border-slate-600 text-white shrink-0"
              >
                <Edit size={14} />
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1.5 h-7 px-2 bg-slate-800 hover:bg-slate-700 border-slate-600 text-white"
                >
                  <X size={14} />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setSaveRequested(true)}
                  className="flex items-center gap-1.5 h-7 px-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Save size={14} />
                </Button>
              </div>
            )}
          </div>

          {/* Main Page Header */}
          <header
            className="flex-1 bg-background py-2 px-3 sm:px-4 md:px-6 border-b border-border/20 transition-all duration-300"
            style={{
              marginLeft: isSidebarOpen ? (viewport.width < 640 ? '320px' : '384px') : '0'
            }}
          >
            <div className="flex items-center justify-between min-h-[48px] max-w-full">
              {/* Left Section */}
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="flex items-center gap-1.5 px-2 h-8 text-xs sm:text-sm shrink-0"
                  data-sidebar-toggle
                >
                  {isSidebarOpen ? <X size={16} /> : <Menu size={16} />}
                </Button>

                {/* Title */}
                <div className="text-lg sm:text-xl font-semibold truncate">
                  <span className="hidden sm:inline">{jsonData.title || 'Timeline'}</span>
                  <span className="sm:hidden">{jsonData.title || 'Timeline'}</span>
                </div>
              </div>

              {/* Right Section */}
              <div className="flex items-center gap-2">
                {/* Presentation Mode Toggle */}
                <Button
                  variant={isPresentationMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={isPresentationMode ? exitPresentationMode : enterPresentationMode}
                  className={`flex items-center gap-1.5 px-2 sm:px-3 h-8 text-xs sm:text-sm shrink-0 transition-all ${isPresentationMode
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
                    : 'hover:border-indigo-400 hover:text-indigo-600'
                    }`}
                  title={isPresentationMode ? 'Exit Presentation (Esc)' : 'Enter Presentation Mode'}
                >
                  {isPresentationMode ? <Square size={14} /> : <Play size={14} />}
                  <span className="hidden sm:inline">{isPresentationMode ? 'Exit' : 'Present'}</span>
                </Button>

                <AppsGrid
                  trigger={
                    <Button
                      variant="default"
                      size="sm"
                      className="flex items-center gap-1.5 px-2 sm:px-3 h-8 text-xs sm:text-sm shrink-0"
                    >
                      <LayoutGrid size={14} /> Apps
                    </Button>
                  }
                  useHardReload={false}
                />
              </div>
            </div>
          </header>
        </div>

        {/* Click-outside overlay - appears when sidebar is open */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-transparent"
            onClick={() => setIsSidebarOpen(false)}
            style={{ top: '64px' }} // Start below header
          />
        )}

        {/* Sidebar for JSON Data */}
        <JsonSidebar
          isOpen={isSidebarOpen}
          jsonData={jsonData}
          onJsonUpdate={handleJsonUpdate}
          onError={handleSidebarError}
          onClose={() => setIsSidebarOpen(false)}
          footerHeight={footerHeight}
          isEditing={isEditing}
          onEditingChange={setIsEditing}
          saveRequested={saveRequested}
          onSaveComplete={() => setSaveRequested(false)}
        />

        {/* Main Timeline Area */}
        <main className={`flex-1 relative overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'ml-80 sm:ml-96' : 'ml-0'}`}>
          {/* Presentation mode: animated colored top border */}
          {isPresentationMode && (
            <div className="absolute top-0 left-0 right-0 h-0.5 z-30 bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                style={{ width: `${presentationProgress}%` }}
              />
            </div>
          )}

          <Timeline
            width={isSidebarOpen ? viewport.width - (viewport.width < 640 ? 320 : 384) : viewport.width}
            height={Math.max(timelineHeight, 200)}
            periods={PERIODS}
            onEventClick={handleTimelineEventClick}
            onBackgroundClick={isPresentationMode ? () => { } : handleDeselect}
            highlightedEvent={highlightedEvent}
            viewState={viewState}
            onViewChange={handleTimelineViewChange}
            controlledVisiblePeriodIndices={presentationVisiblePeriods}
            onPeriodFocus={handleJumpToPeriod}
          />

          {/* Helper Text Overlay */}
          <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 pointer-events-none opacity-40 sm:opacity-50">
            <p className="text-[10px] sm:text-xs font-mono text-slate-500 leading-tight text-left">
              <span className="hidden sm:inline">Scroll/Pinch to Zoom • Drag to Pan</span>
              <span className="sm:hidden">Pinch/Scroll to Zoom<br />Drag to Pan</span>
            </p>
          </div>

          {/* Data Source Link */}
          {jsonData.dataSourceUrl && !isPresentationMode && (
            <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 pointer-events-none opacity-40 sm:opacity-50">
              <a href={jsonData.dataSourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs font-mono text-blue-600 hover:underline pointer-events-auto">
                Data Source
              </a>
            </div>
          )}

          {/* ── Presentation Controls Overlay ── */}
          {isPresentationMode && (
            <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 select-none">
              {/* Control pill */}
              <div className="flex items-center gap-1 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl px-2 py-1.5 shadow-2xl">

                {/* ← Next (older/earlier event, moves left on the timeline) */}
                <button
                  onClick={presentationNext}
                  disabled={isAtPresentationEnd}
                  className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Next older event (← arrow)"
                >
                  <ChevronLeft size={18} />
                </button>

                {/* Info */}
                <div className="text-center px-2 min-w-[160px] sm:min-w-[220px]">
                  <div
                    className="text-[10px] sm:text-xs font-bold truncate"
                    style={{ color: PERIODS[presentingPeriodIdx].color }}
                  >
                    {PERIODS[presentingPeriodIdx].period_title}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono mt-0.5">
                    Use Arrow Keys
                    <span className="mx-1 opacity-50">·</span>
                  </div>
                </div>

                {/* → Back (newer/later event, moves right on the timeline) */}
                <button
                  onClick={presentationPrev}
                  disabled={isAtPresentationStart}
                  className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Go back to newer event (→ arrow)"
                >
                  <ChevronRight size={18} />
                </button>

                {/* Divider */}
                <div className="w-px h-5 bg-slate-700 mx-0.5" />

                {/* Exit */}
                <button
                  onClick={exitPresentationMode}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                  title="Exit Presentation (Esc)"
                >
                  <X size={14} />
                </button>
              </div>

            </div>
          )}
        </main>

        {/* Bottom Navigator */}
        <footer className={`shrink-0 z-30 bg-slate-900`} style={{ height: footerHeight }}>
          <Navigator
            events={allEvents}
            onSelect={handleJumpToEvent}
            onBackgroundClick={handleDeselect}
            selectedYear={highlightedEvent?.year || null}
          />
        </footer>

      </div>
    </div>
  );
};

export default IndonesiaHistoryPage;