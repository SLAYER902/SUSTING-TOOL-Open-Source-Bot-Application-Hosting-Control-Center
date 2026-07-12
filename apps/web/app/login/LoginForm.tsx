"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { branding } from "@/config/branding";

export function LoginForm() {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [remember, setRemember] = useState(true); const [visible, setVisible] = useState(false); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("Validating secure credentials…");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password, remember }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Server unavailable.");
      window.location.assign("/dashboard");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Server unavailable."); setBusy(false); }
  }
  return <main className="ambient login-wrap" style={{ "--background-image": `url(${branding.loginBackgroundUrl})` } as React.CSSProperties}>
    <section className="glass strong login-card" aria-labelledby="login-title">
      <div className="brand"><img className="brand-logo" src={branding.logoUrl} onError={(event) => { event.currentTarget.src = branding.fallbackLogo; }} alt="SULAYER CLOUD logo" /><div><span>{branding.productName}</span><small>CONTROL PLANE</small></div></div>
      <h1 id="login-title">Deploy. Monitor. Control.</h1><p className="muted" style={{ margin: 0, fontSize: 14 }}>Sign in to your authorized infrastructure.</p>
      <form className="login-form" onSubmit={submit}>
        <label className="field-label">Username <span className="password-wrap"><UserRound size={15} style={{ position: "absolute", left: 13, top: 15, color: "var(--text-muted)" }} /><input className="field" style={{ paddingLeft: 38 }} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required placeholder="Administrator username" /></span></label>
        <label className="field-label">Password <span className="password-wrap"><LockKeyhole size={15} style={{ position: "absolute", left: 13, top: 15, color: "var(--text-muted)" }} /><input className="field" style={{ paddingLeft: 38 }} type={visible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Your password" /><button type="button" className="reveal" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
        <label className="tiny" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember this session for 30 days</label>
        <button className="neon-button" type="submit" disabled={busy}>{busy ? <><LoaderCircle size={16} style={{ verticalAlign: "middle", marginRight: 8 }} /> Signing in</> : "Sign in securely"}</button>
        <p className={`form-message ${message && !message.startsWith("Validating") ? "error" : ""}`} role="status" aria-live="polite">{message || "Secure session cookies · Rate-limit protection active"}</p>
      </form>
      <div className="login-footer"><span><span style={{ color: "var(--success)" }}>●</span> Control plane status: ready</span><span>{branding.version}</span></div>
    </section>
  </main>;
}
