import { generateText, streamText } from 'ai';
import { getModel } from './ai';

export class GoogleAIFileManager {
  constructor(apiKey: string) {}
  async uploadFile(filePath: string, metadata: { mimeType: string; displayName: string }) {
    const fs = require('fs/promises');
    const data = await fs.readFile(filePath);
    const base64 = data.toString('base64');
    return {
      file: {
        name: `files/${metadata.displayName || 'file'}`,
        mimeType: metadata.mimeType,
        uri: `data:${metadata.mimeType};base64,${base64}`
      }
    };
  }
  async deleteFile(name: string) {
    return true;
  }
}

export class GoogleGenerativeAI {
  apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  getGenerativeModel(config: any) {
    return new GenerativeModel(config, this.apiKey);
  }
}

class GenerativeModel {
  config: any;
  apiKey: string;
  constructor(config: any, apiKey: string) {
    this.config = config;
    this.apiKey = apiKey;
  }
  
  async generateContent(request: any) {
    let messages: any[] = [];
    let system = this.config.systemInstruction;
    
    let contents = request.contents || request;
    if (typeof contents === 'string') {
      messages.push({ role: 'user', content: contents });
    } else if (Array.isArray(contents)) {
      const isArrayOfParts = contents.length > 0 && ('text' in contents[0] || 'inlineData' in contents[0] || 'fileData' in contents[0]);
      const normalizedContents = isArrayOfParts ? [{ role: 'user', parts: contents }] : contents;
      
      for (const content of normalizedContents) {
        let role = content.role === 'model' ? 'assistant' : 'user';
        let parts = content.parts || [];
        let aiContent: any[] = [];
        
        for (const part of parts) {
          if (part.text) {
            aiContent.push({ type: 'text', text: part.text });
          } else if (part.inlineData) {
             // For OpenRouter/Vercel AI SDK, we pass images/pdfs as image urls with base64
             // Make sure we include the prefix if not already present
             let dataStr = part.inlineData.data;
             if (!dataStr.startsWith('data:')) {
               dataStr = `data:${part.inlineData.mimeType};base64,${dataStr}`;
             }
             aiContent.push({ type: 'image', image: dataStr });
          } else if (part.fileData) {
             aiContent.push({ type: 'image', image: part.fileData.fileUri });
          }
        }
        
        if (aiContent.length === 1 && aiContent[0].type === 'text') {
           messages.push({ role, content: aiContent[0].text });
        } else {
           messages.push({ role, content: aiContent });
        }
      }
    }

    // Tools conversion could be handled here if needed, but for now we skip tools 
    // unless strictly required by a route. Only chat/route.ts uses tools currently.

    const genConfig = this.config.generationConfig || {};
    const result = await generateText({
      model: getModel(this.config.model || 'gemini-2.5-flash', this.apiKey),
      messages: messages,
      system: system,
      maxTokens: genConfig.maxOutputTokens || 8192,
      temperature: genConfig.temperature,
      topP: genConfig.topP,
      topK: genConfig.topK,
    });
    
    return {
      response: {
        text: () => result.text
      }
    };
  }

  async generateContentStream(request: any) {
    let messages: any[] = [];
    let system = this.config.systemInstruction;
    
    let contents = request.contents || request;
    if (typeof contents === 'string') {
      messages.push({ role: 'user', content: contents });
    } else if (Array.isArray(contents)) {
      const isArrayOfParts = contents.length > 0 && ('text' in contents[0] || 'inlineData' in contents[0] || 'fileData' in contents[0]);
      const normalizedContents = isArrayOfParts ? [{ role: 'user', parts: contents }] : contents;
      
      for (const content of normalizedContents) {
        let role = content.role === 'model' ? 'assistant' : 'user';
        let parts = content.parts || [];
        let aiContent: any[] = [];
        
        for (const part of parts) {
          if (part.text) {
            aiContent.push({ type: 'text', text: part.text });
          } else if (part.inlineData) {
             let dataStr = part.inlineData.data;
             if (!dataStr.startsWith('data:')) {
               dataStr = `data:${part.inlineData.mimeType};base64,${dataStr}`;
             }
             aiContent.push({ type: 'image', image: dataStr });
          } else if (part.fileData) {
             aiContent.push({ type: 'image', image: part.fileData.fileUri });
          }
        }
        
        if (aiContent.length === 1 && aiContent[0].type === 'text') {
           messages.push({ role, content: aiContent[0].text });
        } else {
           messages.push({ role, content: aiContent });
        }
      }
    }

    const genConfig = this.config.generationConfig || {};
    const result = await streamText({
      model: getModel(this.config.model || 'gemini-2.5-flash', this.apiKey),
      messages: messages,
      system: system,
      maxTokens: genConfig.maxOutputTokens || 8192,
      temperature: genConfig.temperature,
      topP: genConfig.topP,
      topK: genConfig.topK,
    });
    
    async function* makeStream() {
      for await (const textPart of result.textStream) {
        yield { text: () => textPart };
      }
    }
    
    return {
      stream: makeStream()
    };
  }
  
  startChat(config: any) {
     return new ChatSession(this, config);
  }
}

class ChatSession {
  model: GenerativeModel;
  history: any[];
  constructor(model: GenerativeModel, config: any) {
    this.model = model;
    this.history = config?.history || [];
  }
  
  async sendMessage(messageParts: any) {
    let parts = Array.isArray(messageParts) ? messageParts : [{ text: messageParts }];
    this.history.push({ role: 'user', parts });
    
    const result = await this.model.generateContent({ contents: this.history });
    
    const text = await result.response.text();
    this.history.push({ role: 'model', parts: [{ text }] });
    
    return result;
  }
}

export const SchemaType = {
  STRING: 'string',
  OBJECT: 'object',
  ARRAY: 'array',
  NUMBER: 'number',
  BOOLEAN: 'boolean'
};
