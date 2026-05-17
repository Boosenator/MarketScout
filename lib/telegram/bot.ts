import { Telegraf } from "telegraf";
import { getEnv } from "@/lib/config";

export function createBot(): Telegraf {
  return new Telegraf(getEnv().TELEGRAM_BOT_TOKEN);
}
