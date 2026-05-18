import { getMarketName } from "@/lib/scout/markets";
import type { IdeaRecord, ScoutSession } from "@/lib/scout/types";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import {
  getLatestSession,
  getTotalStats,
  getVoteCountsForIdeas,
  listAnalyzedIdeas,
  type TotalStats
} from "@/lib/supabase/queries";
import type { InlineKeyboardMarkup, TelegramClient } from "./client";
import { formatIdeaPost } from "./post-idea";

const pageSize = 1;
const maxIdeas = 30;

// ─── Main Menu ─────────────────────────────────────────────────────────────

export function mainMenuText(): string {
  return [
    "🤖 *MarketScout*",
    "",
    "AI\\-система щоденного сканування 12 ринків\\.",
    "Вибери дію:"
  ].join("\n");
}

export function mainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "📊 Результати аналізу", callback_data: "menu_results_0" }],
      [{ text: "🔥 Топ по голосах", callback_data: "menu_top_0" }],
      [
        { text: "▶️ Запустити аналіз", callback_data: "menu_run" },
        { text: "📈 Статус", callback_data: "menu_status" }
      ],
      [
        { text: "🗂 Ринки", callback_data: "menu_markets" },
        { text: "🧪 Тести", callback_data: "menu_tests" }
      ],
      [{ text: "ℹ️ Допомога", callback_data: "menu_help" }]
    ]
  };
}

export async function sendMainMenu(telegram: TelegramClient, chatId: number): Promise<void> {
  await telegram.sendMessage(chatId, mainMenuText(), {
    parse_mode: "Markdown",
    reply_markup: mainMenuKeyboard()
  });
}

export async function editMainMenu(telegram: TelegramClient, chatId: number, messageId: number): Promise<void> {
  await telegram.editMessageText(chatId, messageId, mainMenuText(), {
    parse_mode: "Markdown",
    reply_markup: mainMenuKeyboard()
  });
}

// ─── Results (analyzed ideas with votes) ───────────────────────────────────

export async function showResultsPage(
  telegram: TelegramClient,
  chatId: number,
  messageId: number,
  page: number
): Promise<void> {
  const db = createSupabaseAdmin();
  const ideas = await listAnalyzedIdeas(db, maxIdeas);

  if (ideas.length === 0) {
    await telegram.editMessageText(chatId, messageId, "Поки немає готових deep dive результатів\\.", {
      parse_mode: "Markdown",
      reply_markup: backKeyboard()
    });
    return;
  }

  const normalizedPage = clamp(page, 0, ideas.length - 1);
  const idea = ideas[normalizedPage];
  const votesMap = await getVoteCountsForIdeas(db, [idea.id]);
  const votes = votesMap.get(idea.id) ?? { fire: 0, maybe: 0, skip: 0 };

  const header = `${normalizedPage + 1}/${ideas.length} · ${getMarketName(idea.market_id)}`;
  const voteBar = `🔥 ${votes.fire} · 🤔 ${votes.maybe} · 👎 ${votes.skip}`;
  const text = [header, "", formatIdeaPost(idea), "", voteBar].join("\n");

  await telegram.editMessageText(chatId, messageId, text, {
    parse_mode: "Markdown",
    reply_markup: resultsNavKeyboard(normalizedPage, ideas.length)
  });
}

// ─── Top Voted ─────────────────────────────────────────────────────────────

export async function showTopVotedPage(
  telegram: TelegramClient,
  chatId: number,
  messageId: number,
  page: number
): Promise<void> {
  const db = createSupabaseAdmin();
  const ideas = await listAnalyzedIdeas(db, maxIdeas);

  if (ideas.length === 0) {
    await telegram.editMessageText(chatId, messageId, "Поки немає результатів для голосування\\.", {
      parse_mode: "Markdown",
      reply_markup: backKeyboard()
    });
    return;
  }

  const allIds = ideas.map((i) => i.id);
  const votesMap = await getVoteCountsForIdeas(db, allIds);

  const sorted = [...ideas].sort((a, b) => {
    const aFire = votesMap.get(a.id)?.fire ?? 0;
    const bFire = votesMap.get(b.id)?.fire ?? 0;
    return bFire - aFire;
  });

  const normalizedPage = clamp(page, 0, sorted.length - 1);
  const idea = sorted[normalizedPage];
  const votes = votesMap.get(idea.id) ?? { fire: 0, maybe: 0, skip: 0 };

  const header = `🔥 Топ по голосах · ${normalizedPage + 1}/${sorted.length}`;
  const voteBar = `🔥 ${votes.fire} · 🤔 ${votes.maybe} · 👎 ${votes.skip}`;
  const text = [header, "", formatIdeaPost(idea), "", voteBar].join("\n");

  await telegram.editMessageText(chatId, messageId, text, {
    parse_mode: "Markdown",
    reply_markup: topVotedNavKeyboard(normalizedPage, sorted.length)
  });
}

// ─── Status ────────────────────────────────────────────────────────────────

export async function showStatusPage(
  telegram: TelegramClient,
  chatId: number,
  messageId: number
): Promise<void> {
  const db = createSupabaseAdmin();
  const [session, stats] = await Promise.all([getLatestSession(db), getTotalStats(db)]);

  const text = buildStatusText(session, stats);

  await telegram.editMessageText(chatId, messageId, text, {
    parse_mode: "Markdown",
    reply_markup: backKeyboard()
  });
}

export function buildStatusText(session: ScoutSession | null, stats: TotalStats): string {
  const lines: string[] = ["📈 *Статус MarketScout*", ""];

  if (!session) {
    lines.push("Сесій ще не було\\. Запустіть аналіз\\.");
  } else {
    const statusEmoji = session.status === "running" ? "🔄" : session.status === "done" ? "✅" : "❌";
    const statusLabel = session.status === "running" ? "Виконується" : session.status === "done" ? "Завершено" : "Помилка";

    lines.push(`*Остання сесія* · ${escapeMarkdown(session.date)}`);
    lines.push(`${statusEmoji} Статус: ${statusLabel}`);
    lines.push(`🌍 Ринків проскановано: ${session.markets_scanned}`);
    lines.push(`💡 Ідей згенеровано: ${session.ideas_generated}`);
    lines.push(`❌ Відсіяно: ${(session.ideas_killed_p1 ?? 0) + (session.ideas_killed_p2 ?? 0)}`);
    lines.push(`✨ Вижило: ${session.survivors}`);
  }

  lines.push("");
  lines.push("*Загалом за весь час:*");
  lines.push(`📅 Сесій: ${stats.sessionCount}`);
  lines.push(`💡 Ідей: ${stats.ideaCount}`);
  lines.push(`🏆 Deep dive: ${stats.deepDiveCount}`);

  return lines.join("\n");
}

// ─── Run Confirm ───────────────────────────────────────────────────────────

export async function showRunConfirmPage(
  telegram: TelegramClient,
  chatId: number,
  messageId: number
): Promise<void> {
  const db = createSupabaseAdmin();
  const session = await getLatestSession(db);

  if (session?.status === "running") {
    await telegram.editMessageText(
      chatId,
      messageId,
      [
        "⚠️ *Аналіз вже виконується*",
        "",
        `Сесія від ${escapeMarkdown(session.date)} зараз у статусі _running_\\.`,
        "Зачекай поки вона завершиться\\."
      ].join("\n"),
      { parse_mode: "Markdown", reply_markup: backKeyboard() }
    );
    return;
  }

  await telegram.editMessageText(
    chatId,
    messageId,
    [
      "▶️ *Запустити повний аналіз?*",
      "",
      "Буде проскановано всі 12 ринків, згенеровано ідеї,",
      "відфільтровано kill criteria, зроблено deep dive топ\\-5,",
      "результати з'являться у каналі команди\\.",
      "",
      "⏱ Займає ~5\\-10 хвилин\\."
    ].join("\n"),
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Так, запустити", callback_data: "menu_run_confirm" },
            { text: "❌ Скасувати", callback_data: "menu_main" }
          ]
        ]
      }
    }
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────

export async function showTestsMenu(telegram: TelegramClient, chatId: number, messageId: number): Promise<void> {
  await telegram.editMessageText(
    chatId,
    messageId,
    [
      "🧪 *Тести ринків*",
      "",
      "Запусти команду в чаті:",
      "`/testmarket beauty` — швидкий режим \\(2 сигнали\\)",
      "`/fullmarket beauty` — повний web\\-grounded режим",
      "",
      "Або по фазах:",
      "`/phase1 beauty` — тільки пошук сигналів",
      "`/phase2 beauty` — генерація + фільтрація",
      "`/phase3 beauty` — deep dive"
    ].join("\n"),
    { parse_mode: "Markdown", reply_markup: backKeyboard() }
  );
}

// ─── Help ──────────────────────────────────────────────────────────────────

export async function showHelpMenu(telegram: TelegramClient, chatId: number, messageId: number): Promise<void> {
  await telegram.editMessageText(
    chatId,
    messageId,
    [
      "ℹ️ *Допомога*",
      "",
      "*Команди:*",
      "/start, /menu — головне меню",
      "/run — запустити повний аналіз",
      "/status — статус останньої сесії",
      "/markets — список ринків",
      "/testmarket \\<id\\> — швидкий тест ринку",
      "/fullmarket \\<id\\> — повний аналіз ринку",
      "",
      "*Кнопки голосування:*",
      "🔥 Годнота / 🤔 Може бути / 👎 Скіп",
      "Один голос на людину\\, можна перевибрати\\."
    ].join("\n"),
    { parse_mode: "Markdown", reply_markup: backKeyboard() }
  );
}

// ─── Keyboards ─────────────────────────────────────────────────────────────

export function backKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: "⬅️ Головне меню", callback_data: "menu_main" }]]
  };
}

function resultsNavKeyboard(page: number, total: number): InlineKeyboardMarkup {
  const last = Math.max(0, total - 1);
  return {
    inline_keyboard: [
      [
        { text: "⬅️", callback_data: `menu_results_${Math.max(0, page - 1)}` },
        { text: `${page + 1}/${total}`, callback_data: `menu_results_${page}` },
        { text: "➡️", callback_data: `menu_results_${Math.min(last, page + 1)}` }
      ],
      [{ text: "🏠 Головне меню", callback_data: "menu_main" }]
    ]
  };
}

function topVotedNavKeyboard(page: number, total: number): InlineKeyboardMarkup {
  const last = Math.max(0, total - 1);
  return {
    inline_keyboard: [
      [
        { text: "⬅️", callback_data: `menu_top_${Math.max(0, page - 1)}` },
        { text: `${page + 1}/${total}`, callback_data: `menu_top_${page}` },
        { text: "➡️", callback_data: `menu_top_${Math.min(last, page + 1)}` }
      ],
      [{ text: "🏠 Головне меню", callback_data: "menu_main" }]
    ]
  };
}

// ─── Utils ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function escapeMarkdown(value: string): string {
  return value.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export async function sendStatusMessage(telegram: TelegramClient, chatId: number): Promise<void> {
  const db = createSupabaseAdmin();
  const [session, stats] = await Promise.all([getLatestSession(db), getTotalStats(db)]);
  await telegram.sendMessage(chatId, buildStatusText(session, stats), { parse_mode: "Markdown" });
}
