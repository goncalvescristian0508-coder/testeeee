export default async function handler(req, res) {
  const { id } = req.query
  try {
    const r = await fetch(`${process.env.VPS_URL}/status/${id}`, {
      headers: { 'x-bot-secret': process.env.BOT_SECRET },
    })
    res.status(r.status).json(await r.json())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
