export default async function handler(req, res) {
  try {
    const r = await fetch(`${process.env.VPS_URL}/created-accounts`, {
      headers: { 'x-bot-secret': process.env.BOT_SECRET },
    })
    res.status(r.status).json(await r.json())
  } catch (e) {
    res.status(500).json([])
  }
}
