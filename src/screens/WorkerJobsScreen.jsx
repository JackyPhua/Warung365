// src/screens/WorkerJobsScreen.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import DispatchService from '../services/DispatchService'

function formatTime(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function errText(t, e) {
  const code = e?.message
  if (code === 'WORKER_MODE_REQUIRED') return t('jobErrWorkerMode')
  if (code === 'NATIVE_APK_REQUIRED') return t('jobErrNativeApk')
  return e?.message || String(e)
}

export default function WorkerJobsScreen({ onNavigate, job }) {
  const { t } = useApp()
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    if (!job?.jobId) return
    setJobs(prev => (prev.some(j => j.jobId === job.jobId) ? prev : [job, ...prev]))
  }, [job])

  useEffect(() => {
    const handler = (incoming) => {
      if (!incoming?.jobId) return
      setJobs(prev => (prev.some(j => j.jobId === incoming.jobId) ? prev : [incoming, ...prev]))
    }
    DispatchService.onJob = handler
    return () => { if (DispatchService.onJob === handler) DispatchService.onJob = null }
  }, [])

  const pending = useMemo(() => jobs.filter(j => !j.doneAt), [jobs])

  const handleAccept = async (j) => {
    if (j.doneAt || j.acceptedAt) return
    try {
      await DispatchService.acceptJob(j.jobId)
      setJobs(prev => prev.map(x => x.jobId === j.jobId ? { ...x, acceptedAt: new Date().toISOString() } : x))
    } catch (e) {
      alert(`${t('error')}: ${errText(t, e)}`)
    }
  }

  const handleDone = async (j) => {
    if (j.doneAt) return
    const doneAt = new Date().toISOString()
    setJobs(prev => prev.map(x => x.jobId === j.jobId ? { ...x, doneAt } : x))
    try {
      await DispatchService.doneJob(j.jobId)
    } catch (e) {
      setJobs(prev => prev.map(x => x.jobId === j.jobId ? { ...x, doneAt: undefined } : x))
      alert(`${t('error')}: ${errText(t, e)}`)
    }
  }

  return (
    <div style={S.container}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => onNavigate('sync')}>←</button>
        <div style={{ color: 'var(--primary)', fontSize: 16, fontWeight: 800 }}>🧾 {t('myJobs')}</div>
        <div style={{ width: 70 }} />
      </div>

      <div style={S.scroll}>
        <div style={S.statusBox}>
          <div style={{ color: 'var(--success)', fontWeight: 800 }}>● {t('connected')}</div>
          <div style={{ color: 'var(--text-light)', fontSize: 12, marginTop: 6 }}>
            {pending.length} {t('jobsPending')}
          </div>
        </div>

        {jobs.length === 0 ? (
          <div style={S.empty}>{t('noNewJobs')}</div>
        ) : jobs.map(job => (
          <div key={job.jobId} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ color: 'var(--text)', fontWeight: 900, fontSize: 16 }}>
                🪑 {t('tableNo')} {job.tableId === 0 ? t('takeaway') : job.tableId}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {formatTime(job.placedAt)}
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              {job.items.map((it, idx) => (
                <div key={idx} style={S.itemRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700 }}>
                      {it.qty}x {it.name}
                    </div>
                    {it.note && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                        📝 {it.note}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {job.doneAt ? (
              <div style={{ marginTop: 12, color: 'var(--success)', fontWeight: 800, fontSize: 14 }}>
                ✓ {t('doneJob')} · {formatTime(job.doneAt)}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" style={{ ...S.btn, opacity: job.acceptedAt ? 0.55 : 1 }}
                  disabled={!!job.acceptedAt}
                  onClick={() => handleAccept(job)}>✅ {t('acceptJob')}</button>
                <button type="button" style={{ ...S.btn, background: 'var(--success)', color: '#FFF' }}
                  onClick={() => handleDone(job)}>
                  🏁 {t('doneJob')}
                </button>
              </div>
            )}
            {job.acceptedAt && !job.doneAt && (
              <div style={{ marginTop: 8, color: 'var(--primary)', fontSize: 12, fontWeight: 700 }}>
                {t('jobAcceptedAt')} {formatTime(job.acceptedAt)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const S = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 18px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
  },
  backBtn: { background: 'var(--bg-lighter)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', color: 'var(--text)', fontSize: 14 },
  scroll: { flex: 1, overflow: 'auto', padding: 16 },
  statusBox: { background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 12, padding: 14, marginBottom: 12 },
  empty: { color: 'var(--text-muted)', textAlign: 'center', padding: 60 },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: 'var(--shadow-sm)' },
  itemRow: { display: 'flex', alignItems: 'flex-start', padding: '8px 0', borderTop: '1px dashed var(--border)' },
  btn: { flex: 1, background: 'var(--bg-lighter)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 800, color: 'var(--text)' },
}

