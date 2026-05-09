"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/AuthPanel";
import { ReservationCalendar } from "@/components/ReservationCalendar";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const email = useMemo(() => session?.user.email ?? "", [session]);

  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-xl rounded-lg border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Configuration required
          </p>
          <h1 className="mt-2 text-2xl font-bold text-ink">
            Add Supabase environment variables
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Copy <code className="rounded bg-panel px-1">.env.example</code> to{" "}
            <code className="rounded bg-panel px-1">.env.local</code>, then set{" "}
            <code className="rounded bg-panel px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and{" "}
            <code className="rounded bg-panel px-1">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>
            .
          </p>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg border border-line bg-white px-5 py-4 text-sm font-medium text-muted shadow-soft">
          Loading workspace...
        </div>
      </main>
    );
  }

  if (recoveryMode) {
    return (
      <AuthPanel
        initialMode="updatePassword"
        onPasswordUpdated={() => setRecoveryMode(false)}
      />
    );
  }

  if (!session) {
    return <AuthPanel initialMode="login" />;
  }

  return (
    <ReservationCalendar
      userEmail={email}
      userId={session.user.id}
      onSignOut={() => supabase.auth.signOut()}
    />
  );
}
