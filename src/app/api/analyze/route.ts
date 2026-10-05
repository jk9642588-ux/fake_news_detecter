import { db } from "@/db";
import { analyses } from "@/db/schema";
import {
  checkCredibility,
  detectCategory,
  detectLanguage,
  detectRegion,
  factCheckClaim,
  fetchRealNews,
  getYoutubeData,
  matchTrustedOutlet,
  scrapeArticle,
} from "@/lib/analyzer";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

type AnalyzeBody = {
  type?: "text" | "url" | "video_url";
  input?: string;
};

function isYoutubeUrl(value: string) {
  return value.includes("youtube.com") || value.includes("youtu.be");
}

export async function POST(request: Request) {
  let body: AnalyzeBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const inputType = body.type ?? "text";
  const userInput = (body.input ?? "").trim();

  if (!userInput) {
    return Response.json({ error: "Please enter some input!" }, { status: 400 });
  }

  try {
    let title = "";
    let content = "";
    let sourceUrl = "";
    let sourceName = "";

    if (inputType === "video_url" || isYoutubeUrl(userInput)) {
      const details = await getYoutubeData(userInput);
      title = details.title || "YouTube Video";
      content = details.description;
      sourceUrl = userInput;
      sourceName = details.channel;
    } else if (inputType === "url") {
      const article = await scrapeArticle(userInput);
      title = article.title;
      content = article.content;
      sourceUrl = userInput;
      sourceName = article.siteName;
    } else {
      content = userInput;
      title = content.slice(0, 60);
    }

    const fullText = `${title} ${sourceName} ${content}`;
    const language = detectLanguage(fullText);
    const region = detectRegion(fullText);
    const category = detectCategory(fullText);

    const searchQuery = title || content.slice(0, 80);
    const [realNews, factChecks] = await Promise.all([
      fetchRealNews(searchQuery, language === "Urdu" ? "ur" : "en"),
      factCheckClaim(searchQuery),
    ]);

    const credibility = checkCredibility({
      text: fullText,
      url: sourceUrl,
      channel: sourceName,
      sourceName,
      factChecks,
      realNews,
    });

    const resolvedSourceName =
      sourceName || matchTrustedOutlet({ url: sourceUrl, text: fullText }) || (sourceUrl ? new URL(sourceUrl).hostname : "");

    const contentPreview = content.slice(0, 500) || title;

    const [saved] = await db
      .insert(analyses)
      .values({
        inputType,
        inputRaw: userInput,
        title,
        sourceUrl,
        sourceName: resolvedSourceName,
        language,
        region,
        category,
        verdict: credibility.verdict,
        confidence: credibility.confidence,
        score: credibility.score,
        reasons: credibility.reasons,
        realNews: realNews.slice(0, 3),
        factChecks: factChecks.slice(0, 3),
        contentPreview,
      })
      .returning();

    return Response.json({
      id: saved.id,
      title,
      sourceName: resolvedSourceName,
      language,
      region,
      category,
      verdict: credibility.verdict,
      confidence: credibility.confidence,
      score: credibility.score,
      reasons: credibility.reasons,
      content_preview: contentPreview,
      real_news: realNews.slice(0, 3),
      fact_checks: factChecks.slice(0, 3),
      used_live_apis: {
        news_api: Boolean(process.env.NEWS_API_KEY),
        fact_check_api: Boolean(process.env.GOOGLE_FACT_CHECK_API_KEY),
        youtube_api: Boolean(process.env.YOUTUBE_API_KEY),
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Analysis failed." }, { status: 500 });
  }
}

export async function GET() {
  const rows = await db.select().from(analyses).orderBy(desc(analyses.id)).limit(10);
  return Response.json({ history: rows });
}
