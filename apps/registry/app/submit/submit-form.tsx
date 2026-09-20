"use client";
import { useState, type FormEvent } from "react";
export function SubmitForm() {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  return <form className="form" onSubmit={async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: data.get("url"), note: data.get("note") }) });
      const payload = await response.json(); setMessage(payload.message ?? payload.error ?? "Unable to save this report.");
    } catch { setMessage("The report could not be saved. Please try again."); } finally { setBusy(false); }
  }}><label>Public URL<input required name="url" type="url" maxLength={2048} placeholder="https://example.com/page" /></label><label>Observation summary<textarea name="note" maxLength={1500} rows={4} placeholder="Describe the behavior, detector/model and date. Do not paste secrets or exploit code." /></label><button className="button" disabled={busy}>{busy ? "Saving report…" : "Send to review queue →"}</button>{message && <p className="note" role="status">{message}</p>}</form>;
}
