"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Spinner } from "../components/ui";
import { getStoredToken, setStoredToken } from "@/lib/authClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (getStoredToken()) {
      router.replace("/");
      return;
    }
    setChecking(false);
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Invalid email or password");
      }
      const data = await response.json();
      setStoredToken(data.token);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="shell shell-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="shell shell-center">
      <div className="login-wrap">
        <div className="login-header">
          <div className="brand" style={{ justifyContent: "center", marginBottom: "1.5rem" }}>
            <span className="brand-mark">S</span>
            <span>StreamSync</span>
          </div>
          <h1>Welcome back</h1>
          <p>Sign in to generate and manage subtitles</p>
        </div>

        <div className="login-card">
          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>
            <div className="form-actions">
              <Button type="submit" disabled={loading} className="btn-primary">
                {loading ? (
                  <>
                    <Spinner /> Signing in…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </form>
        </div>

        <p className="login-footer">Subtitle processing powered by async workers</p>
      </div>
    </div>
  );
}
