// src/lib/db/schema.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  jsonb
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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
  description: text('description'),
  diagramType: text('diagram_type'),
  pdfUrl: text('pdf_url'),
  pdfName: text('pdf_name'),
  mermaidCode: text('mermaid_code').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type InztagramDiagram = typeof inztagramDiagrams.$inferSelect;
export type NewInztagramDiagram = typeof inztagramDiagrams.$inferInsert;

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
