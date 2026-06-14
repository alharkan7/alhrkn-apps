import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ChatInterface } from '../components/ChatInterface';
import { Message } from '../types/types';
import { getBucket } from '@/lib/storage/client';

export default async function ChatSessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
        redirect('/'); // Or to a login page
    }

    const sessionData = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, id)
    });

    if (!sessionData) {
        // If session not found, we can either redirect or just let them start fresh with this ID
        // For security, if they try to access a non-existent chat, redirect to /chat
        redirect('/chat');
    }

    if (sessionData.userId !== user.id) {
        // Prevent accessing someone else's chat
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

    return (
        <ChatInterface 
            initialMessages={messages} 
            initialSessionId={sessionData.id} 
        />
    );
}
