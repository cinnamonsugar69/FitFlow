"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    // Supabase processes recovery tokens before INITIAL_SESSION is emitted.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "PASSWORD_RECOVERY" || event === "SIGNED_OUT") {
        setAuthenticated(Boolean(session));
        setLoading(false);
      }
    });
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("error")) {
      const timer = window.setTimeout(() => setError("This recovery link has expired or is invalid. Request a new link below."), 0);
      // Remove error details from the address bar without exposing tokens.
      window.history.replaceState(null, "", window.location.pathname);
      return () => { window.clearTimeout(timer); subscription.unsubscribe(); };
    }
    return () => subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (authenticated && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (authenticated) {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
          setError(updateError.code === "weak_password" ? "Choose a stronger password. Use at least 12 characters." : "Could not update your password. Try a different password or request a fresh recovery link.");
          return;
        }
        setPassword("");
        setConfirmation("");
        setComplete(true);
        const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
        setMessage(signOutError ? "Your password was updated. You can return to FitFlow." : "Your password was updated. Sign in with your new password.");
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) {
          setError(resetError.status === 429 || resetError.code === "over_email_send_rate_limit"
            ? "Too many emails have been requested. Please wait before trying again."
            : "Could not send the recovery email. Please try again later or contact your manager.");
        } else {
          setMessage("If an account exists for this email, a recovery link will arrive. Check your inbox and spam folder, then open the newest link.");
        }
      }
    } catch { setError("Unable to connect. Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5 text-slate-900">
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold text-blue-600">FitFlow</h1>
      <h2 className="mb-6 mt-2 text-xl font-semibold">Reset your password</h2>
      {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
      {message && <p role="status" className="mb-4 text-green-800">{message}</p>}
      {loading ? <p role="status">Checking recovery link…</p> : !complete && <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          {authenticated ? <>
            <label className="block">New password<input required minLength={12} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
            <p className="text-sm text-slate-600">Use at least 12 characters.</p>
            <label className="block">Confirm new password<input required minLength={12} type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
          </> : <label className="block">Staff email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>}
          <button className="w-full rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-50" disabled={busy || (!authenticated && Boolean(message))}>{busy ? "Please wait…" : authenticated ? "Save new password" : "Send recovery email"}</button>
        </fieldset>
      </form>}
      <Link href="/" className="mt-5 block text-blue-600 underline">{complete ? "Return to sign in" : "Back to FitFlow"}</Link>
    </div>
  </main>;
}
