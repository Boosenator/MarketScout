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
import { createTelegramClient, type TelegramClient } from "./client";
import { updateIdeaKeyboard } from "./post-idea";

const votePattern = /^vote_(fire|maybe|skip)_(.+)$/;

interface TelegramUser {
  id: number;
  username?: string;
}

interface TelegramChat {
  id: number;
}

interface TelegramIncomingMessage {
  message_id: number;
  chat: TelegramChat;
  text?: string;
  from?: TelegramUser;
}

interface TelegramCallbackQuery {
  id: string;
  from?: TelegramUser;
  message?: TelegramIncomingMessage;
  data?: string;
}

export interface TelegramUpdate {
  message?: TelegramIncomingMessage;
  callback_query?: TelegramCallbackQuery;
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const telegram = createTelegramClient();

  if (update.callback_query) {
    await handleVote(telegram, update.callback_query);
    return;
  }

  if (update.message?.text) {
    await handleCommand(telegram, update.message);
  }
}

async function handleCommand(telegram: TelegramClient, message: TelegramIncomingMessage): Promise<void> {
  const command = parseCommand(message.text ?? "");

  if (!command) {
    return;
  }

  if (command.name === "start" || command.name === "help") {
    await telegram.sendMessage(message.chat.id, helpText());
    return;
  }

  if (command.name === "markets") {
    await telegram.sendMessage(message.chat.id, `Available markets:\n${marketListText()}`);
    return;
  }

  if (command.name === "phase1" || command.name === "phase2" || command.name === "phase3" || command.name === "testmarket") {
    await runMarketCommand(telegram, message.chat.id, command.name, command.argument);
  }
}

async function runMarketCommand(
  telegram: TelegramClient,
  chatId: number,
  command: "phase1" | "phase2" | "phase3" | "testmarket",
  marketId: string | null
): Promise<void> {
  if (!marketId) {
    await telegram.sendMessage(chatId, `Usage: /${command} <market_id>\n\n${marketListText()}`);
    return;
  }

  await telegram.sendMessage(chatId, `Running ${command} test for ${marketId}. This can take a bit.`);

  try {
    if (command === "phase1") {
      await telegram.sendMessage(chatId, summarizePhase1(await runPhase1Test(marketId)));
      return;
    }

    if (command === "phase2") {
      await telegram.sendMessage(chatId, summarizePhase2(await runPhase2Test(marketId)));
      return;
    }

    await telegram.sendMessage(chatId, summarizePhase3(await runPhase3Test(marketId)));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await telegram.sendMessage(chatId, `Test failed: ${errorMessage}`);
  }
}

async function handleVote(telegram: TelegramClient, callbackQuery: TelegramCallbackQuery): Promise<void> {
  const match = callbackQuery.data?.match(votePattern);

  if (!match) {
    await telegram.answerCallbackQuery(callbackQuery.id, "Unknown action");
    return;
  }

  const [, vote, ideaId] = match;
  const user = callbackQuery.from;
  const message = callbackQuery.message;

  if (!user || !message) {
    await telegram.answerCallbackQuery(callbackQuery.id, "Cannot save vote");
    return;
  }

  const db = createSupabaseAdmin();
  await upsertVote(db, ideaId, user.id, user.username ?? null, vote as "fire" | "maybe" | "skip");
  const idea = await getIdea(db, ideaId);
  const counts = await getVoteCounts(db, ideaId);

  if (idea?.telegram_message_id) {
    await updateIdeaKeyboard(telegram, message.chat.id, idea.telegram_message_id, ideaId, counts);
  }

  await telegram.answerCallbackQuery(callbackQuery.id, "Vote accepted");
}

function parseCommand(text: string): { name: string; argument: string | null } | null {
  const [rawCommand, ...rest] = text.trim().split(/\s+/);

  if (!rawCommand?.startsWith("/")) {
    return null;
  }

  const name = rawCommand.slice(1).split("@")[0].toLowerCase();
  const argument = rest.join(" ").trim() || null;

  return { name, argument };
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
