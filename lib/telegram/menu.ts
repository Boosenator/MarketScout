import { createSupabaseAdmin } from "@/lib/supabase/client";
import { listAnalyzedIdeas } from "@/lib/supabase/queries";
import type { InlineKeyboardMarkup, TelegramClient } from "./client";
import { formatIdeaPost } from "./post-idea";

const pageSize = 1;
const maxIdeas = 20;

export function mainMenuText(): string {
  return [
    "Главное меню MarketScout",
    "",
    "Выбери действие кнопками ниже.",
    "",
    "Команды:",
    "/markets - список рынков",
    "/testmarket <market_id> - тест полного анализа"
  ].join("\n");
}

export function mainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "📊 Результаты анализа", callback_data: "menu_results_0" }],
      [
        { text: "🧪 Тест рынков", callback_data: "menu_tests" },
        { text: "🗂 Рынки", callback_data: "menu_markets" }
      ],
      [{ text: "ℹ️ Помощь", callback_data: "menu_help" }]
    ]
  };
}

export async function sendMainMenu(telegram: TelegramClient, chatId: number): Promise<void> {
  await telegram.sendMessage(chatId, mainMenuText(), { reply_markup: mainMenuKeyboard() });
}

export async function editMainMenu(telegram: TelegramClient, chatId: number, messageId: number): Promise<void> {
  await telegram.editMessageText(chatId, messageId, mainMenuText(), { reply_markup: mainMenuKeyboard() });
}

export async function showResultsPage(
  telegram: TelegramClient,
  chatId: number,
  messageId: number,
  page: number
): Promise<void> {
  const db = createSupabaseAdmin();
  const ideas = await listAnalyzedIdeas(db, maxIdeas);

  if (ideas.length === 0) {
    await telegram.editMessageText(chatId, messageId, "Пока нет готовых deep dive результатов.", {
      reply_markup: backKeyboard()
    });
    return;
  }

  const normalizedPage = clamp(page, 0, Math.ceil(ideas.length / pageSize) - 1);
  const idea = ideas[normalizedPage];
  const text = [`${normalizedPage + 1}/${ideas.length}`, "", formatIdeaPost(idea)].join("\n");

  await telegram.editMessageText(chatId, messageId, text, {
    parse_mode: "Markdown",
    reply_markup: resultsKeyboard(normalizedPage, ideas.length)
  });
}

export async function showTestsMenu(telegram: TelegramClient, chatId: number, messageId: number): Promise<void> {
  await telegram.editMessageText(
    chatId,
    messageId,
    [
      "Тесты рынков",
      "",
      "Запусти команду в чате:",
      "/phase1 beauty",
      "/phase2 beauty",
      "/phase3 beauty",
      "/testmarket beauty — быстрый режим",
      "/fullmarket beauty — полный web-grounded режим"
    ].join("\n"),
    { reply_markup: backKeyboard() }
  );
}

export async function showHelpMenu(telegram: TelegramClient, chatId: number, messageId: number): Promise<void> {
  await telegram.editMessageText(
    chatId,
    messageId,
    [
      "Помощь",
      "",
      "Бот умеет запускать тесты фаз и листать готовые результаты анализа.",
      "",
      "Лучший рабочий поток:",
      "1. /testmarket <market_id> для быстрой проверки",
      "2. /fullmarket <market_id> для полного анализа",
      "3. Открыть «Результаты анализа»",
      "4. Листать вперед/назад"
    ].join("\n"),
    { reply_markup: backKeyboard() }
  );
}

export function backKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: "⬅️ Главное меню", callback_data: "menu_main" }]]
  };
}

function resultsKeyboard(page: number, total: number): InlineKeyboardMarkup {
  const lastPage = Math.max(0, total - 1);

  return {
    inline_keyboard: [
      [
        { text: "⬅️", callback_data: `menu_results_${Math.max(0, page - 1)}` },
        { text: `${page + 1}/${total}`, callback_data: `menu_results_${page}` },
        { text: "➡️", callback_data: `menu_results_${Math.min(lastPage, page + 1)}` }
      ],
      [{ text: "🏠 Главное меню", callback_data: "menu_main" }]
    ]
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
