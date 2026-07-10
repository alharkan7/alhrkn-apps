export type InztagramMode = 'mermaid' | 'freeform';

export type InztagramMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
};
