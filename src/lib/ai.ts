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

          // --- Prompt Caching Implementation ---
          if (body.messages && Array.isArray(body.messages)) {
            // Target the second-to-last message (to cache history/context before the current query)
            // If there's only 1 message, target it so static one-shot queries can be cached too.
            const cacheTargetIndex = body.messages.length >= 2 ? body.messages.length - 2 : 0;
            const cacheTarget = body.messages[cacheTargetIndex];
            
            if (cacheTarget && cacheTarget.content) {
              if (Array.isArray(cacheTarget.content) && cacheTarget.content.length > 0) {
                // Add cache_control to the last block of the target message
                const lastBlock = cacheTarget.content[cacheTarget.content.length - 1];
                if (typeof lastBlock === 'object' && lastBlock !== null) {
                  lastBlock.cache_control = { type: 'ephemeral' };
                }
              } else if (typeof cacheTarget.content === 'string') {
                // Convert string to array with cache_control breakpoint
                cacheTarget.content = [
                  { type: 'text', text: cacheTarget.content, cache_control: { type: 'ephemeral' } }
                ];
              }
            }
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
