import { Markup, type Telegram, type Telegraf } from "telegraf";
import { getTelegramEnv } from "@/lib/config";
import { getMarketName } from "@/lib/scout/markets";
import type { IdeaRecord, PipelineSummary } from "@/lib/scout/types";

type VoteCounts = Record<"fire" | "maybe" | "skip", number>;

export async function postDigest(bot: Telegraf, summary: PipelineSummary): Promise<void> {
  const env = getTelegramEnv();
  await bot.telegram.sendMessage(
    env.TELEGRAM_CHAT_ID,
    [
      `Sluice · ${new Date().toISOString().slice(0, 10)}`,
      "",
      `Markets scanned: ${summary.marketsScanned}`,
      `Ideas generated: ${summary.ideasGenerated}`,
      `Killed: ${summary.killedPass1 + summary.killedPass2}`,
      `Today's fire candidates: ${summary.survivors}`
    ].join("\n"),
    { parse_mode: "Markdown" }
  );
}

export async function postIdea(bot: Telegraf, idea: IdeaRecord): Promise<number> {
  const env = getTelegramEnv();
  const message = await bot.telegram.sendMessage(env.TELEGRAM_CHAT_ID, formatIdeaPost(idea), {
    parse_mode: "Markdown",
    reply_markup: voteKeyboard(idea.id, { fire: 0, maybe: 0, skip: 0 }).reply_markup
  });

  return message.message_id;
}

export async function updateIdeaKeyboard(
  telegram: Telegram,
  chatId: number | string,
  messageId: number,
  ideaId: string,
  counts: VoteCounts
): Promise<void> {
  await telegram.editMessageReplyMarkup(chatId, messageId, undefined, voteKeyboard(ideaId, counts).reply_markup);
}

function voteKeyboard(ideaId: string, counts: VoteCounts) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`Fire ${counts.fire}`, `vote_fire_${ideaId}`),
      Markup.button.callback(`Maybe ${counts.maybe}`, `vote_maybe_${ideaId}`),
      Markup.button.callback(`Skip ${counts.skip}`, `vote_skip_${ideaId}`)
    ]
  ]);
}

function formatIdeaPost(idea: IdeaRecord): string {
  const deepDive = idea.deep_dive;
  const analogues = deepDive?.analogues.slice(0, 3).join(", ") ?? "n/a";
  const firstRisk = deepDive?.main_risks[0] ?? "n/a";
  const firstStep = deepDive?.first_validation_step ?? "n/a";

  return [
    `${escapeMarkdown(getMarketName(idea.market_id))} · score: ${idea.total_score ?? 0}/100`,
    "",
    `*${escapeMarkdown(idea.title)}*`,
    "",
    escapeMarkdown(idea.description ?? ""),
    "",
    `*Audience:* ${escapeMarkdown(idea.target_audience ?? "")}`,
    `*Monetization:* ${escapeMarkdown(idea.monetization ?? "")}`,
    `*Why now:* ${escapeMarkdown(idea.why_now ?? "")}`,
    "",
    `*Analogues:* ${escapeMarkdown(analogues)}`,
    `*First step:* ${escapeMarkdown(firstStep)}`,
    `*Main risk:* ${escapeMarkdown(firstRisk)}`
  ].join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}
