import { cookies } from 'next/headers';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { LoginForm } from './LoginForm';
import { ClientDashboard } from './ClientDashboard';

export const metadata = {
  title: 'Admin Dashboard | Alhrkn Apps',
};

// Next.js dynamic rendering
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function DashboardPage(props: { searchParams: SearchParams }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');

  if (token?.value !== 'authenticated') {
    return <LoginForm />;
  }

  const searchParams = await props.searchParams;
  const range = (searchParams.range as string) || '30';
  let dateFilter = '';
  let dateFilterAnd = '';
  let discourseDateFilter = '';
  let discourseDateFilterAnd = '';

  if (range !== 'all') {
    const days = parseInt(range, 10);
    if (!isNaN(days)) {
      dateFilter = `WHERE created_at >= NOW() - INTERVAL '${days} days'`;
      dateFilterAnd = `AND created_at >= NOW() - INTERVAL '${days} days'`;
      discourseDateFilter = `WHERE to_timestamp("date") >= NOW() - INTERVAL '${days} days'`;
      discourseDateFilterAnd = `AND to_timestamp("date") >= NOW() - INTERVAL '${days} days'`;
    }
  }

  // Fetch Totals and unique metrics in ONE query using UNION ALL
  const [appStatsRaw, allUsersRes, timelineRaw] = await Promise.all([
    db.execute(sql.raw(`
      SELECT 'papermap' as app, count(*) as total, count(DISTINCT user_id) as unique_users FROM mindmaps ${dateFilter}
      UNION ALL
      SELECT 'beeblio', count(*), count(DISTINCT user_id) FROM beeblio_searches ${dateFilter}
      UNION ALL
      SELECT 'inztagram', count(*), count(DISTINCT user_id) FROM inztagram_diagrams ${dateFilter}
      UNION ALL
      SELECT 'outliner', count(*), count(DISTINCT user_id) FROM outliner_events ${dateFilter}
      UNION ALL
      SELECT 'chat', count(*), count(DISTINCT user_id) FROM chat_sessions ${dateFilter}
      UNION ALL
      SELECT 'flownote', count(*), count(DISTINCT user_id) FROM flownotes ${dateFilter}
      UNION ALL
      SELECT 'discourse', count(*), count(DISTINCT user_id) FROM dnanalyzer_documents ${discourseDateFilter}
    `)),
    
    // Total unique users globally
    db.execute(sql.raw(`
      SELECT count(DISTINCT user_id) as count FROM (
        SELECT user_id FROM mindmaps WHERE user_id IS NOT NULL ${dateFilterAnd}
        UNION SELECT user_id FROM beeblio_searches WHERE user_id IS NOT NULL ${dateFilterAnd}
        UNION SELECT user_id FROM inztagram_diagrams WHERE user_id IS NOT NULL ${dateFilterAnd}
        UNION SELECT user_id FROM outliner_events WHERE user_id IS NOT NULL ${dateFilterAnd}
        UNION SELECT user_id FROM chat_sessions WHERE user_id IS NOT NULL ${dateFilterAnd}
        UNION SELECT user_id FROM flownotes WHERE user_id IS NOT NULL ${dateFilterAnd}
        UNION SELECT user_id FROM dnanalyzer_documents WHERE user_id IS NOT NULL ${discourseDateFilterAnd}
      ) as users
    `)),

    // Fetch Timeline Data
    db.execute(sql.raw(`
      WITH combined_activity AS (
        SELECT date_trunc('day', created_at) AS date, 'papermap' AS app FROM mindmaps WHERE created_at IS NOT NULL ${dateFilterAnd}
        UNION ALL
        SELECT date_trunc('day', created_at) AS date, 'beeblio' AS app FROM beeblio_searches WHERE created_at IS NOT NULL ${dateFilterAnd}
        UNION ALL
        SELECT date_trunc('day', created_at) AS date, 'inztagram' AS app FROM inztagram_diagrams WHERE created_at IS NOT NULL ${dateFilterAnd}
        UNION ALL
        SELECT date_trunc('day', created_at) AS date, 'outliner' AS app FROM outliner_events WHERE created_at IS NOT NULL ${dateFilterAnd}
        UNION ALL
        SELECT date_trunc('day', created_at) AS date, 'chat' AS app FROM chat_sessions WHERE created_at IS NOT NULL ${dateFilterAnd}
        UNION ALL
        SELECT date_trunc('day', created_at) AS date, 'flownote' AS app FROM flownotes WHERE created_at IS NOT NULL ${dateFilterAnd}
        UNION ALL
        SELECT date_trunc('day', to_timestamp("date")) AS date, 'discourse' AS app FROM dnanalyzer_documents WHERE "date" IS NOT NULL ${discourseDateFilterAnd}
      )
      SELECT 
        date, 
        app, 
        COUNT(*) as count 
      FROM combined_activity 
      GROUP BY date, app 
      ORDER BY date ASC
    `))
  ]);

  const statsMap = appStatsRaw.reduce((acc, row) => {
    acc[row.app as string] = {
      total: parseInt(row.total as string || '0', 10),
      unique: parseInt(row.unique_users as string || '0', 10),
    };
    return acc;
  }, {} as Record<string, { total: number; unique: number }>);

  const getStat = (app: string): { total: number; unique: number } => {
    const stat = (statsMap as any)[app];
    return stat ? { total: Number(stat.total), unique: Number(stat.unique) } : { total: 0, unique: 0 };
  };

  const totals = {
    papermap: getStat('papermap').total,
    beeblio: getStat('beeblio').total,
    inztagram: getStat('inztagram').total,
    outliner: getStat('outliner').total,
    flownote: getStat('flownote').total,
    discourse: getStat('discourse').total,
    chatSessions: getStat('chat').total,
    totalUsers: parseInt(allUsersRes[0]?.count as string || '0', 10),
    uniqueUsersPerApp: {
      papermap: getStat('papermap').unique,
      beeblio: getStat('beeblio').unique,
      inztagram: getStat('inztagram').unique,
      outliner: getStat('outliner').unique,
      chat: getStat('chat').unique,
      flownote: getStat('flownote').unique,
      discourse: getStat('discourse').unique,
    }
  };

  const timeline = timelineRaw.map(row => {
    // Ensure date is a string for serialization to Client Components
    let dateStr = row.date;
    if (dateStr instanceof Date) {
      dateStr = dateStr.toISOString();
    } else if (typeof dateStr === 'string' || typeof dateStr === 'number') {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString();
      } else {
        dateStr = String(dateStr);
      }
    } else {
      dateStr = String(dateStr);
    }
    return {
      date: dateStr as string,
      app: row.app as string,
      count: parseInt(row.count as string || '0', 10),
    };
  });

  return <ClientDashboard totals={totals} timeline={timeline} />;
}
