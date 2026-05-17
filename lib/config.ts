import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
  CRON_SECRET: z.string().min(1)
});

export type AppEnv = z.infer<typeof envSchema>;
export type AnthropicEnv = Pick<AppEnv, "ANTHROPIC_API_KEY">;
export type SupabaseEnv = Pick<AppEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">;
export type TelegramEnv = Pick<AppEnv, "TELEGRAM_BOT_TOKEN" | "TELEGRAM_CHAT_ID">;
export type CronEnv = Pick<AppEnv, "CRON_SECRET">;

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}

export function getOptionalEnv(): Partial<AppEnv> {
  return envSchema.partial().parse(process.env);
}

export function getAnthropicEnv(): AnthropicEnv {
  return envSchema.pick({ ANTHROPIC_API_KEY: true }).parse(process.env);
}

export function getSupabaseEnv(): SupabaseEnv {
  return envSchema.pick({ SUPABASE_URL: true, SUPABASE_SERVICE_ROLE_KEY: true }).parse(process.env);
}

export function getTelegramEnv(): TelegramEnv {
  return envSchema.pick({ TELEGRAM_BOT_TOKEN: true, TELEGRAM_CHAT_ID: true }).parse(process.env);
}

export function getCronEnv(): CronEnv {
  return envSchema.pick({ CRON_SECRET: true }).parse(process.env);
}
