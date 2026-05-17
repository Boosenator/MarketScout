import type { Market } from "./types";

const searchAngles = [
  "emerging niches 2025",
  "underserved pain points",
  "fastest growing sub-segments",
  "new monetization models"
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
