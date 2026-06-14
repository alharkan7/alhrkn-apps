export type MessageContent = string | MessagePart[];

export type MessagePart = 
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; blobUrl?: string; originalUrl?: string; filePath?: string } }
    | { type: 'file_url'; file_url: { url: string; blobUrl?: string; originalUrl?: string; filePath?: string; name: string; type: string } };

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: MessageContent;
}