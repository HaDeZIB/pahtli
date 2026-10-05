# Changelog

## v1.1 — 4 Oct 2026 (after the Hack-Nation submission)

> **Post-submission update.** Pahtli was submitted to the Hack-Nation 7th Global AI Hackathon on 4 Oct 2026 at commit `de209a0`, tagged [`v1.0-entrega`](https://github.com/HaDeZIB/pahtli/tree/v1.0-entrega). Everything below was built **after** the deadline and is now live at https://pahtli.vercel.app. Judges who want to see exactly what was submitted can browse or run that tag. The approach is unchanged: speech → extractor → cited rules → a person decides. This update fixes safety bugs found by continued testing and covers more everyday complaints.

### Clinical safety fixes (bugs present in v1.0)
- **Negation scope:** "niño de 3 años *sin calentura con convulsiones*" negated the convulsions too and returned *Atender aquí*. It now returns **urgencia**.
- **Patient vs. companion:** the age and sex of the person speaking or accompanying were assigned to the patient. "La señora de 30 años trae a su bebé de 1 mes con calentura" took the mother's age and returned *Atender aquí*. It now returns **urgencia**. A man described by his wife is no longer asked about pregnancy.
- **Scorpion stings** were not recognized and returned *Atender aquí*. A sting in a child under 5 is now **urgencia** (Secretaría de Salud guidance; NOM-033 was cancelled in 2024 and is not cited).
- **Pregnancy questions:** the app asks "¿Es hombre o mujer?" first when sex is unknown, and never asks about pregnancy for men, children or women outside 10–49.
- **Green vomit** is urgencia at any age (NHS).
- **Hypertension in pregnancy** is urgencia (NOM-007-SSA2-2016 5.3.1.3).

### New coverage
- 39 cited rules for common complaints: constipation and gas (including "no obra ni echa gases" as an obstruction warning), heartburn, sore throat, earache, burning urination, back pain, toothache, rashes, cuts, burns, scorpion/spider/dog bites, falls and head blows, dizziness, known diabetes or hypertension, anxiety.
- Home-care advice tailored to the complaint, age, sex and pregnancy status, each with its "go to the health unit if…" signs and source. Never shown on an uncertain ("No estoy segura") result, and never shown to pregnant women for non-obstetric complaints.

### Evaluation
- New blind held-out set **test_v3** (80 cases on everyday complaints, frozen by SHA-256 before any round-3 change): accuracy 66.3% → **80.0%**; urgent cases under-triaged 9/20 → **6/20** (95% CI 15–52%), and **none** of them silent (the app always asks or flags "No estoy segura"); forbidden questions (e.g. pregnancy to a man) **0/54**; over-triage 5%.
- Earlier splits unchanged: dev 100%, test_v1 100%, test_v2 92.5%.
- 629 automated tests (Vitest) and the offline Playwright E2E pass.
- All new rules are provisional pending review by a licensed physician (see `docs/decisiones-clinicas.md`).

## v1.0-entrega — 4 Oct 2026
Version submitted to Hack-Nation 7th Global AI Hackathon (World Bank · Small AI for Development · Health).
