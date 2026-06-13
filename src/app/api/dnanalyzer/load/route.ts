import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DNAnalyzerDB } from '@/lib/dnanalyzer-db';

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

    const db = new DNAnalyzerDB(user.id);

    try {
      await db.initialize();

      const formattedDocuments = await db.loadDocuments();
      const rawStatements = await db.loadStatements();

      const statements = rawStatements.map((stmt: any) => {
        const document = formattedDocuments.find((doc: any) => doc.title === stmt.sourceFile);
        let statementText = `Statement by ${stmt.actor || 'Unknown'}${stmt.organization ? ` from ${stmt.organization}` : ''} regarding ${stmt.concept || 'topic'}`;

        if (document && stmt.startIndex >= 0 && stmt.endIndex > stmt.startIndex && stmt.endIndex <= document.content.length) {
          statementText = document.content.substring(stmt.startIndex, stmt.endIndex);
        }

        return {
          statement: statementText,
          concept: stmt.concept || '',
          actor: stmt.actor || '',
          organization: stmt.organization || '',
          agree: stmt.agree,
          sourceFile: stmt.sourceFile,
          startIndex: stmt.startIndex || 0,
          endIndex: stmt.endIndex || 0,
          originalStatementId: stmt.ID
        };
      });

      return NextResponse.json({
        success: true,
        documents: formattedDocuments,
        statements: statements,
        message: `Loaded ${statements.length} statements from ${formattedDocuments.length} documents`
      });

    } finally {
      await db.close();
    }

  } catch (error: any) {
    console.error('Error loading from database:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
