import { generateOpenGraphImage } from '@/lib/opengraph-image';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || "@alhrkn's Apps Gallery";
  const description = searchParams.get('description') || "Collection of Experimental AI Apps";
  const path = searchParams.get('path') || "";

  return generateOpenGraphImage({ title, description, path });
}
