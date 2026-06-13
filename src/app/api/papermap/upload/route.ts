import { NextRequest, NextResponse } from 'next/server';
import { getBucket } from '@/lib/storage/client';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = getBucket();
    
    // Add unique prefix to avoid collisions and put in papermap subfolder
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const destinationPath = `papermap/${uniqueId}-${sanitizedName}`;

    const gcsFile = bucket.file(destinationPath);
    
    await gcsFile.save(buffer, {
      contentType: file.type,
      resumable: false,
    });

    try {
      await gcsFile.makePublic();
    } catch (e) {
      console.warn("Could not make file public explicitly (bucket might have uniform bucket-level access or it's already public)", e);
    }

    // Generate a 12-hour signed URL instead of a purely public URL
    // This allows access even if uniform bucket-level access prevents makePublic()
    const [signedUrl] = await gcsFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
    });

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error('Error uploading to GCP:', error);
    return NextResponse.json(
      { error: 'Failed to upload file to Google Cloud Storage' },
      { status: 500 }
    );
  }
}
