"use client";

import { createContext, FormEvent, ReactNode, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { StaffProfile } from "@/lib/staff";
import Link from "next/link";
import { usePathname } from "next/navigation";

const StaffContext = createContext<StaffProfile | null>(null);

export function useStaff() {
  const profile = useContext(StaffContext);
  if (!profile) throw new Error("Staff access is required.");
  return profile;
}

export default function StaffAccess({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Recovery must work before staff access is loaded; database RLS still protects issues.
  if (pathname === "/reset-password") return <>{children}</>;
  return <StaffGate>{children}</StaffGate>;
}

function StaffGate({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let revision = 0;
    let lastUserId: string | null | undefined;
    async function loadProfile(userId: string | null) {
      const request = ++revision;
      setProfile(null);
      setLoading(true);
      setSignedIn(Boolean(userId));
      setError("");
      if (userId) {
        try {
          const { data, error: profileError } = await supabase.from("staff_profiles")
            .select("id, display_name, role").eq("id", userId).maybeSingle();
          if (!active || request !== revision) return;
          if (profileError) setError("Unable to load staff access. Try again or contact your manager.");
          else if (!data || !["staff", "manager"].includes(data.role))
            setError("Your account needs staff access. Contact your manager.");
          else setProfile(data as StaffProfile);
        } catch {
          if (active && request === revision) setError("Unable to connect. Please try again.");
        }
      }
      if (active && request === revision) setLoading(false);
    }
    // INITIAL_SESSION restores sign-in; later events also handle sign-out in another tab.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user.id ?? null;
      // Dashboard recovery emails may still redirect to the site's root.
      if (event === "PASSWORD_RECOVERY") {
        window.location.replace("/reset-password");
        return;
      }
      // Focus and token refresh can repeat sign-in events. Keep unsaved forms.
      if (userId === lastUserId && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) return;
      lastUserId = userId;
      // Defer database work until the Auth callback has released its session lock.
      window.setTimeout(() => { if (active) void loadProfile(userId); }, 0);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) setError("Sign-in failed. Check your email and password, then try again.");
      else setPassword("");
    } catch { setError("Unable to connect. Please try again."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.signOut({ scope: "local" });
      if (authError) setError("Could not sign out. Please try again.");
    } catch { setError("Could not sign out. Please try again."); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="p-10 text-slate-700" aria-live="polite">Loading staff access…</main>;
  if (!profile) return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5 text-slate-900">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-blue-600">FitFlow</h1>
        <p className="mb-6 mt-2">Sign in with your staff account.</p>
        {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
        {signedIn ? <div className="flex gap-4">
          <button onClick={() => window.location.reload()} className="rounded-xl border px-4 py-3">Retry access</button>
          <button disabled={busy} onClick={signOut} className="rounded-xl bg-blue-600 px-4 py-3 text-white">Sign out</button>
        </div> : <form onSubmit={signIn} className="space-y-4">
          <label className="block">Email<input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
          <label className="block">Password<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
          <button disabled={busy} className="w-full rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
          <Link href="/reset-password" className="block text-blue-600 underline">Forgot your password?</Link>
          <p className="text-sm text-slate-500">Need an account? Contact your manager.</p>
        </form>}
      </div>
    </main>
  );
  return <StaffContext.Provider value={profile}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-3 text-slate-900">
      <nav className="flex gap-4"><Link href="/" className="font-semibold text-blue-600">+ New Issue</Link><Link href="/issues">Issues</Link></nav>
      <div className="flex items-center gap-4"><span>{profile.display_name} · {profile.role === "manager" ? "Manager" : "Staff"}</span><button disabled={busy} onClick={signOut} className="rounded-lg border px-3 py-2">Sign out</button></div>
      {error && <p role="alert" className="w-full text-red-700">{error}</p>}
    </header>
    {children}
  </StaffContext.Provider>;
}
