import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DNAnalyzerDB, Statement } from '@/lib/dnanalyzer-db';

export async function POST(req: NextRequest) {
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
    const { documents } = body || {};

    if (!documents || !Array.isArray(documents)) {
      return NextResponse.json(
        { error: 'Missing or invalid "documents" parameter' },
        { status: 400 }
      );
    }

    const db = new DNAnalyzerDB(user.id);

    try {
      await db.initialize();

      const savedDocuments = [];
      for (const doc of documents) {
        if (!doc.title || !doc.content) {
          continue;
        }

        let documentId: number;

        if (doc.id && typeof doc.id === 'number') {
          await db.updateDocument(doc.id, doc.title, doc.content);
          documentId = doc.id;

          if (doc.statements && Array.isArray(doc.statements)) {
            for (const statement of doc.statements) {
              if (statement.originalStatementId && typeof statement.originalStatementId === 'number') {
                await db.updateStatement(statement.originalStatementId, statement);
              } else {
                await db.saveSingleStatement(documentId, statement);
              }
            }
          }
        } else {
          documentId = await db.saveDocument(doc.title, doc.content);

          if (doc.statements && Array.isArray(doc.statements)) {
            await db.saveStatements(documentId, doc.statements);
          }
        }

        savedDocuments.push({
          id: documentId,
          title: doc.title,
          statementsCount: doc.statements?.length || 0,
          isUpdate: !!doc.id
        });
      }

      return NextResponse.json({
        success: true,
        message: `Saved ${savedDocuments.length} documents with ${savedDocuments.reduce((sum, doc) => sum + doc.statementsCount, 0)} statements to database`,
        documents: savedDocuments
      });

    } finally {
      await db.close();
    }

  } catch (error: any) {
    console.error('Error saving to database:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
