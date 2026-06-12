export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const r = await fetch(`${process.env.VPS_URL}/create-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': process.env.BOT_SECRET },
      body: JSON.stringify(req.body),
    })
    res.status(r.status).json(await r.json())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
