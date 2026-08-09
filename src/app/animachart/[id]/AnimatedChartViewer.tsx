"use client";

import { Component, ReactNode, useState, useRef, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  Filler,
  Plugin,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut, Radar, PolarArea, Bubble, Scatter } from 'react-chartjs-2';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Play, Download, RefreshCw, ChevronLeft, Menu, ChevronDown, Video, Image as ImageIcon, ChevronRight, Send, Loader2, Pencil, X, ChevronUp, Code } from 'lucide-react';
import { AppsHeader } from '@/components/apps-header';
import { merge } from 'lodash';
import AppsFooter from '@/components/apps-footer';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { sanitizeAnimachartCustomOptions } from '@/lib/animachart-sanitize';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend
);

interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'mixed' | 'bubble' | 'scatter';
  orientation?: 'vertical' | 'horizontal';
  title: string;
  labels: string[];
  presentationLabels?: PresentationLabelOptions;
  datasets: {
    type?: 'line' | 'bar' | 'area' | 'bubble' | 'scatter';
    label: string;
    data: any[];
    tension?: number;
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    yAxisID?: string;
  }[];
  customOptions?: any;
}

interface PresentationLabelOptions {
  enabled?: boolean;
  showPercentages?: boolean;
  showValues?: boolean;
  showCategoryLabels?: boolean;
  showLeaderLines?: boolean;
  decimals?: number;
}

interface AnimatedChartViewerProps {
  id: string;
  initialData: ChartData;
  initialVersions?: { chartData: any; createdAt: Date }[];
}

class ChartRenderErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Animachart render failed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[320px] w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
          <div className="max-w-md space-y-2">
            <p className="font-semibold text-foreground">This chart could not be rendered.</p>
            <p className="text-sm text-muted-foreground">The chart edit returned an unsupported setting. Try editing the chart again or replaying the animation.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const EDITORIAL_COLORS = [
  { border: '#1f4e79', bg: 'rgba(31, 78, 121, 0.2)' }, // Navy (Primary)
  { border: '#b22222', bg: 'rgba(178, 34, 34, 0.2)' }, // Editorial Red
  { border: '#d2a679', bg: 'rgba(210, 166, 121, 0.2)' }, // Tan
  { border: '#607d8b', bg: 'rgba(96, 125, 139, 0.2)' }, // Slate
  { border: '#8c8c8c', bg: 'rgba(140, 140, 140, 0.2)' }, // Grey
];

const CHART_REVEAL_DURATION = 2500;
const RADIAL_STROKE_WIDTH = 1;
const RADIAL_FILL_OPACITY = 0.2;

const getDatasetMagnitude = (data: any[]) => data.reduce((total, point) => {
  const value = typeof point === 'number' ? point : point?.y;
  return total + (typeof value === 'number' && Number.isFinite(value) ? Math.abs(value) : 0);
}, 0);

const getRadialValue = (point: any) => {
  if (typeof point === 'number' && Number.isFinite(point)) return point;
  if (point && typeof point.y === 'number' && Number.isFinite(point.y)) return point.y;
  if (point && typeof point.r === 'number' && Number.isFinite(point.r)) return point.r;
  return 0;
};

const withAlpha = (color: unknown, alpha: number, fallback: string) => {
  if (typeof color !== 'string') return fallback;
  const value = color.trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const expanded = hex[1].length === 3
      ? hex[1].split('').map(channel => channel + channel).join('')
      : hex[1];
    const red = parseInt(expanded.slice(0, 2), 16);
    const green = parseInt(expanded.slice(2, 4), 16);
    const blue = parseInt(expanded.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  const rgb = value.match(/^rgba?\(\s*([^,]+),\s*([^,]+),\s*([^,\)]+)(?:,\s*[^\)]+)?\)$/i);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;

  return fallback;
};

const getNumericChartValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && Number.isFinite(Number(value))) return Number(value);
  if (value && typeof value === 'object' && 'y' in value) {
    const y = (value as { y?: unknown }).y;
    if (typeof y === 'number' && Number.isFinite(y)) return y;
  }
  return 0;
};

const getRgbColor = (color: unknown) => {
  if (typeof color !== 'string') return null;
  const value = color.trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const expanded = hex[1].length === 3
      ? hex[1].split('').map(channel => channel + channel).join('')
      : hex[1];
    return {
      red: parseInt(expanded.slice(0, 2), 16),
      green: parseInt(expanded.slice(2, 4), 16),
      blue: parseInt(expanded.slice(4, 6), 16),
    };
  }

  const rgb = value.match(/^rgba?\(\s*([^,]+),\s*([^,]+),\s*([^,)]+)(?:,\s*[^)]+)?\)$/i);
  if (!rgb) return null;
  const [red, green, blue] = [rgb[1], rgb[2], rgb[3]].map(Number);
  return [red, green, blue].every(channel => Number.isFinite(channel))
    ? { red, green, blue }
    : null;
};

const getPresentationTextColor = (backgroundColor: unknown) => {
  const rgb = getRgbColor(backgroundColor);
  if (!rgb) return '#ffffff';
  const luminance = (0.299 * rgb.red + 0.587 * rgb.green + 0.114 * rgb.blue) / 255;
  return luminance > 0.58 ? '#111827' : '#ffffff';
};

const formatPresentationNumber = (value: number, decimals: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const presentationLabelsPlugin: Plugin = {
  id: 'presentationLabels',
  afterDatasetsDraw(chart: any) {
    if (!['pie', 'doughnut', 'polarArea'].includes(chart.config?.type)) return;

    const options = chart.options?.plugins?.presentationLabels as PresentationLabelOptions | undefined;
    if (!options?.enabled) return;

    const dataset = chart.data?.datasets?.[0];
    const arcs = chart.getDatasetMeta(0)?.data || [];
    if (!dataset || arcs.length === 0) return;

    const values = (dataset.data || []).map(getNumericChartValue);
    const total = values.reduce((sum: number, value: number) => sum + Math.max(value, 0), 0);
    if (total <= 0) return;

    const labels = chart.data.labels || [];
    const backgroundColors = Array.isArray(dataset.backgroundColor)
      ? dataset.backgroundColor
      : [];
    const decimals = Math.max(0, Math.min(2, options.decimals ?? 0));
    const showPercentages = options.showPercentages === true;
    const showValues = options.showValues === true;
    const showCategoryLabels = options.showCategoryLabels === true;
    const showLeaderLines = options.showLeaderLines !== false;
    const fontSize = 11;
    const lineHeight = 14;
    const chartArea = chart.chartArea;
    const canvasWidth = chart.width;
    if (!chartArea) return;

    const legendOptions = chart.options?.plugins?.legend?.labels || {};
    const legendFont = legendOptions.font || {};
    const fontFamily = typeof legendFont.family === 'string'
      ? legendFont.family
      : "'Helvetica Neue', Arial, sans-serif";
    const fontWeight = legendFont.weight || 500;

    const callouts: {
      anchorX: number;
      anchorY: number;
      side: -1 | 1;
      lines: string[];
      lineColor: string;
      y: number;
    }[] = [];
    const insideLabels: {
      x: number;
      y: number;
      text: string;
      color: string;
    }[] = [];

    arcs.forEach((arc: any, index: number) => {
      const value = Math.max(values[index] || 0, 0);
      if (value <= 0) return;

      const props = arc.getProps(
        ['x', 'y', 'startAngle', 'endAngle', 'innerRadius', 'outerRadius'],
        true
      );
      const x = Number(props.x);
      const y = Number(props.y);
      const innerRadius = Number(props.innerRadius) || 0;
      const outerRadius = Number(props.outerRadius) || 0;
      const startAngle = Number(props.startAngle);
      const endAngle = Number(props.endAngle);
      const angle = (startAngle + endAngle) / 2;
      const angleSpan = Math.abs(endAngle - startAngle);
      if (![x, y, outerRadius, startAngle, endAngle].every(Number.isFinite) || outerRadius <= 0) return;

      const percentage = (value / total) * 100;
      const percentageText = `${formatPresentationNumber(percentage, decimals)}%`;
      const backgroundColor = backgroundColors[index] || dataset.backgroundColor || '#1f4e79';
      const textColor = getPresentationTextColor(backgroundColor);
      const canFitInside = angleSpan >= 0.2 && outerRadius - innerRadius >= 16;

      if (showPercentages && canFitInside) {
        const labelRadius = innerRadius + (outerRadius - innerRadius) * 0.55;
        insideLabels.push({
          x: x + Math.cos(angle) * labelRadius,
          y: y + Math.sin(angle) * labelRadius,
          text: percentageText,
          color: textColor,
        });
      }

      const lines: string[] = [];
      if (showCategoryLabels) lines.push(String(labels[index] || `Segment ${index + 1}`));
      if (showValues) lines.push(formatPresentationNumber(value, decimals));
      if (showPercentages && !canFitInside) lines.push(percentageText);
      if (lines.length === 0) return;

      const anchorRadius = outerRadius + 4;
      callouts.push({
        anchorX: x + Math.cos(angle) * anchorRadius,
        anchorY: y + Math.sin(angle) * anchorRadius,
        side: Math.cos(angle) >= 0 ? 1 : -1,
        lines,
        lineColor: withAlpha(backgroundColor, 0.72, '#64748b'),
        y: y + Math.sin(angle) * anchorRadius,
      });
    });

    const layoutCallouts = (side: -1 | 1) => {
      const sideCallouts = callouts
        .filter(callout => callout.side === side)
        .sort((a, b) => a.y - b.y);
      const minY = chartArea.top + lineHeight;
      const maxY = chartArea.bottom - lineHeight;
      const gap = lineHeight * 2 + 4;

      sideCallouts.forEach((callout, index) => {
        callout.y = Math.max(callout.y, index === 0 ? minY : sideCallouts[index - 1].y + gap);
      });
      for (let index = sideCallouts.length - 1; index >= 0; index -= 1) {
        const nextY = index === sideCallouts.length - 1 ? maxY : sideCallouts[index + 1].y - gap;
        sideCallouts[index].y = Math.min(sideCallouts[index].y, nextY);
      }
    };

    layoutCallouts(-1);
    layoutCallouts(1);

    const legendColor = chart.options?.plugins?.legend?.labels?.color;
    const outsideTextColor = typeof legendColor === 'string' ? legendColor : '#334155';
    const leftLabelX = Math.max(10, chartArea.left - 12);
    const rightLabelX = Math.min(canvasWidth - 10, chartArea.right + 12);

    chart.ctx.save();
    chart.ctx.lineWidth = 1;
    chart.ctx.lineJoin = 'round';
    chart.ctx.textBaseline = 'middle';

    if (showLeaderLines) {
      callouts.forEach(callout => {
        const labelX = callout.side === 1 ? rightLabelX : leftLabelX;
        const elbowX = callout.side === 1
          ? Math.min(canvasWidth - 10, chartArea.right + 2)
          : Math.max(10, chartArea.left - 2);
        chart.ctx.strokeStyle = callout.lineColor;
        chart.ctx.globalAlpha = 0.85;
        chart.ctx.beginPath();
        chart.ctx.moveTo(callout.anchorX, callout.anchorY);
        chart.ctx.lineTo(elbowX, callout.y);
        chart.ctx.lineTo(labelX + (callout.side === 1 ? -4 : 4), callout.y);
        chart.ctx.stroke();
      });
    }

    chart.ctx.globalAlpha = 1;
    callouts.forEach(callout => {
      const labelX = callout.side === 1 ? rightLabelX : leftLabelX;
      chart.ctx.textAlign = callout.side === 1 ? 'right' : 'left';
      callout.lines.forEach((line, lineIndex) => {
        const isValueLine = callout.lines.length > 1 && lineIndex === callout.lines.length - 1;
        chart.ctx.font = `${isValueLine ? 600 : fontWeight} ${fontSize}px ${fontFamily}`;
        chart.ctx.fillStyle = outsideTextColor;
        chart.ctx.fillText(
          line,
          labelX,
          callout.y + (lineIndex - (callout.lines.length - 1) / 2) * lineHeight
        );
      });
    });

    insideLabels.forEach(label => {
      chart.ctx.textAlign = 'center';
      chart.ctx.font = `700 ${fontSize}px ${fontFamily}`;
      chart.ctx.lineWidth = 3;
      chart.ctx.strokeStyle = label.color === '#ffffff' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.65)';
      chart.ctx.strokeText(label.text, label.x, label.y);
      chart.ctx.fillStyle = label.color;
      chart.ctx.fillText(label.text, label.x, label.y);
    });

    chart.ctx.restore();
  },
};

export function AnimatedChartViewer({ id, initialData, initialVersions = [] }: AnimatedChartViewerProps) {
  const [versions, setVersions] = useState<{ chartData: any; createdAt: Date }[]>(
    initialVersions.length > 0 ? initialVersions : [{ chartData: initialData, createdAt: new Date() }]
  );
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0); // 0 is latest
  const currentData = versions[currentVersionIndex].chartData as ChartData;
  const [chatInput, setChatInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const chartRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [chartKey, setChartKey] = useState(0); 
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // New state for layout and chat
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', text: string}[]>([
    { role: 'assistant', text: 'Here is your motion chart! What would you like to change?' }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatEndRefMobile = useRef<HTMLDivElement>(null);

  const isLine = currentData.type === 'line';
  const isPie = ['pie', 'doughnut'].includes(currentData.type);
  const isRadar = ['radar', 'polarArea'].includes(currentData.type);
  const isPolygonalPolarArea = currentData.type === 'polarArea' && currentData.datasets.length > 1;
  const shouldUseRadarRenderer = currentData.type === 'radar' || isPolygonalPolarArea;
  const isRadialChart = isPie || (currentData.type === 'polarArea' && !isPolygonalPolarArea);
  const isHorizontal = currentData.orientation === 'horizontal';
  const hasAxes = !isPie && !isRadar;
  const datasetTypes = new Set(
    currentData.datasets.map(ds => {
      if (ds.type === 'area') return 'line';
      return ds.type || (currentData.type === 'mixed' ? 'bar' : currentData.type);
    })
  );
  const isMixedChart = currentData.type === 'mixed' || datasetTypes.size > 1;
  const shouldRevealChart = isLine || isMixedChart;
  const usesDualYAxis = currentData.datasets.some(ds => ds.yAxisID === 'y1');
  const areaOrderByIndex = new Map(
    currentData.datasets
      .map((ds, index) => ({
        index,
        magnitude: getDatasetMagnitude(ds.data),
        isArea: shouldUseRadarRenderer || ds.type === 'area' || (currentData.type === 'line' && (!ds.type || ds.type === 'line')),
      }))
      .filter(dataset => dataset.isArea)
      .sort((a, b) => a.magnitude - b.magnitude || a.index - b.index)
      .map((dataset, order) => [dataset.index, order])
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    chatEndRefMobile.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isSidebarOpen]);
  
  // Deterministic reveal used for line and mixed charts.
  const lineRevealPlugin: Plugin = useMemo(() => ({
    id: 'chartReveal',
    beforeDatasetsDraw(chart: any) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      
      if (!chart._revealStartTime) {
        chart._revealStartTime = Date.now();
      }
      
      const duration = CHART_REVEAL_DURATION;
      const elapsed = Date.now() - chart._revealStartTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
  
      ctx.save();
      ctx.beginPath();
      ctx.rect(chartArea.left, chartArea.top, chartArea.width * easeProgress, chartArea.height);
      ctx.clip();
      chart._revealClipActive = true;
      
      if (progress < 1) {
        requestAnimationFrame(() => {
          if (chart && chart.canvas && chart.ctx) {
            try {
              chart.update('none');
            } catch (e) {}
          }
        });
      }
    },
    afterDatasetsDraw(chart: any) {
      if (chart._revealClipActive) {
        chart.ctx.restore();
        chart._revealClipActive = false;
      }
    }
  }), []);

  // Force reset start time on re-render
  useEffect(() => {
    if (chartRef.current && shouldRevealChart) {
       chartRef.current._revealStartTime = null;
       chartRef.current._revealClipActive = false;
    }
  }, [chartKey, shouldRevealChart]);

  const radialDataset = (() => {
    const onePointPerDataset = currentData.datasets.length > 1
      && currentData.datasets.every(ds => ds.data.length === 1);
    const values = onePointPerDataset
      ? currentData.datasets.map(ds => getRadialValue(ds.data[0]))
      : currentData.labels.map((_, labelIndex) => currentData.datasets.reduce(
        (total, ds) => total + getRadialValue(ds.data[labelIndex]),
        0
      ));
    const datasetLabels = currentData.datasets.map(ds => ds.label).filter(Boolean);
    const labels = currentData.labels.length === values.length
      ? currentData.labels
      : datasetLabels.length === values.length
        ? datasetLabels
        : values.map((_, index) => `Segment ${index + 1}`);
    const sourceDatasets = onePointPerDataset ? currentData.datasets : [currentData.datasets[0]];
    const backgroundColor = values.map((_, index) => {
      const source = sourceDatasets[index] || sourceDatasets[0];
      const sourceColors = source?.backgroundColor;
      return Array.isArray(sourceColors) && sourceColors.length > 0
        ? sourceColors[index % sourceColors.length]
        : EDITORIAL_COLORS[index % EDITORIAL_COLORS.length].border;
    });

    return {
      labels,
      dataset: {
        label: datasetLabels.join(' / '),
        data: values,
        backgroundColor,
        borderColor: values.map(() => isDark ? '#020817' : '#ffffff'),
        borderWidth: 1,
      },
    };
  })();

  const chartJsData = {
    labels: isRadialChart ? radialDataset.labels : currentData.labels,
    datasets: isRadialChart ? [radialDataset.dataset] : currentData.datasets.map((ds, index) => {
      const color = EDITORIAL_COLORS[index % EDITORIAL_COLORS.length];
      const dsType = shouldUseRadarRenderer
        ? 'radar'
        : ds.type || (currentData.type === 'mixed' ? 'bar' : currentData.type);
      const isLineStyle = dsType === 'line' || dsType === 'area';
      const customLineTension = currentData.customOptions?.elements?.line?.tension;
      const lineTension = currentData.type === 'radar'
        ? 0
        : typeof ds.tension === 'number'
          ? ds.tension
          : typeof customLineTension === 'number'
            ? customLineTension
            : 0;
      const sourceBackgroundColor = Array.isArray(ds.backgroundColor)
        ? ds.backgroundColor[0]
        : ds.backgroundColor;
      const sourceBorderColor = Array.isArray(ds.borderColor)
        ? ds.borderColor[0]
        : ds.borderColor;
      const isFilledPolygon = isLineStyle || shouldUseRadarRenderer;
      const fillColor = withAlpha(
        sourceBackgroundColor || color.border,
        shouldUseRadarRenderer ? RADIAL_FILL_OPACITY : 0.25,
        color.bg
      );
      const areaOrder = areaOrderByIndex.get(index);
      const lineOrder = -(currentData.datasets.length + 1);
      const barOrder = currentData.datasets.length + 1;
      // Chart.js draws higher order values first, so they sit behind lower
      // order values. Keep lines above bars and smaller filled areas above
      // larger ones without changing legend or dataset order.
      const drawOrder = isMixedChart
        ? dsType === 'line'
          ? lineOrder
          : dsType === 'bar'
            ? barOrder
            : areaOrder ?? 0
        : areaOrder;
      return {
        ...ds,
        type: dsType === 'area' ? 'line' : dsType,
        ...(drawOrder === undefined ? {} : { order: drawOrder }),
        borderWidth: shouldUseRadarRenderer ? RADIAL_STROKE_WIDTH : isLineStyle ? 3 : 1,
        tension: isLineStyle ? lineTension : undefined,
        backgroundColor: isFilledPolygon ? fillColor : (ds.backgroundColor || color.border),
        borderColor: sourceBorderColor || color.border,
        fill: shouldUseRadarRenderer || dsType === 'area' || currentData.type === 'line' ? true : undefined,
        borderRadius: dsType === 'bar' ? 3 : undefined,
        pointRadius: isLineStyle ? 0 : undefined,
        pointHoverRadius: isLineStyle ? 6 : undefined,
      };
    })
  };

  const baseChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: currentData.orientation === 'horizontal' ? 'y' : 'x',
    animation: shouldRevealChart ? false : {
      duration: 2000,
      easing: 'easeOutQuart' as const,
      animateScale: isPie ? false : true,
      animateRotate: true,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'start' as const,
        labels: {
          usePointStyle: true,
          color: isDark ? '#e2e8f0' : '#333333',
          font: { family: "'Helvetica Neue', Arial, sans-serif", size: 12, weight: '500' }
        }
      },
      title: {
        display: !!currentData.title,
        text: currentData.title,
        color: isDark ? '#f8fafc' : '#111111',
        align: 'start' as const,
        font: { family: "Georgia, serif", size: 24, weight: 'normal' as const },
        padding: { bottom: 20 }
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#f8fafc' : '#111',
        bodyColor: isDark ? '#cbd5e1' : '#333',
        borderColor: isDark ? '#334155' : '#ddd',
        borderWidth: 1,
        padding: 12,
        titleFont: { family: "'Helvetica Neue', Arial, sans-serif", size: 13, weight: 'bold' },
        bodyFont: { family: "'Helvetica Neue', Arial, sans-serif", size: 13 },
        boxPadding: 4,
        usePointStyle: true
      },
      presentationLabels: currentData.presentationLabels || { enabled: false }
    },
    scales: hasAxes ? {
      x: {
        position: currentData.orientation === 'horizontal' ? 'bottom' : 'bottom',
        grid: {
          display: currentData.orientation === 'horizontal',
          color: isDark ? '#334155' : '#ededed',
        },
        border: {
          display: currentData.orientation === 'horizontal' ? false : true,
          color: isDark ? '#475569' : '#111111',
          width: 1.5,
        },
        ticks: { 
          color: isDark ? '#94a3b8' : '#555555',
          font: { family: "'Helvetica Neue', Arial, sans-serif", size: 11 }
        }
      },
      y: {
        type: usesDualYAxis ? 'linear' : undefined,
        position: usesDualYAxis || isHorizontal ? 'left' : 'right',
        grid: { 
          display: currentData.orientation === 'horizontal' ? false : true,
          color: isDark ? '#334155' : '#ededed',
          drawBorder: false,
        },
        border: {
          display: currentData.orientation === 'horizontal' ? true : false,
          color: isDark ? '#475569' : '#111111',
          width: 1.5,
        },
        ticks: { 
          color: isDark ? '#94a3b8' : '#777777',
          font: { family: "'Helvetica Neue', Arial, sans-serif", size: 11 }
        }
      }
    } : undefined
  };

  if (usesDualYAxis && baseChartOptions.scales) {
    baseChartOptions.scales.y1 = {
      type: 'linear',
      position: 'right',
      grid: { drawOnChartArea: false },
      ticks: { 
        color: isDark ? '#94a3b8' : '#777777',
        font: { family: "'Helvetica Neue', Arial, sans-serif", size: 11 }
      }
    };
  }

  // Keep model-generated options behind a strict boundary. Chart.js ignores
  // most unknown nested keys, but null core option objects can crash its
  // resolver (for example, layout: null).
  const safeCustomOptions = sanitizeAnimachartCustomOptions(currentData.customOptions);
  const chartOptions = merge({}, baseChartOptions, safeCustomOptions);

  // A dual-axis chart must reserve one side for each value scale. Enforce this
  // after custom options are merged so model-generated options cannot put both
  // sets of tick labels on the same side.
  if (usesDualYAxis && chartOptions.scales) {
    const yScale = chartOptions.scales.y && typeof chartOptions.scales.y === 'object'
      ? chartOptions.scales.y
      : {};
    const y1Scale = chartOptions.scales.y1 && typeof chartOptions.scales.y1 === 'object'
      ? chartOptions.scales.y1
      : {};

    chartOptions.scales.y = {
      ...yScale,
      type: 'linear',
      position: 'left',
    };
    chartOptions.scales.y1 = {
      ...y1Scale,
      type: 'linear',
      position: 'right',
      grid: {
        ...(y1Scale.grid && typeof y1Scale.grid === 'object' ? y1Scale.grid : {}),
        drawOnChartArea: false,
      },
    };
  }

  const handleReplay = () => {
    setChartKey(prev => prev + 1);
  };

  const downloadImage = (format: 'png' | 'jpeg') => {
    if (!chartRef.current) return;
    const originalCanvas = chartRef.current.canvas;
    
    const PADDING = 60;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalCanvas.width + (PADDING * 2);
    tempCanvas.height = originalCanvas.height + (PADDING * 2);
    const ctx = tempCanvas.getContext('2d')!;
    
    if (format === 'jpeg') {
      ctx.fillStyle = isDark ? '#020817' : '#ffffff';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    }
    
    ctx.drawImage(originalCanvas, PADDING, PADDING);
    const url = tempCanvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', 1.0);

    const a = document.createElement('a');
    a.href = url;
    a.download = `animachart-${currentData.type}.${format === 'jpeg' ? 'jpg' : 'png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadVideo = async (format: 'webm' | 'mp4') => {
    if (!chartRef.current) return;
    setIsRecording(true);
    setChartKey(prev => prev + 1);
    await new Promise(r => setTimeout(r, 100)); // wait for reset and new canvas to mount
    
    if (!chartRef.current) {
      setIsRecording(false);
      return;
    }
    const originalCanvas = chartRef.current.canvas;
    
    // Feature detection for iOS Safari which historically lacks captureStream
    if (typeof originalCanvas.captureStream !== 'function') {
      alert("Video export is not supported on this browser (e.g., iOS Safari). Please try using a desktop browser or Android.");
      setIsRecording(false);
      return;
    }

    const PADDING = 60;
    const wrapperCanvas = document.createElement('canvas');
    wrapperCanvas.width = originalCanvas.width + (PADDING * 2);
    wrapperCanvas.height = originalCanvas.height + (PADDING * 2);
    const wrapperCtx = wrapperCanvas.getContext('2d')!;
    
    const stream = wrapperCanvas.captureStream(60);
    let mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm;codecs=vp9';
    
    // Fallback if requested format is not supported
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (format === 'mp4' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
        alert('MP4 recording is not natively supported by your browser. Falling back to WebM.');
      } else {
        // Just let it use browser default if both fail
        mimeType = ''; 
      }
    }
    
    const recorder = new MediaRecorder(stream, { mimeType: mimeType || undefined });
    
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = (mimeType || '').includes('mp4') ? 'mp4' : 'webm';
      a.download = `animachart-${currentData.type}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsRecording(false);
    };
    
    // Custom loop to draw original canvas over white background with padding
    let animationFrameId: number;
    const renderLoop = () => {
      wrapperCtx.fillStyle = isDark ? '#020817' : '#ffffff';
      wrapperCtx.fillRect(0, 0, wrapperCanvas.width, wrapperCanvas.height);
      wrapperCtx.drawImage(originalCanvas, PADDING, PADDING);
      if (recorder.state === 'recording') {
        animationFrameId = requestAnimationFrame(renderLoop);
      }
    };
    
    recorder.start();
    renderLoop();
    
    // Duration
    const duration = shouldRevealChart ? CHART_REVEAL_DURATION : 2000;
    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
        cancelAnimationFrame(animationFrameId);
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    }, duration + 1000);
  };

  const copyHtmlSource = async () => {
    // We recreate a simplified type string since the component handles mixed/area differently
    const chartType = currentData.type === 'mixed'
      ? 'bar'
      : shouldUseRadarRenderer
        ? 'radar'
        : currentData.type;
    
    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${currentData.title || 'Motion Chart'}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background-color: ${isDark ? '#020817' : '#ffffff'};
            color: ${isDark ? '#f8fafc' : '#0f172a'};
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 2rem;
        }
        .chart-container {
            width: 100%;
            max-width: 1000px;
            aspect-ratio: 21 / 9;
        }
        @media (max-width: 768px) {
            .chart-container {
                aspect-ratio: 16 / 9;
            }
        }
    </style>
</head>
<body>
    <div class="chart-container">
        <canvas id="myChart"></canvas>
    </div>

    <script>
        const ctx = document.getElementById('myChart').getContext('2d');
        const config = {
            type: '${chartType}',
            data: ${JSON.stringify(chartJsData, null, 4)},
            options: ${JSON.stringify(chartOptions, null, 4)}
        };

        new Chart(ctx, config);
    </script>
</body>
</html>`;

    try {
      await navigator.clipboard.writeText(htmlTemplate);
      toast.success('HTML code copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy source code.');
    }
  };

  const renderChart = () => {
    const props: any = {
      ref: chartRef,
      data: chartJsData,
      options: chartOptions,
      plugins: [
        ...(shouldRevealChart ? [lineRevealPlugin] : []),
        presentationLabelsPlugin,
      ]
    };
    
    switch (currentData.type) {
      case 'mixed':
      case 'bar': return <Bar {...props} />;
      case 'pie': return <Pie {...props} />;
      case 'doughnut': return <Doughnut {...props} />;
      case 'radar': return <Radar {...props} />;
      case 'polarArea': return shouldUseRadarRenderer ? <Radar {...props} /> : <PolarArea {...props} />;
      case 'bubble': return <Bubble {...props} />;
      case 'scatter': return <Scatter {...props} />;
      case 'line':
      default:
        return <Line {...props} />;
    }
  };

  const handleEditSubmit = async () => {
    if (!chatInput.trim() || isEditing) return;
    const userMessage = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }, { role: 'assistant', text: 'Updating chart...' }]);
    setChatInput('');
    setIsEditing(true);
    
    try {
      const res = await fetch(`/api/animachart/${id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to edit chart');
      }
      
      const data = await res.json();
      setVersions(prev => [{ chartData: data.chartData, createdAt: new Date() }, ...prev]);
      setCurrentVersionIndex(0);
      setChartKey(prev => prev + 1); // trigger re-render and re-animation
      
      setChatMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: 'assistant', text: 'Chart updated successfully.' };
        return newMsgs;
      });
    } catch (err) {
      console.error(err);
      setChatMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: 'assistant', text: 'Error updating chart. Please try again.' };
        return newMsgs;
      });
    } finally {
      setIsEditing(false);
    }
  };

  const renderVersionNav = () => (
    <div className="flex items-center gap-0.5 border-l border-black/[0.08] pl-1 dark:border-white/[0.1]">
      <Button
        variant="ghost"
        size="icon"
        disabled={currentVersionIndex === versions.length - 1}
        onClick={(e) => {
          e.stopPropagation();
          setCurrentVersionIndex(prev => prev + 1);
          setChartKey(prev => prev + 1);
        }}
        className="size-8 rounded-lg text-black/55 hover:bg-black/[0.06] hover:text-[#191918] dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white"
        title="Undo (Previous Version)"
        aria-label="Previous version"
      >
        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={currentVersionIndex === 0}
        onClick={(e) => {
          e.stopPropagation();
          setCurrentVersionIndex(prev => prev - 1);
          setChartKey(prev => prev + 1);
        }}
        className="size-8 rounded-lg text-black/55 hover:bg-black/[0.06] hover:text-[#191918] dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white"
        title="Redo (Next Version)"
        aria-label="Next version"
      >
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Button>
    </div>
  );

  const renderDownloadButton = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          disabled={isRecording}
          className="h-9 max-sm:w-9 rounded-xl border-black/[0.07] bg-black/[0.025] px-3 max-sm:px-0 text-black/65 shadow-none hover:bg-black/[0.06] hover:text-black dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/65 dark:hover:bg-white/[0.08] dark:hover:text-white"
          title={isRecording ? 'Recording animation' : 'Download chart'}
          aria-label={isRecording ? 'Recording animation' : 'Download chart'}
        >
          {isRecording ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="max-sm:hidden">{isRecording ? 'Recording…' : 'Download'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-card text-foreground border-border">
        <DropdownMenuItem onClick={() => handleDownloadVideo('webm')} className="cursor-pointer hover:bg-muted focus:bg-muted">
          <Video className="w-4 h-4 mr-2 text-muted-foreground" />
          <span>WebM (Web Video)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDownloadVideo('mp4')} className="cursor-pointer hover:bg-muted focus:bg-muted">
          <Video className="w-4 h-4 mr-2 text-muted-foreground" />
          <span>MP4 (Safari/iOS)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadImage('png')} className="cursor-pointer hover:bg-muted focus:bg-muted">
          <ImageIcon className="w-4 h-4 mr-2 text-muted-foreground" />
          <span>PNG (Transparent)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadImage('jpeg')} className="cursor-pointer hover:bg-muted focus:bg-muted">
          <ImageIcon className="w-4 h-4 mr-2 text-muted-foreground" />
          <span>JPEG Image</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyHtmlSource} className="cursor-pointer hover:bg-muted focus:bg-muted">
          <Code className="w-4 h-4 mr-2 text-muted-foreground" />
          <span>Code (HTML)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderChartControls = () => (
    <div className="static z-10 mb-3 flex w-auto shrink-0 self-end items-center justify-end gap-0.5 rounded-xl border border-black/[0.08] bg-[#f7f7f5]/90 p-1 shadow-[0_4px_16px_rgba(25,25,24,0.08)] backdrop-blur-md dark:border-white/[0.1] dark:bg-[#10100f]/90 dark:shadow-[0_4px_16px_rgba(0,0,0,0.25)] md:absolute md:right-3 md:top-3 md:mb-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleReplay}
        disabled={isRecording}
        className="size-8 rounded-lg text-black/60 hover:bg-black/[0.06] hover:text-[#191918] dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
        title="Replay animation"
        aria-label="Replay animation"
      >
        <Play className="size-4" />
      </Button>
      {versions.length > 1 && renderVersionNav()}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsSidebarOpen(true)}
        className="size-8 rounded-lg text-black/60 hover:bg-black/[0.06] hover:text-[#191918] dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
        title="Edit chart"
        aria-label="Edit chart"
      >
        <Pencil className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#f7f7f5] font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">

      <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-[#f7f7f5]/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10100f]/80">
        <AppsHeader
          leftButton={(
            <Button
              variant="ghost"
              size="icon"
              className="sidebar-toggle size-9 rounded-xl text-black/60 hover:bg-black/[0.06] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
              onClick={() => window.dispatchEvent(new Event('toggleAnimaChartHistorySidebar'))}
              aria-label="Open chart history"
            >
              <Menu size={18} />
            </Button>
          )}
          title={(
            <Link
              href="/animachart"
              title="Back to Motion Chart"
              className="inline-flex items-center text-sm font-semibold tracking-[-0.01em] text-[#191918] no-underline transition-opacity hover:opacity-65 dark:text-[#f2f2ef]"
            >
              Motion Chart
            </Link>
          )}
          rightContent={renderDownloadButton()}
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-start items-center w-full max-w-6xl px-2 md:px-4 pt-20 pb-20 md:pb-16 mx-auto">
        <div className="w-full flex flex-col md:flex-row gap-6 items-start h-full">
          
          {/* LEFT AREA: Chart */}
          <div className={`flex flex-col gap-4 transition-all duration-300 ${isSidebarOpen ? 'w-full md:w-[calc(100%-350px-1.5rem)]' : 'w-full'}`}>
            
            {/* Chart Container */}
            <div className="relative flex min-h-[400px] w-full flex-col items-center justify-center rounded-xl border border-border bg-card p-4 shadow-sm md:h-[calc(100vh-160px)] md:flex-row md:p-6 lg:p-8">
              {renderChartControls()}
              <div className="relative w-full h-full aspect-square sm:aspect-video md:aspect-auto">
                  <div key={`${chartKey}-${currentVersionIndex}`} className="w-full h-full relative">
                    <ChartRenderErrorBoundary>
                      {renderChart()}
                    </ChartRenderErrorBoundary>
                  </div>
              </div>
            </div>

          </div>

          {/* RIGHT AREA: Desktop Chat Interface */}
          {isSidebarOpen && (
            <div className="hidden md:flex w-[350px] shrink-0 flex-col h-[calc(100vh-160px)] sticky top-20 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
                <span className="px-2 text-sm font-semibold text-muted-foreground">Edit</span>
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-muted/10">
                 {chatMessages.map((msg, i) => (
                   <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card border border-border text-foreground rounded-bl-none shadow-sm'}`}>
                       {msg.text}
                     </div>
                   </div>
                 ))}
                 <div ref={chatEndRef} />
              </div>
              
              {/* Input Area */}
              <div className="p-3 border-t border-border bg-card">
                <div className="flex flex-col gap-2 focus-within:ring-2 focus-within:ring-ring rounded-xl bg-muted/30 border border-border p-2 transition-all shadow-sm">
                  <Textarea 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask to change colors, flip to a bar chart..."
                    className="w-full min-h-[60px] max-h-[200px] resize-none border-0 focus-visible:ring-0 px-2 py-1 shadow-none text-sm bg-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleEditSubmit();
                      }
                    }}
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleEditSubmit} 
                      disabled={!chatInput.trim() || isEditing || currentVersionIndex !== 0}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 shadow-sm disabled:opacity-50"
                      title={currentVersionIndex !== 0 ? "You can only edit the latest version" : ""}
                    >
                      {isEditing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Send className="w-3 h-3 mr-2" />}
                      {isEditing ? "Editing..." : "Edit"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE: Bottom Chat Sheet */}
      <div 
        className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-40 transition-transform duration-300"
        style={{
          transform: isSidebarOpen ? 'translateY(0)' : 'translateY(calc(100% - 60px - max(env(safe-area-inset-bottom), 24px)))',
          paddingBottom: 'max(env(safe-area-inset-bottom), 24px)'
        }}
      >
        <div className="h-[60px] px-4 flex items-center justify-between border-b border-border bg-muted/30 cursor-pointer" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          <span className="text-sm font-semibold text-foreground">Edit chart</span>
          <Button variant="ghost" size="icon" className="pointer-events-none h-8 w-8 text-muted-foreground">
            {isSidebarOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </Button>
        </div>
        <div className="h-[50vh] flex flex-col bg-muted/10">
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
             {chatMessages.map((msg, i) => (
               <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card border border-border text-foreground rounded-bl-none shadow-sm'}`}>
                   {msg.text}
                 </div>
               </div>
             ))}
             <div ref={chatEndRefMobile} />
          </div>
          <div className="p-3 border-t border-border bg-card pb-safe">
            <div className="flex flex-col gap-2 focus-within:ring-2 focus-within:ring-ring rounded-xl bg-muted/30 border border-border p-2 shadow-sm">
              <Textarea 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask to change colors, flip to a bar chart..."
                className="w-full min-h-[60px] max-h-[150px] resize-none border-0 focus-visible:ring-0 px-2 py-1 shadow-none text-sm bg-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleEditSubmit();
                  }
                }}
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleEditSubmit} 
                  disabled={!chatInput.trim() || isEditing || currentVersionIndex !== 0}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 shadow-sm disabled:opacity-50"
                  title={currentVersionIndex !== 0 ? "You can only edit the latest version" : ""}
                >
                  {isEditing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Send className="w-3 h-3 mr-2" />}
                  {isEditing ? "Editing..." : "Edit"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:block fixed bottom-0 left-0 right-0 py-1 px-0 text-center text-muted-foreground text-xs bg-background/60 backdrop-blur-md z-50 border-t border-border">
        <AppsFooter />
      </div>
    </div>
  );
}
