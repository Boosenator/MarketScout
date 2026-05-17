import type { Context, Telegraf } from "telegraf";
import {
  marketListText,
  runPhase1Test,
  runPhase2Test,
  runPhase3Test,
  summarizePhase1,
  summarizePhase2,
  summarizePhase3
} from "@/lib/scout/test-runner";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import { getIdea, getVoteCounts, upsertVote } from "@/lib/supabase/queries";
import { updateIdeaKeyboard } from "./post-idea";

const votePattern = /^vote_(fire|maybe|skip)_(.+)$/;

export function registerHandlers(bot: Telegraf): void {
  bot.start(async (ctx) => {
    await ctx.reply(helpText());
  });
  bot.help(async (ctx) => {
    await ctx.reply(helpText());
  });
  bot.command("markets", async (ctx) => {
    await ctx.reply(`Available markets:\n${marketListText()}`);
  });
  bot.command("phase1", async (ctx) => {
    await runMarketCommand(ctx, "phase1");
  });
  bot.command("phase2", async (ctx) => {
    await runMarketCommand(ctx, "phase2");
  });
  bot.command("phase3", async (ctx) => {
    await runMarketCommand(ctx, "phase3");
  });
  bot.command("testmarket", async (ctx) => {
    await runMarketCommand(ctx, "all");
  });
  bot.on("callback_query", handleVote);
}

async function runMarketCommand(ctx: Context, phase: "phase1" | "phase2" | "phase3" | "all"): Promise<void> {
  const marketId = commandArgument(ctx);

  if (!marketId) {
    await ctx.reply(`Usage: /${phase === "all" ? "testmarket" : phase} <market_id>\n\n${marketListText()}`);
    return;
  }

  await ctx.reply(`Running ${phase} test for ${marketId}. This can take a bit.`);

  try {
    if (phase === "phase1") {
      await ctx.reply(summarizePhase1(await runPhase1Test(marketId)));
      return;
    }

    if (phase === "phase2") {
      await ctx.reply(summarizePhase2(await runPhase2Test(marketId)));
      return;
    }

    await ctx.reply(summarizePhase3(await runPhase3Test(marketId)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await ctx.reply(`Test failed: ${message}`);
  }
}

function commandArgument(ctx: Context): string | null {
  const text = ctx.text;

  if (!text) {
    return null;
  }

  return text.split(/\s+/).slice(1).join(" ").trim() || null;
}

function helpText(): string {
  return [
    "MarketScout commands:",
    "/markets - list market ids",
    "/phase1 <market_id> - test signal scouting",
    "/phase2 <market_id> - test generate + filter",
    "/phase3 <market_id> - test deep dive for top survivor",
    "/testmarket <market_id> - run phase1 -> phase3"
  ].join("\n");
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
