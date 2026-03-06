"use client";

import { useEffect, useState } from "react";

export default function LoginModal() {
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function checkAuth() {
    try {
      setChecking(true);
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const json = await res.json();
      setAuthed(!!json?.authed || (!!json?.ok && !!json?.userId));
    } catch {
      setAuthed(false);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function login() {
    try {
      setLoading(true);
      setErr(null);

      if (!username.trim()) throw new Error("Username is required.");
      if (!password) throw new Error("Password is required.");

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Login failed (${res.status})`);
      }

      setAuthed(true);
      setPassword("");
      setOpen(false);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      setErr(null);

      const res = await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Logout failed (${res.status})`);
      }

      setAuthed(false);
      setUsername("");
      setPassword("");
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  if (checking) return null;

  return (
    <>
      {!authed ? (
        <button
          className="login-trigger"
          onClick={() => {
            setErr(null);
            setOpen(true);
          }}
        >
          Login
        </button>
      ) : (
        <div className="login-status">
          <span>Logged in</span>
          <button className="login-action" onClick={logout}>
            Logout
          </button>
          {err && <div>{err}</div>}
        </div>
      )}

      {open && (
        <div
          className="login-modal-overlay"
          onClick={() => setOpen(false)}
        >
          <div
            className="login-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="login-action"
              onClick={() => setOpen(false)}
            >
              ×
            </button>

            <div className="login-title">Login</div>

            <div className="login-field">
              <div>Username</div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="login-field">
              <div>Password</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {err && <div className="login-error">{err}</div>}

            <div className="login-submit">
              <button
                className="login-action"
                disabled={loading}
                onClick={login}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}