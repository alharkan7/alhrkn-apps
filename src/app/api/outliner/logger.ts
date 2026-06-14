import { db } from '@/db';
import { outlinerEvents } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getAuthUser() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (e) {
    return null;
  }
}

export async function logOutlinerEvent(userId: string, action: string, inputPayload: any, outputPayload: string) {
  try {
    await db.insert(outlinerEvents).values({
      userId,
      action,
      inputPayload: typeof inputPayload === 'string' ? inputPayload : JSON.stringify(inputPayload),
      outputPayload,
    });
  } catch (error) {
    console.error('Failed to log outliner event:', error);
  }
}
