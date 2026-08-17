// src/lib/db/schema.ts
import {
  pgTable as pgTableWithoutRLS,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  index,
  AnyPgColumn,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Every application table is private to the server-side Postgres connection.
// Keep RLS in the Drizzle schema so `drizzle-kit push` cannot recreate a table
// as publicly accessible through Supabase's Data API.
const pgTable = ((...args: Parameters<typeof pgTableWithoutRLS>) =>
  pgTableWithoutRLS(...args).enableRLS()) as typeof pgTableWithoutRLS;

// Main mindmaps table
export const mindmaps = pgTable('mindmaps', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title'),
  inputType: text('input_type').notNull().$type<'pdf' | 'text' | 'url'>(),
  pdfUrl: text('pdf_url'),
  fileName: text('file_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  sourceUrl: text('source_url'),
  isExample: boolean('is_example').default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }).defaultNow(),
  parsed_pdf_content: text('parsed_pdf_content'),
  userId: uuid('user_id').notNull(),
});

// Nodes table
export const mindmapNodes = pgTable('mindmap_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  mindmapId: uuid('mindmap_id')
    .notNull()
    .references(() => mindmaps.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(), // Frontend visualization ID
  title: text('title').notNull(),
  description: text('description'),
  parentId: text('parent_id'), // null for root node
  level: integer('level').notNull(),
  pageNumber: integer('page_number'),
  positionX: doublePrecision('position_x'),
  positionY: doublePrecision('position_y'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});



// Relations
export const mindmapsRelations = relations(mindmaps, ({ many }) => ({
  nodes: many(mindmapNodes),
}));

export const mindmapNodesRelations = relations(mindmapNodes, ({ one }) => ({
  mindmap: one(mindmaps, {
    fields: [mindmapNodes.mindmapId],
    references: [mindmaps.id],
  }),
}));



// Types for TypeScript
export type Mindmap = typeof mindmaps.$inferSelect;
export type NewMindmap = typeof mindmaps.$inferInsert;

export type MindmapNode = typeof mindmapNodes.$inferSelect;
export type NewMindmapNode = typeof mindmapNodes.$inferInsert;

// --- DNAnalyzer Tables ---

export const dnanalyzerCoders = pgTable('dnanalyzer_coders', {
  id: integer('id').primaryKey(),
  name: text('name'),
  red: integer('red'),
  green: integer('green'),
  blue: integer('blue'),
  refresh: integer('refresh'),
  fontSize: integer('font_size'),
  password: text('password'),
  popupWidth: integer('popup_width'),
  colorByCoder: integer('color_by_coder'),
  popupDecoration: integer('popup_decoration'),
  popupAutoComplete: integer('popup_auto_complete'),
  permissionAddDocuments: integer('permission_add_documents'),
  permissionEditDocuments: integer('permission_edit_documents'),
  permissionDeleteDocuments: integer('permission_delete_documents'),
  permissionImportDocuments: integer('permission_import_documents'),
  permissionAddStatements: integer('permission_add_statements'),
  permissionEditStatements: integer('permission_edit_statements'),
  permissionDeleteStatements: integer('permission_delete_statements'),
  permissionEditAttributes: integer('permission_edit_attributes'),
  permissionEditRegex: integer('permission_edit_regex'),
  permissionEditStatementTypes: integer('permission_edit_statement_types'),
  permissionEditCoders: integer('permission_edit_coders'),
  permissionEditCoderRelations: integer('permission_edit_coder_relations'),
  permissionViewOthersDocuments: integer('permission_view_others_documents'),
  permissionEditOthersDocuments: integer('permission_edit_others_documents'),
  permissionViewOthersStatements: integer('permission_view_others_statements'),
  permissionEditOthersStatements: integer('permission_edit_others_statements'),
});

export const dnanalyzerStatementTypes = pgTable('dnanalyzer_statement_types', {
  id: integer('id').primaryKey(),
  label: text('label'),
  red: integer('red'),
  green: integer('green'),
  blue: integer('blue'),
});

export const dnanalyzerVariables = pgTable('dnanalyzer_variables', {
  id: integer('id').primaryKey(),
  variable: text('variable'),
  dataType: text('data_type'),
  statementTypeId: integer('statement_type_id').references(() => dnanalyzerStatementTypes.id),
});

export const dnanalyzerDocuments = pgTable('dnanalyzer_documents', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('title'),
  text: text('text'),
  coder: integer('coder').references(() => dnanalyzerCoders.id),
  date: integer('date'),
  userId: uuid('user_id').notNull(),
});

export const dnanalyzerStatements = pgTable('dnanalyzer_statements', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  statementTypeId: integer('statement_type_id').references(() => dnanalyzerStatementTypes.id),
  documentId: integer('document_id').references(() => dnanalyzerDocuments.id, { onDelete: 'cascade' }),
  start: integer('start'),
  stop: integer('stop'),
  coder: integer('coder').references(() => dnanalyzerCoders.id),
});

export const dnanalyzerEntities = pgTable('dnanalyzer_entities', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  variableId: integer('variable_id').references(() => dnanalyzerVariables.id),
  value: text('value'),
});

export const dnanalyzerDataShortText = pgTable('dnanalyzer_data_short_text', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  statementId: integer('statement_id').references(() => dnanalyzerStatements.id, { onDelete: 'cascade' }),
  variableId: integer('variable_id').references(() => dnanalyzerVariables.id),
  entity: integer('entity').references(() => dnanalyzerEntities.id),
});

export const dnanalyzerDataBoolean = pgTable('dnanalyzer_data_boolean', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  statementId: integer('statement_id').references(() => dnanalyzerStatements.id, { onDelete: 'cascade' }),
  variableId: integer('variable_id').references(() => dnanalyzerVariables.id),
  value: integer('value'),
});

// --- Inztagram Tables ---

export const inztagramDiagrams = pgTable('inztagram_diagrams', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  mode: text('mode').notNull().default('mermaid').$type<'mermaid' | 'freeform'>(),
  description: text('description'),
  diagramType: text('diagram_type'),
  pdfUrl: text('pdf_url'),
  pdfName: text('pdf_name'),
  mermaidCode: text('mermaid_code'),
  svgCode: text('svg_code'),
  messages: jsonb('messages').$type<Array<{
    role: 'user' | 'assistant';
    content: string;
    createdAt?: string;
  }>>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type InztagramDiagram = typeof inztagramDiagrams.$inferSelect;
export type NewInztagramDiagram = typeof inztagramDiagrams.$inferInsert;

export const inztagramDiagramVersions = pgTable('inztagram_diagram_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  diagramId: uuid('diagram_id').notNull().references(() => inztagramDiagrams.id, { onDelete: 'cascade' }),
  svgCode: text('svg_code'),
  mermaidCode: text('mermaid_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type InztagramDiagramVersion = typeof inztagramDiagramVersions.$inferSelect;
export type NewInztagramDiagramVersion = typeof inztagramDiagramVersions.$inferInsert;


// --- Outliner Tables ---

export const outlinerEvents = pgTable('outliner_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  action: text('action').notNull(),
  inputPayload: text('input_payload'),
  outputPayload: text('output_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type OutlinerEvent = typeof outlinerEvents.$inferSelect;
export type NewOutlinerEvent = typeof outlinerEvents.$inferInsert;

export const outlinerQueries = pgTable('outliner_queries', {
  id: text('id').primaryKey(), // We will use nanoid for short IDs
  userId: uuid('user_id').notNull(),
  keywords: text('keywords').notNull(),
  language: text('language').notNull(),
  ideas: jsonb('ideas').default('[]'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type OutlinerQuery = typeof outlinerQueries.$inferSelect;
export type NewOutlinerQuery = typeof outlinerQueries.$inferInsert;

export const outlinerDrafts = pgTable('outliner_drafts', {
  id: text('id').primaryKey(),
  queryId: text('query_id').references(() => outlinerQueries.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull(),
  abstract: jsonb('abstract').notNull(),
  content: jsonb('content'),
  language: text('language'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type OutlinerDraft = typeof outlinerDrafts.$inferSelect;
export type NewOutlinerDraft = typeof outlinerDrafts.$inferInsert;

export const outlinerQueriesRelations = relations(outlinerQueries, ({ many }) => ({
  drafts: many(outlinerDrafts),
}));

export const outlinerDraftsRelations = relations(outlinerDrafts, ({ one }) => ({
  query: one(outlinerQueries, {
    fields: [outlinerDrafts.queryId],
    references: [outlinerQueries.id],
  }),
}));

// --- Chat Tables ---

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  title: text('title'),
  messages: jsonb('messages').default('[]'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;

// --- FlowNote Tables ---

export const flownotes = pgTable('flownotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull(),
  nodes: jsonb('nodes').default('[]'),
  edges: jsonb('edges').default('[]'),
  originalFileUrl: text('original_file_url'),
  originalFileName: text('original_file_name'),
  aiPrompt: text('ai_prompt'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type FlowNote = typeof flownotes.$inferSelect;
export type NewFlowNote = typeof flownotes.$inferInsert;

export const flownoteEvents = pgTable('flownote_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  flownoteId: uuid('flownote_id').references(() => flownotes.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  inputPayload: text('input_payload'),
  outputPayload: text('output_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type FlowNoteEvent = typeof flownoteEvents.$inferSelect;
export type NewFlowNoteEvent = typeof flownoteEvents.$inferInsert;

// --- Beeblio Tables ---

export const beeblioSearches = pgTable('beeblio_searches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  originalQuery: text('original_query'),
  contextText: text('context_text'),
  databases: jsonb('databases'),
  structuredQueries: jsonb('structured_queries'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type BeeblioSearch = typeof beeblioSearches.$inferSelect;
export type NewBeeblioSearch = typeof beeblioSearches.$inferInsert;

export const beeblioPapers = pgTable('beeblio_papers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  searchId: uuid('search_id').references(() => beeblioSearches.id, { onDelete: 'cascade' }),
  paperId: text('paper_id').notNull(),
  source: text('source').notNull(),
  title: text('title').notNull(),
  abstract: text('abstract'),
  authors: jsonb('authors').default('[]'),
  year: integer('year'),
  citations: integer('citations'),
  url: text('url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type BeeblioPaper = typeof beeblioPapers.$inferSelect;
export type NewBeeblioPaper = typeof beeblioPapers.$inferInsert;

export const beeblioEvaluations = pgTable('beeblio_evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  paperId: uuid('paper_id').references(() => beeblioPapers.id, { onDelete: 'cascade' }),
  originalQuery: text('original_query'),
  overallScore: doublePrecision('overall_score'),
  rubrics: jsonb('rubrics'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type BeeblioEvaluation = typeof beeblioEvaluations.$inferSelect;
export type NewBeeblioEvaluation = typeof beeblioEvaluations.$inferInsert;

export const beeblioFiles = pgTable('beeblio_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  searchId: uuid('search_id').references(() => beeblioSearches.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type BeeblioFile = typeof beeblioFiles.$inferSelect;
export type NewBeeblioFile = typeof beeblioFiles.$inferInsert;

export const beeblioSettings = pgTable('beeblio_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  searchId: uuid('search_id').references(() => beeblioSearches.id, { onDelete: 'cascade' }),
  activeDatabases: jsonb('active_databases'),
  aiOptimize: boolean('ai_optimize').default(true),
  aiReview: boolean('ai_review').default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type BeeblioSetting = typeof beeblioSettings.$inferSelect;
export type NewBeeblioSetting = typeof beeblioSettings.$inferInsert;

// --- AnimaChart Tables ---

export const animacharts = pgTable('animacharts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  imageUrl: text('image_url'),
  chartData: jsonb('chart_data'),
  messages: jsonb('messages'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type AnimaChart = typeof animacharts.$inferSelect;
export type NewAnimaChart = typeof animacharts.$inferInsert;

export const animachartVersions = pgTable('animachart_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  chartId: uuid('chart_id').notNull().references(() => animacharts.id, { onDelete: 'cascade' }),
  chartData: jsonb('chart_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
export type AnimaChartVersion = typeof animachartVersions.$inferSelect;
export type NewAnimaChartVersion = typeof animachartVersions.$inferInsert;

// --- Posterly Tables ---

export const posterlyPosters = pgTable('posterly_posters', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull(),
  sourceFileName: text('source_file_name').notNull(),
  sourceFilePath: text('source_file_path'),
  style: text('style').$type<'minimal' | 'editorial' | 'dark' | 'blueprint'>().notNull().default('minimal'),
  html: text('html'),
  status: text('status').$type<'pending' | 'processing' | 'ready' | 'error'>().notNull().default('pending'),
  htmlPath: text('html_path'),
  pdfPath: text('pdf_path'),
  pngPath: text('png_path'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userCreatedIdx: index('posterly_posters_user_created_idx').on(table.userId, table.createdAt),
}));

export type PosterlyPoster = typeof posterlyPosters.$inferSelect;
export type NewPosterlyPoster = typeof posterlyPosters.$inferInsert;

// --- Primer Tables ---

export const primers = pgTable('primers', {
  id: text('id').primaryKey(), // nanoid, generated app-side on creation
  userId: uuid('user_id').notNull(),
  // Children point to their parent; parents do not duplicate child ids.
  parentId: text('parent_id').references((): AnyPgColumn => primers.id, { onDelete: 'set null' }),
  topic: text('topic').notNull(),
  title: text('title'),
  content: text('content'), // markdown body; null until generation completes
  glossary: jsonb('glossary').$type<{ term: string; definition: string }[]>().default([]),
  options: jsonb('options').$type<import('@/app/primer/types').PrimerOptions>().default({}),
  status: text('status').$type<'pending' | 'generating' | 'ready' | 'error'>().notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userParentCreatedIdx: index('primers_user_parent_created_idx').on(table.userId, table.parentId, table.createdAt),
}));

export const primerExplanations = pgTable('primer_explanations', {
  id: text('id').primaryKey(),
  primerId: text('primer_id').notNull().references(() => primers.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  selection: text('selection').notNull(),
  selectionKey: text('selection_key').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  // 0-based index of the exact whole-word occurrence the reader selected, so
  // reload re-underlines that one occurrence rather than every match. Null when
  // the selection could not be tied to a stable occurrence (e.g. inside code).
  occurrence: integer('occurrence'),
  status: text('status').$type<'generating' | 'ready' | 'error'>().notNull().default('generating'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  lookupIdx: uniqueIndex('primer_explanations_lookup_idx').on(table.primerId, table.selectionKey),
}));

export const primerCitations = pgTable('primer_citations', {
  id: text('id').primaryKey(),
  primerId: text('primer_id').notNull().references(() => primers.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  selection: text('selection').notNull(),
  selectionKey: text('selection_key').notNull(),
  // 0-based whole-word occurrence of the cited passage so reload can re-pin the
  // inline [n] marker to the exact phrase (mirrors primerExplanations.occurrence).
  occurrence: integer('occurrence'),
  // The 1-3 academic sources the verifier chose to back this passage.
  references: jsonb('references').$type<{
    title: string;
    authors: string[];
    year: number | null;
    venue?: string;
    doi?: string;
    url?: string;
    citationCount?: number;
  }[]>().notNull().default([]),
  verdict: text('verdict').notNull(),
  status: text('status').$type<'generating' | 'ready' | 'error'>().notNull().default('generating'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  lookupIdx: uniqueIndex('primer_citations_lookup_idx').on(table.primerId, table.selectionKey),
}));

export type Primer = typeof primers.$inferSelect;
export type NewPrimer = typeof primers.$inferInsert;
export type PrimerExplanation = typeof primerExplanations.$inferSelect;
export type NewPrimerExplanation = typeof primerExplanations.$inferInsert;
export type PrimerCitationRow = typeof primerCitations.$inferSelect;
export type NewPrimerCitation = typeof primerCitations.$inferInsert;
