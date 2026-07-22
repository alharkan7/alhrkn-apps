import { headers } from 'next/headers';

export async function isBotRequest() {
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || '';
  return /bot|googlebot|crawler|spider|robot|crawling|facebookexternalhit|twitterbot|slackbot|whatsapp|telegrambot/i.test(userAgent);
}
