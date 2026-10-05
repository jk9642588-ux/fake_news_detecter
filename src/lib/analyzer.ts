import * as cheerio from "cheerio";

// ─────────────────────────────────────────────────────────────────────────
// Reference data
// ─────────────────────────────────────────────────────────────────────────

// Each trusted outlet carries the display name plus every alias/domain that
// should be recognised as "this is that outlet" when scanning a title,
// channel name, publisher string, or source URL.
export const TRUSTED_OUTLETS: { name: string; aliases: string[]; domains: string[] }[] = [
  { name: "BBC News", aliases: ["bbc", "bbc news", "bbc urdu"], domains: ["bbc.com", "bbc.co.uk"] },
  { name: "Reuters", aliases: ["reuters"], domains: ["reuters.com"] },
  { name: "Associated Press", aliases: ["ap news", "associated press"], domains: ["apnews.com"] },
  { name: "Al Jazeera", aliases: ["al jazeera", "aljazeera"], domains: ["aljazeera.com"] },
  { name: "Dawn News", aliases: ["dawn", "dawn news"], domains: ["dawn.com"] },
  { name: "Geo News", aliases: ["geo news", "geo.tv", "geo urdu"], domains: ["geo.tv"] },
  { name: "ARY News", aliases: ["ary news"], domains: ["arynews.tv"] },
  { name: "Express News", aliases: ["express news"], domains: ["express.pk"] },
  { name: "The New York Times", aliases: ["nytimes", "new york times"], domains: ["nytimes.com"] },
  { name: "CNN", aliases: ["cnn"], domains: ["cnn.com"] },
  { name: "Sky News", aliases: ["sky news"], domains: ["skynews.com", "news.sky.com"] },
  { name: "The Washington Post", aliases: ["washington post"], domains: ["washingtonpost.com"] },
  { name: "The Guardian", aliases: ["the guardian", "guardian"], domains: ["theguardian.com"] },
  { name: "Dunya News", aliases: ["dunya news"], domains: ["dunyanews.tv"] },
  { name: "Samaa News", aliases: ["samaa news", "samaa tv"], domains: ["samaa.tv"] },
  { name: "TRT World", aliases: ["trt world"], domains: ["trtworld.com"] },
  { name: "France 24", aliases: ["france 24"], domains: ["france24.com"] },
  { name: "DW News", aliases: ["dw news", "deutsche welle"], domains: ["dw.com"] },
];

const FAKE_INDICATORS = [
  "breaking exclusive", "you won't believe", "shocking truth", "secret revealed",
  "mainstream media hiding", "doctors hate", "miracle cure", "conspiracy",
  "exposed", "they don't want you", "حیران کن", "افواہ", "جھوٹا", "سازش", "خفیہ", "جعلی",
];

const REGION_KEYWORDS: Record<string, string[]> = {
  Pakistan: ["pakistan", "islamabad", "lahore", "karachi", "peshawar", "punjab", "sindh", "balochistan", "kpk", "پاکستان", "اسلام آباد", "لاہور"],
  India: ["india", "delhi", "mumbai", "modi", "bollywood", "بھارت", "دہلی"],
  "Middle East": ["saudi", "dubai", "uae", "qatar", "iran", "iraq", "gaza", "palestine", "israel", "tehran", "سعودی", "ایران", "غزہ"],
  USA: ["america", "washington", "white house", "trump", "biden", "امریکہ", "ٹرمپ"],
  "UK/Europe": ["london", "britain", "europe", "uk parliament", "لندن", "برطانیہ"],
  Afghanistan: ["afghanistan", "kabul", "taliban", "افغانستان"],
  China: ["china", "beijing", "چین"],
};

const CATEGORIES: Record<string, string[]> = {
  Politics: ["election", "government", "minister", "parliament", "president", "trump", "biden", "سیاست", "حکومت"],
  Sports: ["cricket", "football", "match", "world cup", "psl", "کرکٹ"],
  Economy: ["economy", "stock", "inflation", "dollar", "imf", "oil", "معیشت", "ڈالر"],
  Technology: ["artificial intelligence", "tech", "software", "apple", "google", "ٹیکنالوجی"],
  Health: ["hospital", "disease", "virus", "vaccine", "صحت"],
  Entertainment: ["film", "drama", "actor", "singer", "فلم"],
};

// ─────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────

function includesKeyword(haystack: string, keyword: string): boolean {
  const isPlainLatinWord = /^[a-z0-9]+$/i.test(keyword);
  if (isPlainLatinWord && keyword.length <= 4) {
    return new RegExp(`\\b${keyword}\\b`, "i").test(haystack);
  }
  return haystack.includes(keyword.toLowerCase());
}

function scoreByKeywords(textLower: string, map: Record<string, string[]>): string {
  let best = "";
  let bestScore = 0;
  for (const [label, keywords] of Object.entries(map)) {
    const score = keywords.reduce((acc, kw) => acc + (includesKeyword(textLower, kw.toLowerCase()) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = label;
    }
  }
  return bestScore > 0 ? best : "";
}

export function detectLanguage(text: string): "Urdu" | "English" {
  const urduChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const totalWords = Math.max(text.split(/\s+/).filter(Boolean).length, 1);
  return urduChars / totalWords > 0.2 ? "Urdu" : "English";
}

export function detectRegion(text: string): string {
  const region = scoreByKeywords(text.toLowerCase(), REGION_KEYWORDS);
  return region || "Global / Unspecified";
}

export function detectCategory(text: string): string {
  const category = scoreByKeywords(text.toLowerCase(), CATEGORIES);
  return category || "General News";
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Finds a known trusted outlet by scanning url/channel/source/text fields. */
export function matchTrustedOutlet(fields: { url?: string; channel?: string; source?: string; text?: string }) {
  const host = fields.url ? hostnameOf(fields.url) : "";
  const channelLower = (fields.channel ?? "").toLowerCase().trim();
  const sourceLower = (fields.source ?? "").toLowerCase().trim();
  const textLower = (fields.text ?? "").toLowerCase();

  for (const outlet of TRUSTED_OUTLETS) {
    if (host && outlet.domains.some((d) => host === d || host.endsWith(`.${d}`))) {
      return outlet.name;
    }
    if (channelLower && outlet.aliases.some((a) => channelLower === a || channelLower.includes(a))) {
      return outlet.name;
    }
    if (sourceLower && outlet.aliases.some((a) => sourceLower === a || sourceLower.includes(a))) {
      return outlet.name;
    }
  }
  // Weaker fallback: look for the alias anywhere in the combined text (title etc).
  if (textLower) {
    for (const outlet of TRUSTED_OUTLETS) {
      if (outlet.aliases.some((a) => includesKeyword(textLower, a))) {
        return outlet.name;
      }
    }
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────
// External data fetchers (all optional / degrade gracefully without keys)
// ─────────────────────────────────────────────────────────────────────────

export type RealNewsItem = { title: string; source: string; url: string };
export type FactCheckItem = { rating: string; publisher: string };

export async function fetchRealNews(query: string, language: "en" | "ur"): Promise<RealNewsItem[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];
  try {
    const cleanQ = query.replace(/[^\w\s]/g, "").slice(0, 80).trim();
    if (!cleanQ) return [];
    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("q", cleanQ);
    url.searchParams.set("language", language);
    url.searchParams.set("sortBy", "relevancy");
    url.searchParams.set("pageSize", "5");
    url.searchParams.set("apiKey", apiKey);
    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(7000) });
    const data = await resp.json();
    if (data.status === "ok" && Array.isArray(data.articles)) {
      return data.articles.map((a: Record<string, unknown>) => ({
        title: String((a as { title?: string }).title ?? ""),
        source: String(((a as { source?: { name?: string } }).source ?? {}).name ?? "News"),
        url: String((a as { url?: string }).url ?? "#"),
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function factCheckClaim(claimText: string): Promise<FactCheckItem[]> {
  const apiKey = process.env.GOOGLE_FACT_CHECK_API_KEY;
  if (!apiKey) return [];
  try {
    const cleanQ = claimText.replace(/[^\w\s]/g, "").slice(0, 80).trim();
    if (!cleanQ) return [];
    const url = new URL("https://factchecktools.googleapis.com/v1alpha1/claims:search");
    url.searchParams.set("query", cleanQ);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("languageCode", "en");
    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(7000) });
    const data = await resp.json();
    const results: FactCheckItem[] = [];
    if (Array.isArray(data.claims)) {
      for (const claim of data.claims) {
        for (const review of claim.claimReview ?? []) {
          results.push({
            rating: String(review.textualRating ?? "Unrated"),
            publisher: String(review.publisher?.name ?? "Fact Checker"),
          });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [/(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&]|$)/, /youtu\.be\/([0-9A-Za-z_-]{11})/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function getYoutubeData(videoUrl: string): Promise<{ title: string; channel: string; description: string }> {
  let title = "";
  let channel = "";
  let description = "";

  // 1) oEmbed needs no API key and reliably returns title + channel name.
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const resp = await fetch(oembedUrl, { signal: AbortSignal.timeout(7000) });
    if (resp.ok) {
      const data = await resp.json();
      title = String(data.title ?? "");
      channel = String(data.author_name ?? "");
    }
  } catch {
    // ignore, fall through to scraping fallback
  }

  // 2) If an official YouTube Data API key is present, enrich with the
  //    description (helps category/region detection + extra verification).
  const apiKey = process.env.YOUTUBE_API_KEY;
  const videoId = extractVideoId(videoUrl);
  if (apiKey && videoId) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("id", videoId);
      url.searchParams.set("key", apiKey);
      const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(7000) });
      const data = await resp.json();
      const snippet = data.items?.[0]?.snippet;
      if (snippet) {
        title = title || String(snippet.title ?? "");
        channel = channel || String(snippet.channelTitle ?? "");
        description = String(snippet.description ?? "").slice(0, 1000);
      }
    } catch {
      // ignore
    }
  }

  // 3) Last-resort fallback: scrape the watch page title tag.
  if (!title) {
    try {
      const resp = await fetch(videoUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });
      const html = await resp.text();
      const $ = cheerio.load(html);
      const rawTitle = $("title").text().replace("- YouTube", "").trim();
      title = rawTitle;
      if (!channel && rawTitle.includes("|")) channel = rawTitle.split("|").pop()?.trim() ?? "";
    } catch {
      // ignore
    }
  }

  return { title, channel, description };
}

export async function scrapeArticle(url: string): Promise<{ title: string; content: string; siteName: string }> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await resp.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer").remove();
    const paragraphs = $("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
    const content = paragraphs.join(" ").slice(0, 3000);
    const title = ($('meta[property="og:title"]').attr("content") || $("title").text() || "News Article").trim();
    const siteName = ($('meta[property="og:site_name"]').attr("content") || "").trim();
    return { title, content, siteName };
  } catch {
    return { title: "News Article", content: "", siteName: "" };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Credibility scoring
// ─────────────────────────────────────────────────────────────────────────

export type Verdict = "LIKELY TRUE" | "LIKELY FAKE" | "UNCERTAIN";
export type Confidence = "High" | "Medium" | "Low";

export interface CredibilityInput {
  text: string;
  url?: string;
  channel?: string;
  sourceName?: string;
  factChecks: FactCheckItem[];
  realNews: RealNewsItem[];
}

export interface CredibilityResult {
  verdict: Verdict;
  confidence: Confidence;
  score: number;
  reasons: string[];
  matchedOutlet: string;
}

export function checkCredibility(input: CredibilityInput): CredibilityResult {
  const textLower = input.text.toLowerCase();
  const reasons: string[] = [];
  let score = 0;
  let hasSignal = false;

  // 1) Trusted outlet / channel / domain match → strong positive signal.
  const matchedOutlet = matchTrustedOutlet({
    url: input.url,
    channel: input.channel,
    source: input.sourceName,
    text: input.text,
  });
  if (matchedOutlet) {
    score -= 50;
    hasSignal = true;
    reasons.push(`✅ Source confirmed as ${matchedOutlet} — a recognized, trusted news publisher.`);
  }

  // 2) Clickbait / sensational phrasing → negative signal.
  for (const indicator of FAKE_INDICATORS) {
    if (textLower.includes(indicator)) {
      score += 20;
      hasSignal = true;
      reasons.push(`⚠️ Contains sensational/clickbait phrase: "${indicator}"`);
    }
  }

  // 3) Independent fact-check verdicts (Google Fact Check Tools API).
  for (const fc of input.factChecks) {
    const rating = fc.rating.toLowerCase();
    hasSignal = true;
    if (/(false|fake|misleading|pants on fire|incorrect|جھوٹ)/.test(rating)) {
      score += 40;
      reasons.push(`❌ Independent fact-checker "${fc.publisher}" rated this claim: "${fc.rating}".`);
    } else if (/(true|correct|accurate|سچ)/.test(rating)) {
      score -= 30;
      reasons.push(`✅ Independent fact-checker "${fc.publisher}" confirmed this as: "${fc.rating}".`);
    } else {
      reasons.push(`ℹ️ Fact-checker "${fc.publisher}" rated this: "${fc.rating}".`);
    }
  }

  // 4) Matching live coverage from NewsAPI.
  if (input.realNews.length > 0) {
    hasSignal = true;
    const bump = Math.min(input.realNews.length, 3) * 15;
    score -= bump;
    const outlets = [...new Set(input.realNews.map((n) => n.source))].slice(0, 3).join(", ");
    reasons.push(`✅ Found ${input.realNews.length} matching live news ${input.realNews.length === 1 ? "story" : "stories"} from: ${outlets}.`);
  }

  if (!hasSignal) {
    reasons.push("ℹ️ No trusted-source match, fact-check, or live news coverage was found — treat with caution and verify manually.");
  }

  let verdict: Verdict;
  let confidence: Confidence;
  if (score <= -40) {
    verdict = "LIKELY TRUE";
    confidence = "High";
  } else if (score <= -10) {
    verdict = "LIKELY TRUE";
    confidence = "Medium";
  } else if (score < 25) {
    verdict = "UNCERTAIN";
    confidence = hasSignal ? "Medium" : "Low";
  } else if (score < 60) {
    verdict = "LIKELY FAKE";
    confidence = "Medium";
  } else {
    verdict = "LIKELY FAKE";
    confidence = "High";
  }

  return { verdict, confidence, score, reasons, matchedOutlet };
}
