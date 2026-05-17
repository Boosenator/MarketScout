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
import {
  claimTelegramUpdate,
  finishTelegramUpdate,
  getIdea,
  getVoteCounts,
  upsertVote
} from "@/lib/supabase/queries";
import { createTelegramClient, type TelegramClient } from "./client";
import { editMainMenu, sendMainMenu, showHelpMenu, showResultsPage, showTestsMenu } from "./menu";
import { updateIdeaKeyboard } from "./post-idea";

const votePattern = /^vote_(fire|maybe|skip)_(.+)$/;
const resultsPattern = /^menu_results_(\d+)$/;

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
  update_id?: number;
  message?: TelegramIncomingMessage;
  callback_query?: TelegramCallbackQuery;
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const db = createSupabaseAdmin();
  const updateKind = update.message ? "message" : update.callback_query ? "callback_query" : null;

  if (update.update_id !== undefined && updateKind) {
    const claimed = await claimTelegramUpdate(db, update.update_id, updateKind);

    if (!claimed) {
      console.log(`Skipping duplicate Telegram update ${update.update_id}`);
      return;
    }
  }

  const telegram = createTelegramClient();

  try {
    if (update.callback_query) {
      await handleCallback(telegram, update.callback_query);
      await markUpdateFinished(db, update, "done");
      return;
    }

    if (update.message?.text) {
      await handleCommand(telegram, update.message);
    }

    await markUpdateFinished(db, update, "done");
  } catch (error) {
    await markUpdateFinished(db, update, "failed", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

async function markUpdateFinished(
  db: ReturnType<typeof createSupabaseAdmin>,
  update: TelegramUpdate,
  status: "done" | "failed",
  errorMessage?: string
): Promise<void> {
  if (update.update_id === undefined) {
    return;
  }

  await finishTelegramUpdate(db, update.update_id, status, errorMessage);
}

async function handleCommand(telegram: TelegramClient, message: TelegramIncomingMessage): Promise<void> {
  const command = parseCommand(message.text ?? "");

  if (!command) {
    return;
  }

  if (command.name === "start" || command.name === "help" || command.name === "menu") {
    await sendMainMenu(telegram, message.chat.id);
    return;
  }

  if (command.name === "markets") {
    await telegram.sendMessage(message.chat.id, `Доступные рынки:\n${marketListText()}`);
    return;
  }

  if (command.name === "phase1" || command.name === "phase2" || command.name === "phase3" || command.name === "testmarket") {
    await runMarketCommand(telegram, message.chat.id, command.name, command.argument);
  }
}

async function handleCallback(telegram: TelegramClient, callbackQuery: TelegramCallbackQuery): Promise<void> {
  const data = callbackQuery.data ?? "";
  const message = callbackQuery.message;

  if (!message) {
    await telegram.answerCallbackQuery(callbackQuery.id, "Нет сообщения для обновления");
    return;
  }

  const resultsMatch = data.match(resultsPattern);

  if (resultsMatch) {
    await showResultsPage(telegram, message.chat.id, message.message_id, Number(resultsMatch[1]));
    await telegram.answerCallbackQuery(callbackQuery.id, "Открываю результаты");
    return;
  }

  if (data === "menu_main") {
    await editMainMenu(telegram, message.chat.id, message.message_id);
    await telegram.answerCallbackQuery(callbackQuery.id, "Меню");
    return;
  }

  if (data === "menu_tests") {
    await showTestsMenu(telegram, message.chat.id, message.message_id);
    await telegram.answerCallbackQuery(callbackQuery.id, "Тесты");
    return;
  }

  if (data === "menu_markets") {
    await telegram.editMessageText(message.chat.id, message.message_id, `Доступные рынки:\n${marketListText()}`, {
      reply_markup: {
        inline_keyboard: [[{ text: "⬅️ Главное меню", callback_data: "menu_main" }]]
      }
    });
    await telegram.answerCallbackQuery(callbackQuery.id, "Рынки");
    return;
  }

  if (data === "menu_help") {
    await showHelpMenu(telegram, message.chat.id, message.message_id);
    await telegram.answerCallbackQuery(callbackQuery.id, "Помощь");
    return;
  }

  if (votePattern.test(data)) {
    await handleVote(telegram, callbackQuery);
    return;
  }

  await telegram.answerCallbackQuery(callbackQuery.id, "Неизвестное действие");
}

async function runMarketCommand(
  telegram: TelegramClient,
  chatId: number,
  command: "phase1" | "phase2" | "phase3" | "testmarket",
  marketId: string | null
): Promise<void> {
  if (!marketId) {
    await telegram.sendMessage(chatId, `Формат: /${command} <market_id>\n\n${marketListText()}`);
    return;
  }

  await telegram.sendMessage(chatId, `Запускаю ${command} для рынка ${marketId}. Это может занять пару минут.`);

  try {
    if (command === "phase1") {
      await telegram.sendMessage(chatId, summarizePhase1(await runPhase1Test(marketId)));
      return;
    }

    if (command === "phase2") {
      await telegram.sendMessage(chatId, summarizePhase2(await runPhase2Test(marketId)));
      return;
    }

    const phase3Result = await runPhase3Test(marketId);
    await telegram.sendMessage(
      chatId,
      summarizePhase3(phase3Result),
      phase3Result.selectedIdea ? { parse_mode: "Markdown" } : {}
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await telegram.sendMessage(chatId, `Тест упал: ${errorMessage}`);
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

  await telegram.answerCallbackQuery(callbackQuery.id, "Голос принят");
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
