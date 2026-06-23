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

export default async function DashboardPage({ searchParams }: { searchParams: { range?: string } }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');

  if (token?.value !== 'authenticated') {
    return <LoginForm />;
  }

  const range = searchParams.range || '30';
  let dateFilter = '';
  let dateFilterAnd = '';
  let discourseDateFilter = '';
  let discourseDateFilterAnd = '';

  if (range !== 'all') {
    const days = parseInt(range, 10);
    if (!isNaN(days)) {
      dateFilter = `WHERE created_at >= NOW() - INTERVAL '${days} days'`;
      dateFilterAnd = `AND created_at >= NOW() - INTERVAL '${days} days'`;
      discourseDateFilter = `WHERE to_timestamp("date"/1000) >= NOW() - INTERVAL '${days} days'`;
      discourseDateFilterAnd = `AND to_timestamp("date"/1000) >= NOW() - INTERVAL '${days} days'`;
    }
  }

  // Fetch Totals and unique metrics
  const [
    papermapRes, beeblioRes, inztagramRes, outlinerRes, chatRes, flownoteRes, 
    discourseRes, chatMessagesRes, usersRes
  ] = await Promise.all([
    db.execute(sql.raw(`SELECT count(*) FROM mindmaps ${dateFilter}`)),
    db.execute(sql.raw(`SELECT count(*) FROM beeblio_searches ${dateFilter}`)),
    db.execute(sql.raw(`SELECT count(*) FROM inztagram_diagrams ${dateFilter}`)),
    db.execute(sql.raw(`SELECT count(*) FROM outliner_events ${dateFilter}`)),
    db.execute(sql.raw(`SELECT count(*) FROM chat_sessions ${dateFilter}`)),
    db.execute(sql.raw(`SELECT count(*) FROM flownotes ${dateFilter}`)),
    db.execute(sql.raw(`SELECT count(*) FROM dnanalyzer_documents ${discourseDateFilter}`)),
    db.execute(sql.raw(`SELECT sum(jsonb_array_length(messages)) as count FROM chat_sessions WHERE messages IS NOT NULL AND jsonb_typeof(messages) = 'array' ${dateFilterAnd}`)),
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
  ]);

  const totals = {
    papermap: parseInt(papermapRes[0]?.count as string || '0', 10),
    beeblio: parseInt(beeblioRes[0]?.count as string || '0', 10),
    inztagram: parseInt(inztagramRes[0]?.count as string || '0', 10),
    outliner: parseInt(outlinerRes[0]?.count as string || '0', 10),
    flownote: parseInt(flownoteRes[0]?.count as string || '0', 10),
    discourse: parseInt(discourseRes[0]?.count as string || '0', 10),
    chatSessions: parseInt(chatRes[0]?.count as string || '0', 10),
    chatMessages: parseInt(chatMessagesRes[0]?.count as string || '0', 10),
    totalUsers: parseInt(usersRes[0]?.count as string || '0', 10),
  };

  // Fetch Timeline Data
  const timelineRaw = await db.execute(sql.raw(`
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
      SELECT date_trunc('day', to_timestamp("date"/1000)) AS date, 'discourse' AS app FROM dnanalyzer_documents WHERE "date" IS NOT NULL ${discourseDateFilterAnd}
    )
    SELECT 
      date, 
      app, 
      COUNT(*) as count 
    FROM combined_activity 
    GROUP BY date, app 
    ORDER BY date ASC
  `));

  const timeline = timelineRaw.map(row => {
    // Ensure date is a string for serialization to Client Components
    let dateStr = row.date as string | Date;
    if (dateStr instanceof Date) {
      dateStr = dateStr.toISOString();
    }
    return {
      date: dateStr,
      app: row.app as string,
      count: parseInt(row.count as string || '0', 10),
    };
  });

  return <ClientDashboard totals={totals} timeline={timeline} />;
}
