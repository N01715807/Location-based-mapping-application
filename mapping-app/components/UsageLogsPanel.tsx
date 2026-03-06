"use client";

import { useEffect, useState } from "react";

type LogRow = {
  id: number;
  used_at: string;
  field_name: string;
  amount: number;
  note: string | null;
};

export default function UsageLogsPanel({ wellId }: { wellId: number }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  async function checkAuth() {
    try {
      setChecking(true);
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const j = await r.json();
      setAuthed(!!j?.authed || (!!j?.ok && !!j?.userId));
    } catch {
      setAuthed(false);
    } finally {
      setChecking(false);
    }
  }

  async function loadLogs() {
    try {
      setLoadingLogs(true);
      setErr(null);

      const r = await fetch(
        `/api/usage-logs?waterResourceId=${wellId}&limit=100`,
        { cache: "no-store" }
      );
      const j = await r.json();

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || `API ${r.status}`);
      }

      setLogs(j.data || []);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadLogs();
  }, [authed, wellId]);

  async function login() {
    try {
      setLoggingIn(true);
      setErr(null);
      setMsg(null);

      if (!username.trim()) throw new Error("Username is required.");
      if (!password) throw new Error("Password is required.");

      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const j = await r.json();

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || `Login failed (${r.status})`);
      }

      setUsername("");
      setPassword("");
      setAuthed(true);
      setMsg("Logged in.");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    try {
      setErr(null);
      setMsg(null);

      const r = await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });
      const j = await r.json();

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || `Logout failed (${r.status})`);
      }

      setAuthed(false);
      setLogs([]);
      setMsg("Logged out.");
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function saveEdit(row: LogRow) {
    try {
      setErr(null);
      setMsg(null);

      const r = await fetch(`/api/usage-logs/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          fieldName: row.field_name,
          amount: row.amount,
          note: row.note || "",
        }),
      });

      const j = await r.json();

      if (r.status === 401) {
        setAuthed(false);
        throw new Error("Please login first.");
      }

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || `API ${r.status}`);
      }

      setMsg("Updated.");
      await loadLogs();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function del(id: number) {
    try {
      const ok = window.confirm("Delete this log?");
      if (!ok) return;

      setErr(null);
      setMsg(null);

      const r = await fetch(`/api/usage-logs/${id}`, {
        method: "DELETE",
        cache: "no-store",
      });

      const j = await r.json();

      if (r.status === 401) {
        setAuthed(false);
        throw new Error("Please login first.");
      }

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || `API ${r.status}`);
      }

      setMsg("Deleted.");
      await loadLogs();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  return (
    <div>
      <h2>Usage Logs</h2>

      {checking ? (
        <div>Checking login...</div>
      ) : !authed ? (
        <div>
          <div>Login required to view/edit/delete usage logs.</div>

          <div>
            <div>Username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <div>Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {err && <div>{err}</div>}
          {msg && <div>{msg}</div>}

          <button disabled={loggingIn} onClick={login}>
            {loggingIn ? "Logging in..." : "Login"}
          </button>
        </div>
      ) : (
        <div>
          <button onClick={logout}>Logout</button>

          {err && <div>{err}</div>}
          {msg && <div>{msg}</div>}

          {loadingLogs ? (
            <div>Loading logs...</div>
          ) : logs.length === 0 ? (
            <div>No logs.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Field</th>
                  <th>Amount</th>
                  <th>Note</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((x) => (
                  <EditableRow
                    key={x.id}
                    row={x}
                    onSave={saveEdit}
                    onDelete={del}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function EditableRow({
  row,
  onSave,
  onDelete,
}: {
  row: LogRow;
  onSave: (row: LogRow) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [field, setField] = useState(row.field_name);
  const [amount, setAmount] = useState(String(row.amount));
  const [note, setNote] = useState(row.note || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    try {
      setSaving(true);

      const amountNum = Number(amount);
      if (!field.trim()) throw new Error("Field is required.");
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        throw new Error("Amount must be > 0.");
      }

      await onSave({
        ...row,
        field_name: field.trim(),
        amount: amountNum,
        note: note.trim() || null,
      });
    } catch (e: any) {
      alert(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{row.used_at}</td>
      <td>
        <input value={field} onChange={(e) => setField(e.target.value)} />
      </td>
      <td>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      </td>
      <td>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </td>
      <td>
        <button disabled={saving} onClick={save}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={() => onDelete(row.id)}>Delete</button>
      </td>
    </tr>
  );
}