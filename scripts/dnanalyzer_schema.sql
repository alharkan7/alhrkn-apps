CREATE TABLE IF NOT EXISTS "dnanalyzer_coders" (
  "id" integer PRIMARY KEY,
  "name" text,
  "red" integer,
  "green" integer,
  "blue" integer,
  "refresh" integer,
  "font_size" integer,
  "password" text,
  "popup_width" integer,
  "color_by_coder" integer,
  "popup_decoration" integer,
  "popup_auto_complete" integer,
  "permission_add_documents" integer,
  "permission_edit_documents" integer,
  "permission_delete_documents" integer,
  "permission_import_documents" integer,
  "permission_add_statements" integer,
  "permission_edit_statements" integer,
  "permission_delete_statements" integer,
  "permission_edit_attributes" integer,
  "permission_edit_regex" integer,
  "permission_edit_statement_types" integer,
  "permission_edit_coders" integer,
  "permission_edit_coder_relations" integer,
  "permission_view_others_documents" integer,
  "permission_edit_others_documents" integer,
  "permission_view_others_statements" integer,
  "permission_edit_others_statements" integer
);

CREATE TABLE IF NOT EXISTS "dnanalyzer_statement_types" (
  "id" integer PRIMARY KEY,
  "label" text,
  "red" integer,
  "green" integer,
  "blue" integer
);

CREATE TABLE IF NOT EXISTS "dnanalyzer_variables" (
  "id" integer PRIMARY KEY,
  "variable" text,
  "data_type" text,
  "statement_type_id" integer REFERENCES "dnanalyzer_statement_types"("id")
);

CREATE TABLE IF NOT EXISTS "dnanalyzer_documents" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "title" text,
  "text" text,
  "coder" integer REFERENCES "dnanalyzer_coders"("id"),
  "date" integer,
  "user_id" uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS "dnanalyzer_statements" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "statement_type_id" integer REFERENCES "dnanalyzer_statement_types"("id"),
  "document_id" integer REFERENCES "dnanalyzer_documents"("id") ON DELETE CASCADE,
  "start" integer,
  "stop" integer,
  "coder" integer REFERENCES "dnanalyzer_coders"("id")
);

CREATE TABLE IF NOT EXISTS "dnanalyzer_entities" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "variable_id" integer REFERENCES "dnanalyzer_variables"("id"),
  "value" text
);

CREATE TABLE IF NOT EXISTS "dnanalyzer_data_short_text" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "statement_id" integer REFERENCES "dnanalyzer_statements"("id") ON DELETE CASCADE,
  "variable_id" integer REFERENCES "dnanalyzer_variables"("id"),
  "entity" integer REFERENCES "dnanalyzer_entities"("id")
);

CREATE TABLE IF NOT EXISTS "dnanalyzer_data_boolean" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "statement_id" integer REFERENCES "dnanalyzer_statements"("id") ON DELETE CASCADE,
  "variable_id" integer REFERENCES "dnanalyzer_variables"("id"),
  "value" integer
);

-- Insert Initial Data
INSERT INTO "dnanalyzer_coders" ("id", "name", "red", "green", "blue", "refresh", "font_size", "password", "popup_width", "color_by_coder", "popup_decoration", "popup_auto_complete", "permission_add_documents", "permission_edit_documents", "permission_delete_documents", "permission_import_documents", "permission_add_statements", "permission_edit_statements", "permission_delete_statements", "permission_edit_attributes", "permission_edit_regex", "permission_edit_statement_types", "permission_edit_coders", "permission_edit_coder_relations", "permission_view_others_documents", "permission_edit_others_documents", "permission_view_others_statements", "permission_edit_others_statements")
VALUES (1, 'Admin', 255, 0, 0, 0, 14, '', 300, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1) ON CONFLICT DO NOTHING;

INSERT INTO "dnanalyzer_statement_types" ("id", "label", "red", "green", "blue") VALUES (1, 'DNA Statement', 239, 208, 51) ON CONFLICT DO NOTHING;

INSERT INTO "dnanalyzer_variables" ("id", "variable", "data_type", "statement_type_id") VALUES
   (1, 'person', 'short text', 1),
   (2, 'organization', 'short text', 1),
   (3, 'concept', 'short text', 1),
   (4, 'agreement', 'boolean', 1) ON CONFLICT DO NOTHING;
