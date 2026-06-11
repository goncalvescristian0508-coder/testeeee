'use client';

import { useState, useEffect, useCallback } from 'react';

const PRESET_EMAILS = [
  { email: 'GoldieLangenfeld490@hotmail.com', password: 'kteBlMD4d7VN' },
  { email: 'FaulkenberryAlma6379@hotmail.com', password: '2H9AfJbgS' },
  { email: 'RuvalcavaGoettsche028@hotmail.com', password: 'p5aHFZal' },
  { email: 'KerschLetang55@hotmail.com', password: 'NMdSNI8E9L' },
  { email: 'WaligoraRadona77@hotmail.com', password: 'jx23hjM8IHa' },
  { email: 'GoffinetPapanikolas6324@hotmail.com', password: 'jgcL0Uh8FY' },
  { email: 'KendallKrewson458@hotmail.com', password: '9yMkI2R2vg7' },
  { email: 'AllorFriddell7728@hotmail.com', password: 'gsNaE33695' },
  { email: 'CarmickelOlenius9937@hotmail.com', password: 'b5Mg6UEtMQ' },
  { email: 'EvelynRegehr238@hotmail.com', password: 'PLO7Mj3f4' },
];

type Job = {
  id: string;
  email: string;
  status: 'running' | 'done' | 'error' | 'suspended';
  createdAt: string;
  instagramUrl?: string;
  error?: string;
  logs?: string[];
};

const DOT: Record<string, string> = {
  running: '#f59e0b',
  done: '#22c55e',
  error: '#ef4444',
  suspended: '#a855f7',
};

const inp: React.CSSProperties = {
  background: '#111',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#f1f1f1',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const btn: React.CSSProperties = {
  background: '#e91e8c',
  border: 'none',
  borderRadius: 8,
  padding: '10px 20px',
  color: '#fff',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [noProxy, setNoProxy] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) setJobs(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchJobs();
    const id = setInterval(fetchJobs, 5000);
    return () => clearInterval(id);
  }, [fetchJobs]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, noProxy }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`✓ Job iniciado: ${data.jobId.slice(0, 8)}...`);
        setEmail('');
        setPassword('');
        fetchJobs();
      } else {
        setMsg(`Erro: ${data.error}`);
      }
    } catch (err: any) {
      setMsg(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function openLogs(job: Job) {
    try {
      const res = await fetch(`/api/status/${job.id}`);
      if (res.ok) setSelectedJob(await res.json());
    } catch {}
  }

  function fillPreset(e: React.ChangeEvent<HTMLSelectElement>) {
    const p = PRESET_EMAILS.find((x) => x.email === e.target.value);
    if (p) { setEmail(p.email); setPassword(p.password); }
    e.target.value = '';
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Instagram Account Creator</h1>
      <p style={{ color: '#555', margin: '0 0 32px', fontSize: 13 }}>VPS: 147.182.218.81:3001</p>

      {/* Form */}
      <div style={{ background: '#141414', borderRadius: 12, padding: 24, marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, color: '#aaa', marginTop: 0 }}>Criar conta</h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <select defaultValue="" onChange={fillPreset} style={{ ...inp, cursor: 'pointer' }}>
            <option value="">Selecionar email pré-configurado...</option>
            {PRESET_EMAILS.map((x) => (
              <option key={x.email} value={x.email}>{x.email}</option>
            ))}
          </select>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (ex: user@hotmail.com)"
            style={inp}
            required
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha do email"
            style={inp}
            required
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={noProxy} onChange={(e) => setNoProxy(e.target.checked)} />
            Sem proxy (IP direto do VPS)
          </label>

          <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Iniciando...' : 'Criar conta'}
          </button>

          {msg && (
            <p style={{ margin: 0, fontSize: 13, color: msg.startsWith('Erro') ? '#ef4444' : '#22c55e' }}>
              {msg}
            </p>
          )}
        </form>
      </div>

      {/* Jobs */}
      <div style={{ background: '#141414', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, color: '#aaa', margin: 0 }}>Jobs ({jobs.length})</h2>
          <button onClick={fetchJobs} style={{ ...btn, padding: '5px 14px', fontSize: 12, background: '#222' }}>
            Atualizar
          </button>
        </div>

        {jobs.length === 0 && <p style={{ color: '#555', fontSize: 13 }}>Nenhum job ainda.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...jobs].reverse().map((job) => (
            <div
              key={job.id}
              onClick={() => openLogs(job)}
              style={{
                background: '#0f0f0f',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                border: selectedJob?.id === job.id ? '1px solid #333' : '1px solid transparent',
              }}
            >
              <span style={{
                width: 9, height: 9, borderRadius: '50%',
                background: DOT[job.status] || '#888', flexShrink: 0,
              }} />
              <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {job.email}
              </span>
              <span style={{ color: DOT[job.status] || '#888', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {job.status.toUpperCase()}
              </span>
              <span style={{ color: '#444', fontSize: 11, flexShrink: 0 }}>
                {new Date(job.createdAt).toLocaleTimeString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Logs modal */}
      {selectedJob && (
        <div
          onClick={() => setSelectedJob(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#111', borderRadius: 12, padding: 24,
              width: '90%', maxWidth: 720, maxHeight: '80vh',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#aaa' }}>
                <strong style={{ color: DOT[selectedJob.status] }}>{selectedJob.status.toUpperCase()}</strong>
                {' — '}{selectedJob.email}
              </span>
              <button
                onClick={() => openLogs(selectedJob)}
                style={{ ...btn, padding: '4px 12px', fontSize: 12, background: '#222', marginRight: 8 }}
              >
                Refresh
              </button>
              <button
                onClick={() => setSelectedJob(null)}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {selectedJob.instagramUrl && (
              <a
                href={selectedJob.instagramUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#22c55e', fontSize: 12 }}
              >
                {selectedJob.instagramUrl}
              </a>
            )}
            {selectedJob.error && (
              <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>Erro: {selectedJob.error}</p>
            )}

            <div style={{
              background: '#000', borderRadius: 6, padding: 12,
              fontFamily: 'monospace', fontSize: 11, color: '#0f0',
              overflow: 'auto', flex: 1,
            }}>
              {(selectedJob.logs || []).length === 0
                ? <span style={{ color: '#444' }}>Sem logs.</span>
                : (selectedJob.logs || []).map((line, i) => <div key={i}>{line}</div>)
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
