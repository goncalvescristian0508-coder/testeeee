import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'

const CARD = { background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: 24, marginBottom: 20 }
const TH = { padding: '8px 14px', color: '#666', fontWeight: 500, textAlign: 'left', borderBottom: '1px solid #2a2a2a', whiteSpace: 'nowrap', fontSize: 12 }
const TD = { padding: '10px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13 }

const STATUS = {
  running:      { icon: '🔄', color: '#3498db' },
  done:         { icon: '✅', color: '#2ecc71' },
  error:        { icon: '❌', color: '#e74c3c' },
  suspended:    { icon: '⚠️', color: '#f39c12' },
  waiting_otp:  { icon: '📧', color: '#9b59b6' },
}

export default function Dashboard() {
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [creating, setCreating] = useState(false)
  const [flash, setFlash]     = useState('')
  const [jobs, setJobs]       = useState([])
  const [accounts, setAccounts] = useState([])
  const [openJob, setOpenJob] = useState(null)
  const [jobLogs, setJobLogs] = useState({})
  const [lastRefresh, setLastRefresh] = useState(null)

  const reload = useCallback(async () => {
    const [j, a] = await Promise.all([
      fetch('/api/jobs').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/accounts').then(r => r.ok ? r.json() : []).catch(() => []),
    ])
    setJobs(j)
    setAccounts(a)
    setLastRefresh(new Date())
  }, [])

  useEffect(() => {
    reload()
    const t = setInterval(reload, 15000)
    return () => clearInterval(t)
  }, [reload])

  // Auto-refresh logs for active expanded job
  useEffect(() => {
    if (!openJob) return
    const job = jobs.find(j => j.id === openJob)
    if (!job || !['running', 'waiting_otp'].includes(job.status)) return
    const pull = () => fetch(`/api/status/${openJob}`)
      .then(r => r.json())
      .then(d => setJobLogs(p => ({ ...p, [openJob]: d.logs || [] })))
      .catch(() => {})
    pull()
    const t = setInterval(pull, 5000)
    return () => clearInterval(t)
  }, [openJob, jobs])

  const toggleJob = async (id) => {
    if (openJob === id) { setOpenJob(null); return }
    setOpenJob(id)
    const d = await fetch(`/api/status/${id}`).then(r => r.json()).catch(() => ({}))
    setJobLogs(p => ({ ...p, [id]: d.logs || [] }))
  }

  const submitCreate = async () => {
    if (!email || !pass) return
    setCreating(true); setFlash('')
    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, emailPassword: pass }),
      })
      const data = await res.json()
      if (res.ok) {
        setFlash(`✅ Job criado: ${data.jobId.slice(0, 8)}`)
        setEmail(''); setPass('')
        setTimeout(reload, 1500)
      } else {
        setFlash(`❌ ${data.error || 'Erro desconhecido'}`)
      }
    } catch (e) { setFlash(`❌ ${e.message}`) }
    setCreating(false)
  }

  return (
    <>
      <Head>
        <title>IG Creator</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } body { background: #0a0a0a; } a { color: inherit; }`}</style>
      </Head>

      <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#eee', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', padding: '20px 16px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, background: 'linear-gradient(90deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            📸 IG Creator
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {lastRefresh && <span style={{ color: '#555', fontSize: 12 }}>{lastRefresh.toLocaleTimeString()}</span>}
            <button onClick={reload} style={{ background: '#222', border: 'none', color: '#aaa', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>↻ Atualizar</button>
          </div>
        </div>

        {/* Create form */}
        <div style={CARD}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>🆕 Criar Nova Conta</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitCreate()}
              placeholder="email@hotmail.com"
              style={{ flex: 1, minWidth: 200, background: '#0d0d0d', border: '1px solid #333', borderRadius: 7, padding: '9px 13px', color: '#fff', fontSize: 14, outline: 'none' }}
            />
            <input
              value={pass} onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitCreate()}
              placeholder="Senha do Hotmail" type="password"
              style={{ flex: 1, minWidth: 180, background: '#0d0d0d', border: '1px solid #333', borderRadius: 7, padding: '9px 13px', color: '#fff', fontSize: 14, outline: 'none' }}
            />
            <button
              onClick={submitCreate} disabled={creating}
              style={{ background: creating ? '#333' : '#c13584', border: 'none', color: '#fff', padding: '9px 22px', borderRadius: 7, cursor: creating ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, opacity: creating ? 0.7 : 1 }}
            >
              {creating ? '⏳ Criando...' : '🚀 Criar'}
            </button>
          </div>
          {flash && <p style={{ marginTop: 10, fontSize: 13, color: flash.startsWith('✅') ? '#2ecc71' : '#e74c3c' }}>{flash}</p>}
        </div>

        {/* Jobs */}
        <div style={CARD}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            🔎 Jobs <span style={{ color: '#2ecc71' }}>({jobs.length})</span>
            <span style={{ color: '#555', fontSize: 12, fontWeight: 400, marginLeft: 8 }}>auto-refresh 15s</span>
          </h2>
          {jobs.length === 0
            ? <p style={{ color: '#555' }}>Nenhum job ainda.</p>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Email', 'Status', 'Hora', 'Instagram', ''].map(h => <th key={h} style={TH}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[...jobs].reverse().map(job => {
                      const st = STATUS[job.status] || { icon: '❓', color: '#fff' }
                      const isOpen = openJob === job.id
                      return (
                        <React.Fragment key={job.id}>
                          <tr style={{ cursor: 'pointer' }} onClick={() => toggleJob(job.id)}>
                            <td style={TD}>{job.email}</td>
                            <td style={TD}><span style={{ color: st.color }}>{st.icon} {job.status}</span></td>
                            <td style={{ ...TD, color: '#666' }}>{new Date(job.createdAt).toLocaleTimeString()}</td>
                            <td style={TD}>
                              {job.instagramUrl
                                ? <a href={job.instagramUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#c13584', textDecoration: 'none' }}>Abrir →</a>
                                : '—'}
                            </td>
                            <td style={{ ...TD, textAlign: 'right', color: '#555', fontSize: 11 }}>{isOpen ? '▲' : '▼'}</td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={5} style={{ padding: '0 14px 14px', background: '#0f0f0f' }}>
                                <LogBox lines={jobLogs[job.id]} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        {/* Saved accounts */}
        <div style={CARD}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            💾 Contas Criadas <span style={{ color: '#2ecc71' }}>({accounts.length})</span>
          </h2>
          {accounts.length === 0
            ? <p style={{ color: '#555' }}>Nenhuma conta salva ainda.</p>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Email', 'Senha email', 'Instagram', 'Criada em'].map(h => <th key={h} style={TH}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[...accounts].reverse().map((acc, i) => (
                      <tr key={i}>
                        <td style={TD}><CopyCell text={acc.email} /></td>
                        <td style={TD}><BlurCell text={acc.emailPassword} /></td>
                        <td style={TD}>
                          {acc.instagramUrl
                            ? <><a href={acc.instagramUrl} target="_blank" rel="noreferrer" style={{ color: '#c13584', textDecoration: 'none' }}>{acc.instagramUrl.replace('https://www.instagram.com', '') || '/'}</a><CopyBtn text={acc.instagramUrl} /></>
                            : '—'}
                        </td>
                        <td style={{ ...TD, color: '#666' }}>{new Date(acc.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

      </div>
    </>
  )
}

function LogBox({ lines }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: 6, padding: '10px 14px', marginTop: 4, maxHeight: 240, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11.5, lineHeight: 1.8 }}>
      {lines?.length
        ? lines.slice(-30).map((line, i) => {
            const msg = line.replace(/^\S+ /, '')
            const c = /FATAL|erro|error/i.test(msg) ? '#e74c3c'
              : /Conta criada|sucesso|done/i.test(msg) ? '#2ecc71'
              : /\[otp\]|\[outlook\]|OTP|código/i.test(msg) ? '#9b59b6'
              : '#777'
            return <div key={i} style={{ color: c }}>{msg}</div>
          })
        : <span style={{ color: '#444' }}>Carregando logs...</span>}
    </div>
  )
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false)
  const click = (e) => {
    e.stopPropagation()
    navigator.clipboard?.writeText(text)
    setOk(true); setTimeout(() => setOk(false), 1500)
  }
  return (
    <button onClick={click} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ok ? '#2ecc71' : '#555', padding: '0 4px', fontSize: 13 }}>
      {ok ? '✓' : '📋'}
    </button>
  )
}

function CopyCell({ text }) {
  return <>{text} <CopyBtn text={text} /></>
}

function BlurCell({ text }) {
  const [show, setShow] = useState(false)
  if (!text) return <>—</>
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <span
        style={{ filter: show ? 'none' : 'blur(5px)', cursor: 'pointer', userSelect: show ? 'auto' : 'none' }}
        onClick={() => setShow(s => !s)}
      >
        {text}
      </span>
      {show && <CopyBtn text={text} />}
    </span>
  )
}
