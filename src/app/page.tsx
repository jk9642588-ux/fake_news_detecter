import { db } from "@/db";
import { analyses } from "@/db/schema";
import { desc } from "drizzle-orm";
import AnalyzerClient, { type HistoryRow } from "@/components/AnalyzerClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rows = await db.select().from(analyses).orderBy(desc(analyses.id)).limit(10);

  const history: HistoryRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    sourceName: r.sourceName,
    verdict: r.verdict,
    confidence: r.confidence,
    category: r.category,
    region: r.region,
    language: r.language,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      <AnalyzerClient initialHistory={history} />
    </main>
  );
}
