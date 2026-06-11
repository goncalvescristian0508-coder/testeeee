import { NextRequest, NextResponse } from 'next/server';

const BOT_URL = process.env.BOT_URL || 'http://localhost:3001';
const BOT_SECRET = process.env.BOT_SECRET || '';

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
