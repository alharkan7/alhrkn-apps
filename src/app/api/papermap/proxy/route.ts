import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { mindmaps } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Define constants
const MAX_FILE_SIZE_MB = 25; // Same limit as in Sidebar.tsx
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Server-side proxy for fetching PDFs to avoid CORS issues
 * This endpoint fetches the PDF on the server and returns it to the client
 * Now also supports non-PDF URLs using Jina AI Reader for text extraction
 */
export async function GET(request: NextRequest) {
  try {
    // Get URL from query parameters
    const url = request.nextUrl.searchParams.get('url');
    // Get mindmapId from query parameters (optional)
    const mindmapId = request.nextUrl.searchParams.get('mindmapId') || undefined;
    
    // Validate URL
    if (!url) {
      return NextResponse.json(
        { error: "Missing URL parameter" },
        { status: 400 }
      );
    }

    // Attempt to perform basic URL validation
    try {
      new URL(url);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    console.log(`Proxy fetching content from: ${url}`);

    // OPTIMIZATION: Fast path for Vercel Blob URLs
    // If the URL is already a Vercel Blob URL, we can just return it directly
    // since it's already accessible and CORS-friendly
    if (url.includes('vercel-blob.com')) {
      console.log('URL is a Vercel Blob URL, returning directly without downloading');
      return NextResponse.json({
        success: true,
        isVercelBlob: true,
        contentType: 'application/pdf',
        fileName: extractFileName(url),
        directUrl: url
      });
    }

    // Check if URL is directly to a PDF by examining the URL extension (ignoring query strings)
    const urlWithoutQuery = url.split('?')[0];
    const isPdfUrl = urlWithoutQuery.toLowerCase().endsWith('.pdf');
    
    // If it looks like a PDF URL, proceed with PDF handling
    if (isPdfUrl) {
      return await handlePdfUrl(url);
    } else {
      // For non-PDF URLs, use Jina AI Reader for text extraction
      return await handleWebUrl(url, mindmapId);
    }

  } catch (error) {
    console.error('Error in proxy:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to proxy request" },
      { status: 500 }
    );
  }
}

/**
 * Handle PDF URLs by fetching and returning base64-encoded PDF data
 */
async function handlePdfUrl(url: string) {
  // Fetch the PDF
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/pdf',
    },
    // Use Node.js native fetch - no CORS issues on server
  });

  // Check for successful response
  if (!response.ok) {
    return NextResponse.json(
      { error: `Failed to fetch PDF: ${response.status} ${response.statusText}` },
      { status: response.status }
    );
  }

  // Verify content type is PDF
  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('application/pdf')) {
    // If we expected a PDF but got something else, use Jina AI Reader instead
    return await handleWebUrl(url);
  }

  // Check file size
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File is too large (${(parseInt(contentLength) / (1024 * 1024)).toFixed(2)} MB). Maximum file size is ${MAX_FILE_SIZE_MB} MB.` },
      { status: 413 }
    );
  }

  // Get the binary PDF data
  const pdfBuffer = await response.arrayBuffer();
  
  // Check actual size after download
  if (pdfBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File is too large (${(pdfBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB). Maximum file size is ${MAX_FILE_SIZE_MB} MB.` },
      { status: 413 }
    );
  }

  // Return content as JSON with base64 data
  return NextResponse.json({
    success: true,
    contentType: contentType || 'application/pdf',
    fileName: extractFileName(url),
    size: pdfBuffer.byteLength,
    base64Data: Buffer.from(pdfBuffer).toString('base64')
  });
}

/**
 * Handle web URLs by using Jina AI Reader for text extraction
 */
async function handleWebUrl(url: string, mindmapId?: string) {
  try {
    // Use Jina AI Reader to extract text from URL
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    console.log(`Using Jina AI Reader for URL: ${jinaUrl}`);
    
    // Fetch content from Jina AI Reader
    const jinaResponse = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; WritersUnblock/1.0)'
      },
    });
    
    if (!jinaResponse.ok) {
      return NextResponse.json(
        { error: `Failed to extract text from URL: ${jinaResponse.status} ${jinaResponse.statusText}` },
        { status: jinaResponse.status }
      );
    }
    
    // Get the extracted text
    const extractedText = await jinaResponse.text();

    // If mindmapId is provided, update the parsed_pdf_content column
    if (mindmapId) {
      try {
        const sanitizedText = extractedText.replace(/\0/g, '');
        await db.update(mindmaps)
          .set({ parsed_pdf_content: sanitizedText, updatedAt: new Date() })
          .where(eq(mindmaps.id, mindmapId));
        console.log(`[Proxy] Updated mindmap ${mindmapId} with parsed content from Jina.`);
      } catch (dbError) {
        console.error(`[Proxy] Failed to update mindmap ${mindmapId}:`, dbError);
      }
    }
    
    // Return the extracted text
    return NextResponse.json({
      success: true,
      isWebContent: true,
      contentType: 'text/plain',
      fileName: extractWebPageTitle(url),
      extractedText: extractedText,
      sourceUrl: url
    });
  } catch (error) {
    console.error('Error extracting text from URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract text from URL" },
      { status: 500 }
    );
  }
}

/**
 * Extract a sensible filename from a URL
 */
function extractFileName(url: string): string {
  try {
    // Try to get filename from URL path
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    let fileName = pathParts[pathParts.length - 1];
    
    // If we found a filename
    if (fileName && fileName.trim() !== '') {
      // If it doesn't end with .pdf, add the extension
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        fileName += '.pdf';
      }
      return fileName;
    }
    
    // Fallback to a default name with the domain
    return `document-from-${urlObj.hostname}.pdf`;
  } catch (e) {
    // If URL parsing fails, use a generic name
    return 'document.pdf';
  }
}

/**
 * Extract a title for the web page from URL
 */
function extractWebPageTitle(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    
    // Extract slug from path if available
    const pathParts = urlObj.pathname.split('/').filter(part => part.trim() !== '');
    const slug = pathParts.length > 0 ? pathParts[pathParts.length - 1] : '';
    
    // Use slug if available, otherwise use the hostname
    if (slug && slug.length > 0) {
      // Clean up the slug
      const cleanSlug = slug
        .replace(/-/g, ' ')
        .replace(/\.(html|htm|php|aspx?)$/i, '')
        .trim();
      
      if (cleanSlug.length > 0) {
        return `${cleanSlug} (${hostname})`;
      }
    }
    
    // Fallback to just the hostname
    return `Content from ${hostname}`;
  } catch (e) {
    // If URL parsing fails, use a generic name
    return 'Web content';
  }
} 