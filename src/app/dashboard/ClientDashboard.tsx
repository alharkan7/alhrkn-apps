'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Cell
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { logoutAdmin, getAppDetails } from './actions';
import { LogOut, Activity, Database, FileText, Share2, Layers, MessageSquare, Network, Users as UsersIcon, MessageCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

type AppTotals = {
  papermap: number;
  beeblio: number;
  inztagram: number;
  outliner: number;
  flownote: number;
  discourse: number;
  chatSessions: number;
  chatMessages: number;
  totalUsers: number;
};

type TimelineData = {
  date: string;
  app: string;
  count: number;
};

interface ClientDashboardProps {
  totals: AppTotals;
  timeline: TimelineData[];
}

const APP_GRADIENTS = {
  papermap: { from: '#0284c7', to: '#38bdf8' }, // sky
  beeblio: { from: '#0369a1', to: '#0ea5e9' }, // sky dark
  inztagram: { from: '#1d4ed8', to: '#60a5fa' }, // blue
  outliner: { from: '#4338ca', to: '#818cf8' }, // indigo
  chat: { from: '#5b21b6', to: '#a78bfa' }, // violet
  flownote: { from: '#7e22ce', to: '#c084fc' }, // purple
  discourse: { from: '#a21caf', to: '#e879f9' }, // fuchsia
};

const APP_ICONS = {
  papermap: Share2,
  beeblio: Database,
  inztagram: Layers,
  outliner: FileText,
  chat: MessageSquare,
  flownote: Network,
  discourse: Database,
};

export function ClientDashboard({ totals, timeline }: ClientDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const timeRange = searchParams.get('range') || '30';
  const [selectedApp, setSelectedApp] = useState<string>('all');
  
  // App Details Sheet State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeDetailApp, setActiveDetailApp] = useState<string | null>(null);
  const [appDetails, setAppDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const handleCardClick = async (app: string) => {
    setActiveDetailApp(app);
    setIsSheetOpen(true);
    setIsLoadingDetails(true);
    setAppDetails(null);
    
    const details = await getAppDetails(app);
    setAppDetails(details);
    setIsLoadingDetails(false);
  };

  // Process timeline data for recharts AreaChart
  const processedTimeline = useMemo(() => {
    // Group by date
    const grouped = timeline.reduce((acc, curr) => {
      // Create date string formatted nicely if possible, else keep ISO
      const dateStr = curr.date;
      if (!acc[dateStr]) {
        acc[dateStr] = { date: dateStr, displayDate: format(new Date(dateStr), 'MMM dd') };
        Object.keys(APP_GRADIENTS).forEach(app => {
          acc[dateStr][app] = 0;
        });
      }
      acc[dateStr][curr.app] = Number(curr.count);
      return acc;
    }, {} as Record<string, any>);

    // The server already filters timeline data, so we just group and format it
    let data = Object.values(grouped).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return data;
  }, [timeline]);

  // Totals array for BarChart
  const totalsData = useMemo(() => {
    const apps = {
      papermap: totals.papermap,
      beeblio: totals.beeblio,
      inztagram: totals.inztagram,
      outliner: totals.outliner,
      chat: totals.chatSessions,
      flownote: totals.flownote,
      discourse: totals.discourse,
    };
    return Object.entries(apps).map(([app, count]) => ({
      app,
      count,
      fill: `url(#gradient-${app})`
    })).sort((a, b) => b.count - a.count);
  }, [totals]);

  const totalActivityCount = totalsData.reduce((a, b) => a + b.count, 0);

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 dark:bg-slate-950 font-sans">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200/60 bg-white/60 px-6 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/60">
        <div className="flex items-center gap-3 font-semibold text-slate-800 dark:text-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl tracking-tight">Apps Dashboard</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Select 
            value={timeRange} 
            onValueChange={(val) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set('range', val);
              router.push(`${pathname}?${params.toString()}`);
            }}
          >
            <SelectTrigger className="w-[150px] bg-white/50 dark:bg-slate-900/50">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => logoutAdmin()} title="Logout" className="bg-white/50 dark:bg-slate-900/50">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-8 p-6 lg:p-10 max-w-[1600px] mx-auto w-full">
        {/* Global Summary Stats */}
        <div className="flex flex-wrap justify-center gap-6">
          <Card className="flex-1 min-w-[280px] max-w-[400px] border-none bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-white/80">Total Unique Users</CardTitle>
              <UsersIcon className="h-5 w-5 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tracking-tight">{totals.totalUsers.toLocaleString()}</div>
              <p className="text-sm text-white/60 mt-1 font-medium">Across all applications</p>
            </CardContent>
          </Card>
          
          <Card className="flex-1 min-w-[280px] max-w-[400px] border-none bg-gradient-to-br from-fuchsia-500 to-rose-600 text-white shadow-xl shadow-fuchsia-500/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-white/80">Total Chat Messages</CardTitle>
              <MessageCircle className="h-5 w-5 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tracking-tight">{totals.chatMessages.toLocaleString()}</div>
              <p className="text-sm text-white/60 mt-1 font-medium">Total messages sent globally</p>
            </CardContent>
          </Card>
        </div>

        {/* Apps Grid */}
        <div className="flex flex-wrap justify-center gap-4">
          {totalsData.map(({ app, count }) => {
            const Icon = APP_ICONS[app as keyof typeof APP_ICONS] || Activity;
            const gradient = APP_GRADIENTS[app as keyof typeof APP_GRADIENTS];
            return (
              <Card 
                key={app} 
                className="flex-1 min-w-[160px] max-w-[220px] cursor-pointer border-slate-200/60 bg-white/80 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10 dark:border-slate-800/60 dark:bg-slate-900/80"
                onClick={() => handleCardClick(app)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium capitalize text-slate-600 dark:text-slate-400">
                    {app === 'chat' ? 'Chat Sessions' : app === 'discourse' ? 'Discourse' : app}
                  </CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)` }}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{count.toLocaleString()}</div>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    {app === 'papermap' ? 'Mindmaps' : 
                     app === 'beeblio' ? 'Searches' : 
                     app === 'inztagram' ? 'Diagrams' : 
                     app === 'outliner' ? 'Events' : 
                     app === 'flownote' ? 'Documents' : 
                     app === 'discourse' ? 'Documents' : 
                     'Sessions'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Daily creation of records across all apps</CardDescription>
              </div>
              <Select value={selectedApp} onValueChange={setSelectedApp}>
                <SelectTrigger className="w-[120px] bg-white/50 dark:bg-slate-900/50">
                  <SelectValue placeholder="App" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Apps</SelectItem>
                  {Object.keys(APP_GRADIENTS).map(app => (
                    <SelectItem key={app} value={app} className="capitalize">{app}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="h-[400px] w-full min-h-[400px] pb-4">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={400}>
                <AreaChart data={processedTimeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    {Object.entries(APP_GRADIENTS).map(([app, gradient]) => (
                      <linearGradient key={`color${app}`} id={`color${app}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={gradient.from} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={gradient.to} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tickMargin={10} minTickGap={20} tick={{fill: '#888', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tickMargin={10} tick={{fill: '#888', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  {Object.entries(APP_GRADIENTS).map(([app, gradient]) => (
                    (selectedApp === 'all' || selectedApp === app) && (
                      <Area 
                        key={app}
                        type="monotone" 
                        dataKey={app} 
                        stackId={selectedApp === 'all' ? "1" : undefined}
                        stroke={gradient.from} 
                        strokeWidth={2}
                        fill={`url(#color${app})`}
                        name={app.charAt(0).toUpperCase() + app.slice(1)}
                      />
                    )
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Total Volume Comparison</CardTitle>
              <CardDescription>Breakdown by application ({totalActivityCount.toLocaleString()} total)</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] w-full min-h-[400px] pb-4">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={400}>
                <BarChart data={totalsData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                  <defs>
                    {Object.entries(APP_GRADIENTS).map(([app, gradient]) => (
                      <linearGradient key={`gradient-${app}`} id={`gradient-${app}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={gradient.from} />
                        <stop offset="100%" stopColor={gradient.to} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                  <YAxis dataKey="app" type="category" axisLine={false} tickLine={false} className="capitalize" tick={{fill: '#888', fontSize: 12, fontWeight: 500}} />
                  <Tooltip 
                    cursor={{fill: 'var(--muted)', opacity: 0.4}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {totalsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </main>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="capitalize text-2xl flex items-center gap-3">
              {activeDetailApp && (() => {
                const Icon = APP_ICONS[activeDetailApp as keyof typeof APP_ICONS] || Activity;
                const gradient = APP_GRADIENTS[activeDetailApp as keyof typeof APP_GRADIENTS];
                return (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ background: `linear-gradient(135deg, ${gradient?.from || '#000'} 0%, ${gradient?.to || '#333'} 100%)` }}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                );
              })()}
              {activeDetailApp === 'chat' ? 'Chat Sessions' : activeDetailApp} Analytics
            </SheetTitle>
            <SheetDescription>
              Detailed breakdown of activities and top users.
            </SheetDescription>
          </SheetHeader>

          {isLoadingDetails ? (
            <div className="flex flex-col items-center justify-center h-40 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading details...</p>
            </div>
          ) : appDetails?.error ? (
            <div className="text-destructive p-4 bg-destructive/10 rounded-md">
              {appDetails.error}
            </div>
          ) : appDetails ? (
            <div className="space-y-8">
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <UsersIcon className="h-4 w-4 text-muted-foreground" />
                  Top Users
                </h3>
                <div className="space-y-2">
                  {appDetails.topUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No user data available.</p>
                  ) : (
                    appDetails.topUsers.map((u: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                        <span className="truncate max-w-[200px] text-muted-foreground" title={u.email || u.userId}>
                          {u.email ? u.email : `${u.userId.split('-')[0]}...`}
                        </span>
                        <span className="font-medium bg-background px-2 py-1 rounded shadow-sm">
                          {u.count.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Recent Activity
                </h3>
                <div className="space-y-3">
                  {appDetails.recentActivities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent activity available.</p>
                  ) : (
                    appDetails.recentActivities.map((a: any, i: number) => (
                      <div key={i} className="flex flex-col gap-1 p-3 rounded-md bg-muted/30 border text-sm">
                        <div className="font-medium truncate" title={a.title}>
                          {a.title}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span title={`User: ${a.email || a.userId}`} className="truncate max-w-[150px]">
                            {a.email ? a.email : `User: ${a.userId.split('-')[0]}`}
                          </span>
                          <span>
                            {a.date && !isNaN(new Date(a.date).getTime()) 
                              ? format(new Date(a.date), 'MMM d, HH:mm') 
                              : 'Unknown Date'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
