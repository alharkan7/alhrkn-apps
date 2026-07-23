'use client';

import { useState, useMemo, useEffect, useTransition, useCallback, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Cell
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { logoutAdmin, getAppUsers, getAppActivities, getActivityDetails } from './actions';
import { LogOut, Activity, Database, FileText, Share2, Layers, MessageSquare, Network, Users as UsersIcon, Loader2, X, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import mermaid from 'mermaid';
import MiniPapermapRenderer from './MiniPapermapRenderer';
import { MessageList } from '@/app/chat/components/MessageList';
import MiniFlownoteRenderer from './MiniFlownoteRenderer';
import MiniDiscourseRenderer from './MiniDiscourseRenderer';
import MiniOutlinerRenderer from './MiniOutlinerRenderer';

type AppTotals = {
  papermap: number;
  beeblio: number;
  inztagram: number;
  outliner: number;
  flownote: number;
  discourse: number;
  chatSessions: number;
  totalUsers: number;
  uniqueUsersPerApp: {
    papermap: number;
    beeblio: number;
    inztagram: number;
    outliner: number;
    chat: number;
    flownote: number;
    discourse: number;
  };
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

const APP_COLORS = {
  papermap: '#0ea5e9',
  beeblio: '#0284c7',
  inztagram: '#3b82f6',
  outliner: '#6366f1',
  chat: '#8b5cf6',
  flownote: '#a855f7',
  discourse: '#d946ef',
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


function SimpleMermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!code) return;
    try {
      mermaid.initialize({ startOnLoad: false, theme: 'default' });
      mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, code).then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg;
        }
      }).catch(e => {
        if (ref.current) {
          ref.current.innerHTML = `<pre class="text-red-500 text-xs p-4 overflow-auto">${e.message || 'Syntax error'}</pre>`;
        }
      });
    } catch (e) {
      console.error('Mermaid render error', e);
    }
  }, [code]);

  return <div ref={ref} className="w-full h-full flex justify-center items-center p-4 overflow-auto min-h-[400px] [&>svg]:max-w-full [&>svg]:h-auto bg-white dark:bg-slate-900" />;
}


function ChatPreviewRenderer({ messages }: { messages: any[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  
  if (!messages || messages.length === 0) {
    return (
      <div className="p-5 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
        No messages found in this chat session.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <MessageList 
          messages={messages} 
          messagesEndRef={endRef} 
          onUpdate={() => {}} 
          isLoading={false} 
          isStreaming={false} 
        />
        <div ref={endRef} />
      </div>
    </div>
  );
}




export function ClientDashboard({ totals, timeline }: ClientDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const rangeQuery = searchParams.get('range') || '30';
  const [localTimeRange, setLocalTimeRange] = useState<string>(rangeQuery);
  const [selectedApp, setSelectedApp] = useState<string>('all');
  const [isPending, startTransition] = useTransition();
  
  useEffect(() => {
    setLocalTimeRange(rangeQuery);
  }, [rangeQuery]);
  
  // App Details Sheet State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeDetailApp, setActiveDetailApp] = useState<string | null>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [usersHasMore, setUsersHasMore] = useState(true);
  const [activitiesHasMore, setActivitiesHasMore] = useState(true);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [activityDetails, setActivityDetails] = useState<any>(null);
  const [isLoadingActivityDetails, setIsLoadingActivityDetails] = useState(false);

  // Use refs to access latest state in scroll handlers
  const stateRef = useRef({
    users,
    activities,
    usersHasMore,
    activitiesHasMore,
    isLoadingUsers,
    isLoadingActivities,
    selectedUserId,
    activeDetailApp,
    rangeQuery
  });

  useEffect(() => {
    stateRef.current = {
      users,
      activities,
      usersHasMore,
      activitiesHasMore,
      isLoadingUsers,
      isLoadingActivities,
      selectedUserId,
      activeDetailApp,
      rangeQuery
    };
  }, [users, activities, usersHasMore, activitiesHasMore, isLoadingUsers, isLoadingActivities, selectedUserId, activeDetailApp, rangeQuery]);

  const loadUsers = useCallback(async (app: string, reset = false) => {
    const s = stateRef.current;
    if (s.isLoadingUsers || (!reset && !s.usersHasMore)) return;
    
    setIsLoadingUsers(true);
    const offset = reset ? 0 : s.users.length;
    
    const res = await getAppUsers(app, s.rangeQuery, offset, 20);
    
    if (res.users) {
      if (reset) setUsers(res.users);
      else setUsers(prev => [...prev, ...res.users]);
      setUsersHasMore(res.users.length === 20);
    }
    setIsLoadingUsers(false);
  }, []);

  const loadActivities = useCallback(async (app: string, userId: string | null, reset = false) => {
    const s = stateRef.current;
    if (s.isLoadingActivities || (!reset && !s.activitiesHasMore)) return;
    
    setIsLoadingActivities(true);
    const offset = reset ? 0 : s.activities.length;
    
    const res = await getAppActivities(app, s.rangeQuery, userId, offset, 20);
    
    if (res.activities) {
      if (reset) setActivities(res.activities);
      else setActivities(prev => [...prev, ...res.activities]);
      setActivitiesHasMore(res.activities.length === 20);
    }
    setIsLoadingActivities(false);
  }, []);

  const handleCardClick = (app: string) => {
    setActiveDetailApp(app);
    setIsSheetOpen(true);
    
    setUsers([]);
    setActivities([]);
    setSelectedUserId(null);
    setSelectedActivityId(null);
    setActivityDetails(null);
    setUsersHasMore(true);
    setActivitiesHasMore(true);
    
    // Ensure state ref is updated before calling async loaders
    stateRef.current.activeDetailApp = app;
    stateRef.current.selectedUserId = null;
    stateRef.current.users = [];
    stateRef.current.activities = [];
    
    loadUsers(app, true);
    loadActivities(app, null, true);
  };

  const handleUserClick = (userId: string) => {
    if (selectedUserId === userId) {
      setSelectedUserId(null);
      stateRef.current.selectedUserId = null;
      loadActivities(activeDetailApp!, null, true);
    } else {
      setSelectedUserId(userId);
      stateRef.current.selectedUserId = userId;
      loadActivities(activeDetailApp!, userId, true);
    }
  };

  const handleActivityClick = async (activityId: string) => {
    setSelectedActivityId(activityId);
    setIsLoadingActivityDetails(true);
    setActivityDetails(null);
    
    const res = await getActivityDetails(activeDetailApp!, activityId);
    if (res.details) {
      setActivityDetails(res.details);
    }
    setIsLoadingActivityDetails(false);
  };

  const handleUsersScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (stateRef.current.activeDetailApp) {
        loadUsers(stateRef.current.activeDetailApp, false);
      }
    }
  };

  const handleActivitiesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (stateRef.current.activeDetailApp) {
        loadActivities(stateRef.current.activeDetailApp, stateRef.current.selectedUserId, false);
      }
    }
  };

  const processedTimeline = useMemo(() => {
    const grouped: Record<string, any> = {};
    const days = parseInt(rangeQuery, 10);
    
    if (!isNaN(days)) {
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = format(d, 'MMM dd');
        grouped[key] = { date: d.toISOString(), displayDate: key };
        Object.keys(APP_COLORS).forEach(app => {
          grouped[key][app] = 0;
        });
      }
    }

    timeline.forEach(curr => {
      const d = new Date(curr.date);
      if (isNaN(d.getTime())) return;
      const key = format(d, 'MMM dd');
      
      if (!grouped[key]) {
        grouped[key] = { date: curr.date, displayDate: key };
        Object.keys(APP_COLORS).forEach(app => {
          grouped[key][app] = 0;
        });
      }
      grouped[key][curr.app] = (grouped[key][curr.app] || 0) + Number(curr.count);
    });

    let data = Object.values(grouped).sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
    });
    
    return data;
  }, [timeline, rangeQuery]);

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
    
    let entries = Object.entries(apps).map(([app, count]) => ({
      app,
      count,
      fill: APP_COLORS[app as keyof typeof APP_COLORS]
    }));
    
    if (selectedApp !== 'all') {
      entries = entries.filter(e => e.app === selectedApp);
    }
    
    return entries.sort((a, b) => b.count - a.count);
  }, [totals, selectedApp]);

  const totalActivityCount = totalsData.reduce((a, b) => a + b.count, 0);

  const displayedUniqueUsers = selectedApp === 'all' 
    ? totals.totalUsers 
    : totals.uniqueUsersPerApp?.[selectedApp as keyof typeof totals.uniqueUsersPerApp] ?? 0;

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 dark:bg-slate-950 font-sans">
      {isPending && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md dark:bg-slate-950/60">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 dark:text-indigo-400 mb-4" />
          <p className="text-lg font-medium text-slate-800 dark:text-slate-200">Crunching analytics data...</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">This can take up to a minute depending on the time range.</p>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200/60 bg-white/60 px-6 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/60">
        <div className="flex items-center gap-3 font-semibold text-slate-800 dark:text-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl tracking-tight">Apps Dashboard</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Select value={selectedApp} onValueChange={setSelectedApp}>
            <SelectTrigger className="w-[120px] bg-white/50 dark:bg-slate-900/50">
              <SelectValue placeholder="App" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Apps</SelectItem>
              {Object.keys(APP_COLORS).map(app => (
                <SelectItem key={app} value={app} className="capitalize">{app}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={localTimeRange} 
            onValueChange={(val) => {
              setLocalTimeRange(val);
              const params = new URLSearchParams(searchParams.toString());
              params.set('range', val);
              startTransition(() => {
                router.push(`${pathname}?${params.toString()}`);
              });
            }}
            disabled={isPending}
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
        {/* Apps Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="flex flex-col justify-between border-slate-200/60 bg-white/80 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Unique Users</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <UsersIcon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{displayedUniqueUsers.toLocaleString()}</div>
              <p className="text-xs font-medium text-slate-500 mt-1">
                {selectedApp === 'all' ? 'Across all applications' : `Unique users for ${selectedApp}`}
              </p>
            </CardContent>
          </Card>
          
          {totalsData.map(({ app, count }) => {
            const Icon = APP_ICONS[app as keyof typeof APP_ICONS] || Activity;
            const color = APP_COLORS[app as keyof typeof APP_COLORS];
            return (
              <Card 
                key={app} 
                className="flex flex-col justify-between cursor-pointer border-slate-200/60 bg-white/80 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-slate-800/60 dark:bg-slate-900/80"
                onClick={() => handleCardClick(app)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium capitalize text-slate-600 dark:text-slate-400">
                    {app === 'chat' ? 'Chat Sessions' : app === 'discourse' ? 'Discourse' : app}
                  </CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
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
          <Card className="lg:col-span-4 min-w-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Daily creation of records across all apps</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={processedTimeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tickMargin={10} minTickGap={20} tick={{fill: '#888', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tickMargin={10} tick={{fill: '#888', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  {Object.entries(APP_COLORS).map(([app, color]) => (
                    (selectedApp === 'all' || selectedApp === app) && (
                      <Area 
                        key={app}
                        type="monotone" 
                        dataKey={app} 
                        stackId="1"
                        stroke={color} 
                        strokeWidth={2}
                        fill={color}
                        fillOpacity={0.2}
                        name={app.charAt(0).toUpperCase() + app.slice(1)}
                      />
                    )
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 min-w-0">
            <CardHeader>
              <CardTitle>Total Volume Comparison</CardTitle>
              <CardDescription>Breakdown by application ({totalActivityCount.toLocaleString()} total)</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={totalsData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
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
        <SheetContent className={`w-full flex flex-col p-0 transition-all duration-300 ${selectedActivityId ? 'sm:max-w-[80vw]' : 'sm:max-w-md'}`}>
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-950">
            <SheetHeader>
              <SheetTitle className="capitalize text-2xl flex items-center gap-3">
                {activeDetailApp && (() => {
                  const Icon = APP_ICONS[activeDetailApp as keyof typeof APP_ICONS] || Activity;
                  const color = APP_COLORS[activeDetailApp as keyof typeof APP_COLORS] || '#000';
                  return (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: color }}>
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
          </div>

          <div className="flex flex-1 min-h-0 bg-slate-50 dark:bg-slate-950/50">
            {/* Left Sidebar for Lists */}
            <div className={`${selectedActivityId ? 'w-1/3 border-r' : 'w-full'} flex flex-col border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300`}>
              
              {/* Users Section */}
              <div className="flex-1 min-h-0 flex flex-col border-b border-slate-200 dark:border-slate-800">
                <div className="p-4 font-semibold flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <span className="flex items-center gap-2"><UsersIcon className="w-4 h-4 text-slate-500" /> Users</span>
                  {selectedUserId && (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleUserClick(selectedUserId); }} className="h-6 px-2 text-xs text-slate-500 hover:text-slate-800">
                      <X className="w-3 h-3 mr-1" /> Clear Filter
                    </Button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2" onScroll={handleUsersScroll}>
                  {users.map(u => (
                    <div 
                      key={u.userId} 
                      onClick={() => handleUserClick(u.userId)}
                      className={`flex items-center justify-between p-2 rounded-md text-sm cursor-pointer border transition-colors ${selectedUserId === u.userId ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800'}`}
                    >
                      <span className="truncate max-w-[200px]" title={u.email || u.userId}>
                        {u.email ? u.email : `${u.userId.split('-')[0]}...`}
                      </span>
                      <span className="font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded shadow-sm text-xs">
                        {u.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {isLoadingUsers && <div className="text-center p-2"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></div>}
                  {!isLoadingUsers && users.length === 0 && <div className="text-sm text-slate-500 p-2">No users found.</div>}
                </div>
              </div>

              {/* Activities Section */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="p-4 font-semibold bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-500" /> Recent Activity {selectedUserId && <span className="text-xs font-normal bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full dark:bg-indigo-900 dark:text-indigo-300">Filtered</span>}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3" onScroll={handleActivitiesScroll}>
                  {(() => {
                    let renderedActivities = activities.map((a: any) => ({ ...a, isIndent: false }));
                    if (activeDetailApp === 'outliner') {
                      const queries = activities.filter(a => a.type === 'query');
                      const drafts = activities.filter(a => a.type === 'draft');
                      
                      const queryMap = new Map();
                      queries.forEach(q => queryMap.set(q.id, { ...q, isParent: true, drafts: [] }));
                      
                      const orphanDrafts: any[] = [];
                      drafts.forEach(d => {
                        if (d.queryId && queryMap.has(d.queryId)) {
                          queryMap.get(d.queryId).drafts.push(d);
                        } else {
                          orphanDrafts.push(d);
                        }
                      });
                      
                      const grouped = Array.from(queryMap.values());
                      grouped.forEach(q => {
                        q.drafts.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        const draftTimes = q.drafts.map((d: any) => new Date(d.date).getTime()).filter((t: number) => !isNaN(t));
                        const qTime = new Date(q.date).getTime();
                        q.latestTime = isNaN(qTime) ? 0 : Math.max(qTime, ...draftTimes);
                      });
                      
                      const allTopLevel = [
                        ...grouped, 
                        ...orphanDrafts.map(d => ({ 
                           ...d, 
                           latestTime: isNaN(new Date(d.date).getTime()) ? 0 : new Date(d.date).getTime() 
                        }))
                      ];
                      
                      allTopLevel.sort((a, b) => b.latestTime - a.latestTime);
                      
                      renderedActivities = [];
                      allTopLevel.forEach(item => {
                        if (item.isParent) {
                          renderedActivities.push({ ...item, isIndent: false });
                          item.drafts.forEach((d: any) => {
                            renderedActivities.push({ ...d, isIndent: true });
                          });
                        } else {
                          renderedActivities.push({ ...item, isIndent: false });
                        }
                      });
                    }

                    return renderedActivities.map(a => (
                      <div 
                        key={a.id} 
                        onClick={() => handleActivityClick(a.id)}
                        className={`flex flex-col gap-1 p-3 rounded-md border text-sm cursor-pointer transition-colors ${
                          a.isIndent ? 'ml-6 relative before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-[1px] before:bg-slate-300 dark:before:bg-slate-700' : ''
                        } ${selectedActivityId === a.id ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                          <div className="font-medium truncate text-slate-800 dark:text-slate-200 flex items-center gap-2" title={a.title}>
                            {activeDetailApp === 'outliner' && (
                              a.type === 'query' ? <Lightbulb size={14} className="text-amber-500 shrink-0" /> : <FileText size={14} className="text-blue-500 shrink-0" />
                            )}
                            <span className="truncate">{a.title}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                            <span className="truncate max-w-[120px]">
                              {a.email ? a.email : a.userId.split('-')[0]}
                            </span>
                            <span>{a.date && !isNaN(new Date(a.date).getTime()) ? format(new Date(a.date), 'MMM d, HH:mm') : ''}</span>
                          </div>
                      </div>
                    ));
                  })()}
                  {isLoadingActivities && <div className="text-center p-2"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></div>}
                  {!isLoadingActivities && activities.length === 0 && <div className="text-sm text-slate-500 p-2">No activities found.</div>}
                </div>
              </div>

            </div>

            {/* Right Sidebar for Content Detail */}
            {selectedActivityId && (
              <div className="w-2/3 flex flex-col overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950/20">
                {isLoadingActivityDetails ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  </div>
                ) : activityDetails ? (
                  <div className="space-y-6 max-w-4xl mx-auto w-full">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate" title={activityDetails.title || activityDetails.original_query || activityDetails.description || activityDetails.action || 'Untitled Activity'}>
                        {activityDetails.title || activityDetails.original_query || activityDetails.description || activityDetails.action || 'Untitled Activity'}
                      </h2>
                      <div className="flex items-center gap-2 mt-2 text-sm text-slate-500 dark:text-slate-400">
                        <span>{activityDetails.created_at || activityDetails.createdAt || activityDetails.date ? format(new Date(activityDetails.created_at || activityDetails.createdAt || activityDetails.date), 'PPpp') : 'Unknown Date'}</span>
                        <span>&bull;</span>
                        <span className="truncate max-w-[250px]" title={activityDetails.email || activityDetails.user_id || activityDetails.userId}>{activityDetails.email || activityDetails.user_id || activityDetails.userId}</span>
                      </div>
                    </div>
                    
                    
                  <div className="space-y-4">
                    
                    {activeDetailApp === 'inztagram' ? (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-2">Diagram Preview</h4>
                        <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-[400px] relative">
                          {activityDetails.mode === 'freeform' ? (
                            <div 
                              className="w-full h-[500px] flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full p-4 overflow-auto"
                              dangerouslySetInnerHTML={{ __html: activityDetails.svg_code || activityDetails.svgCode || '' }} 
                            />
                          ) : (
                            <SimpleMermaid code={activityDetails.mermaid_code || activityDetails.mermaidCode || ''} />
                          )}
                        </div>
                        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
                           <a href={`/inztagram/${activityDetails.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2 shadow-sm">
                             Open in Inztagram
                           </a>
                        </div>
                      </div>
                    ) : activeDetailApp === 'papermap' ? (
                      <div className="space-y-4">
                        {activityDetails.nodes && activityDetails.nodes.length > 0 ? (
                          <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-2">Mindmap Interactive Preview</h4>
                            <div className="p-2">
                              <MiniPapermapRenderer nodes={activityDetails.nodes} />
                            </div>
                          </div>
                        ) : (
                          <div className="p-5 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                            No nodes found for this mindmap.
                          </div>
                        )}
                        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
                           <a href={`/papermap/${activityDetails.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2 shadow-sm">
                             Open in Papermap
                           </a>
                        </div>
                      </div>
                    ) : activeDetailApp === 'beeblio' ? (
                      <div className="space-y-4">
                        {activityDetails.papers && activityDetails.papers.length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-2">References: {activityDetails.papers.length}</h4>
                            <div className="flex flex-col gap-3">
                              {activityDetails.papers.map((p: any) => (
                                <div key={p.id} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                                  <a href={p.url || '#'} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2">
                                    {p.title}
                                  </a>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
                                    <span className="font-medium capitalize">{p.source}</span>
                                    {p.year && <span>&bull; {p.year}</span>}
                                    {p.citations !== null && <span>&bull; {p.citations} citations</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="p-5 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                            No references found for this search.
                          </div>
                        )}
                        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
                           <a href={`/beeblio/${activityDetails.id}`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2 shadow-sm">
                             Open Results in Beeblio
                           </a>
                        </div>
                      </div>
                    ) : activeDetailApp === 'chat' ? (
                      <div className="space-y-4">
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-2">Chat History</h4>
                          <ChatPreviewRenderer messages={activityDetails.messages || []} />
                        </div>
                        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
                           <a href={`/chat/${activityDetails.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2 shadow-sm">
                             Open Chat Session
                           </a>
                        </div>
                      </div>
                    ) : activeDetailApp === 'flownote' ? (
                      <div className="space-y-4">
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-2">Flownote Interactive Preview</h4>
                          <MiniFlownoteRenderer nodes={activityDetails.nodes || []} edges={activityDetails.edges || []} />
                        </div>
                        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
                           <a href={`/flownote/${activityDetails.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2 shadow-sm">
                             Open in Flownote
                           </a>
                        </div>
                      </div>
                    ) : activeDetailApp === 'discourse' ? (
                      <div className="space-y-4">
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-2">Discourse Interactive Preview</h4>
                          <MiniDiscourseRenderer title={activityDetails.title} text={activityDetails.text} statements={activityDetails.statements || []} />
                        </div>
                        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
                           <a href={`/dnanalyzer`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2 shadow-sm">
                             Open in Discourse
                           </a>
                        </div>
                      </div>
                    ) : activeDetailApp === 'outliner' ? (
                      <div className="space-y-4">
                        <MiniOutlinerRenderer details={activityDetails} />
                        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
                           <a href={`/outliner/${activityDetails.type === 'query' ? 'q' : 'd'}/${activityDetails.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2 shadow-sm">
                             Open in Outliner
                           </a>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
                        <pre className="p-6 bg-slate-900 text-slate-50 text-sm overflow-x-auto">
                          <code>{JSON.stringify(activityDetails, null, 2)}</code>
                        </pre>
                      </div>
                    )}
                  </div>

                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <FileText className="w-8 h-8" />
                    </div>
                    <p className="text-lg font-medium">Select an activity</p>
                    <p className="text-sm">Click an activity from the left panel to view its details.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
