import { createOpenAI } from '@ai-sdk/openai';

export const getModel = (modelId: string, customApiKey?: string) => {
  const isOrKey = customApiKey?.startsWith('sk-or-');
  const apiKey = (isOrKey ? customApiKey : process.env.OPENROUTER_API_KEY) || process.env.OPENROUTER_API_KEY;
  
  const openRouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    // @ts-ignore - Some versions of @ai-sdk/openai may not have this in their types yet
    compatibility: 'compatible',
    fetch: async (url, options) => {
      if (options?.body) {
        try {
          const body = JSON.parse(options.body as string);
          if (body.max_completion_tokens) {
            body.max_tokens = body.max_completion_tokens;
            delete body.max_completion_tokens;
          }
          if (!body.max_tokens) {
            body.max_tokens = 8192;
          }
          // Also set HTTP-Referer and X-Title for OpenRouter BYOK rankings (optional but good practice)
          options.headers = {
            ...options.headers,
            'HTTP-Referer': 'https://alhrkn-apps.vercel.app',
            'X-Title': 'Alhrkn Apps',
          };
          options.body = JSON.stringify(body);
        } catch(e) {}
      }
      return fetch(url, options);
    }
  });

  const id = modelId.includes('/') ? modelId : `google/${modelId}`;
  return openRouter.chat(id);
};
