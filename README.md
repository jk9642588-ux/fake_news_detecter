# 🛡️ Fake News Detector

A full-stack news verification app that checks claims against trusted 
outlets, independent fact-checkers, and live news coverage.

## ✨ Features
- Analyze raw text, news URLs, and YouTube videos
- Live cross-verification with Google Fact Check Tools API
- Real news matching via NewsAPI
- YouTube metadata extraction via YouTube Data API v3
- Credibility score with verdict (Likely True / Likely Fake)
- Analysis history saved to PostgreSQL

## 🛠️ Tech Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Drizzle ORM + Neon PostgreSQL
- NewsAPI, Google Fact Check API, YouTube Data API

## 🚀 Run Locally
1. `npm install`
2. Copy `.env.example` to `.env` and fill in your keys
3. `npx drizzle-kit push`
4. `npm run dev`
