import type { Market } from "./types";

export const targetRegions = ["Украина", "Европа", "США"] as const;
export const excludedRegions = ["Россия", "РФ", "Беларусь", "СНГ"] as const;
export const targetRegionText = targetRegions.join(", ");
export const excludedRegionText = excludedRegions.join(", ");

const excludedRegionPattern = /\b(росси[яиюе]|рф|беларус[ьи]|снг|russia|russian|belarus|cis)\b/i;

const searchAngles = [
  "emerging niches 2025 Ukraine Europe USA -Russia -Belarus -CIS",
  "underserved pain points Ukraine Europe USA -Russia -Belarus -CIS",
  "fastest growing sub-segments Europe US Ukraine -Russia -Belarus -CIS",
  "new monetization models Europe USA Ukraine -Russia -Belarus -CIS"
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
