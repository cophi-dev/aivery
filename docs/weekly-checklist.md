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
- [ ] If running plan prompt changed, verify it *explicitly* instructs the LLM to use average weekly distance, longest run, fastest pace, and last 5 running workouts (not just the most recent run). Check fallback logic for vague plan responses is enforced and documented.
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
  - [ ] Personal Records display highest values, not random samples
- [ ] AI feedback appears in workouts or dashboard
  - [ ] Workout statements include real-world comparisons (landmarks for cardio, object weights for strength)
- [ ] Muscle group analysis provides accurate insights
  - [ ] Primary and secondary muscles are weighted correctly
  - [ ] Neglected muscle groups are properly identified
  - [ ] Time period filters (30/90/180 days) work correctly
- [ ] Post-workout logic (if enabled) behaves correctly

---

## 💡 Optional: Build in Public

- [ ] What did I improve this week?
- [ ] Anything worth sharing visually (AI output, dashboard tweak, refactor win)?

- [ ] Fallback for vague queries (intent: 'unknown') with user context returns a concrete, actionable suggestion (not a generic message); retry logic triggers if needed. See prompts.md for details.

## LLM Integration Checklist

- [ ] All LLM calls use the centralized `callLLM` helper in `src/lib/services/llm.ts`
- [ ] Provider/model selection is via environment variables (no hardcoded values)
- [ ] Provider/model logging is present at every LLM call site
- [ ] Prompt fallback/retry logic and follow-up instruction handling are implemented and tested
- [ ] No direct fetch calls or hardcoded model/provider names remain in the codebase
