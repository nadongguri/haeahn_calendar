"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "signup" | "reset" | "updatePassword";

const loginAliases: Record<string, string> = {
  meeting: "meeting@haeahn-calendar.local"
};

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
          email: normalizeLoginIdentifier(email),
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
        setStatus("가입 확인 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.");
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
        setStatus("비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해 주세요.");
      }

      if (mode === "updatePassword") {
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        });
        if (updateError) throw updateError;
        setStatus("비밀번호가 변경되었습니다. 계속 이용하실 수 있습니다.");
        setNewPassword("");
        onPasswordUpdated?.();
      }
    } catch (caughtError) {
      void caughtError;
      setError(getKoreanAuthError(mode));
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === "signup"
      ? "회원가입"
      : mode === "reset"
        ? "비밀번호 재설정"
        : mode === "updatePassword"
          ? "새 비밀번호 설정"
          : "로그인";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          haeahn_calendar
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          이메일 또는 공용 ID로 로그인하세요. 메일은 회원가입 인증과 비밀번호
          재설정 때만 발송됩니다.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode !== "updatePassword" && (
            <label className="block">
              <span className="text-sm font-medium text-ink">
                {mode === "login" ? "이메일 또는 ID" : "이메일"}
              </span>
              <input
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder={mode === "login" ? "meeting 또는 email@example.com" : ""}
                required
                type={mode === "login" ? "text" : "email"}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}

          {(mode === "login" || mode === "signup") && (
            <label className="block">
              <span className="text-sm font-medium text-ink">비밀번호</span>
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
              <span className="text-sm font-medium text-ink">새 비밀번호</span>
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
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "처리 중..." : title}
          </button>
        </form>

        {mode !== "updatePassword" && (
          <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
            {mode !== "login" && (
              <button
                className="font-medium text-accent hover:text-blue-900"
                type="button"
                onClick={() => setMode("login")}
              >
                로그인으로 돌아가기
              </button>
            )}
            {mode !== "signup" && (
              <button
                className="font-medium text-accent hover:text-blue-900"
                type="button"
                onClick={() => setMode("signup")}
              >
                회원가입
              </button>
            )}
            {mode !== "reset" && (
              <button
                className="font-medium text-accent hover:text-blue-900"
                type="button"
                onClick={() => setMode("reset")}
              >
                비밀번호 찾기
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function normalizeLoginIdentifier(identifier: string) {
  const trimmedIdentifier = identifier.trim();
  return loginAliases[trimmedIdentifier.toLowerCase()] ?? trimmedIdentifier;
}

function getKoreanAuthError(mode: Mode) {
  if (mode === "login") {
    return "아이디 또는 비밀번호를 확인해 주세요.";
  }

  if (mode === "signup") {
    return "회원가입 처리 중 오류가 발생했습니다. 이메일과 비밀번호를 확인해 주세요.";
  }

  if (mode === "reset") {
    return "비밀번호 재설정 메일을 보내지 못했습니다. 이메일을 확인해 주세요.";
  }

  return "비밀번호 변경 중 오류가 발생했습니다. 다시 시도해 주세요.";
}
