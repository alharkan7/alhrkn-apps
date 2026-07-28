"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
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
import { Play, Download, RefreshCw, ChevronLeft, Menu, Plus, ChevronDown, Video, Image as ImageIcon, ChevronRight, Send, Loader2, MessageSquare, X, ChevronUp, Code } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  datasets: {
    type?: 'line' | 'bar' | 'area' | 'bubble' | 'scatter';
    label: string;
    data: any[];
    backgroundColor?: string;
    borderColor?: string;
    yAxisID?: string;
  }[];
  customOptions?: any;
}

interface AnimatedChartViewerProps {
  id: string;
  initialData: ChartData;
  initialVersions?: { chartData: any; createdAt: Date }[];
}

const EDITORIAL_COLORS = [
  { border: '#1f4e79', bg: 'rgba(31, 78, 121, 0.2)' }, // Navy (Primary)
  { border: '#b22222', bg: 'rgba(178, 34, 34, 0.2)' }, // Editorial Red
  { border: '#d2a679', bg: 'rgba(210, 166, 121, 0.2)' }, // Tan
  { border: '#607d8b', bg: 'rgba(96, 125, 139, 0.2)' }, // Slate
  { border: '#8c8c8c', bg: 'rgba(140, 140, 140, 0.2)' }, // Grey
];

export function AnimatedChartViewer({ id, initialData, initialVersions = [] }: AnimatedChartViewerProps) {
  const [versions, setVersions] = useState<{ chartData: any; createdAt: Date }[]>(
    initialVersions.length > 0 ? initialVersions : [{ chartData: initialData, createdAt: new Date() }]
  );
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0); // 0 is latest
  const currentData = versions[currentVersionIndex].chartData as ChartData;
  const [chatInput, setChatInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    chatEndRefMobile.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isSidebarOpen]);
  
  // Custom Line Reveal Plugin
  const lineRevealPlugin: Plugin = useMemo(() => ({
    id: 'lineReveal',
    beforeDatasetsDraw(chart: any) {
      if (currentData.type !== 'line') return;
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      
      if (!chart._revealStartTime) {
        chart._revealStartTime = Date.now();
      }
      
      const duration = 2500;
      const elapsed = Date.now() - chart._revealStartTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
  
      ctx.save();
      ctx.beginPath();
      ctx.rect(chartArea.left, chartArea.top, chartArea.width * easeProgress, chartArea.height);
      ctx.clip();
      
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
      if (currentData.type !== 'line') return;
      chart.ctx.restore();
    }
  }), [currentData.type]);

  // Force reset start time on re-render
  useEffect(() => {
    if (chartRef.current && currentData.type === 'line') {
       chartRef.current._revealStartTime = null;
    }
  }, [chartKey, currentData.type]);

  const chartJsData = {
    labels: currentData.labels,
    datasets: currentData.datasets.map((ds, index) => {
      const color = EDITORIAL_COLORS[index % EDITORIAL_COLORS.length];
      const dsType = ds.type || (currentData.type === 'mixed' ? 'bar' : currentData.type);
      const isLineStyle = dsType === 'line' || dsType === 'area';
      return {
        ...ds,
        type: dsType === 'area' ? 'line' : dsType,
        borderWidth: isLineStyle ? 3 : 1,
        tension: 0.4, 
        backgroundColor: ds.backgroundColor || (isLineStyle ? color.bg : color.border),
        borderColor: ds.borderColor || color.border,
        fill: dsType === 'area' ? true : (currentData.type === 'line' ? true : undefined),
        borderRadius: dsType === 'bar' ? 3 : undefined,
        pointRadius: isLineStyle ? 0 : undefined,
        pointHoverRadius: isLineStyle ? 6 : undefined,
      };
    })
  };

  const isLine = currentData.type === 'line';
  const isPie = ['pie', 'doughnut'].includes(currentData.type);
  const isRadar = ['radar', 'polarArea'].includes(currentData.type);
  const hasAxes = !isPie && !isRadar;

  const baseChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: currentData.orientation === 'horizontal' ? 'y' : 'x',
    animation: isLine ? false : { // Disable native animation for line charts to use custom plugin
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
      }
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
        position: currentData.orientation === 'horizontal' ? 'left' : 'right',
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

  // Check if any dataset uses 'y1' axis
  const usesDualAxis = currentData.datasets.some(ds => ds.yAxisID === 'y1');
  if (usesDualAxis && baseChartOptions.scales) {
    baseChartOptions.scales.y1 = {
      type: 'linear',
      position: currentData.orientation === 'horizontal' ? 'bottom' : 'right',
      grid: { drawOnChartArea: false },
      ticks: { 
        color: isDark ? '#94a3b8' : '#777777',
        font: { family: "'Helvetica Neue', Arial, sans-serif", size: 11 }
      }
    };
  }

  // Safely sanitize customOptions to prevent null overrides that crash Chart.js
  const safeCustomOptions = { ...(currentData.customOptions || {}) };
  if (safeCustomOptions.plugins === null || typeof safeCustomOptions.plugins !== 'object') delete safeCustomOptions.plugins;
  if (safeCustomOptions.scales === null || typeof safeCustomOptions.scales !== 'object') delete safeCustomOptions.scales;
  if (safeCustomOptions.animation === null || typeof safeCustomOptions.animation !== 'object') delete safeCustomOptions.animation;

  const chartOptions = merge({}, baseChartOptions, safeCustomOptions);

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
    const duration = isLine ? 2500 : 2000;
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
    const chartType = currentData.type === 'mixed' ? 'bar' : currentData.type;
    
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
      plugins: isLine ? [lineRevealPlugin] : []
    };
    
    switch (currentData.type) {
      case 'mixed':
      case 'bar': return <Bar {...props} />;
      case 'pie': return <Pie {...props} />;
      case 'doughnut': return <Doughnut {...props} />;
      case 'radar': return <Radar {...props} />;
      case 'polarArea': return <PolarArea {...props} />;
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

  const renderActionButtons = (isMobile: boolean) => (
    <>
      <Button 
        variant="outline" 
        size={isMobile ? "icon" : "default"}
        onClick={handleReplay}
        disabled={isRecording}
        className={`bg-card border-border text-foreground hover:bg-muted transition-colors rounded-full shadow-sm ${!isMobile ? 'px-5' : ''}`}
        title="Replay Animation"
      >
        <Play className={`w-4 h-4 ${!isMobile ? 'mr-2' : ''}`} /> {!isMobile && 'Replay'}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline"
            disabled={isRecording}
            size={isMobile ? "icon" : "default"}
            className={`bg-card border-border text-foreground hover:bg-muted transition-colors rounded-full shadow-sm ${!isMobile ? 'px-5' : ''}`}
            title="Download"
          >
            {isRecording ? (
              <>
                <RefreshCw className={`w-4 h-4 ${!isMobile ? 'mr-2' : ''} animate-spin`} /> {!isMobile && 'Recording...'}
              </>
            ) : (
              <>
                <Download className={`w-4 h-4 ${!isMobile ? 'mr-2' : ''}`} /> {!isMobile && <>Download <ChevronDown className="w-4 h-4 ml-1" /></>}
              </>
            )}
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
    </>
  );

  const renderVersionNav = () => (
    <div className="flex items-center justify-between bg-card border border-border rounded-lg p-1.5 shadow-sm shrink-0">
      <Button
        variant="ghost"
        size="icon"
        disabled={currentVersionIndex === versions.length - 1}
        onClick={(e) => {
          e.stopPropagation();
          setCurrentVersionIndex(prev => prev + 1);
          setChartKey(prev => prev + 1);
        }}
        className="w-7 h-7 rounded-md hover:bg-muted"
        title="Undo (Previous Version)"
      >
        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
      </Button>
      <div className="text-xs font-medium text-muted-foreground tabular-nums px-2">
        v{versions.length - currentVersionIndex} of {versions.length}
      </div>
      <Button
        variant="ghost"
        size="icon"
        disabled={currentVersionIndex === 0}
        onClick={(e) => {
          e.stopPropagation();
          setCurrentVersionIndex(prev => prev - 1);
          setChartKey(prev => prev + 1);
        }}
        className="w-7 h-7 rounded-md hover:bg-muted"
        title="Redo (Next Version)"
      >
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground overflow-hidden relative font-sans">
      <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/10 dark:bg-violet-500/5 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange-500/10 dark:bg-orange-500/5 blur-[150px] mix-blend-multiply dark:mix-blend-screen" />
      </div>

      <div className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border">
        <AppsHeader
          leftButton={(
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-muted sidebar-toggle" onClick={() => window.dispatchEvent(new Event('toggleAnimaChartHistorySidebar'))}>
                <Menu size={20} />
              </Button>
              <Button variant="secondary" aria-label="Create new chart" onClick={() => router.push('/animachart')} className="bg-card hover:bg-muted text-foreground border border-border">
                <Plus className="size-4 mr-1" /> New
              </Button>
            </div>
          )}
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-start items-center max-w-[1400px] mx-auto w-full px-4 pt-20 pb-20 md:pb-16">
        
        {/* MOBILE: Title & Action Buttons */}
        <div className="w-full flex md:hidden items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-medium text-muted-foreground truncate">
            Motion Chart Preview
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {renderActionButtons(true)}
          </div>
        </div>

        <div className="w-full flex flex-col md:flex-row gap-6 items-start h-full">
          
          {/* LEFT AREA: Chart */}
          <div className={`flex flex-col gap-4 transition-all duration-300 ${isSidebarOpen ? 'w-full md:w-[calc(100%-350px-1.5rem)]' : 'w-full'}`}>
            
            {/* DESKTOP: Title & Action Buttons */}
            <div className="hidden md:flex w-full items-center justify-between gap-4">
              <h2 className="text-xl font-medium text-muted-foreground">
                Motion Chart Preview
              </h2>
              <div className="flex items-center gap-3">
                {renderActionButtons(false)}
                
                {/* Collapsed Sidebar Header Items */}
                {!isSidebarOpen && (
                  <div className="flex items-center gap-3 ml-2 pl-4 border-l border-border">
                    {versions.length > 1 && renderVersionNav()}
                    <Button 
                      onClick={() => setIsSidebarOpen(true)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md border-0 transition-all rounded-full px-5"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" /> Edit Chart
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Chart Container */}
            <div className="w-full bg-card border border-border rounded-xl p-4 md:p-12 shadow-sm flex items-center justify-center min-h-[400px]">
              <div className="relative w-full aspect-square sm:aspect-video md:aspect-[21/9]">
                 <div key={chartKey} className="w-full h-full relative">
                    {renderChart()}
                 </div>
              </div>
            </div>

          </div>

          {/* RIGHT AREA: Desktop Chat Interface */}
          {isSidebarOpen && (
            <div className="hidden md:flex w-[350px] shrink-0 flex-col h-[calc(100vh-140px)] sticky top-20 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
                {versions.length > 1 ? renderVersionNav() : <span className="text-sm font-semibold text-muted-foreground px-2">Edit Chart</span>}
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
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {versions.length > 1 && renderVersionNav()}
          </div>
          <div className="flex items-center gap-2 pointer-events-none">
            {!isSidebarOpen && (
              <div className="bg-primary text-primary-foreground shadow-sm rounded-full py-2 px-4 flex items-center text-sm font-medium">
                <MessageSquare className="w-4 h-4 mr-2" /> Edit
              </div>
            )}
            <Button variant="ghost" size="icon" className="pointer-events-none text-muted-foreground w-8 h-8">
              {isSidebarOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </Button>
          </div>
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
