import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Accepts: email, fileName, downloadFormat, description (user's query)
    const { email, fileName, downloadFormat, description } = body;
    
    // Format timestamp in a way Google Sheets can interpret as datetime
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(',', '');

    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const sheetId = process.env.GOOGLE_SHEETS_ID_PAPERMAP_EMAIL;

    // Download tracking is optional; never fail the download UX if Sheets is not configured
    if (!privateKey || !clientEmail || !sheetId) {
      console.warn('Skipping email download log: missing Google Sheets credentials');
      return NextResponse.json({ message: 'Skipped' }, { status: 200 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        private_key: privateKey.replace(/\\n/g, '\n'),
        client_email: clientEmail,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'Email Downloads!A:D';

    // Use fileName if present, otherwise use description (user's query), fallback to 'Unknown'
    const fileNameOrQuery = fileName || description || 'Unknown';

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      includeValuesInResponse: true,
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[timestamp, email, fileNameOrQuery, `${downloadFormat?.toUpperCase?.() || ''}`]],
      },
    });

    return NextResponse.json({ message: 'Success' }, { status: 200 });
  } catch (error) {
    console.error('Error saving email:', {
      name: error instanceof Error ? error.name : 'Unknown Error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
    });
    // Return success anyway since we don't want to block the download
    return NextResponse.json({ message: 'Success' }, { status: 200 });
  }
} 