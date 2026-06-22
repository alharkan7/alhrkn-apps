import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { beeblioFiles } from '@/db/schema';
import { uploadFile } from '@/lib/storage';

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // Create unique filename
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const destination = `beeblio/${user.id}/${fileName}`;

    // Upload to Google Cloud Storage (or the configured bucket)
    const uploadedPath = await uploadFile(buffer, {
      destination,
      contentType: file.type,
    });

    const fileUrl = `https://storage.googleapis.com/${process.env.GOOGLE_CLOUD_BUCKET}/${uploadedPath}`;

    // Save to DB
    const [insertedFile] = await db.insert(beeblioFiles).values({
      userId: user.id,
      fileName: file.name,
      fileUrl: fileUrl,
    }).returning({ 
      id: beeblioFiles.id, 
      fileUrl: beeblioFiles.fileUrl, 
      fileName: beeblioFiles.fileName 
    });

    return NextResponse.json({ 
      success: true, 
      file: {
        ...insertedFile,
        fileName: insertedFile.fileName || file.name
      }
    });

  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
