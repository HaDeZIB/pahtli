# Pahtli — Data grounding

> Every number below was read on the linked source page/PDF on **3 Oct 2026** unless stated otherwise.
> If we could not verify a figure on a primary source, we left it out (see §E "What we could not verify").
> Spanish terms are kept where they are the official name of an indicator or program.

Contents
- [A. Evidence that the problem is real](#a-evidence-that-the-problem-is-real)
- [B. Data and knowledge the tool is built with](#b-data-and-knowledge-the-tool-is-built-with)
- [C. How the tool would fare in a less-supported language (Náhuatl)](#c-how-the-tool-would-fare-in-a-less-supported-language-náhuatl)
- [D. Privacy and data location](#d-privacy-and-data-location)
- [E. What we could not verify](#e-what-we-could-not-verify)

---

## A. Evidence that the problem is real

### A.1 Too few health workers, especially at the first level

| Indicator | Mexico | Comparison | Year / source |
|---|---|---|---|
| Practising doctors per 1,000 population | **2.7** | OECD avg 3.9 | OECD, *Health at a Glance 2025 – Mexico country note* (CC BY 4.0), data from OECD Health Statistics 2025. [oecd.org](https://www.oecd.org/en/publications/health-at-a-glance-2025_15a55280-en/mexico_f3342ed6-en.html) |
| Practising nurses per 1,000 | **3.0** | OECD avg 9.2 | same |
| Hospital beds per 1,000 | **1.0** | OECD avg 4.2 | same |
| Population covered for a core set of services | **78 %** | OECD avg 98 % | same |
| Treatable mortality (deaths per 100,000) | **175** | OECD avg 77 | same |
| Physicians per 1,000 (WHO-sourced series) | **2.59** (2022) | — | World Bank WDI `SH.MED.PHYS.ZS`, [API](https://api.worldbank.org/v2/country/MEX/indicator/SH.MED.PHYS.ZS?format=json&mrnev=1) (CC BY 4.0) |
| Nurses and midwives per 1,000 | **3.03** (2022) | — | World Bank WDI `SH.MED.NUMW.P3`, [API](https://api.worldbank.org/v2/country/MEX/indicator/SH.MED.NUMW.P3?format=json&mrnev=1) |

**Not covered:** these are national averages. We did not find a verified, current rural-vs-urban density split for Mexico, so we do not claim one.

### A.2 Lack of access to health services (carencia por acceso a los servicios de salud)

Source: INEGI, *Comunicado de prensa 118/25 – Pobreza multidimensional 2024* (13 Aug 2025). INEGI took over poverty measurement after CONEVAL was dissolved (constitutional reform DOF 20-Dec-2024); the 2024 figures follow CONEVAL's methodology. [PDF](https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2025/pm/pm2025_08.pdf)

- **34.2 % of the population (44.5 million people)** lacked access to health services in 2024 (39.1 % / 50.4 M in 2022; 16.2 % / 20.1 M in 2018).
- **13.9 million** of them live in rural areas, 30.6 M in urban areas.
- The demo states have high poverty: **Veracruz 44.5 %** and **Puebla 43.4 %** of the population in multidimensional poverty (national 29.6 %).

**Not covered:** this indicator measures *affiliation/entitlement* to a health institution, not physical distance or travel time. Someone can be "covered" and still be hours away from a staffed facility. Civil-society organisations questioned whether part of the 2022→2024 drop reflects questionnaire changes ([Expansión, 27 Aug 2025](https://politica.expansion.mx/mexico/2025/08/27/organizaciones-piden-al-inegi-aclarar-cambios-en-medicion-de-pobreza-y-acceso-a-salud)).

### A.3 Language: millions of people whose first language is not Spanish

Source: INEGI, *Estadísticas a propósito del Día Internacional de los Pueblos Indígenas*, Comunicado 430/22 (8 Aug 2022), from Censo de Población y Vivienda 2020. [PDF](https://www.inegi.org.mx/contenidos/saladeprensa/aproposito/2022/EAP_PueblosInd22.pdf)

- **7,364,645** people aged 3+ speak an Indigenous language (6.1 % of that age group); **68** Indigenous languages are spoken.
- **Náhuatl is the most spoken: 22.4 %** of Indigenous-language speakers (≈ 1.65 million; our multiplication of 22.4 % × 7,364,645). Náhuatl is predominant in 15 states.
- **866,000 (11.8 %) Indigenous-language speakers do not speak Spanish.**
- Illiteracy among Indigenous-language speakers aged 15+ is **20.9 %** (vs 3.6 % among non-speakers); **26.2 % among Indigenous-language-speaking women**. → This is why Pahtli is voice-first with pictograms, not a text form.
- 23.2 million people aged 3+ self-identify as Indigenous (19.4 %).

### A.4 Connectivity: better than it was, still a rural gap

Source: INEGI, *ENDUTIH 2025*, Comunicado de prensa 32/26 (16 Jun 2026). [PDF](https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/endutih/ENDUTIH_25.pdf)

- Internet use (age 6+): **88.9 % urban vs 75.2 % rural** (national 86.1 %).
- Households with internet: national 78.3 %; lowest in **Veracruz (68.3 %)**, Oaxaca (64.0 %) and Chiapas (53.9 %).
- 21.7 % of households had no internet; main reason: cannot afford it (12.1 %).
- **84.6 %** of people aged 6+ use a mobile phone; 79.3 % of users are on **prepaid** plans (data is metered → large downloads must happen once, on Wi-Fi).
- Only 4.7 % of internet users declare speaking an Indigenous language.

Previous year for trend: ENDUTIH 2024 reported 86.9 % urban vs 68.5 % rural internet use ([INEGI results report](https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2025/endutih/ENDUTIH_24_RR.pdf), via [DPL News](https://dplnews.com/100-millones-de-usuarios-de-internet/)).

**Not covered:** ENDUTIH measures whether people *used* the internet in the survey period, not whether there is signal *where the patient is* at the moment of care. The household survey does not map coverage holes inside a municipality; that is the gap an offline tool targets.

**Gender gap — honest finding:** in Mexico the gender gap in phone use is small. ENDUTIH 2025: 84.8 % of men vs 84.5 % of women use a mobile phone (gap shrank from 3.3 pp in 2015 to 0.3 pp in 2025). GSMA's *Mobile Gender Gap Report 2025* likewise lists Mexico as an exception "where women are equally as likely as men to use mobile internet" ([PDF](https://www.gsma.com/wp-content/uploads/2025/12/The-Mobile-Gender-Gap-Report-2025.pdf)). We therefore do **not** use a gender-gap argument for Mexico.

### A.5 The conditions Pahtli triages are still deadly

- **Influenza and pneumonia** were the **6th cause of death** in Mexico in 2024: **37,283 deaths** (5th among women, 16,731). INEGI, *Estadísticas de Defunciones Registradas 2024*, Comunicado 142/25 (10 Nov 2025). [PDF](https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2025/edr/EDR2024-def_CP.pdf)
- **Under-5 mortality: 13.1 per 1,000 live births (2024).** UN IGME via World Bank WDI `SH.DYN.MORT`. [API](https://api.worldbank.org/v2/country/MEX/indicator/SH.DYN.MORT?format=json&mrnev=1)
- **Dengue** — Secretaría de Salud, *Panorama Epidemiológico de Dengue* (SINAVE/DGE, weekly). [2025 series](https://www.gob.mx/salud/documentos/panorama-epidemiologico-de-dengue-2025) · [2026 series](https://www.gob.mx/salud/documentos/panorama-epidemiologico-de-dengue-2026)
  - 2024 closing figures: **126,332 confirmed cases, 1,064 deaths**.
  - 2025 closing figures (as reported in the 2026 SE38 bulletin): **22,382 confirmed cases, 214 deaths**; 11,073 of them (**49 %**) were *dengue con signos de alarma* or *dengue grave*.
  - 2026 through epidemiological week 38 ([Pano_dengue_SE38.pdf](https://www.gob.mx/cms/uploads/attachment/file/1106665/Pano_dengue_SE38.pdf), 2 Oct 2026): **6,342 confirmed, 26 deaths**; **3,250 (51 %) with warning signs or severe**. **Veracruz** (a demo state) is among the 5 states with 66 % of cases (1,119 confirmed in 2026 so far).
  - In 2025, Veracruz had 2,863 confirmed cases (incidence 32.7/100k), San Luis Potosí 631, Puebla 416, Hidalgo 295 ([SE53-2025 bulletin](https://www.gob.mx/cms/uploads/attachment/file/1047120/Pano_dengue_53.pdf)).
  - Why it matters for triage: recognising *signos de alarma* early and referring is exactly the decision a promotora has to make. Note the bulletins count *confirmed* cases; deaths are added when a national committee ratifies them, so recent weeks are always under-counted.

**Not covered:** we did not find a verified 2024/2025 breakdown of under-5 deaths by pneumonia/diarrhoea for rural or Indigenous municipalities, so we make no claim about it.

### A.6 Community health workers already exist — they lack decision support, not motivation

- IMSS-Bienestar's community model works with **7,079 parteras (traditional midwives), 753 traditional healers and 1,379 rural health volunteers**, plus **2,177 health committees and 10,356 volunteers in 11 states** (IMSS, Boletín de prensa 121/2023, 14 Mar 2023). [PDF](https://www.imss.gob.mx/sites/all/statics/i2f_news/IMSS%20Bolet%C3%ADn%20121_0.pdf)
- **Facility presence is not guaranteed:** in nationally representative unannounced visits in six low/middle-income countries (Bangladesh, Ecuador, India, Indonesia, Peru, Uganda), **23 % to 40 % of medical personnel were absent** (Chaudhury, Hammer, Kremer, Muralidharan, Rogers, *Provider Absence in Schools and Health Clinics*, World Bank/DFID, 2004; later *J. Econ. Perspectives* 2006). [PDF](https://assets.publishing.service.gov.uk/media/57a08cd0ed915d3cfd001624/Chaudhury_etal_Provider_absence_1_.pdf). This is the methodology behind the World Bank **Service Delivery Indicators** (SDI) absence-rate indicator. Mexico was not in that sample — we use it only to explain why "nearest facility on the registry" ≠ "staffed facility today".

**Not covered:** we did not find a single current official count of *promotores de salud* across all institutions (SSA, IMSS-Bienestar, state services); the IMSS figure above covers only the IMSS-Bienestar community model as of 2023.

---

## B. Data and knowledge the tool is built with

> Key design point: **the triage decision is not learned from data.** It is a deterministic rule engine that *encodes* published clinical guidelines, rule by rule, each with a citation (`src/triage/rules/sources.ts`). The ML models only (1) transcribe speech and (2) turn colloquial Spanish into structured findings — and the model may only *raise* severity, never lower it.

### B.1 Clinical guidelines (encoded, not trained)

| Source | Publisher / year | License / status | Size | Used for | Does NOT cover |
|---|---|---|---|---|---|
| IMCI Chart Booklet ([PDF](https://cdn.who.int/media/docs/default-source/mca-documents/child/imci-integrated-management-of-childhood-illness/imci-in-service-training/imci-chart-booklet.pdf)) | WHO/UNICEF, 2014 (AIEPI in Spanish) | WHO publication, free to use with attribution | ~5 MB PDF | General danger signs, fast breathing cut-offs by age, dehydration, fever in children | **Only children 2 months – 5 years.** Adults, pregnancy and newborns need other sources (below). Assumes the worker can count breaths and see chest indrawing — our voice pipeline cannot observe; we ask. |
| IMCI: management of the sick young infant up to 2 months, 2019 ([PDF](https://iris.who.int/server/api/core/bitstreams/e5a2ace4-c5ae-462d-b28c-1ac1d1a351ca/content)) | WHO, 2019 | WHO | — | Newborn/young infant danger signs | Requires examination (temperature, umbilicus, skin) |
| *Caring for the sick child in the community* (iCCM) ([PDF](https://www.childhealthtaskforce.org/sites/default/files/2019-06/Caring%20for%20Sick%20Child%20in%20the%20Community%20CHW%20Chart%20Booklet%28WHO%2CUNICEF%2C2014%29.pdf)) | WHO/UNICEF, 2014 | WHO/UNICEF | 16 pp | CHW-level version of IMCI ("refer urgently / treat at home") — closest match to a promotora's role | Includes treatment (ORS, zinc, amoxicillin, antimalarials) that **Pahtli deliberately does not give** (no dosing) |
| NOM-007-SSA2-2016 ([PDF](https://www.gob.mx/cms/uploads/attachment/file/512098/NOM-007-SSA2-2016.pdf)) | Secretaría de Salud, DOF 07-Apr-2016 | Mexican official standard (public) | 32 pp | Obstetric warning signs (bleeding, severe headache/visual disturbance, convulsions, reduced fetal movement…) | Not a triage algorithm; we translate warning signs to "urgencia/centro hoy". |
| NOM-031-SSA2-1999 (child health) | Secretaría de Salud, DOF 2001 | public | — | Mexican adoption of AIEPI criteria | Old (1999); superseded in parts by newer GPCs |
| GPC IMSS-028-08 prenatal care | IMSS, update 2017 | public | — | Prenatal warning signs | — |
| WHO PCPNC, 3rd ed. ([PDF](https://iris.who.int/server/api/core/bitstreams/e9f751fd-6eab-42cb-9e0c-0eb86a0365bb/content)) | WHO, 2015 | WHO | — | Pregnancy/postpartum danger signs | — |
| PAHO *Algoritmos para el manejo clínico de los casos de dengue* ([PDF](https://www.paho.org/sites/default/files/2020-09/2020-cde-algoritmos-manejo-clinico-dengue.pdf)) | PAHO, 2020 (based on PAHO guide 2016) | PAHO | — | Dengue warning signs (*signos de alarma*) → urgent referral | Lab criteria (platelets, haematocrit) are unavailable in the field |
| WHO/ICRC/MSF Interagency Integrated Triage Tool (IITT), adult & paediatric | WHO, current | WHO | — | Adult emergency signs (airway, breathing, circulation, altered consciousness) | Designed for facility triage by trained staff, not lay workers |
| CDC stroke / heart-attack symptom pages | CDC | US public domain | — | Lay-language FAST / chest-pain red flags | US-centric wording |

What the rule set as a whole does **not** cover: chronic disease management (diabetes, hypertension follow-up), mental health, trauma scoring, malnutrition (MUAC needs a tape), anything requiring lab tests or vital-sign devices. **Pahtli triages; it does not diagnose or prescribe.** Clinical review by a licensed physician is pending (stated in the README).

### B.2 Speech-to-text: Whisper (on device)

| Item | Value |
|---|---|
| Model | OpenAI Whisper (tiny / base), ONNX exports by `onnx-community` run with transformers.js |
| Paper | Radford et al., *Robust Speech Recognition via Large-Scale Weak Supervision*, 2022, [arXiv:2212.04356](https://arxiv.org/abs/2212.04356) |
| Training data | **680,000 h** of weakly-supervised web audio; 117,000 h cover 96 non-English languages; **Spanish ASR: 11,100 h** (paper, Appendix E training-data figure). Training audio is **not released**. |
| License | Code **MIT** ([github.com/openai/whisper](https://github.com/openai/whisper)); weights on Hugging Face tagged **Apache-2.0** ([openai/whisper-base](https://huggingface.co/openai/whisper-base)) |
| On-device size (q4 ONNX, from HF file listing) | whisper-tiny: encoder 9.0 MB + merged decoder 86.7 MB; whisper-base: encoder 18.8 MB + merged decoder 123.6 MB ([onnx-community/whisper-base](https://huggingface.co/onnx-community/whisper-base)). 8-bit "quantized" decoders are smaller (tiny 30.7 MB, base 53.7 MB). |
| Published Spanish benchmark (paper Table 13, **FLEURS**, WER %) | tiny **15.9** · base **9.9** · small 5.6 · medium 3.6 · large-v2 3.0 |
| Published Spanish benchmark (paper Table 11, **Common Voice 9**, WER %) | tiny **30.3** · base **19.6** · small 10.3 · medium 6.9 · large-v2 5.6 |

**What this does NOT cover (important):**
- FLEURS is *read* Wikipedia sentences recorded in quiet conditions; Common Voice is crowd-sourced *read* speech. Neither is spontaneous, noisy, rural Mexican Spanish with regional vocabulary ("anda aguado", "calentura", "le dan ataques"). **Whisper's accuracy on rural or Indigenous-accented Mexican Spanish is unmeasured — by OpenAI and by us.** The numbers above are an upper bound, and the tiny/base models we can run on a low-end phone are the weakest rows of the table (≈ 1 word in 5–10 wrong on read speech).
- Mitigations in the product: the transcript is always shown and editable, and every finding can be entered by buttons (Tier C needs no ASR at all).
- No Náhuatl ASR on device (see §C).

### B.3 Findings extractor: small instruct LLM (on device)

| Item | Value |
|---|---|
| Candidates | Qwen2.5-0.5B/1.5B-Instruct or Qwen3-0.6B/1.7B, MLC q4f16_1 builds run with WebLLM (`@mlc-ai/web-llm`). Final choice is reported in the README with measured latency. |
| License | **Apache-2.0** (base models: [Qwen2.5-0.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct), [Qwen2.5-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct), [Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-0.6B), [Qwen3-1.7B](https://huggingface.co/Qwen/Qwen3-1.7B)) |
| Download size (sum of HF repo files) | Qwen2.5-0.5B q4f16_1-MLC ≈ 290 MB · Qwen3-0.6B ≈ 352 MB · Qwen2.5-1.5B ≈ 880 MB · Qwen3-1.7B ≈ 984 MB |
| Fine-tuning | **None.** Prompted with a closed schema of findings; a keyword extractor runs in parallel as a cross-check and fallback. |

**Does NOT cover:** the model's pre-training data is not public, so we cannot say how much rural Mexican Spanish it has seen. It is never allowed to lower the rules' triage level. Without a GPU (Tier B/C phones) it may not load at all — triage still works from keywords + buttons.

### B.4 Evaluation set — **SYNTHETIC**

- **Synthetic clinical vignettes written for this project** (in `eval/`), in colloquial Mexican Spanish, each labelled with the expected triage level and expected rule IDs. Generated with an LLM and hand-reviewed by the team; physician review pending.
- License: same as the repository.
- Size: reported in the README alongside the metrics (sub-triage / over-triage / latency), with a held-out split.

**Does NOT cover:** synthetic text ≠ real patients. Vignettes are clean typed text — they test the extractor + rules, **not** speech recognition on real voices, background noise, code-switching with Náhuatl, or what promotoras actually say. Labels encode our reading of the guidelines; if we misread a guideline, the eval would agree with our mistake. No real patient data was used anywhere.

### B.5 Health facility registry — CLUES (DGIS)

| Item | Value |
|---|---|
| Dataset | *Catálogo de Clave Única de Establecimientos de Salud (CLUES)*, Dirección General de Información en Salud (DGIS), Secretaría de Salud |
| Source page | [dgis.salud.gob.mx/contenidos/intercambio/clues_gobmx.html](http://www.dgis.salud.gob.mx/contenidos/intercambio/clues_gobmx.html) — "Última actualización: Agosto 2026"; page modified 23 Sep 2026 |
| File downloaded | `ESTABLECIMIENTO_SALUD_202608.xlsx` (25.2 MB) from `http://gobi.salud.gob.mx/gobi/catalogos/catalogosmaestros/ESTABLECIMIENTO_SALUD_202608.xlsx`, **downloaded 3 Oct 2026** |
| License / terms | DGIS: "Las variables de las CLUES están abiertas a todo el sector salud, no existen restricciones para su uso." |
| Raw size | 64,450 establishments nationwide (sheet `CLUES_202608`), 68 columns incl. LATITUD/LONGITUD |
| Build script | `scripts/build-facilities.py` (Python 3 standard library only; re-runnable with a newer monthly file) |
| Filters | States **Puebla, Hidalgo, San Luis Potosí, Veracruz** (covers the Sierra Norte de Puebla and Huasteca demo regions) → 12,499; `ESTATUS DE OPERACION = EN OPERACION` → 7,107; type *consulta externa* or *hospitalización*; public/social-security institutions + Cruz Roja (drops private practices, forensic/justice units, addiction centres); drops mobile units/brigades and single-purpose UNEMES; valid coordinates |
| Output | `public/data/facilities.json` — **3,956 facilities**: 3,697 first level, 241 hospitals (2nd level), 18 high-specialty (3rd level). By state: Veracruz 1,550 · Puebla 1,115 · Hidalgo 801 · SLP 490. By institution: IMSS-Bienestar 2,146 · IMSS 1,520 · ISSSTE 186 · others 104. **908 KB** (≈ 120 KB gzipped); coords rounded to 4 decimals (~11 m). |
| Used for | Offline "where to send the patient": nearest hospital for *urgencia* (plus nearest first-level unit as fallback), nearest first-level unit for *centro hoy* (`src/referral/nearest.ts`). |

**What the registry does NOT tell us:**
- **Whether anyone is there today.** CLUES says a unit is "en operación", not that a doctor or nurse is present, open at night, or stocked (cf. provider-absence evidence in §A.6).
- **Opening hours** exist in a separate sheet (`HORARIOS_202608`) that we do not ship yet.
- **Road distance or travel time.** We compute straight-line (great-circle) km. In the Sierra Norte, 10 km straight-line can be an hour or more by road; rivers and rainy-season road closures are invisible to us.
- **Eligibility.** IMSS ordinary-regime and ISSSTE units serve their affiliates for routine care; we show the institution so the promotora can choose. Urgent cases should go to the nearest hospital regardless.
- **Coordinate quality** is self-reported by each institution; 25 records share exact coordinates with another record (e.g. units in the same building). Units may be geolocated to the town centre.
- **Coverage:** only four states. Other states require re-running the script with a different state filter.
- **Staleness:** the catalogue is updated monthly; the shipped file is a snapshot of August 2026.

### B.6 Map tiles — OpenStreetMap

- Dashboard map uses OpenStreetMap tiles via Leaflet. Data © OpenStreetMap contributors, **ODbL 1.0**; attribution shown on the map.
- **Does NOT cover:** tiles are fetched online — the health-centre dashboard map is not available offline. Rural OSM coverage of small localities and footpaths is uneven. The promotora's triage screen does not depend on the map.

### B.7 Seed data for the dashboard demo — **SYNTHETIC**

- `src/surveillance/seed.ts` generates **synthetic** cases so the outbreak-detection dashboard has something to show. The dashboard tags them "Demo" and has a toggle to hide them; they are not part of the evaluation metrics.

---

## C. How the tool would fare in a less-supported language (Náhuatl)

**Today:** Pahtli's interface strings and result phrases can be shown in Náhuatl, but **speech input is Spanish only**. A Náhuatl-speaking patient's words reach Pahtli only through the promotora (who is usually bilingual). For the 866,000 Indigenous-language speakers who speak no Spanish (§A.3), the tool is only as good as the promotora's interpretation.

**What exists for Náhuatl ASR (verified 3 Oct 2026):**

| Resource | What it offers | Limits |
|---|---|---|
| **Meta MMS** `facebook/mms-1b-all` ([HF](https://huggingface.co/facebook/mms-1b-all)); paper Pratap et al. 2023, [arXiv:2305.13516](https://arxiv.org/abs/2305.13516) | Per-language adapters for **13 Nahuatl ISO 639-3 codes** found in the repository file list: `azz` (Highland Puebla — *Sierra Norte de Puebla*), `ncj` (Northern Puebla), `nhi` (Zacatlán-Ahuacatlán-Tepetzintla), `npl` (Southeastern Puebla), `nsu` (Sierra Negra), `nch` (Central Huasteca), `nhe` (Eastern Huasteca), `nhw` (Western Huasteca), `ngu` (Guerrero), `nuz` (Tlamacazapa), `ncl` (Michoacán), `nhx` (Isthmus-Mecayapan), `nhy` (Northern Oaxaca). **Both demo regions have an adapter.** | **≈ 965 M parameters** (964,845,850 per HF metadata) → ~3.9 GB in fp32; too big for a low-end phone browser today. **License CC-BY-NC-4.0 (non-commercial).** Its labelled data for 1,107 languages is "based on readings of publicly available religious texts" (paper abstract) — read religious speech, not clinical conversation. Accuracy on Nahuatl symptom descriptions is unmeasured. |
| **Mozilla Common Voice** (CC0 audio; [stats API](https://commonvoice.mozilla.org/api/v1/stats/languages) read 3 Oct 2026) | Orizaba Nahuatl `nlv`: 13 h recorded / 12 h validated, 16 speakers. Central Puebla `ncx`: 12 h / 11 h, 41 speakers. Western Sierra Puebla `nhi`: 0.6 h / 0.1 h, 6 speakers. Eastern Huasteca `nhe` and Highland Puebla `azz`: **0 h** (locales exist but are not yet open for contribution). | Tiny compared with Spanish in the same API (2,307 h recorded). Read sentences, few speakers → models would overfit to those voices. |
| Whisper | Náhuatl does not appear anywhere in the Whisper paper's per-language training/evaluation tables. | Fine-tuning Whisper-tiny on ~12 h of one variant is feasible but would likely transfer poorly across variants (Huasteca vs Sierra). |

**Expected behaviour if a Náhuatl speaker talks directly to Pahtli today:** Whisper will force the audio into Spanish (or another language) and produce wrong text. The safety design still holds — the rules only fire on confirmed findings, the transcript is visible and editable, and the button path works — but **the voice feature gives no value** and could mislead an inattentive user. We therefore **do not offer** Náhuatl voice input in the MVP.

**Realistic path (roadmap, not built):**
1. **Collect consented community recordings** of promotoras and patients describing symptoms in the local variant (e.g. `azz` in Cuetzalan, `nch`/`nhe` in Huejutla), with community/linguist review of transcriptions.
2. **Contribute sentences and recordings back to Common Voice** under CC0 (opening `azz` and `nhe`, which today have 0 h), so the data benefits others, not just Pahtli.
3. **Adapt:** either fine-tune the MMS adapter for the variant (≈ 2.5 M adapter weights per language, per the HF MMS adapter guide) and distil/quantise the base model, or fine-tune Whisper-tiny/base on the collected data. Target: a model that fits the same ~100–150 MB budget as Whisper-base q4.
4. **Measure before shipping:** report WER on held-out *speakers* per variant and sub-triage on spoken vignettes; ship only if sub-triage on red-flag cases stays at our Spanish baseline.
5. Licensing check: MMS weights are non-commercial; a public-sector deployment must confirm the licence fits, or use the Whisper route (MIT/Apache).

---

## D. Privacy and data location

The World Bank asks: *where does the data sit, who can read it, and what happens when the phone is lost or shared?*

| Question | Current design | Status |
|---|---|---|
| Where is data stored? | On the phone, in the browser's **IndexedDB** (Dexie): case records + sync outbox. Models in Cache Storage. Nothing leaves the phone until a sync. | **Implemented** |
| What is collected? | Age, sex, pregnancy, symptoms/findings, triage level, fired rule IDs, community name, optional coordinates, timestamp. **No patient name, no ID number, no phone number** is asked for. | **Implemented** |
| What leaves the phone? | `toSyncCase()` sends only whitelisted fields; **the free-text transcript (which could contain names) never leaves the device**. The server (`api/sync.ts`) re-applies the whitelist and drops any other field. Covered by a unit test (`src/db/sync.test.ts`). | **Implemented** |
| Where does synced data go? | A Postgres database (Supabase) for the health-centre dashboard, keyed by a random device-generated UUID. | **Implemented** (when configured) |
| Who can read synced data? | Intended: the health-centre team via the dashboard. **Gap:** `GET /api/cases` currently has **no authentication** — anyone who knows the URL can read the anonymised records. Needs a health-centre login or signed token before any real deployment. | **Gap — to fix** |
| Re-identification risk | Age + sex + pregnancy + community + date + exact GPS is a quasi-identifier set; in a locality of 200 people it can identify a person. Proposed: round coordinates to the locality (or ~1 km) before sync; send age in bands for adults. | **Proposed** |
| Phone lost or shared | Proposed: app **PIN** on open; transcripts and findings encrypted at rest with a key derived from the PIN (WebCrypto); "lock" after inactivity. Today, anyone holding an unlocked phone can open past cases in the app. | **Proposed** |
| Data retention on the phone | Proposed: **auto-purge** of synced records after N days (e.g. 30), keeping only aggregate counts; transcript deleted at sync time. Today records stay until the browser storage is cleared. | **Proposed** |
| Write integrity | `/api/sync` accepts unauthenticated batches (validated and idempotent by `case_id`, but anyone could submit fake cases and trigger a false outbreak alert). Proposed: per-device enrolment token issued at the health centre. | **Gap — to fix** |
| Regulatory frame | Mexico's personal-data law and NOM-024-SSA3-2012 (health information systems) would apply to a real deployment; this hackathon prototype has not been assessed for compliance. | Not assessed |

---

## E. What we could not verify (and therefore did not claim)

- An exact Náhuatl speaker count of 1,651,958 — INEGI's 2022 bulletin gives 22.4 % of 7,364,645; the ≈ 1.65 M figure is our multiplication.
- A current, official **travel time / distance to the nearest health facility** for rural or Indigenous localities in Mexico.
- A **rural-vs-urban health-worker density** split for Mexico.
- A national count of *promotores de salud* across all institutions.
- 2024/2025 under-5 deaths from pneumonia and diarrhoea specifically (INEGI's press release gives all-age figures only; secondary reports of age-specific counts did not match the primary source we could access).
- A GSMA Mexico-specific smartphone-ownership gap number (the 2025 report states women and men are equally likely to use mobile internet in Mexico).
- Whisper or Qwen accuracy on rural/Indigenous-accented Mexican Spanish — no published benchmark exists; this must be measured with real recordings.
