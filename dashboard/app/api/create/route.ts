import { NextRequest, NextResponse } from 'next/server';

const BOT_URL = process.env.BOT_URL || 'http://147.182.218.81:3001';
const BOT_SECRET = process.env.BOT_SECRET || '6cd233b9cf07f198ed526d86e9fa1b5f317c69ab530069fc';

export async function POST(req: NextRequest) {
  const { email, password, noProxy } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }

  const res = await fetch(`${BOT_URL}/create-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': BOT_SECRET,
    },
    body: JSON.stringify({ email, emailPassword: password, noProxy: Boolean(noProxy) }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
