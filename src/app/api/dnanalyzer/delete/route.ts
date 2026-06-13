import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DNAnalyzerDB } from '@/lib/dnanalyzer-db';

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { documentId } = body || {};

    if (!documentId || typeof documentId !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid "documentId" parameter' },
        { status: 400 }
      );
    }

    const db = new DNAnalyzerDB(user.id);
    await db.initialize();

    try {
      await db.deleteDocument(documentId);

      return NextResponse.json({
        success: true,
        message: 'Document and associated statements deleted successfully'
      });
    } finally {
      await db.close();
    }

  } catch (error: any) {
    console.error('Error in /api/dnanalyzer/delete:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
