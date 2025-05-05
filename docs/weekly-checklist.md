# ✅ Aivery – Weekly Cleanup & Codebase Health Checklist

> Recommended: Run this every Friday or before shipping major updates.

---

## 🔁 1. Codebase Inventory

- [ ] Run `node scripts/generateCodebaseOverview.js`
- [ ] Review `docs/codebase-overview.md`:
  - [ ] Check for new ❌ (unused) files
  - [ ] Move unused files to `__deprecated__/`
  - [ ] Flag ❓ files for manual review

---

## 📚 2. Documentation Hygiene

- [ ] Update `docs/prompts.md` if prompt logic changed or new prompts were added
- [ ] Update `docs/database-schema.md` if:
  - New fields or collections were introduced
  - Indexes or relationships changed
- [ ] Add new files to `codebase-overview.md` if relevant

---

## 🧠 3. AI & Prompt Validation

- [ ] Review a few AI outputs (workout summaries, dashboard quotes, etc.)
- [ ] Spot-check for weirdness: hallucinations, broken formatting, etc.
- [ ] Test how the system handles incomplete data (no workout name, no weather)

---

## 💸 4. Stripe & API Tier Checks

- [ ] Test Free vs. Premium behavior:
  - [ ] API limits respected (2/day Free, 5/day Premium)
  - [ ] Stripe webhook updates working
- [ ] Skim API logs for anomalies or abuse

---

## 🔐 5. Cursor Rule Audit

- [ ] Review `.cursor-rules.json`
- [ ] Add new rules for risky files or folders
- [ ] Confirm that rules (e.g. `__deprecated__`) still behave correctly in Cursor

---

## ⚠️ 6. Under Review Files

- [ ] Open `## Needs Manual Review` in `codebase-overview.md`
- [ ] Pick 1–2 files to:
  - [ ] Confirm usage and mark ✅
  - [ ] Or move to `__deprecated__` if clearly unused
- [ ] Delete confirmed stale files after review

---

## 🧪 7. Smoke Test (Local)

- [ ] `npm run dev` runs cleanly
- [ ] Strava connect and sync working
- [ ] Dashboard loads correct data
- [ ] AI feedback appears in workouts or dashboard
- [ ] Post-workout logic (if enabled) behaves correctly

---

## 💡 Optional: Build in Public

- [ ] What did I improve this week?
- [ ] Anything worth sharing visually (AI output, dashboard tweak, refactor win)?
