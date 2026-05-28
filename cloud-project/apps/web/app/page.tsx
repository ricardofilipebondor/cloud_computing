"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, Input, Select, Spinner } from "./components/ui";
import { clearStoredToken, getStoredToken } from "@/lib/authClient";

type Job = {
  job_id: string;
  source_url: string;
  target_language: string;
  status: string;
  created_at: string;
};

const LANGUAGES: Record<string, string> = {
  ro: "Romanian",
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish"
};

function statusVariant(status: string): "pending" | "processing" | "completed" | "failed" | "default" {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return "completed";
  if (s === "FAILED") return "failed";
  if (s === "PROCESSING" || s === "RUNNING") return "processing";
  if (s === "PENDING" || s === "QUEUED") return "pending";
  return "default";
}

function parseEmailFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("ro");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      router.replace("/login");
      return;
    }
    setToken(stored);
  }, [router]);

  const userEmail = token ? parseEmailFromToken(token) : null;

  const api = useMemo(
    () => async (path: string, init: RequestInit = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(init.headers as Record<string, string> | undefined)
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetch(path, { ...init, headers });
    },
    [token]
  );

  const loadJobs = useCallback(async () => {
    if (!token) return;
    const response = await api("/api/jobs");
    if (response.status === 401) {
      clearStoredToken();
      router.replace("/login");
      return;
    }
    if (!response.ok) return;
    const data = await response.json();
    setJobs(data);
  }, [token, api, router]);

  async function createJob(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const response = await api("/api/jobs/create", {
        method: "POST",
        body: JSON.stringify({ source_url: url.trim(), target_language: language })
      });
      if (!response.ok) throw new Error("Could not create job");
      setUrl("");
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteJob(jobId: string) {
    setLoading(true);
    const response = await api(`/api/jobs/${jobId}`, { method: "DELETE" });
    if (response.ok) await loadJobs();
    setLoading(false);
  }

  async function downloadSubtitles(jobId: string, format: "srt" | "vtt") {
    setError("");
    try {
      const response = await api(`/api/jobs/${jobId}/subtitles?format=${format}`, {
        headers: {}
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Download failed");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${jobId}.${format}`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }

  function logout() {
    clearStoredToken();
    router.replace("/login");
  }

  useEffect(() => {
    if (!token) return;
    loadJobs();
    const id = setInterval(loadJobs, 4000);
    return () => clearInterval(id);
  }, [token, loadJobs]);

  if (!token) {
    return (
      <div className="shell shell-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark">S</span>
            <span>StreamSync</span>
          </div>
          <div className="user-menu">
            {userEmail && <span className="user-email">{userEmail}</span>}
            <Button variant="ghost" className="btn-sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="page container container-wide">
        <div className="page-header">
          <h1>Subtitles</h1>
          <p>Paste a video URL and download .srt or .vtt when processing completes.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <section className="section">
          <h2 className="section-title">New job</h2>
          <Card>
            <form onSubmit={createJob}>
              <div className="form-row">
                <Field label="Video URL" hint="YouTube or other supported sources">
                  <Input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=…"
                    required
                  />
                </Field>
                <Field label="Language">
                  <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button type="submit" disabled={submitting || !url.trim()}>
                {submitting ? (
                  <>
                    <Spinner /> Submitting…
                  </>
                ) : (
                  "Generate subtitles"
                )}
              </Button>
            </form>
          </Card>
        </section>

        <section className="section">
          <h2 className="section-title">Your jobs</h2>
          <Card className="card-flush">
            {jobs.length === 0 ? (
              <div className="jobs-empty">No jobs yet. Submit a URL above to get started.</div>
            ) : (
              <ul className="job-list">
                {jobs.map((job) => (
                  <li key={job.job_id} className="job-item">
                    <div className="job-meta">
                      <div>
                        <Badge status={statusVariant(job.status)}>{job.status}</Badge>
                        <div className="job-lang">{LANGUAGES[job.target_language] ?? job.target_language}</div>
                      </div>
                    </div>
                    <div className="job-url">{job.source_url}</div>
                    <div className="job-actions">
                      <Button
                        variant="secondary"
                        className="btn-sm"
                        disabled={job.status !== "COMPLETED"}
                        onClick={() => downloadSubtitles(job.job_id, "srt")}
                      >
                        SRT
                      </Button>
                      <Button
                        variant="secondary"
                        className="btn-sm"
                        disabled={job.status !== "COMPLETED"}
                        onClick={() => downloadSubtitles(job.job_id, "vtt")}
                      >
                        VTT
                      </Button>
                      <Button
                        variant="danger"
                        className="btn-sm"
                        disabled={loading}
                        onClick={() => deleteJob(job.job_id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}
