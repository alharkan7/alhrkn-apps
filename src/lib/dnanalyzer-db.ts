import { db } from '@/db';
import { eq, inArray, and } from 'drizzle-orm';
import {
  dnanalyzerDocuments,
  dnanalyzerStatements,
  dnanalyzerEntities,
  dnanalyzerDataShortText,
  dnanalyzerDataBoolean
} from '@/db/schema';

export interface Statement {
  statement: string;
  concept: string;
  actor: string;
  organization: string;
  agree: boolean;
  sourceFile?: string;
  startIndex?: number;
  endIndex?: number;
  originalStatementId?: number;
}

export interface Document {
  id?: number;
  title: string;
  content: string;
  processed?: boolean;
}

export class DNAnalyzerDB {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async initialize(): Promise<void> {
    // Initialization is managed by Drizzle/PostgreSQL now
  }

  async close(): Promise<void> {
    // No-op for Drizzle
  }

  // Backwards compatibility stub for old API code that used raw queries
  getConnection() {
    return null;
  }

  async saveDocument(title: string, content: string): Promise<number> {
    const date = Math.floor(Date.now() / 1000);

    const [doc] = await db.insert(dnanalyzerDocuments)
      .values({
        title,
        text: content,
        coder: 1,
        date,
        userId: this.userId,
      })
      .returning({ id: dnanalyzerDocuments.id });

    return doc.id;
  }

  async updateDocument(documentId: number, title: string, content: string): Promise<void> {
    const date = Math.floor(Date.now() / 1000);

    await db.update(dnanalyzerDocuments)
      .set({ title, text: content, date })
      .where(and(eq(dnanalyzerDocuments.id, documentId), eq(dnanalyzerDocuments.userId, this.userId)));
  }

  async updateStatement(statementId: number, statement: Statement): Promise<void> {
    await db.delete(dnanalyzerDataShortText).where(eq(dnanalyzerDataShortText.statementId, statementId));
    await db.delete(dnanalyzerDataBoolean).where(eq(dnanalyzerDataBoolean.statementId, statementId));

    const startPos = statement.startIndex ?? 0;
    const stopPos = statement.endIndex ?? Math.max(1, startPos + statement.statement.length);
    
    await db.update(dnanalyzerStatements)
      .set({ start: startPos, stop: stopPos })
      .where(eq(dnanalyzerStatements.id, statementId));

    await this.saveEntityAndLink(statementId, 1, statement.actor);
    await this.saveEntityAndLink(statementId, 2, statement.organization);
    await this.saveEntityAndLink(statementId, 3, statement.concept);
    await this.saveBooleanData(statementId, 4, statement.agree ? 1 : 0);
  }

  async saveStatements(documentId: number, statements: Statement[]): Promise<void> {
    for (const statement of statements) {
      await this.saveSingleStatement(documentId, statement);
    }
  }

  async saveSingleStatement(documentId: number, statement: Statement): Promise<void> {
    const startPos = statement.startIndex ?? 0;
    const stopPos = statement.endIndex ?? Math.max(1, startPos + statement.statement.length);

    const [stmt] = await db.insert(dnanalyzerStatements)
      .values({
        statementTypeId: 1,
        documentId,
        start: startPos,
        stop: stopPos,
        coder: 1,
      })
      .returning({ id: dnanalyzerStatements.id });

    const statementId = stmt.id;

    await this.saveEntityAndLink(statementId, 1, statement.actor);
    await this.saveEntityAndLink(statementId, 2, statement.organization);
    await this.saveEntityAndLink(statementId, 3, statement.concept);
    await this.saveBooleanData(statementId, 4, statement.agree ? 1 : 0);
  }

  private async saveEntityAndLink(statementId: number, variableId: number, value: string): Promise<void> {
    if (!value || value.trim() === '') return;

    const existingEntities = await db.select({ id: dnanalyzerEntities.id })
      .from(dnanalyzerEntities)
      .where(and(eq(dnanalyzerEntities.variableId, variableId), eq(dnanalyzerEntities.value, value)))
      .limit(1);

    let entityId: number;

    if (existingEntities.length > 0) {
      entityId = existingEntities[0].id;
    } else {
      const [newEntity] = await db.insert(dnanalyzerEntities)
        .values({ variableId, value })
        .returning({ id: dnanalyzerEntities.id });
      entityId = newEntity.id;
    }

    await db.insert(dnanalyzerDataShortText).values({
      statementId,
      variableId,
      entity: entityId,
    });
  }

  private async saveBooleanData(statementId: number, variableId: number, value: number): Promise<void> {
    await db.insert(dnanalyzerDataBoolean).values({
      statementId,
      variableId,
      value,
    });
  }

  async deleteDocument(documentId: number): Promise<void> {
    const doc = await db.select({ id: dnanalyzerDocuments.id })
      .from(dnanalyzerDocuments)
      .where(and(eq(dnanalyzerDocuments.id, documentId), eq(dnanalyzerDocuments.userId, this.userId)))
      .limit(1);
    
    if (doc.length === 0) throw new Error("Document not found or unauthorized");

    await this.deleteStatementsByDocumentId(documentId);
    await db.delete(dnanalyzerDocuments).where(eq(dnanalyzerDocuments.id, documentId));
  }

  async deleteStatementsByDocumentId(documentId: number): Promise<void> {
    const stmts = await db.select({ id: dnanalyzerStatements.id })
      .from(dnanalyzerStatements)
      .where(eq(dnanalyzerStatements.documentId, documentId));

    const statementIds = stmts.map(s => s.id);

    if (statementIds.length > 0) {
      await db.delete(dnanalyzerDataShortText).where(inArray(dnanalyzerDataShortText.statementId, statementIds));
      await db.delete(dnanalyzerDataBoolean).where(inArray(dnanalyzerDataBoolean.statementId, statementIds));
      await db.delete(dnanalyzerStatements).where(eq(dnanalyzerStatements.documentId, documentId));
    }
  }

  async deleteStatement(statementId: number): Promise<void> {
    await db.delete(dnanalyzerDataShortText).where(eq(dnanalyzerDataShortText.statementId, statementId));
    await db.delete(dnanalyzerDataBoolean).where(eq(dnanalyzerDataBoolean.statementId, statementId));
    await db.delete(dnanalyzerStatements).where(eq(dnanalyzerStatements.id, statementId));
  }

  async loadDocuments(): Promise<any[]> {
    const docs = await db.select()
      .from(dnanalyzerDocuments)
      .where(eq(dnanalyzerDocuments.userId, this.userId))
      .orderBy(dnanalyzerDocuments.id);

    return docs.map(doc => ({
      id: doc.id,
      title: doc.title,
      content: doc.text,
      date: doc.date
    }));
  }

  async loadStatements(): Promise<any[]> {
    // Use raw query for complex joins, it's easier and equivalent to previous MySQL query
    const res = await db.execute(`
      SELECT
        s.id as "ID",
        s.document_id as "DocumentId",
        s.start as "startIndex",
        s.stop as "endIndex",
        d.title as "sourceFile",
        COALESCE(p_entity.value, '') as "actor",
        COALESCE(o_entity.value, '') as "organization",
        COALESCE(c_entity.value, '') as "concept",
        CASE WHEN agreement.value = 1 THEN true ELSE false END as "agree"
      FROM dnanalyzer_statements s
      LEFT JOIN dnanalyzer_documents d ON s.document_id = d.id
      LEFT JOIN dnanalyzer_data_short_text p_data ON s.id = p_data.statement_id AND p_data.variable_id = 1
      LEFT JOIN dnanalyzer_entities p_entity ON p_data.entity = p_entity.id
      LEFT JOIN dnanalyzer_data_short_text o_data ON s.id = o_data.statement_id AND o_data.variable_id = 2
      LEFT JOIN dnanalyzer_entities o_entity ON o_data.entity = o_entity.id
      LEFT JOIN dnanalyzer_data_short_text c_data ON s.id = c_data.statement_id AND c_data.variable_id = 3
      LEFT JOIN dnanalyzer_entities c_entity ON c_data.entity = c_entity.id
      LEFT JOIN dnanalyzer_data_boolean agreement ON s.id = agreement.statement_id AND agreement.variable_id = 4
      WHERE d.user_id = '${this.userId}'
      ORDER BY s.id
    `);

    // In drizzle-orm with postgres-js, the result of db.execute is the array of rows itself.
    return res as any[];
  }
}
