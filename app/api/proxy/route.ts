import { NextRequest, NextResponse } from 'next/server';

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

// All requests converted to GET to avoid Apps Script POST→GET redirect body loss
async function callAppsScript(params: Record<string, string>): Promise<unknown> {
  if (!APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL belum dikonfigurasi di .env.local');

  const url = new URL(APPS_SCRIPT_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), { redirect: 'follow' });
  const text = await response.text();
  return JSON.parse(text);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Build params: include each field as a direct URL param (for old Code.gs)
    // AND include full body JSON (for new Code.gs)
    const params: Record<string, string> = {
      body: JSON.stringify(body), // new Code.gs reads this
    };
    // Flatten top-level fields as URL params (old Code.gs reads these)
    for (const [k, v] of Object.entries(body)) {
      params[k] = String(v ?? '');
    }
    const data = await callAppsScript(params);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params: Record<string, string> = {};
    searchParams.forEach((v, k) => { params[k] = v; });
    const data = await callAppsScript(params);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
