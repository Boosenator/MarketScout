import type { Context, Telegraf } from "telegraf";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import { getIdea, getVoteCounts, upsertVote } from "@/lib/supabase/queries";
import { updateIdeaKeyboard } from "./post-idea";

const votePattern = /^vote_(fire|maybe|skip)_(.+)$/;

export function registerHandlers(bot: Telegraf): void {
  bot.on("callback_query", handleVote);
}

async function handleVote(ctx: Context): Promise<void> {
  const callbackQuery = ctx.callbackQuery;

  if (!callbackQuery) {
    return;
  }

  const data = "data" in callbackQuery ? callbackQuery.data : undefined;
  const match = data?.match(votePattern);

  if (!match) {
    await ctx.answerCbQuery("Unknown action");
    return;
  }

  const [, vote, ideaId] = match;
  const user = ctx.from;
  const message = callbackQuery.message;

  if (!user || !message || !("chat" in message)) {
    await ctx.answerCbQuery("Cannot save vote");
    return;
  }

  const db = createSupabaseAdmin();
  await upsertVote(db, ideaId, user.id, user.username ?? null, vote as "fire" | "maybe" | "skip");
  const idea = await getIdea(db, ideaId);
  const counts = await getVoteCounts(db, ideaId);

  if (idea?.telegram_message_id) {
    await updateIdeaKeyboard(ctx.telegram, message.chat.id, idea.telegram_message_id, ideaId, counts);
  }

  await ctx.answerCbQuery("Vote accepted");
}
