import { getBucket } from '@/lib/storage/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const fileUpload = formData.get('file') as File;
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('filename') || (fileUpload ? fileUpload.name : undefined);

        if (!fileUpload || !filename) {
            return NextResponse.json({ error: 'Missing file or filename' }, { status: 400 });
        }

        const bucket = getBucket();
        const buffer = Buffer.from(await fileUpload.arrayBuffer());
        
        const safeFileName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `inztagram/${safeFileName}`;
        
        const file = bucket.file(filePath);
        await file.save(buffer, {
            resumable: false,
        });

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
        });

        return NextResponse.json({ url });
    } catch (error) {
        console.error('Error uploading to storage:', error);
        return NextResponse.json({ error: 'Failed to upload to storage' }, { status: 500 });
    }
} 