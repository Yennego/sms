// pages/api/test.ts (or app/api/test/route.ts)
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('--- Reached /api/test ---');
  return NextResponse.json({ message: 'Hello from test API route!' });
}
