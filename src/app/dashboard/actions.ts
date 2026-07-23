'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function loginAdmin(password: string) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    return { error: 'Admin password is not configured in .env' };
  }
  
  if (password === adminPassword) {
    const cookieStore = await cookies();
    cookieStore.set('admin_token', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/dashboard',
    });
    revalidatePath('/dashboard');
    return { success: true };
  } else {
    return { error: 'Invalid password' };
  }
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_token');
  revalidatePath('/dashboard');
}

function getAppTableInfo(app: string) {
  let table = '';
  let dateCol = 'created_at';
  let titleCol = 'id';
  switch (app) {
    case 'papermap': table = 'mindmaps'; titleCol = 'title'; break;
    case 'beeblio': table = 'beeblio_searches'; titleCol = 'original_query'; break;
    case 'inztagram': table = 'inztagram_diagrams'; titleCol = 'description'; break;
    case 'outliner': table = 'outliner_events'; titleCol = 'action'; break;
    case 'flownote': table = 'flownotes'; titleCol = 'title'; break;
    case 'chat': table = 'chat_sessions'; titleCol = 'title'; break;
    case 'discourse': table = 'dnanalyzer_documents'; titleCol = 'title'; dateCol = 'null'; break;
  }
  return { table, dateCol, titleCol };
}

function getDateFilter(range: string, dateCol: string, hasWhere = false) {
  if (range === 'all') return '';
  const days = parseInt(range, 10);
  if (isNaN(days)) return '';
  const col = dateCol === 'null' ? 't."date"' : `t.${dateCol}`;
  const timeExp = dateCol === 'null' ? `to_timestamp(${col})` : col;
  const keyword = hasWhere ? 'AND' : 'WHERE';
  return `${keyword} ${timeExp} >= NOW() - INTERVAL '${days} days'`;
}

export async function getAppUsers(app: string, range: string, offset = 0, limit = 20) {
  const { table, dateCol } = getAppTableInfo(app);
  if (!table) return { error: 'Unknown app' };

  const dateFilter = getDateFilter(range, dateCol, true);
  
  try {
    const query = `
      SELECT t.user_id, u.email, count(*) as count 
      FROM ${table} t
      LEFT JOIN auth.users u ON t.user_id = u.id
      WHERE t.user_id IS NOT NULL ${dateFilter}
      GROUP BY t.user_id, u.email
      ORDER BY count DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    const users = await db.execute(sql.raw(query));
    
    return {
      users: users.map(u => ({
        userId: String(u.user_id),
        email: u.email ? String(u.email) : null,
        count: Number(u.count)
      }))
    };
  } catch (error) {
    console.error('Failed to fetch app users:', error);
    return { error: 'Failed to fetch users' };
  }
}

export async function getAppActivities(app: string, range: string, userId: string | null = null, offset = 0, limit = 20) {
  const { table, dateCol, titleCol } = getAppTableInfo(app);
  if (!table) return { error: 'Unknown app' };

  let conditions = [];
  if (userId) {
    conditions.push(`t.user_id = '${userId}'`);
  }
  
  if (range !== 'all') {
    const days = parseInt(range, 10);
    if (!isNaN(days)) {
      const timeExp = dateCol === 'null' ? 'to_timestamp(t."date")' : `t.${dateCol}`;
      conditions.push(`${timeExp} >= NOW() - INTERVAL '${days} days'`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderCol = dateCol === 'null' ? 't."date"' : `t.${dateCol}`;
  const selectDate = dateCol === 'null' ? 't."date"' : `t.${dateCol}`;
  
  try {
    let query = '';
    
    if (app === 'outliner') {
      query = `
        SELECT t.id, t.user_id, u.email, t.title, t.created_at, t.type, t.query_id
        FROM (
          SELECT id, user_id, keywords as title, created_at, 'query' as type, null as query_id FROM outliner_queries
          UNION ALL
          SELECT id, user_id, title, created_at, 'draft' as type, query_id FROM outliner_drafts
        ) t
        LEFT JOIN auth.users u ON t.user_id = u.id
        ${whereClause.replace(/t\./g, 't.')}
        ORDER BY t.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = `
        SELECT t.id, t.user_id, u.email, t.${titleCol} as title, ${selectDate} as created_at, null as query_id
        FROM ${table} t
        LEFT JOIN auth.users u ON t.user_id = u.id
        ${whereClause}
        ORDER BY ${orderCol} DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    
    const activities = await db.execute(sql.raw(query));
    
    return {
      activities: activities.map(a => ({
        id: String(a.id),
        userId: String(a.user_id),
        email: a.email ? String(a.email) : null,
        title: String(a.title || 'Untitled'),
        date: String(a.created_at),
        type: a.type ? String(a.type) : undefined,
        queryId: a.query_id ? String(a.query_id) : undefined
      }))
    };
  } catch (error) {
    console.error('Failed to fetch app activities:', error);
    return { error: 'Failed to fetch activities' };
  }
}

export async function getActivityDetails(app: string, activityId: string) {
  const { table } = getAppTableInfo(app);
  if (!table) return { error: 'Unknown app' };
  
  try {
    const isIntId = app === 'discourse';
    const idVal = isIntId ? parseInt(activityId, 10) : `'${activityId}'`;
    
    let details: any = null;
    
    if (app === 'outliner') {
      const queryQuery = `
        SELECT t.*, 'query' as type, u.email 
        FROM outliner_queries t
        LEFT JOIN auth.users u ON t.user_id = u.id
        WHERE t.id = ${idVal}
        LIMIT 1
      `;
      const queryRows = await db.execute(sql.raw(queryQuery));
      
      if (queryRows.length > 0) {
        details = queryRows[0];
      } else {
        const draftQuery = `
          SELECT t.*, 'draft' as type, u.email 
          FROM outliner_drafts t
          LEFT JOIN auth.users u ON t.user_id = u.id
          WHERE t.id = ${idVal}
          LIMIT 1
        `;
        const draftRows = await db.execute(sql.raw(draftQuery));
        if (draftRows.length > 0) {
          details = draftRows[0];
        }
      }
    } else {
      const query = `
        SELECT t.*, u.email 
        FROM ${table} t
        LEFT JOIN auth.users u ON t.user_id = u.id
        WHERE t.id = ${idVal}
        LIMIT 1
      `;
      const rows = await db.execute(sql.raw(query));
      if (rows.length > 0) details = rows[0];
    }
    
    if (!details) return { error: 'Not found' };
    
    if (app === 'beeblio') {
      const papersQuery = `
        SELECT id, title, authors, year, source, citations, url
        FROM beeblio_papers
        WHERE search_id = ${idVal}
        ORDER BY citations DESC NULLS LAST
        LIMIT 50
      `;
      const papers = await db.execute(sql.raw(papersQuery));
      details.papers = papers;
    } else if (app === 'papermap') {
      const nodesQuery = `
        SELECT node_id as "id", title, description, parent_id as "parentId", level, page_number as "pageNumber"
        FROM mindmap_nodes
        WHERE mindmap_id = ${idVal}
        ORDER BY level ASC
      `;
      const nodes = await db.execute(sql.raw(nodesQuery));
      details.nodes = nodes;
    } else if (app === 'chat' && details.messages) {
      let messages = details.messages;
      if (typeof messages === 'string') {
        try { messages = JSON.parse(messages); } catch(e) {}
      }
      if (Array.isArray(messages) && messages.length > 0) {
        const { getBucket } = await import('@/lib/storage/client');
        const bucket = getBucket();
        for (const msg of messages) {
            if (Array.isArray(msg.content)) {
                for (const part of msg.content) {
                    if (part.type === 'image_url' && part.image_url?.filePath) {
                        try {
                            const [url] = await bucket.file(part.image_url.filePath).getSignedUrl({
                                version: 'v4', action: 'read', expires: Date.now() + 12 * 60 * 60 * 1000,
                            });
                            part.image_url.url = url;
                        } catch (e) {}
                    } else if (part.type === 'file_url' && part.file_url?.filePath) {
                        try {
                            const [url] = await bucket.file(part.file_url.filePath).getSignedUrl({
                                version: 'v4', action: 'read', expires: Date.now() + 12 * 60 * 60 * 1000,
                            });
                            part.file_url.url = url;
                        } catch (e) {}
                    }
                }
            }
        }
        details.messages = messages;
      }
    } else if (app === 'flownote') {
      if (typeof details.nodes === 'string') {
        try { details.nodes = JSON.parse(details.nodes); } catch(e) {}
      }
      if (typeof details.edges === 'string') {
        try { details.edges = JSON.parse(details.edges); } catch(e) {}
      }
    } else if (app === 'discourse') {
      const statementsQuery = `
        SELECT
          s.id as "ID",
          s.start as "startIndex",
          s.stop as "endIndex",
          COALESCE(p_entity.value, '') as "actor",
          COALESCE(o_entity.value, '') as "organization",
          COALESCE(c_entity.value, '') as "concept",
          CASE WHEN agreement.value = 1 THEN true ELSE false END as "agree"
        FROM dnanalyzer_statements s
        LEFT JOIN dnanalyzer_data_short_text p_data ON s.id = p_data.statement_id AND p_data.variable_id = 1
        LEFT JOIN dnanalyzer_entities p_entity ON p_data.entity = p_entity.id
        LEFT JOIN dnanalyzer_data_short_text o_data ON s.id = o_data.statement_id AND o_data.variable_id = 2
        LEFT JOIN dnanalyzer_entities o_entity ON o_data.entity = o_entity.id
        LEFT JOIN dnanalyzer_data_short_text c_data ON s.id = c_data.statement_id AND c_data.variable_id = 3
        LEFT JOIN dnanalyzer_entities c_entity ON c_data.entity = c_entity.id
        LEFT JOIN dnanalyzer_data_boolean agreement ON s.id = agreement.statement_id AND agreement.variable_id = 4
        WHERE s.document_id = ${idVal}
        ORDER BY s.id
      `;
      const statements = await db.execute(sql.raw(statementsQuery));
      details.statements = statements.map((stmt: any) => {
        const text = details.text || '';
        let statementText = `Statement by ${stmt.actor || 'Unknown'}${stmt.organization ? ` from ${stmt.organization}` : ''} regarding ${stmt.concept || 'topic'}`;
        if (text && stmt.startIndex >= 0 && stmt.endIndex > stmt.startIndex && stmt.endIndex <= text.length) {
          statementText = text.substring(stmt.startIndex, stmt.endIndex);
        }
        return {
          statement: statementText,
          concept: stmt.concept || '',
          actor: stmt.actor || '',
          organization: stmt.organization || '',
          agree: stmt.agree,
          startIndex: stmt.startIndex || 0,
          endIndex: stmt.endIndex || 0,
          originalStatementId: stmt.ID
        };
      });
    }
    
    return { details };
  } catch (error) {
    console.error('Failed to fetch activity details:', error);
    return { error: 'Failed to fetch details' };
  }
}
