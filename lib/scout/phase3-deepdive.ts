import { completeJson } from "./anthropic";
import { containsExcludedRegion, excludedRegionText, targetRegionText } from "./markets";
import type { DeepDive, ScoredIdea } from "./types";

const model = "claude-haiku-4-5-20251001";

interface DeepDiveResponse {
  deep_dive: unknown;
}

export interface DeepDiveOptions {
  useWebSearch?: boolean;
}

export async function deepDiveIdea(apiKey: string, idea: ScoredIdea, options: DeepDiveOptions = {}): Promise<DeepDive> {
  const useWebSearch = options.useWebSearch ?? true;
  const result = await completeJson<DeepDiveResponse>({
    apiKey,
    model,
    system:
      `You are a pragmatic venture analyst. Target geography: ${targetRegionText}. Excluded geography: ${excludedRegionText}. ${useWebSearch ? "Use web search to verify analogues, competitors, risks, regulation, and current market context in Ukraine, Europe, and the USA before writing." : "Do not call web search; use the idea and its signals only. For analogues, use named companies/products from signals_used if available, otherwise provide conservative analogue categories, not fabricated traction."} Never use Russia, Belarus, or CIS markets, companies, platforms, laws, pricing, demand, or analogues. Do not invent company traction or revenue. If exact revenue is unavailable, say what is observable instead. Produce a concrete deep dive with entry paths, risks, and a first validation step. Never return empty arrays or n/a. Write all human-facing fields in Russian. team_fit_score must be an integer from 0 to 10, not a percentage.`,
    messages: [
      {
        role: "user",
        content: `Deep dive this idea ${useWebSearch ? "using fresh web research" : "using only the provided idea data"} for target geography: ${targetRegionText}. Exclude ${excludedRegionText} completely.

Requirements:
- analogues must be real companies/products/creators/marketplaces found or verified online in Ukraine, Europe, or the USA when web search is enabled.
- when web search is disabled, analogues must be named sources/products from signals_used where possible, otherwise use conservative category analogues without claiming traction.
- do not mention Russia, Belarus, CIS, Russian regulation, Russian platforms, Russian companies, or Russian consumer demand.
- include what each analogue proves: demand, pricing, channel, positioning, or distribution.
- first_validation_step must be executable in 7-14 days without building full tech.
- main_risks must include one market/channel/regulatory risk for EU/US/UA if relevant.

Idea:
${JSON.stringify(
          idea,
          null,
          2
        )}\n\nReturn compact JSON. IMPORTANT: analogues, main_risks, and risk_mitigations must be arrays of strings, not objects. Schema: {"deep_dive":{"analogues":["Name — what it proves"],"entry_bootstrap":"...","entry_vc":"...","entry_lifestyle":"...","main_risks":["..."],"risk_mitigations":["..."],"first_validation_step":"...","team_fit_score":7}}`
      }
    ],
    maxTokens: useWebSearch ? 2600 : 2200,
    tools: useWebSearch ? [{ type: "web_search_20250305", name: "web_search" }] : undefined
  });

  return normalizeDeepDive(result.deep_dive);
}

export function createFallbackDeepDive(idea: ScoredIdea): DeepDive {
  return sanitizeDeepDive({
    analogues: [
      `Похожие решения из signal/context: ${safeText(idea.signals_used?.slice(0, 2).join("; "), "требуется ручная проверка аналогов")}`
    ],
    entry_bootstrap:
      "Начать как консьерж-сервис: вручную выполнить обещанную работу для 3-5 клиентов и проверить готовность платить до разработки продукта.",
    entry_vc:
      "VC-вариант имеет смысл только после доказанного повторяемого спроса, платных пилотов и понятного канала привлечения.",
    entry_lifestyle:
      "Lifestyle-вариант: узкая услуга/микро-SaaS для одной ниши с оплатой за месяц или за выполненную операцию.",
    main_risks: ["Главный риск: боль может быть недостаточно частой или платёжеспособной; это нужно проверить до разработки."],
    risk_mitigations: ["Провести интервью, лендинг и предоплату/LOI; не строить продукт до 3-5 платных подтверждений."],
    first_validation_step:
      "За 7-14 дней провести 15 интервью с целевой аудиторией, собрать 3 платных предзаказа или LOI и вручную выполнить первый кейс.",
    team_fit_score: 5
  });
}

function normalizeDeepDive(value: unknown): DeepDive {
  const record = isRecord(value) ? value : {};

  return sanitizeDeepDive({
    analogues: toStringArray(record.analogues),
    entry_bootstrap: safeText(record.entry_bootstrap, ""),
    entry_vc: safeText(record.entry_vc, ""),
    entry_lifestyle: safeText(record.entry_lifestyle, ""),
    main_risks: toStringArray(record.main_risks),
    risk_mitigations: toStringArray(record.risk_mitigations),
    first_validation_step: safeText(record.first_validation_step, ""),
    team_fit_score: normalizeTeamFitScore(typeof record.team_fit_score === "number" ? record.team_fit_score : 5)
  });
}

function normalizeTeamFitScore(score: number): number {
  const normalized = score > 10 && score <= 100 ? score / 10 : score;
  return Math.max(0, Math.min(10, Math.round(normalized)));
}

function sanitizeDeepDive(deepDive: DeepDive): DeepDive {
  const sanitized = {
    ...deepDive,
    analogues: deepDive.analogues.filter((item) => !containsExcludedRegion(item)),
    main_risks: deepDive.main_risks.filter((item) => !containsExcludedRegion(item)),
    risk_mitigations: deepDive.risk_mitigations.filter((item) => !containsExcludedRegion(item)),
    entry_bootstrap: sanitizeText(deepDive.entry_bootstrap),
    entry_vc: sanitizeText(deepDive.entry_vc),
    entry_lifestyle: sanitizeText(deepDive.entry_lifestyle),
    first_validation_step: sanitizeText(deepDive.first_validation_step)
  };

  return {
    ...sanitized,
    analogues: nonEmpty(
      sanitized.analogues,
      "Паттерн Jobber / Housecall Pro для полевых сервисных команд; конкретные локальные аналоги нужно проверить перед платным запуском."
    ),
    main_risks: nonEmpty(
      sanitized.main_risks,
      "Риск слабой готовности платить у малых команд; нужно подтвердить предоплатой до разработки."
    ),
    risk_mitigations: nonEmpty(
      sanitized.risk_mitigations,
      "Проверить спрос через интервью и предзаказы, затем запускать только узкий MVP."
    ),
    first_validation_step: requiredText(
      sanitized.first_validation_step,
      "За 7-14 дней провести 15 интервью с целевой аудиторией, собрать 3 предоплаты за простой MVP/консьерж-сервис и проверить повторяемость боли."
    )
  };
}

function sanitizeText(value: string): string {
  if (!containsExcludedRegion(value)) {
    return value;
  }

  return "Требуется перепроверка для целевой географии: Украина, Европа, США.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return typeof value === "string" && value.trim() ? [value] : [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (isRecord(item)) {
        const name = safeText(item.name, "");
        const proves = safeText(item.what_it_proves ?? item.proves ?? item.description, "");
        const geography = safeText(item.geography, "");
        return [name, geography, proves].filter(Boolean).join(" — ");
      }

      return "";
    })
    .filter((item) => item.trim().length > 0);
}

function safeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function nonEmpty(values: string[], fallback: string): string[] {
  const clean = values.filter((value) => {
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 && normalized !== "n/a";
  });

  return clean.length > 0 ? clean : [fallback];
}

function requiredText(value: string, fallback: string): string {
  const normalized = value.trim();

  if (!normalized || normalized.toLowerCase() === "n/a") {
    return fallback;
  }

  return normalized;
}
