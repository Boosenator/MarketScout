import { getTelegramEnv } from "@/lib/config";
import { getMarketName } from "@/lib/scout/markets";
import type { IdeaRecord, PipelineSummary } from "@/lib/scout/types";
import type { InlineKeyboardMarkup, TelegramClient } from "./client";

type VoteCounts = Record<"fire" | "maybe" | "skip", number>;

export async function postDigest(telegram: TelegramClient, summary: PipelineSummary): Promise<void> {
  const env = getTelegramEnv();
  await telegram.sendMessage(
    env.TELEGRAM_CHAT_ID,
    [
      `Sluice · ${new Date().toISOString().slice(0, 10)}`,
      "",
      `Просканировано рынков: ${summary.marketsScanned}`,
      `Идей сгенерировано: ${summary.ideasGenerated}`,
      `Отсеяно: ${summary.killedPass1 + summary.killedPass2}`,
      `Годных кандидатов: ${summary.survivors}`
    ].join("\n"),
    { parse_mode: "MarkdownV2" }
  );
}

export async function postIdea(telegram: TelegramClient, idea: IdeaRecord): Promise<number> {
  const env = getTelegramEnv();
  const message = await telegram.sendMessage(env.TELEGRAM_CHAT_ID, formatIdeaPost(idea), {
    parse_mode: "MarkdownV2",
    reply_markup: voteKeyboard(idea.id, { fire: 0, maybe: 0, skip: 0 })
  });

  return message.message_id;
}

export async function updateIdeaKeyboard(
  telegram: TelegramClient,
  chatId: number | string,
  messageId: number,
  ideaId: string,
  counts: VoteCounts
): Promise<void> {
  await telegram.editMessageReplyMarkup(chatId, messageId, voteKeyboard(ideaId, counts));
}

export function formatIdeaPost(idea: IdeaRecord): string {
  const deepDive = idea.deep_dive;
  const analogues = deepDive?.analogues.slice(0, 3).join(", ") ?? "n/a";
  const firstRisk = deepDive?.main_risks[0] ?? "n/a";
  const firstStep = deepDive?.first_validation_step ?? "n/a";

  return [
    `🔍 ${escapeMarkdown(getMarketName(idea.market_id))} · score: ${idea.total_score ?? 0}/100`,
    "",
    `💡 *${escapeMarkdown(idea.title)}*`,
    "",
    escapeMarkdown(idea.description ?? ""),
    "",
    `👥 *Аудитория:* ${escapeMarkdown(idea.target_audience ?? "")}`,
    `💰 *Монетизация:* ${escapeMarkdown(idea.monetization ?? "")}`,
    `⚡️ *Почему сейчас:* ${escapeMarkdown(idea.why_now ?? "")}`,
    "",
    `🏆 *Аналоги:* ${escapeMarkdown(analogues)}`,
    `🚀 *Первый шаг:* ${escapeMarkdown(firstStep)}`,
    `⚠️ *Главный риск:* ${escapeMarkdown(firstRisk)}`,
    "─────────────────────"
  ].join("\n");
}

function voteKeyboard(ideaId: string, counts: VoteCounts): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: `🔥 ${counts.fire}`, callback_data: `vote_fire_${ideaId}` },
        { text: `🤔 ${counts.maybe}`, callback_data: `vote_maybe_${ideaId}` },
        { text: `👎 ${counts.skip}`, callback_data: `vote_skip_${ideaId}` }
      ]
    ]
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}
