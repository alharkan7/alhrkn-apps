import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Return dummy data since we no longer use user-specific MySQL or API keys
    return NextResponse.json({
      mysqlConfig: { host: 'supabase', user: 'postgres', database: 'postgres' },
      googleApiKey: 'configured_in_env'
    });
  } catch (error: any) {
    console.error('Error fetching user config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user configuration' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Dummy success since we are no longer using this configuration route
    return NextResponse.json({
      success: true,
      message: 'Configuration saved successfully (Using default Supabase DB)'
    });
  } catch (error: any) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}
