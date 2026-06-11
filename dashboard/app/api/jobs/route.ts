import { NextResponse } from 'next/server';

const BOT_URL = process.env.BOT_URL || 'http://localhost:3001';
const BOT_SECRET = process.env.BOT_SECRET || '';

export async function GET() {
  const res = await fetch(`${BOT_URL}/jobs`, {
    headers: { 'x-bot-secret': BOT_SECRET },
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data);
}
