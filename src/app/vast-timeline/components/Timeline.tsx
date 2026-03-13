import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { HistoricalPeriod, HistoricalEvent, ViewState } from '../types';
import { Scan, Filter } from 'lucide-react';
import { EVENT_COLORS } from '../constants';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

interface TimelineProps {
  periods: HistoricalPeriod[];
  onEventClick: (event: HistoricalEvent) => void;
  onBackgroundClick: () => void;
  highlightedEvent: HistoricalEvent | null;
  width: number;
  height: number;
  viewState: ViewState | null;
  onViewChange: (k: number, x: number) => void;
  /** When provided, overrides the internal filter state (used by presentation mode) */
  controlledVisiblePeriodIndices?: Set<number>;
  onPeriodFocus?: (period: HistoricalPeriod) => void;
}

const TIME_UNITS = [
  { label: '1 Million Years', value: 1000000 },
  { label: '100 Millennia', value: 100000 },
  { label: '10 Millennia', value: 10000 },
  { label: '1 Millennium', value: 1000 },
  { label: '1 Century', value: 100 },
  { label: '1 Decade', value: 10 },
  { label: '1 Year', value: 1 },
  { label: '1 Month', value: 1 / 12 },
  { label: '1 Week', value: 7 / 365.25 },
];

// Map time unit labels to colors
const getScaleColor = (label: string): string => {
  const colorMap: Record<string, string> = {
    '1 Million Years': EVENT_COLORS[0],  // red-500
    '100 Millennia': EVENT_COLORS[1],    // orange-500
    '10 Millennia': EVENT_COLORS[2],     // amber-500
    '1 Millennium': EVENT_COLORS[3],     // lime-500
    '1 Century': EVENT_COLORS[4],        // emerald-500
    '1 Decade': EVENT_COLORS[5],         // cyan-500
    '1 Year': EVENT_COLORS[6],           // blue-500
    '1 Month': EVENT_COLORS[7],          // indigo-500
    '1 Week': EVENT_COLORS[8],           // violet-500
  };

  return colorMap[label] || EVENT_COLORS[0];
};

// Map time unit labels to colors with transparency for grid
const getGridColor = (label: string): string => {
  const baseColor = getScaleColor(label);
  // Convert hex to rgba with transparency
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.3)`;
};

const Timeline: React.FC<TimelineProps> = ({
  periods,
  onEventClick,
  onBackgroundClick,
  highlightedEvent,
  width,
  height,
  viewState,
  onViewChange,
  controlledVisiblePeriodIndices,
  onPeriodFocus,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Period visibility state - all visible by default
  const [visiblePeriodIndices, setVisiblePeriodIndices] = useState<Set<number>>(
    () => new Set(periods.map((_, i) => i))
  );

  // Filter periods based on visibility — use external control if provided (presentation mode)
  const effectiveVisibleIndices = controlledVisiblePeriodIndices ?? visiblePeriodIndices;
  const visiblePeriods = useMemo(
    () => periods.filter((_, i) => (controlledVisiblePeriodIndices ?? visiblePeriodIndices).has(i)),
    [periods, visiblePeriodIndices, controlledVisiblePeriodIndices]
  );

  // Flatten events for easier processing (only from visible periods)
  const allEvents = useMemo(() => visiblePeriods.flatMap(p => p.events), [visiblePeriods]);

  // Time range calculation — ALWAYS use ALL periods so the scale domain stays
  // constant even when controlledVisiblePeriodIndices hides some period blocks.
  // This is critical: page.tsx handleJumpToEvent computes zoom transforms against
  // the full domain; if the domain here changes, the viewState {k, x} won't align.
  const { minYear, maxYear } = useMemo(() => {
    if (periods.length === 0) {
      return { minYear: -1600000, maxYear: 2024 };
    }
    const min = d3.min(periods, d => d.start_year) ?? -1600000;
    const max = d3.max(periods, d => d.visual_end_year) ?? 2024;
    const padding = Math.abs(max - min) * 0.05;
    return { minYear: min, maxYear: max + padding };
  }, [periods]);

  // Initial Scale
  const initialScale = useMemo(() => {
    return d3.scaleLinear()
      .domain([minYear, maxYear])
      .range([0, width]);
  }, [minYear, maxYear, width]);

  const [currentScale, setCurrentScale] = useState(() => initialScale);
  const [transformState, setTransformState] = useState(d3.zoomIdentity);

  // Setup Zoom
  useEffect(() => {
    if (!svgRef.current) return;

    // Fixed padding in screen pixels - this stays constant regardless of zoom level
    const FIXED_PADDING_PX = 150;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 100000000]) // Very deep zoom required for geological to modern times
      .on('zoom', (event) => {
        let transform = event.transform;
        const k = transform.k;

        // Calculate the scaled width of the timeline content
        // At scale k, the content spans from 0 to width*k in "zoomed" coordinates
        // The transform.x shifts the content left (negative) or right (positive)

        // When panning left (transform.x becomes more negative):
        // - The RIGHT edge of timeline (at x = width*k + transform.x in screen coords) moves left
        // - We want to stop when the right edge reaches: width - FIXED_PADDING_PX
        // - So: width*k + transform.x >= width - FIXED_PADDING_PX
        // - Therefore: transform.x >= width - FIXED_PADDING_PX - width*k

        // When panning right (transform.x becomes more positive):
        // - The LEFT edge of timeline (at x = transform.x in screen coords) moves right
        // - We want to stop when the left edge reaches: FIXED_PADDING_PX
        // - So: transform.x <= FIXED_PADDING_PX

        const minX = width - FIXED_PADDING_PX - width * k; // Most negative allowed (panned far left)
        const maxX = FIXED_PADDING_PX;                      // Most positive allowed (panned far right)

        // Clamp the transform.x to these bounds
        const clampedX = Math.max(minX, Math.min(maxX, transform.x));

        // Only update if clamping was needed
        if (clampedX !== transform.x) {
          transform = d3.zoomIdentity.translate(clampedX, transform.y).scale(k);
          // Apply the constrained transform back to the SVG (without triggering another zoom event)
          d3.select(svgRef.current!).property('__zoom', transform);
        }

        setTransformState(transform);
        const newScale = transform.rescaleX(initialScale);
        setCurrentScale(() => newScale);
        onViewChange(transform.k, transform.x);
      });

    zoomBehaviorRef.current = zoom;
    d3.select(svgRef.current).call(zoom);
  }, [width, height, initialScale, onViewChange]);

  // Sync external view state changes
  useEffect(() => {
    if (viewState && svgRef.current && zoomBehaviorRef.current) {
      const currentTransform = d3.zoomTransform(svgRef.current);
      if (Math.abs(currentTransform.k - viewState.k) > 0.001 || Math.abs(currentTransform.x - viewState.x) > 1) {
        d3.select(svgRef.current)
          .transition()
          .duration(750)
          .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(viewState.x, 0).scale(viewState.k));
      }
    }
  }, [viewState]);

  // Handle Reset Zoom
  const handleResetZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  };

  // Handle Period Toggle with Sequential Validation
  const handlePeriodToggle = (periodIndex: number) => {
    if (!canTogglePeriod(periodIndex)) return;

    setVisiblePeriodIndices(prev => {
      const newSet = new Set(prev);

      if (newSet.has(periodIndex)) {
        newSet.delete(periodIndex);
      } else {
        newSet.add(periodIndex);
      }

      return newSet;
    });

    // Reset zoom to fit the new period range
    setTimeout(() => {
      if (svgRef.current && zoomBehaviorRef.current) {
        d3.select(svgRef.current)
          .transition()
          .duration(750)
          .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
      }
    }, 50);
  };

  // Check if a period can be toggled
  const canTogglePeriod = (periodIndex: number): boolean => {
    const isCurrentlyVisible = visiblePeriodIndices.has(periodIndex);

    // Find the first visible period index
    let firstVisibleIndex = -1;
    for (let i = 0; i < periods.length; i++) {
      if (visiblePeriodIndices.has(i)) {
        firstVisibleIndex = i;
        break;
      }
    }

    if (isCurrentlyVisible) {
      // Trying to unselect
      // Cannot unselect if this is the last remaining period
      if (visiblePeriodIndices.size === 1) {
        return false;
      }

      // Can only unselect if this is the first visible period
      // This ensures we always remove from the beginning, maintaining contiguous selection
      return periodIndex === firstVisibleIndex;
    } else {
      // Trying to select
      // Can only select if this is the period directly before the first visible period
      // This ensures we can only add periods back sequentially from the top
      return periodIndex === firstVisibleIndex - 1;
    }
  };

  // Dynamic Scale Indicator Calculation
  const scaleIndicator = useMemo(() => {
    const domain = currentScale.domain();
    const range = currentScale.range();
    const rangeWidth = Math.abs(range[1] - range[0]);
    const domainWidth = Math.abs(domain[1] - domain[0]);

    if (domainWidth === 0 || rangeWidth === 0) return null;

    const pxPerYear = rangeWidth / domainWidth;

    // We aim for a bar width between 60px and 200px
    let bestUnit = TIME_UNITS.find(u => {
      const w = u.value * pxPerYear;
      return w >= 60 && w <= 200;
    });

    if (!bestUnit) {
      // Fallback: find closest to 100px
      let minDiff = Infinity;
      TIME_UNITS.forEach(u => {
        const w = u.value * pxPerYear;
        const diff = Math.abs(w - 100);
        if (diff < minDiff) {
          minDiff = diff;
          bestUnit = u;
        }
      });
    }

    if (!bestUnit) bestUnit = TIME_UNITS[0];

    return {
      label: bestUnit.label,
      width: bestUnit.value * pxPerYear
    };

  }, [currentScale, width]);

  // Layout Constants
  const EVENT_LABEL_WIDTH = 140;
  const BAR_Y_START = height / 2 - 20;
  const BAR_HEIGHT = 40;
  const LINE_Y = height / 2;

  // --- Layout Calculation for Labels ---
  const visibleEventsWithLayout = useMemo(() => {
    const visibleEvents: { event: HistoricalEvent, x: number, lane: number, hiddenLabel: boolean }[] = [];
    const sorted = [...allEvents].sort((a, b) => a.year - b.year);
    const lanes = new Map<number, number>();

    // Limit the stack depth to prevent clutter
    // Sequence: 0 (closest), then alternating up/down. Limit to +/- 2 rows (5 total)
    const ALLOWED_LANES = [0, -1, 1, -2, 2];

    sorted.forEach(evt => {
      const x = currentScale(evt.year);
      // Skip if way off screen (considering the padding)
      if (x < -200 || x > width + 200) return;

      let assignedLane = 0;
      let placed = false;

      // Determine if this is the highlighted event - we force placement if so
      const isHighlighted = highlightedEvent &&
        evt.title === highlightedEvent.title &&
        evt.year === highlightedEvent.year;

      for (const lane of ALLOWED_LANES) {
        const lastEnd = lanes.get(lane) ?? -9999;
        if (x > lastEnd + 10) {
          assignedLane = lane;
          lanes.set(lane, x + EVENT_LABEL_WIDTH);
          placed = true;
          break;
        }
      }

      // Force placement for highlighted event if it wasn't placed naturally
      if (isHighlighted && !placed) {
        assignedLane = 0; // Default to center lane
        placed = true;
      }

      visibleEvents.push({
        event: evt,
        x,
        lane: assignedLane,
        hiddenLabel: !placed
      });
    });

    return visibleEvents;
  }, [allEvents, currentScale, width, transformState, highlightedEvent]);

  // Helper for coordinates
  const getLayoutCoords = (lane: number) => {
    const isTop = lane >= 0;
    const absLane = Math.abs(lane);
    const baseOffset = 30;
    const rowHeight = 45;

    let foY = 0;
    let lineY2 = 0;

    if (isTop) {
      // Box Top
      foY = LINE_Y - baseOffset - (absLane * rowHeight) - 10;
      lineY2 = foY + 40;
    } else {
      // Box Top
      foY = LINE_Y + baseOffset + (absLane * rowHeight) - 20;
      lineY2 = foY + 10;
    }

    return { foY, lineY2, isTop };
  };

  // Helper to split text into two lines
  const splitPeriodTitle = (title: string): [string, string | null] => {
    const words = title.split(' ');
    if (words.length <= 1) return [title, null];

    const totalLen = title.length;
    let currentLen = 0;
    let breakIndex = 0;

    // Try to split roughly in half
    for (let i = 0; i < words.length; i++) {
      currentLen += words[i].length + 1;
      if (currentLen >= totalLen / 2) {
        breakIndex = i + 1;
        break;
      }
    }

    // Safety clamp
    if (breakIndex >= words.length) breakIndex = words.length - 1;
    if (breakIndex < 1) breakIndex = 1;

    const line1 = words.slice(0, breakIndex).join(' ');
    const line2 = words.slice(breakIndex).join(' ');
    return [line1, line2];
  };

  return (
    <div className="relative overflow-hidden bg-slate-50 border-b border-slate-200 shadow-inner select-none" style={{ width, height }}>

      {/* Period Filter Button - Top Left (hidden in presentation mode) */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={`absolute top-2 sm:top-4 left-2 sm:left-4 bg-white p-2 sm:p-2.5 rounded-full shadow-md border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all z-20 group touch-manipulation ${controlledVisiblePeriodIndices ? 'opacity-0 pointer-events-none' : ''}`}
            title="Filter Periods"
          >
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-700 mb-3">Timeline Periods</div>
            <div className="text-xs text-slate-500 mb-3">
              You can hide earlier periods sequentially from top to bottom
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {periods.map((period, index) => {
                const isVisible = effectiveVisibleIndices.has(index);
                const canToggle = canTogglePeriod(index);

                return (
                  <div
                    key={period.period_title}
                    className={`flex items-center space-x-2 p-2 rounded border transition-all hover:bg-slate-50 cursor-pointer ${!isVisible ? 'opacity-70' : ''}`}
                    onClick={() => onPeriodFocus?.(period)}
                  >
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                      <Checkbox
                        checked={isVisible}
                        disabled={!canToggle}
                        onCheckedChange={() => canToggle && handlePeriodToggle(index)}
                        className={canToggle ? "cursor-pointer" : "cursor-not-allowed"}
                      />
                    </div>
                    <div
                      className="w-4 h-4 rounded shrink-0"
                      style={{ backgroundColor: period.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 leading-tight">
                        {period.period_title}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {period.start_year < 0 ? `${Math.abs(period.start_year).toLocaleString()} BCE` : `${period.start_year} CE`}
                        {' → '}
                        {period.end_year < 0 ? `${Math.abs(period.end_year).toLocaleString()} BCE` : `${period.end_year} CE`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Scale Indicator */}
      {scaleIndicator && (
        <div className="absolute top-2 sm:top-4 left-16 sm:left-20 md:left-1/2 md:-translate-x-1/2 flex flex-col items-start md:items-center pointer-events-none opacity-80 z-20 transition-all duration-300">
          <div className="text-[10px] sm:text-xs font-mono text-slate-500 mb-0.5 sm:mb-1 font-bold tracking-tight bg-slate-50/80 px-1 rounded">{scaleIndicator.label}</div>
          <div className="flex items-center" style={{ width: Math.max(scaleIndicator.width, 40) }}>
            <div className="h-2 sm:h-3 w-px" style={{ backgroundColor: getScaleColor(scaleIndicator.label) }}></div>
            <div className="h-0.5 flex-1" style={{ backgroundColor: getScaleColor(scaleIndicator.label) }}></div>
            <div className="h-2 sm:h-3 w-px" style={{ backgroundColor: getScaleColor(scaleIndicator.label) }}></div>
          </div>
        </div>
      )}

      {/* Reset Zoom Button */}
      <button
        onClick={handleResetZoom}
        className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-white p-2 sm:p-2.5 rounded-full shadow-md border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all z-20 group touch-manipulation"
        title="Reset Zoom"
      >
        <Scan className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-500" />
      </button>

      {/* Popover for highlighted event - outside SVG for proper z-indexing */}
      {highlightedEvent && visibleEventsWithLayout.find(v => v.event === highlightedEvent) && (() => {
        const highlightedVisible = visibleEventsWithLayout.find(v =>
          v.event.title === highlightedEvent.title &&
          v.event.year === highlightedEvent.year
        );
        if (!highlightedVisible) return null;

        const { x, lane } = highlightedVisible;
        const { foY, isTop } = getLayoutCoords(lane);

        // Position popover above the label if label is on top, below the label if on bottom
        const popoverHeight = width < 640 ? 120 : 150; // Smaller on mobile
        const labelHeight = 50; // Height of event labels
        const arrowHeight = 10;
        const topMargin = width < 640 ? 8 : 10; // Smaller margin on mobile
        const bottomMargin = width < 640 ? 15 : 20; // Extra margin for bottom events to avoid covering markers

        let popoverY;
        if (isTop) {
          // Position above the label
          popoverY = foY - popoverHeight - arrowHeight - topMargin;
        } else {
          // Position below the label (for bottom events) with extra margin
          popoverY = foY + labelHeight + bottomMargin;
        }

        const popoverWidth = width < 640 ? 160 : 200; // Narrower on mobile

        return (
          <div
            key={`popover-${highlightedEvent.year}-${highlightedEvent.title}`}
            className="absolute z-50"
            style={{
              left: x - popoverWidth / 2,
              top: popoverY,
              width: popoverWidth,
              height: popoverHeight,
              pointerEvents: 'none'
            }}
          >
            <div className="flex flex-col items-center justify-center w-full h-full">
              <div className="bg-white/95 backdrop-blur-sm border border-slate-300 shadow-lg rounded-lg p-1.5 sm:p-2 max-w-full transform -translate-y-2">
                {/* Image */}
                <div className="w-full aspect-video bg-slate-100 rounded border border-slate-200 overflow-hidden mb-1.5 sm:mb-2">
                  <img
                    src={highlightedEvent.illustrations || `https://picsum.photos/seed/${highlightedEvent.year}/400/300`}
                    alt={highlightedEvent.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Description */}
                <div className="text-[9px] sm:text-[10px] text-slate-500 text-center font-mono leading-tight">
                  {highlightedEvent.description}
                </div>
                {/* Arrow pointing down (for top events) or up (for bottom events) */}
                {isTop ? (
                  <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2">
                    <div className="w-0 h-0 border-l-[5px] sm:border-l-[6px] border-r-[5px] sm:border-r-[6px] border-t-[5px] sm:border-t-[6px] border-l-transparent border-r-transparent border-t-white"></div>
                  </div>
                ) : (
                  <div className="absolute top-[-6px] left-1/2 transform -translate-x-1/2">
                    <div className="w-0 h-0 border-l-[5px] sm:border-l-[6px] border-r-[5px] sm:border-r-[6px] border-b-[5px] sm:border-b-[6px] border-l-transparent border-r-transparent border-b-white"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="cursor-grab active:cursor-grabbing"
        onClick={onBackgroundClick}
      >
        <defs>
          <clipPath id="chart-area">
            <rect x="-150" y="0" width={width + 300} height={height} />
          </clipPath>
          {scaleIndicator && (
            <pattern
              id="grid"
              width={scaleIndicator.width}
              height={scaleIndicator.width}
              patternUnits="userSpaceOnUse"
            >
              <rect
                width={scaleIndicator.width}
                height={scaleIndicator.width}
                fill="none"
                stroke={getGridColor(scaleIndicator.label)}
                strokeWidth="0.5"
              />
            </pattern>
          )}
        </defs>

        {/* Grid Background */}
        {scaleIndicator && (
          <rect
            x="-150"
            y="0"
            width={width + 300}
            height={height}
            fill="url(#grid)"
          />
        )}

        <g clipPath="url(#chart-area)">
          {/* 1. Draw Period Blocks (Background) — ALL periods always rendered.
               In presentation mode, locked (not-yet-revealed) periods are dimmed */}
          {periods.map((period, i) => {
            const startX = currentScale(period.start_year);
            const endX = currentScale(period.visual_end_year);
            const w = Math.max(endX - startX, 0);

            // Optimization: Don't render if off screen
            if (startX > width + 200 || endX < -200) return null;

            // Is this period currently unlocked / visible?
            const isUnlocked = effectiveVisibleIndices.has(i);
            // Locked periods shown at very low opacity — context only, no label
            const blockOpacity = isUnlocked ? 0.9 : 0.5;

            // Visibility Logic for Labels (only for unlocked periods)
            const charWidth = 6.5; // Estimated width per char for font size 10
            const fullTextWidth = period.period_title.length * charWidth;
            const padding = 24;

            let showLabel = false;
            let lines: [string, string | null] = [period.period_title, null];

            if (isUnlocked) {
              if (w > fullTextWidth + padding) {
                showLabel = true;
              } else if (w > (fullTextWidth / 2) + padding) {
                showLabel = true;
                lines = splitPeriodTitle(period.period_title);
              }
            }

            return (
              <g key={period.period_title}>
                <rect
                  x={startX}
                  y={BAR_Y_START}
                  width={w}
                  height={BAR_HEIGHT}
                  fill={period.color}
                  opacity={blockOpacity}
                  stroke="white"
                  strokeWidth={1}
                />
                {showLabel && (
                  <text
                    x={startX + w / 2}
                    y={BAR_Y_START + BAR_HEIGHT + 15}
                    fill={period.color}
                    fontWeight="bold"
                    fontSize="10"
                    textAnchor="middle"
                    opacity={0.8}
                    className="uppercase tracking-widest pointer-events-none"
                  >
                    <tspan x={startX + w / 2} dy="0">{lines[0]}</tspan>
                    {lines[1] && <tspan x={startX + w / 2} dy="1.2em">{lines[1]}</tspan>}
                  </text>
                )}
              </g>
            );
          })}

          {/* 2. Layer 1: Connector Lines (Behind everything) */}
          {visibleEventsWithLayout.map(({ event, x, lane, hiddenLabel }) => {
            if (hiddenLabel) return null;

            const isHighlighted = highlightedEvent &&
              event.title === highlightedEvent.title &&
              event.year === highlightedEvent.year;

            // In presentation mode, hide all connector lines except for the active/highlighted event.
            if (controlledVisiblePeriodIndices && !isHighlighted) return null;

            const { lineY2 } = getLayoutCoords(lane);
            return (
              <line
                key={`line-${event.year}-${event.title}`}
                x1={x} y1={LINE_Y}
                x2={x} y2={lineY2}
                stroke={event.periodColor}
                strokeWidth={1}
                strokeDasharray="2,2"
                className="opacity-50"
              />
            );
          })}

          {/* 3. Layer 2: Markers (Always visible, even if label is hidden) */}
          {visibleEventsWithLayout.map(({ event, x, hiddenLabel }) => {
            return (
              <circle
                key={`dot-${event.year}-${event.title}`}
                cx={x} cy={LINE_Y} r={3}
                fill="white" stroke={event.periodColor} strokeWidth={2}
                className="cursor-pointer hover:scale-150 transition-transform"
                onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
              />
            );
          })}

          {/* 4. Layer 3: Labels (On top of everything) - Only visible if placed */}
          {visibleEventsWithLayout.map(({ event, x, lane, hiddenLabel }) => {
            if (hiddenLabel) return null;

            const isHighlighted = highlightedEvent &&
              event.title === highlightedEvent.title &&
              event.year === highlightedEvent.year;

            // In presentation mode (indicated by controlledVisiblePeriodIndices),
            // hide all labels except the one currently active/highlighted.
            if (controlledVisiblePeriodIndices && !isHighlighted) return null;

            const { foY } = getLayoutCoords(lane);

            return (
              <foreignObject
                key={`label-${event.year}-${event.title}`}
                x={x - (EVENT_LABEL_WIDTH / 2)}
                y={foY}
                width={EVENT_LABEL_WIDTH}
                height={50}
                style={{ pointerEvents: 'none', overflow: 'visible' }}
              >
                <div className={`flex flex-col items-center justify-center w-full h-full p-1`}>
                  <div
                    className={`
                            bg-white/90 backdrop-blur-[2px] border shadow-sm rounded px-2 py-1 max-w-full 
                            hover:bg-white hover:scale-105 transition-all duration-200 pointer-events-auto cursor-pointer
                            ${isHighlighted ? 'ring-2 ring-offset-2 scale-110 z-50 shadow-lg' : 'border-slate-200'}
                          `}
                    style={{
                      borderColor: isHighlighted ? event.periodColor : undefined,
                      ['--tw-ring-color' as any]: isHighlighted ? event.periodColor : undefined
                    }}
                    onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                  >
                    <div className="text-[9px] font-bold text-slate-700 leading-tight text-center line-clamp-2 w-full break-words whitespace-normal">
                      {event.title}
                    </div>
                    <div className="text-[8px] text-slate-500 text-center font-mono mt-0.5 truncate">
                      {event.date_display}
                    </div>
                  </div>
                </div>
              </foreignObject>
            )
          })}

        </g>
      </svg>
    </div>
  );
};

export default Timeline;