import { Telegraf } from "telegraf";
import { getTelegramEnv } from "@/lib/config";

export function createBot(): Telegraf {
  return new Telegraf(getTelegramEnv().TELEGRAM_BOT_TOKEN);
}
