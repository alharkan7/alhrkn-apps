import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isBotRequest } from '@/lib/bot';
import { ChatInterface } from '../components/ChatInterface';
import { Message } from '../types/types';
import { getBucket } from '@/lib/storage/client';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const sessionData = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, id)
    });

    const title = sessionData?.title ? `Ask AI - ${sessionData.title}` : 'Ask AI';
    const description = 'Experimental Apps by @alhrkn';

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [`/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&path=chat/${id}`],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [`/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&path=chat/${id}`],
        },
    };
}

export default async function ChatSessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const isBot = await isBotRequest();

    if (!user?.id) {
        if (isBot) return <div />;
        redirect(`/login?next=/chat/${id}`);
    }

    const sessionData = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, id)
    });

    if (!sessionData) {
        // If session not found, we can either redirect or just let them start fresh with this ID
        // For security, if they try to access a non-existent chat, redirect to /chat
        redirect('/chat');
    }

    // Strip undefined values which Next.js Server->Client boundary rejects
    let messages = sessionData.messages ? JSON.parse(JSON.stringify(sessionData.messages)) : [];

    // Regenerate signed URLs for any files that have a filePath
    if (messages.length > 0) {
        const bucket = getBucket();
        for (const msg of messages) {
            if (Array.isArray(msg.content)) {
                for (const part of msg.content) {
                    if (part.type === 'image_url' && part.image_url?.filePath) {
                        try {
                            const [url] = await bucket.file(part.image_url.filePath).getSignedUrl({
                                version: 'v4',
                                action: 'read',
                                expires: Date.now() + 12 * 60 * 60 * 1000,
                            });
                            part.image_url.url = url;
                        } catch (e) {
                            console.error('Failed to regenerate signed url for', part.image_url.filePath, e);
                        }
                    } else if (part.type === 'file_url' && part.file_url?.filePath) {
                        try {
                            const [url] = await bucket.file(part.file_url.filePath).getSignedUrl({
                                version: 'v4',
                                action: 'read',
                                expires: Date.now() + 12 * 60 * 60 * 1000,
                            });
                            part.file_url.url = url;
                        } catch (e) {
                            console.error('Failed to regenerate signed url for', part.file_url.filePath, e);
                        }
                    }
                }
            }
        }
    }

    const isOwner = sessionData.userId === user.id;

    return (
        <ChatInterface 
            initialMessages={messages} 
            initialSessionId={sessionData.id} 
            isOwner={isOwner}
        />
    );
}
