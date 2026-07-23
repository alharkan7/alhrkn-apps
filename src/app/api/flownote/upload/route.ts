import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { getBucket } from '@/lib/storage/client';
import { GoogleGenerativeAI } from '@/lib/google-ai-proxy';
import { GoogleAIFileManager } from '@/lib/google-ai-proxy';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a temp directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flownote-upload-'));
    
    // Use a sanitized filename with the original extension
    const ext = path.extname(file.name).toLowerCase();
    const inputFilePath = path.join(tempDir, `input${ext}`);
    const outputFilePath = path.join(tempDir, 'output.md');

    await fs.writeFile(inputFilePath, buffer);

    // Check for PDF
    if (ext === '.pdf') {
      await fs.rm(tempDir, { recursive: true, force: true });
      return NextResponse.json({ error: 'PDF conversion is disabled' }, { status: 400 });

      /* 
      // Temporarily disabled PDF processing via Gemini
      try {
        if (!process.env.GOOGLE_API_KEY) {
            throw new Error('Missing GOOGLE_API_KEY for PDF conversion');
        }
        
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const fileManager = new GoogleAIFileManager(process.env.GOOGLE_API_KEY);
        
        // Upload the file to Gemini
        const uploadResult = await fileManager.uploadFile(inputFilePath, {
            mimeType: 'application/pdf',
            displayName: 'Document for Flownote'
        });

        // Prompt Gemini to extract text to markdown
        const model = genAI.getGenerativeModel({ model: process.env.FLOWNOTE_UPLOAD_MODEL || "gemini-2.5-flash" });
        const result = await model.generateContent([
            { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } },
            { text: "Extract the text content from this document and output it as clean, structured Markdown. Use appropriate headings (# for title, ## for sections), bullet points, and paragraphs. Do not add any conversational text outside of the extracted markdown content." }
        ]);
        
        const markdown = result.response.text();

        // Cleanup
        await fileManager.deleteFile(uploadResult.file.name).catch(console.error);
        await fs.rm(tempDir, { recursive: true, force: true });
        
        return NextResponse.json({ markdown });
      } catch (pdfError: any) {
        console.error('PDF conversion via Gemini failed:', pdfError);
        await fs.rm(tempDir, { recursive: true, force: true });
        return NextResponse.json({ error: 'Failed to convert PDF document' }, { status: 500 });
      }
      */
    }

    // Convert with pandoc
    try {
      await execAsync(`pandoc "${inputFilePath}" -t markdown -o "${outputFilePath}"`);
    } catch (pandocError: any) {
      console.error('Pandoc conversion error:', pandocError);
      await fs.rm(tempDir, { recursive: true, force: true });
      const errorMessage = pandocError.stderr ? pandocError.stderr.toString().trim() : 'Failed to convert document';
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    const markdown = await fs.readFile(outputFilePath, 'utf8');

    // Upload to GCP bucket
    const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const gcpFilePath = `flownote/${safeFileName}`;
    
    const bucket = getBucket();
    const gcpFile = bucket.file(gcpFilePath);
    await gcpFile.save(buffer, {
      resumable: false,
    });

    // Clean up local temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    return NextResponse.json({ markdown, path: gcpFilePath, fileName: file.name });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to process document' }, { status: 500 });
  }
}
