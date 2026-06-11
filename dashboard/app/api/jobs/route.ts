import { NextResponse } from 'next/server';

const BOT_URL = process.env.BOT_URL || 'http://147.182.218.81:3001';
const BOT_SECRET = process.env.BOT_SECRET || '6cd233b9cf07f198ed526d86e9fa1b5f317c69ab530069fc';

export async function GET() {
  const res = await fetch(`${BOT_URL}/jobs`, {
    headers: { 'x-bot-secret': BOT_SECRET },
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data);
}
