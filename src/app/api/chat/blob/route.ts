import { getBucket } from '@/lib/storage/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
        return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
    }

    try {
        if (!request.body) {
            throw new Error('Missing request body');
        }
        
        const bucket = getBucket();
        const buffer = Buffer.from(await request.arrayBuffer());
        
        // Append timestamp to prevent overwriting
        const safeFileName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `chat/${safeFileName}`;
        
        const file = bucket.file(filePath);
        await file.save(buffer, {
            resumable: false,
        });

        // Generate a signed URL for reading the file
        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
        });

        return NextResponse.json({ url });
    } catch (error) {
        console.error('Error uploading to GCS:', error);
        return NextResponse.json({ error: 'Failed to upload to storage' }, { status: 500 });
    }
} 