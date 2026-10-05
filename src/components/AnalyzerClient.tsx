"use client";

import { useState } from "react";

type RealNewsItem = { title: string; source: string; url: string };
type FactCheckItem = { rating: string; publisher: string };

type AnalyzeResult = {
  id: number;
  title: string;
  sourceName: string;
  language: string;
  region: string;
  category: string;
  verdict: "LIKELY TRUE" | "LIKELY FAKE" | "UNCERTAIN";
  confidence: "High" | "Medium" | "Low";
  score: number;
  reasons: string[];
  content_preview: string;
  real_news: RealNewsItem[];
  fact_checks: FactCheckItem[];
  used_live_apis: { news_api: boolean; fact_check_api: boolean; youtube_api: boolean };
};

export type HistoryRow = {
  id: number;
  title: string;
  sourceName: string;
  verdict: string;
  confidence: string;
  category: string;
  region: string;
  language: string;
  createdAt: string;
};

const TABS: { key: "text" | "url" | "video_url"; label: string; icon: string; placeholder: string }[] = [
  { key: "text", label: "Text", icon: "📝", placeholder: "Paste a news claim, headline, or paragraph to verify..." },
  { key: "url", label: "News URL", icon: "🔗", placeholder: "https://example.com/news/article" },
  { key: "video_url", label: "Video URL", icon: "📺", placeholder: "https://youtu.be/VIDEO_ID or youtube.com/watch?v=..." },
];

const VERDICT_STYLES: Record<string, { ring: string; bg: string; text: string; emoji: string }> = {
  "LIKELY TRUE": { ring: "border-emerald-400/60", bg: "bg-emerald-500/10", text: "text-emerald-300", emoji: "✅" },
  "LIKELY FAKE": { ring: "border-rose-400/60", bg: "bg-rose-500/10", text: "text-rose-300", emoji: "❌" },
  UNCERTAIN: { ring: "border-amber-400/60", bg: "bg-amber-500/10", text: "text-amber-300", emoji: "⚠️" },
};

export default function AnalyzerClient({ initialHistory }: { initialHistory: HistoryRow[] }) {
  const [tab, setTab] = useState<"text" | "url" | "video_url">("video_url");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>(initialHistory);

  async function handleAnalyze() {
    if (!input.trim()) {
      setError("Please enter some input!");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: tab, input: input.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setResult(data);
      refreshHistory();
    } catch {
      setError("Network error — could not reach the analysis service.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshHistory() {
    try {
      const resp = await fetch("/api/analyze");
      const data = await resp.json();
      if (Array.isArray(data.history)) setHistory(data.history);
    } catch {
      // ignore
    }
  }

  const verdictStyle = result ? VERDICT_STYLES[result.verdict] : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="text-center">
        <h1 className="bg-gradient-to-r from-sky-300 via-cyan-200 to-sky-400 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
          🛡️ Fake News Detector
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Checks claims against trusted outlets, independent fact-checkers, and live news coverage.
        </p>
      </header>

      {/* Input card */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.6)] backdrop-blur sm:p-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setResult(null);
                setError("");
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                tab === t.key
                  ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-900/40"
                  : "bg-slate-800/70 text-slate-300 hover:bg-slate-700/70"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "text" ? (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={TABS.find((t) => t.key === tab)?.placeholder}
              rows={4}
              className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />
          ) : (
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={TABS.find((t) => t.key === tab)?.placeholder}
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />
          )}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Analyzing...
            </>
          ) : (
            <>🔍 Analyze News</>
          )}
        </button>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
        )}
      </section>

      {/* Result */}
      {result && verdictStyle && (
        <section className="flex flex-col gap-4">
          <div className={`rounded-2xl border ${verdictStyle.ring} ${verdictStyle.bg} px-6 py-5 text-center`}>
            <p className={`text-xl font-extrabold tracking-wide sm:text-2xl ${verdictStyle.text}`}>
              {verdictStyle.emoji} {result.verdict}
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">Confidence: {result.confidence}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoCard icon="🌐" label="Language" value={result.language} />
            <InfoCard icon="📍" label="Region" value={result.region} />
            <InfoCard icon="📂" label="Category" value={result.category} />
            <InfoCard icon="🏷️" label="Source" value={result.sourceName || "Unknown"} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">📋 Analysis Reasons</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {result.reasons.map((reason, idx) => (
                <li key={idx} className="border-b border-white/5 pb-2 text-sm text-slate-300 last:border-none">
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          {result.fact_checks.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">🔎 Independent Fact-Checks</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {result.fact_checks.map((fc, idx) => (
                  <li key={idx} className="rounded-lg bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
                    <span className="font-semibold text-slate-100">{fc.publisher}</span> rated this{" "}
                    <span className="font-semibold">&ldquo;{fc.rating}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.real_news.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">📰 Matching Live Coverage</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {result.real_news.map((n, idx) => (
                  <li key={idx} className="rounded-lg bg-slate-900/50 px-3 py-2 text-sm">
                    <a href={n.url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
                      {n.title}
                    </a>
                    <span className="ml-2 text-xs text-slate-500">— {n.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">📄 Content Preview</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{result.content_preview}</p>
          </div>

          <p className="text-center text-xs text-slate-500">
            Live signals used — NewsAPI: {result.used_live_apis.news_api ? "on" : "off (add NEWS_API_KEY)"} · Fact Check:{" "}
            {result.used_live_apis.fact_check_api ? "on" : "off (add GOOGLE_FACT_CHECK_API_KEY)"} · YouTube Data:{" "}
            {result.used_live_apis.youtube_api ? "on" : "off (add YOUTUBE_API_KEY)"}
          </p>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-bold text-slate-100">🕘 Recent Analyses</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {history.map((row) => {
              const style = VERDICT_STYLES[row.verdict] ?? VERDICT_STYLES.UNCERTAIN;
              return (
                <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/50 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-slate-200">{row.title || "Untitled"}</p>
                    <p className="truncate text-xs text-slate-500">
                      {row.sourceName || "Unknown source"} · {row.category} · {row.region}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${style.bg} ${style.text}`}>
                    {style.emoji} {row.verdict}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-sky-300">
        {icon} {label}
      </p>
      <p className="mt-1 truncate text-base font-semibold text-slate-100">{value}</p>
    </div>
  );
}
