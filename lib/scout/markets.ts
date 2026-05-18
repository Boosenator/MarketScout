import type { Market } from "./types";

export const targetRegions = ["Украина", "Европа", "США"] as const;
export const excludedRegions = ["Россия", "РФ", "Беларусь", "СНГ"] as const;
export const targetRegionText = targetRegions.join(", ");
export const excludedRegionText = excludedRegions.join(", ");
export const excludedOpportunityText =
  "defense, weapons, military, war, combat, dual-use military supply chains, drones/UAVs for war, cheap labor arbitrage, exploitative labor, guaranteed employment schemes, grant-dependent projects, government-procurement-first ideas";

const excludedRegionPattern = /\b(росси[яиюе]|рф|беларус[ьи]|снг|russia|russian|belarus|cis)\b/i;
const excludedOpportunityPattern =
  /\b(defen[cs]e|military|weapon|weapons|army|war|wartime|combat|dual-use|drone[s]?|uav|munition|missile|cheap labor|low-cost labor|exploitative labor|guaranteed employment|government procurement|grant-dependent|grants?)\b|дрон|дроны|бпла|военн|оруж|боев|деш[её]в(ая|ую|ой|ые|ых) рабоч|грант/i;

const searchAngles = [
  "emerging niches 2025 Ukraine Europe USA -Russia -Belarus -CIS -military -defense -drones -weapons",
  "underserved pain points Ukraine Europe USA -Russia -Belarus -CIS -military -defense -drones -weapons",
  "fastest growing sub-segments Europe US Ukraine -Russia -Belarus -CIS -military -defense -drones -weapons",
  "new monetization models Europe USA Ukraine -Russia -Belarus -CIS -military -defense -drones -weapons"
];

export const markets: Market[] = [
  { id: "poverty", name: "Рынок бедности", searchAngles },
  { id: "connection", name: "Рынок связей", searchAngles },
  { id: "aging", name: "Рынок старения", searchAngles },
  { id: "fuel", name: "Рынок топлива", searchAngles },
  { id: "better_life", name: "Рынок лучшей жизни", searchAngles },
  { id: "freedom", name: "Рынок свободы", searchAngles },
  { id: "media", name: "Рынок медиа", searchAngles },
  { id: "education", name: "Рынок образования", searchAngles },
  { id: "fashion", name: "Рынок моды", searchAngles },
  { id: "entertainment", name: "Рынок развлечений", searchAngles },
  { id: "beauty", name: "Рынок красоты", searchAngles },
  { id: "lifestyle", name: "Рынок лайфстайла", searchAngles }
];

export function getMarketName(marketId: string): string {
  return markets.find((market) => market.id === marketId)?.name ?? marketId;
}

export function containsExcludedRegion(value: string | null | undefined): boolean {
  return excludedRegionPattern.test(value ?? "");
}

export function containsExcludedOpportunity(value: string | null | undefined): boolean {
  return excludedOpportunityPattern.test(value ?? "");
}
