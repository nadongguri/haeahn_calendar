"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "signup" | "reset" | "updatePassword";

type AuthPanelProps = {
  initialMode: Mode;
  onPasswordUpdated?: () => void;
};

export function AuthPanel({ initialMode, onPasswordUpdated }: AuthPanelProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setStatus("");

    const redirectTo =
      typeof window === "undefined" ? undefined : window.location.origin;

    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError) throw signInError;
      }

      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo
          }
        });
        if (signUpError) throw signUpError;
        setStatus("Check your email to verify your account before signing in.");
        setPassword("");
      }

      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo
          }
        );
        if (resetError) throw resetError;
        setStatus("Password reset email sent. Check your inbox.");
      }

      if (mode === "updatePassword") {
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        });
        if (updateError) throw updateError;
        setStatus("Password updated. You can continue to the app.");
        setNewPassword("");
        onPasswordUpdated?.();
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Authentication failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === "signup"
      ? "Create your account"
      : mode === "reset"
        ? "Reset password"
        : mode === "updatePassword"
          ? "Set a new password"
          : "Sign in";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          haeahn_calendar
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Email/password authentication is used for normal sign-in. Email is
          only sent for signup verification and password reset.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode !== "updatePassword" && (
            <label className="block">
              <span className="text-sm font-medium text-ink">Email</span>
              <input
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}

          {(mode === "login" || mode === "signup") && (
            <label className="block">
              <span className="text-sm font-medium text-ink">Password</span>
              <input
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                minLength={8}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          )}

          {mode === "updatePassword" && (
            <label className="block">
              <span className="text-sm font-medium text-ink">New password</span>
              <input
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                minLength={8}
                required
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {status && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {status}
            </div>
          )}

          <button
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Working..." : title}
          </button>
        </form>

        {mode !== "updatePassword" && (
          <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
            {mode !== "login" && (
              <button
                className="font-medium text-accent hover:text-teal-800"
                type="button"
                onClick={() => setMode("login")}
              >
                Back to sign in
              </button>
            )}
            {mode !== "signup" && (
              <button
                className="font-medium text-accent hover:text-teal-800"
                type="button"
                onClick={() => setMode("signup")}
              >
                Create account
              </button>
            )}
            {mode !== "reset" && (
              <button
                className="font-medium text-accent hover:text-teal-800"
                type="button"
                onClick={() => setMode("reset")}
              >
                Forgot password
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
