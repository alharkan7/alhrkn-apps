import { getBucket } from '@/lib/storage/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const fileUpload = formData.get('file') as File;
        
        if (!fileUpload) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        const bucket = getBucket();
        const buffer = Buffer.from(await fileUpload.arrayBuffer());
        
        const safeFileName = `${Date.now()}-${fileUpload.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `chat/${safeFileName}`;
        
        const file = bucket.file(filePath);
        await file.save(buffer, {
            resumable: false,
        });

        // Generate a signed URL
        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 12 * 60 * 60 * 1000,
        });

        return NextResponse.json({ url });
    } catch (error) {
        console.error('Error uploading:', error);
        return NextResponse.json(
            { error: 'Upload failed' },
            { status: 500 }
        );
    }
} 