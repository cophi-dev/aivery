# Aivery

Minimalist, AI-powered fitness app for consistent training. Connects to **Strava**, surfaces calm generative feedback on workouts, and keeps the UI focused on insight over noise.

**Live:** [aivery-five.vercel.app](https://aivery-five.vercel.app)

---

## ⚙️ Tech Stack

- **Frontend & Backend**: Next.js (App Router)
- **Database**: MongoDB Atlas
- **Authentication & Data Sync**: Strava API
- **AI Services**: OpenAI (gpt-4.1-mini-2025-04-14)
- **Payments**: Stripe

---

## 🗂 Project Structure

| Folder / File            | Purpose |
|--------------------------|---------|
| `pages/`                 | Traditional Next.js pages and API routes |
| `app/`                   | App Router structure (routes, layouts, metadata) |
| `components/`            | Reusable UI components |
| `lib/`                   | Core logic (AI insights, API logic, DB access) |
| `scripts/`               | One-off migration/repair/data scripts |
| `public/`                | Static assets |
| `__deprecated__/`        | Archived unused code (for review, not deleted) |
| `docs/`                  | Internal markdown docs for codebase, DB, prompts |

---

## 📚 Internal Docs

- [`docs/codebase-overview.md`](docs/codebase-overview.md)  
  Inventory of every file in the repo with usage status and purpose.

- [`docs/database-schema.md`](docs/database-schema.md)  
  Schema and structure of MongoDB collections (users, workouts, logs, etc.).

- [`docs/prompts.md`](docs/prompts.md)  
  Overview of prompt formats used for workout summaries, quotes, insights.

---

## 🚀 Getting Started

```bash
git clone https://github.com/cophi-dev/aivery.git
cd aivery
npm install

# Configure environment variables (standardize on gpt-4.1-mini-2025-04-14)
./scripts/dev/update-llm-env.js
# Then edit .env.local to add your OpenAI API key
