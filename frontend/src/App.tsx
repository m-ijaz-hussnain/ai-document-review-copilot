import React, { useCallback, useEffect, useState } from "react";
import { api, getToken, setToken, Paged, Doc, Finding, Policy, Stats } from "./api/client";
import { Loading, Empty, ErrorBox, Badge } from "./components/States";

type Page = "dashboard" | "documents" | "findings" | "policies" | "evaluation" | "settings";
interface User { username: string; role: string; email?: string; first_name?: string; last_name?: string; organization_name?: string | null; date_joined?: string; is_active?: boolean; }

// --- Toast system: no prop drilling. Any component calls toast.success/error/info;
// ToastHost (rendered in App) listens for the CustomEvent and auto-dismisses after 4s.
export type ToastKind = "success" | "error" | "info";
export const toast = {
  show: (message: string, kind: ToastKind = "info") => { window.dispatchEvent(new CustomEvent("copilot-toast", { detail: { message, kind } })); },
  success: (message: string) => toast.show(message, "success"),
  error: (message: string) => toast.show(message, "error"),
  info: (message: string) => toast.show(message, "info"),
};
function displayName(u: User): string { const full = `${u.first_name || ""} ${u.last_name || ""}`.trim(); return full || u.username; }
function initials(u: User): string {
  const parts = [u.first_name, u.last_name].map(s => (s || "").trim()).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return u.username.slice(0, 2).toUpperCase();
}
function Avatar({ user, size }: { user: User; size: number }) {
  return (<span className="avatar" style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}>{initials(user)}</span>);
}
function ToastHost() {
  const [items, setItems] = useState<{ id: number; message: string; kind: ToastKind }[]>([]);
  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent).detail as { message: string; kind: ToastKind };
      const id = Date.now() + Math.random();
      setItems(prev => [...prev, { id, message: d.message, kind: d.kind }]);
      window.setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 4000);
    };
    window.addEventListener("copilot-toast", onToast);
    return () => window.removeEventListener("copilot-toast", onToast);
  }, []);
  if (!items.length) return null;
  return (<div className="toast-host" role="status" aria-live="polite">
    {items.map(t => <div key={t.id} className={`toast toast-${t.kind}`}><span>{t.message}</span><button type="button" aria-label="Dismiss notification" onClick={() => setItems(prev => prev.filter(x => x.id !== t.id))}>&times;</button></div>)}
  </div>);
}

function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null); const [err, setErr] = useState(""); const [loading, setLoading] = useState(true);
  const reload = useCallback(() => { setLoading(true); fn().then(d => { setData(d); setErr(""); }).catch(e => setErr(e.message)).finally(() => setLoading(false)); }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, err, loading, reload };
}

export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [flash, setFlash] = useState("");

  // Logout flash: set by App on logout, shown once here, then cleared.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("copilot_flash");
      if (raw) { const d = JSON.parse(raw) as { message?: string }; if (d.message) setFlash(d.message); }
    } catch { /* ignore malformed flash */ }
    sessionStorage.removeItem("copilot_flash");
  }, []);

  // Mouse Parallax Tracker
  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const x = (clientX / window.innerWidth - 0.5) * 25;
    const y = (clientY / window.innerHeight - 0.5) * 25;
    setMousePos({ x, y });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ token: string; user: User }>("/api/v1/auth/login/", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      setToken(r.token);
      onLogin(r.user);
    } catch (ex: any) {
      setErr(ex.message || "Authentication failed. Please verify your enterprise credentials or role permissions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="login-wrap"
      onMouseMove={handleMouseMove}
      style={{
        background: 'radial-gradient(circle at 50% 25%, #0b1329 0%, #020617 100%)',
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 0,
        padding: '1rem',
        overflow: 'hidden',
        zIndex: 9999,
        boxSizing: 'border-box'
      }}
    >
      {/* Background Matrix Grid */}
      <div style={{
        position: 'absolute',
        inset: '-30px',
        backgroundImage: 'radial-gradient(rgba(56, 189, 248, 0.15) 1.5px, transparent 1.5px)',
        backgroundSize: '32px 32px',
        opacity: 0.3,
        transform: `translate(${mousePos.x * 0.2}px, ${mousePos.y * 0.2}px)`,
        transition: 'transform 0.15s ease-out',
        pointerEvents: 'none'
      }} />

      {/* --- SEQUENTIAL PERIMETER WORKFLOW PATH & BOXES --- */}

      {/* SVG Connecting Perimeter Path (- - - Dashed Flow around Form) */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
        <rect
          x="12%" y="15%" width="76%" height="70%" rx="24"
          fill="none" stroke="rgba(56, 189, 248, 0.35)" strokeWidth="2.5" strokeDasharray="10 10"
          className="perimeter-dash-loop"
        />
      </svg>

      {/* Step 1: Upload & Ingest (Bottom-Left) */}
      <div className="workflow-card step-1-card" style={{
        position: 'absolute',
        bottom: '18%',
        left: '8%',
        width: '160px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(56, 189, 248, 0.4)',
        borderRadius: '12px',
        padding: '0.85rem',
        boxShadow: '0 15px 30px rgba(0,0,0,0.6)',
        zIndex: 5,
        pointerEvents: 'none',
        transform: `translate(${mousePos.x * 0.6}px, ${mousePos.y * 0.6}px)`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>1</div>
          <span style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 700 }}>Upload &amp; Ingest</span>
        </div>
        <div style={{ fontSize: '9px', color: '#94a3b8', lineHeight: 1.4 }}>PDF, DOCX or TXT queued to backend parser.</div>
      </div>

      {/* Step 2: AI Vector RAG (Top-Left) */}
      <div className="workflow-card step-2-card" style={{
        position: 'absolute',
        top: '18%',
        left: '8%',
        width: '160px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(168, 85, 247, 0.4)',
        borderRadius: '12px',
        padding: '0.85rem',
        boxShadow: '0 15px 30px rgba(0,0,0,0.6)',
        zIndex: 5,
        pointerEvents: 'none',
        transform: `translate(${mousePos.x * 0.8}px, ${mousePos.y * 0.8}px)`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>2</div>
          <span style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 700 }}>AI Vector RAG</span>
        </div>
        <div style={{ fontSize: '9px', color: '#94a3b8', lineHeight: 1.4 }}>Embeddings scanned via AWS Bedrock.</div>
      </div>

      {/* Step 3: Rule Findings (Top-Right) */}
      <div className="workflow-card step-3-card" style={{
        position: 'absolute',
        top: '18%',
        right: '8%',
        width: '160px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        borderRadius: '12px',
        padding: '0.85rem',
        boxShadow: '0 15px 30px rgba(0,0,0,0.6)',
        zIndex: 5,
        pointerEvents: 'none',
        transform: `translate(${-mousePos.x * 0.8}px, ${-mousePos.y * 0.8}px)`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>3</div>
          <span style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 700 }}>Rule Findings</span>
        </div>
        <div style={{ fontSize: '9px', color: '#94a3b8', lineHeight: 1.4 }}>Deterministic compliance check &amp; evidence.</div>
      </div>

      {/* Step 4: Approve / Audit (Bottom-Right) */}
      <div className="workflow-card step-4-card" style={{
        position: 'absolute',
        bottom: '18%',
        right: '8%',
        width: '160px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(52, 211, 153, 0.4)',
        borderRadius: '12px',
        padding: '0.85rem',
        boxShadow: '0 15px 30px rgba(0,0,0,0.6)',
        zIndex: 5,
        pointerEvents: 'none',
        transform: `translate(${-mousePos.x * 0.6}px, ${-mousePos.y * 0.6}px)`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>✓</div>
          <span style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 700 }}>Approve / Audit</span>
        </div>
        <div style={{ fontSize: '9px', color: '#94a3b8', lineHeight: 1.4 }}>Human-in-the-loop decision saved.</div>
      </div>

      <style>{`
        @keyframes enterpriseEntrance {
          0% { opacity: 0; transform: translateY(20px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shakeError {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        @keyframes dashLoopFlow {
          to { stroke-dashoffset: -40; }
        }

        /* One by one sequential activation (8s total cycle) */
        @keyframes sequentialStep1 {
          0%, 20%, 100% { opacity: 0.35; border-color: rgba(56, 189, 248, 0.3); box-shadow: 0 10px 20px rgba(0,0,0,0.4); transform: scale(0.97); }
          2%, 18% { opacity: 1; border-color: rgba(56, 189, 248, 1); box-shadow: 0 0 25px rgba(56, 189, 248, 0.5); transform: scale(1.03); }
        }
        @keyframes sequentialStep2 {
          0%, 20%, 45%, 100% { opacity: 0.35; border-color: rgba(168, 85, 247, 0.3); box-shadow: 0 10px 20px rgba(0,0,0,0.4); transform: scale(0.97); }
          22%, 43% { opacity: 1; border-color: rgba(168, 85, 247, 1); box-shadow: 0 0 25px rgba(168, 85, 247, 0.5); transform: scale(1.03); }
        }
        @keyframes sequentialStep3 {
          0%, 45%, 70%, 100% { opacity: 0.35; border-color: rgba(245, 158, 11, 0.3); box-shadow: 0 10px 20px rgba(0,0,0,0.4); transform: scale(0.97); }
          47%, 68% { opacity: 1; border-color: rgba(245, 158, 11, 1); box-shadow: 0 0 25px rgba(245, 158, 11, 0.5); transform: scale(1.03); }
        }
        @keyframes sequentialStep4 {
          0%, 70%, 95%, 100% { opacity: 0.35; border-color: rgba(52, 211, 153, 0.3); box-shadow: 0 10px 20px rgba(0,0,0,0.4); transform: scale(0.97); }
          72%, 93% { opacity: 1; border-color: rgba(52, 211, 153, 1); box-shadow: 0 0 25px rgba(52, 211, 153, 0.5); transform: scale(1.03); }
        }

        .perimeter-dash-loop {
          animation: dashLoopFlow 4s linear infinite;
        }
        .step-1-card { animation: sequentialStep1 8s infinite ease-in-out; }
        .step-2-card { animation: sequentialStep2 8s infinite ease-in-out; }
        .step-3-card { animation: sequentialStep3 8s infinite ease-in-out; }
        .step-4-card { animation: sequentialStep4 8s infinite ease-in-out; }

        .animate-enterprise-card {
          animation: enterpriseEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-shake {
          animation: shakeError 0.4s ease-in-out;
        }
        @media (max-width: 1200px) {
          .workflow-card, .perimeter-dash-loop { display: none !important; }
        }
        @media (max-width: 640px) {
          .login-card-desc { display: none !important; }
          .login-brand-title { font-size: 1.15rem !important; }
          .login-brand-icon { width: 38px !important; height: 38px !important; }
        }
      `}</style>

      {/* Fully Responsive & Centered Login Card */}
      <div className="card login-card animate-enterprise-card" style={{
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.12)',
        background: '#ffffff',
        borderRadius: '16px',
        padding: '2.25rem',
        maxWidth: '440px',
        width: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        zIndex: 10,
        position: 'relative',
        margin: 'auto',
        boxSizing: 'border-box'
      }}>

        {/* Brand Header with Custom SVG Shield Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.2rem' }}>
          <div className="login-brand-icon" style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, #0f3d73 100%)',
            color: '#fff',
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px -4px rgba(31, 95, 168, 0.3)',
            flexShrink: 0
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
          </div>
          <div>
            <h1 className="login-brand-title" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
              Compliance Copilot
            </h1>
            <span className="muted small" style={{ fontWeight: 500, fontSize: '0.75rem' }}>AWS Bedrock &bull; RAG &bull; Django REST</span>
          </div>
        </div>

        {/* Short & Professional Description */}
        <p className="muted small login-card-desc" style={{ marginBottom: '1.5rem', lineHeight: '1.5', color: '#475569', fontSize: '0.83rem' }}>
          Secure enterprise gateway for automated document ingestion, RAG auditing, and compliance verification.
        </p>

        {flash && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.7rem 0.9rem', borderRadius: '8px', fontSize: '0.85rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <path d="M20 6 9 17l-5-5"></path>
            </svg>
            <span>{flash}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setFlash("")} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#166534', cursor: 'pointer', fontSize: '1.1rem', boxShadow: 'none', padding: 0 }}>&times;</button>
          </div>
        )}

        {err && (
          <div className="error-box animate-shake" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.1rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.7rem 0.9rem', borderRadius: '8px', fontSize: '0.85rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{err}</span>
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.05rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#334155' }}>
            Username / Identifier
            <input
              aria-label="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              placeholder="e.g. admin, reviewer, uploader"
              style={{ padding: '0.65rem 0.85rem', fontSize: '0.9rem', borderRadius: '8px', border: '1px solid var(--line)', outline: 'none', width: '100%', background: '#fff', color: 'var(--ink)' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#334155' }}>
            Password
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <input
                aria-label="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ padding: '0.65rem 2.75rem 0.65rem 0.85rem', fontSize: '0.9rem', margin: 0, width: '100%', borderRadius: '8px', border: '1px solid var(--line)', outline: 'none', background: '#fff', color: 'var(--ink)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'transparent',
                  color: '#64748b',
                  border: 'none',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'none',
                  borderRadius: '4px'
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%',
              marginTop: '0.5rem',
              padding: '0.75rem 1rem',
              fontWeight: 700,
              fontSize: '0.95rem',
              letterSpacing: '0.01em',
              background: 'linear-gradient(135deg, var(--accent) 0%, #154882 100%)',
              color: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 4px 14px rgba(31, 95, 168, 0.35)',
              cursor: busy ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              border: 0
            }}
          >
            {busy ? (
              <span>Authenticating session...</span>
            ) : (
              <>
                <span>Sign in to Workspace</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', paddingTop: '1.1rem', borderTop: '1px solid var(--line)', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.75rem' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Secured via Role-Based Access Control (RBAC) &amp; OIDC</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { data, err, loading } = useLoad(() => api<Stats>("/api/v1/dashboard/stats/"));
  const [showAlert, setShowAlert] = useState(true);

  if (loading) return <Loading />;
  if (err) return <ErrorBox message={err} />;
  if (!data) return <Empty text="No data" />;

  const total = data.total_documents || 1;
  const completedRate = Math.round((data.completed / total) * 100);
  const pendingRate = Math.round((data.awaiting_review / total) * 100);
  const failureRate = Math.round((data.processing_failures / total) * 100);

  return (
    <section style={{
      background: 'radial-gradient(circle at 50% 25%, #0b1329 0%, #020617 100%)',
      minHeight: 'calc(100vh - 70px)',
      width: '100%',
      padding: '2rem 3rem', // Balanced left/right padding
      boxSizing: 'border-box',
      color: '#f8fafc',
      margin: 0,
      overflowX: 'hidden'
    }}>
      <div style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* Custom Welcome Alert Banner matching Login theme */}
        {showAlert && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '12px',
            padding: '0.9rem 1.25rem',
            marginBottom: '1.75rem',
            boxShadow: '0 15px 30px rgba(0,0,0,0.6)',
            animation: 'enterpriseEntrance 0.5s ease-out',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, #0f3d73 100%)',
                color: '#fff',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px -4px rgba(31, 95, 168, 0.3)',
                flexShrink: 0
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div>
                <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '0.92rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Authentication Successful &bull; Session Active</h4>
                <p style={{ margin: '0.15rem 0 0 0', color: '#94a3b8', fontSize: '0.78rem' }}>Connected to AWS Bedrock RAG Engine &bull; Role-based workspace authorized.</p>
              </div>
            </div>
            <button
              onClick={() => setShowAlert(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}
              title="Dismiss"
            >
              &times;
            </button>
          </div>
        )}

        {/* Header Overview */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <div>
            <h2 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>Overview Dashboard</h2>
            <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
              Live telemetry ingested from <code style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 6px', borderRadius: '4px' }}>/api/v1/dashboard/stats/</code>
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '5px 12px', borderRadius: '20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '6px', height: '6px', background: '#34d399', borderRadius: '50%' }}></span>
              System Operational
            </span>
          </div>
        </div>

        {/* Stats Grid Cards matching login card aesthetic */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>

          <div style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 15px 30px rgba(0,0,0,0.6)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Total Documents</div>
            <div style={{ color: '#f8fafc', fontSize: '1.85rem', fontWeight: 800 }}>{data.total_documents}</div>
            <div style={{ color: '#38bdf8', fontSize: '0.72rem', marginTop: '0.3rem', fontWeight: 600 }}>Ingested &amp; parsed</div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 15px 30px rgba(0,0,0,0.6)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Awaiting Review</div>
            <div style={{ color: '#fbbf24', fontSize: '1.85rem', fontWeight: 800 }}>{data.awaiting_review}</div>
            <div style={{ color: '#fbbf24', fontSize: '0.72rem', marginTop: '0.3rem', fontWeight: 600 }}>Requires audit approval</div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 15px 30px rgba(0,0,0,0.6)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Processing Failures</div>
            <div style={{ color: '#f87171', fontSize: '1.85rem', fontWeight: 800 }}>{data.processing_failures}</div>
            <div style={{ color: '#f87171', fontSize: '0.72rem', marginTop: '0.3rem', fontWeight: 600 }}>Parser exceptions logged</div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 15px 30px rgba(0,0,0,0.6)', border: '1px solid rgba(52, 211, 153, 0.25)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Completed</div>
            <div style={{ color: '#34d399', fontSize: '1.85rem', fontWeight: 800 }}>{data.completed}</div>
            <div style={{ color: '#34d399', fontSize: '0.72rem', marginTop: '0.3rem', fontWeight: 600 }}>Successfully verified</div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 15px 30px rgba(0,0,0,0.6)', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Total Findings</div>
            <div style={{ color: '#c084fc', fontSize: '1.85rem', fontWeight: 800 }}>{data.total_findings}</div>
            <div style={{ color: '#c084fc', fontSize: '0.72rem', marginTop: '0.3rem', fontWeight: 600 }}>Extracted RAG anomalies</div>
          </div>

        </div>

        {/* Charts & Analytics Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem', paddingBottom: '2.5rem' }}>

          <div style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 15px 30px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '0.98rem', fontWeight: 800, marginBottom: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', background: '#38bdf8', borderRadius: '50%' }}></span>
              Document Lifecycle Progress
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: 600 }}>
                  <span>Completed ({data.completed})</span>
                  <span style={{ color: '#34d399' }}>{completedRate}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${completedRate}%`, height: '100%', background: '#34d399', borderRadius: '4px' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: 600 }}>
                  <span>Awaiting Review ({data.awaiting_review})</span>
                  <span style={{ color: '#fbbf24' }}>{pendingRate}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pendingRate}%`, height: '100%', background: '#fbbf24', borderRadius: '4px' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: 600 }}>
                  <span>Processing Failures ({data.processing_failures})</span>
                  <span style={{ color: '#f87171' }}>{failureRate}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${failureRate}%`, height: '100%', background: '#f87171', borderRadius: '4px' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 15px 30px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '0.98rem', fontWeight: 800, marginBottom: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', background: '#a855f7', borderRadius: '50%' }}></span>
              AI &amp; Security Telemetry
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Vector RAG Backend</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>Hybrid retrieval (keyword + vector)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Access Enforcement</span>
                <span style={{ color: '#34d399', fontWeight: 700 }}>Role-based access (RBAC)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Audit Protocol</span>
                <span style={{ color: '#fbbf24', fontWeight: 700 }}>Audit trail on every decision</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

function Documents({ onOpen }: { onOpen: (id: string) => void }) {
  const [search, setSearch] = useState(""); const [statusF, setStatusF] = useState(""); const [msg, setMsg] = useState("");
  const { data, err, loading, reload } = useLoad(() => api<Paged<Doc>>(`/api/v1/documents/?search=${encodeURIComponent(search)}&status=${statusF}`), [search, statusF]);
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); setMsg("");
    try { await api("/api/v1/documents/", { method: "POST", body: fd }); setMsg("Uploaded. Processing runs asynchronously; refresh to see the status."); toast.success("Document uploaded successfully."); reload(); } catch (ex: any) { setMsg(ex.message); toast.error(ex.message || "Upload failed."); }
  }
  return (<section><h2>Document library</h2>
    <form className="card" onSubmit={upload}><h3>Upload document</h3>
      <label>Title<input name="title" /></label>
      <label>File (PDF, DOCX or TXT)<input name="file" type="file" accept=".pdf,.docx,.txt" required /></label>
      <button type="submit">Upload</button>{msg && <p className="muted" role="status">{msg}</p>}</form>
    <div className="row"><label>Search<input aria-label="Search documents" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label>Status<select aria-label="Filter by status" value={statusF} onChange={e => setStatusF(e.target.value)}><option value="">All</option>{["uploaded","queued","extracting","indexing","reviewing","completed","failed"].map(s => <option key={s} value={s}>{s}</option>)}</select></label></div>
    {loading ? <Loading /> : err ? <ErrorBox message={err} /> : !data || data.results.length === 0 ? <Empty text="No documents yet. Upload your first document above." /> :
      <div className="table-wrap"><table><thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Pages</th><th>Chunks</th><th></th></tr></thead>
      <tbody>{data.results.map(d => <tr key={d.id}><td>{d.title}</td><td>{d.file_type}</td><td><Badge value={d.status} /></td><td>{d.page_count}</td><td>{d.chunk_count ?? "—"}</td><td><button onClick={() => onOpen(d.id)}>Open</button></td></tr>)}</tbody></table></div>}
  </section>);
}

function DocumentDetail({ id, back, role }: { id: string; back: () => void; role: string }) {
  const canReview = role === "admin" || role === "reviewer";
  const doc = useLoad(() => api<Doc>(`/api/v1/documents/${id}/`));
  const chunks = useLoad(() => api<Paged<{ id: string; page_number: number; text: string }>>(`/api/v1/documents/${id}/chunks/`));
  const policies = useLoad(() => api<Paged<Policy>>("/api/v1/policies/"));
  const [pv, setPv] = useState(""); const [msg, setMsg] = useState("");
  async function startReview() {
    if (!pv) { setMsg("Select a policy version first."); return; }
    try { await api(`/api/v1/documents/${id}/reviews/`, { method: "POST", body: JSON.stringify({ policy_version_id: pv }) }); setMsg("Review finished (mock/eager) or queued. See Findings page."); toast.success("Review started. See the Findings page."); } catch (e: any) { setMsg(e.message); toast.error(e.message || "Could not start review."); }
  }
  if (doc.loading) return <Loading />; if (doc.err) return <ErrorBox message={doc.err} />; if (!doc.data) return <Empty text="Document not found" />;
  const versions = (policies.data?.results || []).flatMap(p => p.versions.map(v => ({ ...v, pname: p.name })));
  return (<section><button onClick={back}>← Back to library</button><h2>{doc.data.title}</h2>
    <p className="muted">Status timeline: uploaded → queued → extracting → indexing → reviewing → completed / failed</p>
    <p>Status: <Badge value={doc.data.status} /> · Type: {doc.data.file_type} · Pages: {doc.data.page_count}{doc.data.error_message ? ` · Error: ${doc.data.error_message}` : ""}</p>
    {canReview && <div className="card"><h3>Start review</h3>
      <label>Policy version<select aria-label="Policy version" value={pv} onChange={e => setPv(e.target.value)}><option value="">Select…</option>{versions.map(v => <option key={v.id} value={v.id}>{v.pname} — v{v.version}</option>)}</select></label>
      <button onClick={startReview}>Run review</button>{msg && <p role="status" className="muted">{msg}</p>}</div>}
    <h3>Extracted text (chunks)</h3>
    {chunks.loading ? <Loading /> : chunks.data && chunks.data.results.length ? chunks.data.results.map(c => <article key={c.id} className="card"><p className="muted small">Page {c.page_number} · chunk {c.id.slice(0, 8)}</p><p>{c.text}</p></article>) : <Empty text="No extracted chunks yet." />}
  </section>);
}

function Findings() {
  const [sev, setSev] = useState(""); const [statusF, setStatusF] = useState(""); const [note, setNote] = useState("");
  const { data, err, loading, reload } = useLoad(() => api<Paged<Finding>>(`/api/v1/findings/?severity=${sev}&status=${statusF}`), [sev, statusF]);
  const audit = useLoad(() => api<Paged<{ id: string; action: string; created_at: string }>>("/api/v1/audit-events/"));
  async function act(id: string, action: string) {
    try { await api(`/api/v1/findings/${id}/${action}/`, { method: "POST", body: JSON.stringify({ comment: note }) }); reload(); audit.reload(); toast.success(`Finding ${action}d.`); } catch (e: any) { toast.error(e.message || "Action failed."); }
  }
  return (<section><h2>Findings review</h2><p className="muted">AI-generated findings stay distinguishable from human decisions. The original AI output is preserved; decisions are stored separately.</p>
    <div className="row"><label>Severity<select aria-label="Filter severity" value={sev} onChange={e => setSev(e.target.value)}><option value="">All</option>{["low","medium","high","critical"].map(s => <option key={s}>{s}</option>)}</select></label>
    <label>Status<select aria-label="Filter status" value={statusF} onChange={e => setStatusF(e.target.value)}><option value="">All</option>{["pending","approved","rejected","escalated","edited"].map(s => <option key={s}>{s}</option>)}</select></label>
    <label>Reviewer note<input aria-label="Reviewer note" value={note} onChange={e => setNote(e.target.value)} /></label></div>
    {loading ? <Loading /> : err ? <ErrorBox message={err} /> : !data || data.results.length === 0 ? <Empty text="No findings match these filters." /> :
      data.results.map(f => <article key={f.id} className="card"><h3>{f.title} <Badge value={f.severity} /> <Badge value={f.status} /></h3>
        <p>{f.description}</p><p className="muted small">Category: {f.category} · Confidence (uncalibrated model score, not a probability of correctness): {f.confidence} · Priority: {f.priority_score} · Human review required: {String(f.requires_human_review)}</p>
        <p><strong>Why:</strong> {f.reasoning_summary}</p><p><strong>Recommended action:</strong> {f.recommended_action}</p>
        <h4>Evidence</h4>{f.evidence.length ? f.evidence.map(ev => <blockquote key={ev.id}>“{ev.quoted_text}” <span className="muted">— page {ev.page_number}</span></blockquote>) : <p className="muted">No adequate evidence was found for this finding — stated explicitly, never fabricated.</p>}
        {f.decisions.length > 0 && <p className="muted small">Decisions: {f.decisions.map(d => `${d.decision} (${new Date(d.created_at).toLocaleString()})`).join(", ")}</p>}
        <div className="row"><button onClick={() => act(f.id, "approve")}>Approve</button><button onClick={() => act(f.id, "reject")}>Reject</button><button onClick={() => act(f.id, "escalate")}>Escalate</button></div>
      </article>)}
    <h3>Audit history</h3>{audit.data ? <ul>{audit.data.results.slice(0, 10).map(a => <li key={a.id}>{a.action} — {new Date(a.created_at).toLocaleString()}</li>)}</ul> : <Loading />}
  </section>);
}

function AddVersionForm({ policy, onAdded }: { policy: Policy; onAdded: () => void }) {
  const [version, setVersion] = useState(""); const [phrase, setPhrase] = useState(""); const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await api(`/api/v1/policies/${policy.id}/add_version/`, { method: "POST", body: JSON.stringify({ version, rules: { requires_phrases: phrase ? [phrase] : [] }, checklist: [] }) }); setMsg(`Version ${version} added to ${policy.name}.`); toast.success(`Version ${version} added.`); setVersion(""); setPhrase(""); onAdded(); }
    catch (ex: any) { setMsg(ex.message); toast.error(ex.message || "Could not add version."); }
  }
  return (<form onSubmit={submit}><h4>Add new version</h4><div className="row">
    <label>Version<input aria-label={`New version number for ${policy.name}`} value={version} onChange={e => setVersion(e.target.value)} required placeholder="2.0" /></label>
    <label>Required phrase<input aria-label={`Required phrase for new version of ${policy.name}`} value={phrase} onChange={e => setPhrase(e.target.value)} /></label>
    <button type="submit">Add version</button></div>{msg && <p role="status" className="muted">{msg}</p>}</form>);
}

function Policies() {
  const { data, err, loading, reload } = useLoad(() => api<Paged<Policy>>("/api/v1/policies/"));
  const [name, setName] = useState(""); const [phrase, setPhrase] = useState(""); const [msg, setMsg] = useState("");
  async function create(e: React.FormEvent) {
    e.preventDefault();
    try { await api("/api/v1/policies/", { method: "POST", body: JSON.stringify({ name, description: "", version: "1.0", rules: { requires_phrases: phrase ? [phrase] : [] }, checklist: [] }) }); setMsg("Policy created with version 1.0."); toast.success("Policy created."); reload(); } catch (ex: any) { setMsg(ex.message); toast.error(ex.message || "Could not create policy."); }
  }
  return (<section><h2>Policy management</h2>
    <form className="card" onSubmit={create}><label>Policy name<input aria-label="Policy name" value={name} onChange={e => setName(e.target.value)} required /></label>
    <label>Required phrase (deterministic rule)<input aria-label="Required phrase" value={phrase} onChange={e => setPhrase(e.target.value)} /></label><button type="submit">Create policy</button>{msg && <p role="status" className="muted">{msg}</p>}</form>
    {loading ? <Loading /> : err ? <ErrorBox message={err} /> : !data || data.results.length === 0 ? <Empty text="No policies yet." /> :
      data.results.map(p => <article key={p.id} className="card"><h3>{p.name}</h3><p>{p.description}</p><p className="muted small">Versions: {p.versions.map(v => `v${v.version}`).join(", ") || "none"}</p>
        <ul>{p.versions.map(v => { const phrases = v.rules && Array.isArray(v.rules.requires_phrases) ? v.rules.requires_phrases : []; return <li key={v.id}>v{v.version} — Required: {phrases.length ? phrases.join(", ") : "no required phrases"}</li>; })}</ul>
        <AddVersionForm policy={p} onAdded={reload} /></article>)}
  </section>);
}

function Evaluation() {
  const { data, err, loading } = useLoad(() => api<Paged<{ id: string; dataset_version: string; metrics: Record<string, number> }>>("/api/v1/evaluation-runs/"));
  if (loading) return <Loading />; if (err) return <ErrorBox message={err} />;
  const run = data?.results[0];
  return (<section><h2>Evaluation dashboard</h2><p className="muted">Results come from <code>run_evaluation</code> runs stored by the API. Run it locally: <code>python manage.py run_evaluation</code>. Mock-provider scores on synthetic data measure the deterministic pipeline, not LLM quality — see docs/evaluation.md.</p>
    {!run ? <Empty text="No evaluation runs yet. Run the evaluation command first." /> :
      <div className="card"><p>Dataset version: {run.dataset_version}</p><ul>{Object.entries(run.metrics).map(([k, v]) => <li key={k}>{k}: {String(v)}</li>)}</ul></div>}
  </section>);
}

function Settings({ user }: { user: User }) {
  const users = useLoad(() => api<Paged<{ id: string; username: string; role: string }>>("/api/v1/users/"));
  const me = useLoad(() => api<User & { email: string }>("/api/v1/auth/me/"));
  return (<section><h2>Settings</h2><div className="card"><h3>Your account</h3>{me.data ? <p>{me.data.username} · role: {me.data.role}</p> : <Loading />}</div>
    <div className="card"><h3>Users &amp; roles {user.role !== "admin" && <span className="muted">(admin only — list requires admin)</span>}</h3>
    {users.loading ? <Loading /> : users.err ? <ErrorBox message={users.err} /> : <ul>{users.data?.results.map(u => <li key={u.id}>{u.username} — {u.role}</li>)}</ul>}
    <p className="muted small">Model, region, limits and pricing estimates are configured by environment variables (see README env table), never in the UI or in code.</p></div></section>);
}

function UserMenu({ user, onLogout, onProfile, onSettings }: { user: User; onLogout: () => void; onProfile: () => void; onSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (<div className="user-menu" ref={ref}>
    <button type="button" className="user-menu-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
      <Avatar user={user} size={36} />
      <span className="user-menu-text"><span className="user-menu-name">{displayName(user)}</span><span className="user-menu-role">{user.role}</span></span>
      <svg className={`chevron${open ? " open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </button>
    {open && (<div className="user-dropdown" role="menu">
      <div className="user-dropdown-head"><Avatar user={user} size={44} /><div><div className="user-dropdown-name">{displayName(user)}</div><div className="muted small">{user.email || "No email on file"}</div><span className="badge">{user.role}</span></div></div>
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onProfile(); }}>Profile</button>
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onSettings(); }}>Settings</button>
      <button type="button" role="menuitem" className="danger" onClick={() => { setOpen(false); onLogout(); }}>Logout</button>
    </div>)}
  </div>);
}

function Sidebar({ pages, current, onSelect, onClose, onLogout }: { pages: Page[]; current: Page; onSelect: (p: Page) => void; onClose: () => void; onLogout: () => void }) {
  return (<>
    <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />
    <aside className="sidebar" aria-label="Mobile navigation">
      <div className="sidebar-head"><span className="brand-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg></span><strong>Compliance Copilot</strong><button type="button" aria-label="Close menu" onClick={onClose}>&times;</button></div>
      <nav className="sidebar-nav" aria-label="Pages">
        {pages.map(p => <button key={p} type="button" className={current === p ? "active" : ""} onClick={() => { onSelect(p); onClose(); }}>{p}</button>)}
      </nav>
      <button type="button" className="sidebar-logout" onClick={() => { onClose(); onLogout(); }}>Sign out</button>
    </aside>
  </>);
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (<div className="modal-backdrop" onClick={onClose} role="presentation"><div className="modal-card" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
    <div className="modal-head"><h3>{title}</h3><button type="button" aria-label="Close" onClick={onClose}>&times;</button></div>
    {children}
  </div></div>);
}

function ProfileModal({ user, onClose, onEdit }: { user: User; onClose: () => void; onEdit: () => void }) {
  const memberSince = user.date_joined ? new Date(user.date_joined).toLocaleDateString() : "—";
  return (<Modal title="My Profile" onClose={onClose}>
    <div className="profile-hero"><Avatar user={user} size={72} /><div><div className="profile-name">{displayName(user)}</div><div className="muted">@{user.username} · <span className="badge">{user.role}</span></div></div></div>
    <dl className="profile-grid">
      <div><dt>Full name</dt><dd>{displayName(user)}</dd></div>
      <div><dt>Username</dt><dd>{user.username}</dd></div>
      <div><dt>Email</dt><dd>{user.email || "—"}</dd></div>
      <div><dt>Role</dt><dd>{user.role}</dd></div>
      <div><dt>Organization</dt><dd>{user.organization_name || "—"}</dd></div>
      <div><dt>Member since</dt><dd>{memberSince}</dd></div>
      <div><dt>Account status</dt><dd>{user.is_active === false ? "Inactive" : "Active"}</dd></div>
    </dl>
    <div className="modal-foot"><button type="button" onClick={onEdit}>Edit Profile</button></div>
  </Modal>);
}

function SettingsModal({ user, onClose, onView, onSaved }: { user: User; onClose: () => void; onView: () => void; onSaved: (u: User) => void }) {
  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [username, setUsername] = useState(user.username);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const updated = await api<User>("/api/v1/auth/me/", { method: "PATCH", body: JSON.stringify({ username, first_name: firstName, last_name: lastName }) });
      toast.success("Profile updated.");
      onSaved(updated); onClose();
    } catch (ex: any) { setErr(ex.message || "Could not update profile."); toast.error(ex.message || "Could not update profile."); }
    finally { setBusy(false); }
  }
  return (<Modal title="Profile Settings" onClose={onClose}>
    <form onSubmit={save}>
      <label>First name<input aria-label="First name" value={firstName} onChange={e => setFirstName(e.target.value)} /></label>
      <label>Last name<input aria-label="Last name" value={lastName} onChange={e => setLastName(e.target.value)} /></label>
      <label>Username<input aria-label="Username" value={username} onChange={e => setUsername(e.target.value)} required /></label>
      <label>Email<input aria-label="Email" value={user.email || ""} disabled readOnly /></label>
      <p className="muted small">Email cannot be changed.</p>
      {err && <ErrorBox message={err} />}
      <div className="modal-foot"><button type="button" className="btn-secondary" onClick={onView}>View Profile</button><button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div>
    </form>
  </Modal>);
}

const ROLE_PAGES: Record<string, Page[]> = {
  admin: ["dashboard", "documents", "findings", "policies", "evaluation", "settings"],
  reviewer: ["dashboard", "documents", "findings"],
  uploader: ["dashboard", "documents"],
};

export default function App() {
  const [user, setUser] = useState<User | null>(null); const [page, setPage] = useState<Page>("dashboard"); const [docId, setDocId] = useState<string | null>(null); const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState<"profile" | "settings" | null>(null);
  useEffect(() => { if (getToken()) { api<User>("/api/v1/auth/me/").then(setUser).catch(() => setToken(null)).finally(() => setChecking(false)); } else setChecking(false); }, []);
  if (checking) return <Loading />;
  if (!user) return <Login onLogin={setUser} />;
  const allowedPages = ROLE_PAGES[user.role] || ["dashboard"];
  const currentPage: Page = allowedPages.includes(page) ? page : "dashboard";
  const go = (p: Page) => { setPage(p); setDocId(null); };
  const logout = () => {
    setToken(null); setUser(null); setModal(null); setSidebarOpen(false);
    try { sessionStorage.setItem("copilot_flash", JSON.stringify({ message: "Logout successful", type: "success" })); } catch { /* storage unavailable */ }
  };
  return (<div className="shell">
    <header className="app-header"><div className="brand">
      <button type="button" className="hamburger" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
      <span className="brand-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg></span><strong>Compliance Copilot</strong><span className="brand-sub">RAG &bull; Django REST</span></div>
      <nav className="main-nav" aria-label="Main">
        {allowedPages.map(p => <button key={p} className={currentPage === p ? "active" : ""} onClick={() => go(p)}>{p}</button>)}
      </nav>
      <UserMenu user={user} onLogout={logout} onProfile={() => setModal("profile")} onSettings={() => setModal("settings")} />
    </header>
    {sidebarOpen && <Sidebar pages={allowedPages} current={currentPage} onSelect={go} onClose={() => setSidebarOpen(false)} onLogout={logout} />}
    <ToastHost />
    <main className="shell-main">{currentPage === "dashboard" && <Dashboard />}
      {currentPage === "documents" && (docId ? <DocumentDetail id={docId} back={() => setDocId(null)} role={user.role} /> : <Documents onOpen={setDocId} />)}
      {currentPage === "findings" && <Findings />}{currentPage === "policies" && <Policies />}{currentPage === "evaluation" && <Evaluation />}{currentPage === "settings" && <Settings user={user} />}
    </main>
    <footer className="app-footer muted small">AI assists reviewers — it does not make consequential legal, financial, employment or regulatory decisions. Verify every finding against its cited evidence.</footer>
    {modal === "profile" && <ProfileModal user={user} onClose={() => setModal(null)} onEdit={() => setModal("settings")} />}
    {modal === "settings" && <SettingsModal user={user} onClose={() => setModal(null)} onView={() => setModal("profile")} onSaved={setUser} />}
  </div>);
}
