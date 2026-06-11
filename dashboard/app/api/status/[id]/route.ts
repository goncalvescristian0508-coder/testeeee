import { NextRequest, NextResponse } from 'next/server';

const BOT_URL = process.env.BOT_URL || 'http://localhost:3001';
const BOT_SECRET = process.env.BOT_SECRET || '';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await fetch(`${BOT_URL}/status/${params.id}`, {
    headers: { 'x-bot-secret': BOT_SECRET },
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
