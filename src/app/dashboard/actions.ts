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

export async function getAppDetails(app: string) {
  const cookieStore = await cookies();
  if (cookieStore.get('admin_token')?.value !== 'authenticated') {
    return { error: 'Unauthorized' };
  }

  let table = '';
  let dateCol = 'created_at';
  let titleCol = 'id'; // fallback

  switch (app) {
    case 'papermap': table = 'mindmaps'; titleCol = 'title'; break;
    case 'beeblio': table = 'beeblio_searches'; titleCol = 'original_query'; break;
    case 'inztagram': table = 'inztagram_diagrams'; titleCol = 'description'; break;
    case 'outliner': table = 'outliner_events'; titleCol = 'action'; break;
    case 'flownote': table = 'flownotes'; titleCol = 'title'; break;
    case 'chat': table = 'chat_sessions'; titleCol = 'title'; break;
    case 'discourse': table = 'dnanalyzer_documents'; titleCol = 'title'; dateCol = 'null'; break;
    default: return { error: 'Unknown app' };
  }

  try {
    const topUsers = await db.execute(sql.raw(`
      SELECT t.user_id, u.email, count(*) as count 
      FROM ${table} t
      LEFT JOIN auth.users u ON t.user_id = u.id
      WHERE t.user_id IS NOT NULL 
      GROUP BY t.user_id, u.email
      ORDER BY count DESC 
      LIMIT 5
    `));

    let recentQuery = '';
    if (dateCol !== 'null') {
      recentQuery = `
        SELECT t.user_id, u.email, t.${titleCol} as title, t.${dateCol} as created_at
        FROM ${table} t
        LEFT JOIN auth.users u ON t.user_id = u.id
        ORDER BY t.${dateCol} DESC
        LIMIT 10
      `;
    } else {
      // Discourse fallback
      recentQuery = `
        SELECT t.user_id, u.email, t.title, t."date" as created_at
        FROM ${table} t
        LEFT JOIN auth.users u ON t.user_id = u.id
        ORDER BY t."date" DESC
        LIMIT 10
      `;
    }

    const recentActivities = await db.execute(sql.raw(recentQuery));

    return {
      topUsers: topUsers.map(u => ({
        userId: String(u.user_id),
        email: u.email ? String(u.email) : null,
        count: Number(u.count)
      })),
      recentActivities: recentActivities.map(a => ({
        userId: String(a.user_id),
        email: a.email ? String(a.email) : null,
        title: String(a.title || 'Untitled'),
        date: String(a.created_at)
      }))
    };
  } catch (error) {
    console.error('Failed to fetch app details:', error);
    return { error: 'Failed to fetch details' };
  }
}
