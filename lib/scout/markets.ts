import type { Market } from "./types";

const searchAngles = [
  "emerging niches 2025",
  "underserved pain points",
  "fastest growing sub-segments",
  "new monetization models"
];

export const markets: Market[] = [
  { id: "poverty", name: "Poverty Market", searchAngles },
  { id: "connection", name: "Connection Market", searchAngles },
  { id: "aging", name: "Aging Market", searchAngles },
  { id: "fuel", name: "Fuel Market", searchAngles },
  { id: "better_life", name: "Better Life Market", searchAngles },
  { id: "freedom", name: "Freedom Market", searchAngles },
  { id: "media", name: "Media Market", searchAngles },
  { id: "education", name: "Education Market", searchAngles },
  { id: "fashion", name: "Fashion Market", searchAngles },
  { id: "entertainment", name: "Entertainment Market", searchAngles },
  { id: "beauty", name: "Beauty Market", searchAngles },
  { id: "lifestyle", name: "Lifestyle Market", searchAngles }
];

export function getMarketName(marketId: string): string {
  return markets.find((market) => market.id === marketId)?.name ?? marketId;
}
