"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function SubmitForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const turnstileWidget = useRef<string | null>(null);
  const turnstileToken = useRef("");

  useEffect(() => {
    if (!siteKey) return;
    const render = () => {
      if (!window.turnstile || !turnstileContainer.current || turnstileWidget.current !== null) return;
      turnstileWidget.current = window.turnstile.render(turnstileContainer.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          turnstileToken.current = token;
        },
        "expired-callback": () => {
          turnstileToken.current = "";
        },
      });
    };
    if (window.turnstile) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, []);

  return (
    <form
      className="form"
      onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        const data = new FormData(event.currentTarget);
        try {
          const response = await fetch("/api/submissions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              url: data.get("url"),
              note: data.get("note"),
              website: data.get("website"),
              turnstileToken: turnstileToken.current,
            }),
          });
          const payload = await response.json();
          setMessage(payload.message ?? payload.error ?? "Unable to save this report.");
          if (response.ok) (event.target as HTMLFormElement).reset();
        } catch {
          setMessage("The report could not be saved. Please try again.");
        } finally {
          turnstileToken.current = "";
          if (window.turnstile && turnstileWidget.current !== null) window.turnstile.reset(turnstileWidget.current);
          setBusy(false);
        }
      }}
    >
      <label>
        Public URL
        <input required name="url" type="url" maxLength={2048} placeholder="https://example.com/page" />
      </label>
      <label>
        Observation summary
        <textarea
          name="note"
          maxLength={1500}
          rows={4}
          placeholder="Describe the behavior, detector/model and date. Do not paste secrets or exploit code."
        />
      </label>
      {/* Honeypot: invisible to humans, attractive to bots. Never remove the name. */}
      <div style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {siteKey && <div ref={turnstileContainer} />}
      <button className="button" disabled={busy}>
        {busy ? "Saving report…" : "Send to review queue →"}
      </button>
      {message && (
        <p className="note" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
