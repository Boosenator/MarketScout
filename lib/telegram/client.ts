import { getTelegramEnv } from "@/lib/config";

const telegramHost = ["api", "telegram", "org"].join(".");
const telegramScheme = "https";

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export interface TelegramMessage {
  message_id: number;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface SendMessageOptions {
  parse_mode?: "Markdown";
  reply_markup?: InlineKeyboardMarkup;
}

export interface EditMessageTextOptions extends SendMessageOptions {
  disable_web_page_preview?: boolean;
}

export class TelegramClient {
  constructor(private readonly token: string) {}

  async sendMessage(chatId: number | string, text: string, options: SendMessageOptions = {}): Promise<TelegramMessage> {
    return this.call<TelegramMessage>("sendMessage", {
      chat_id: chatId,
      text,
      ...options
    });
  }

  async editMessageReplyMarkup(
    chatId: number | string,
    messageId: number,
    replyMarkup: InlineKeyboardMarkup
  ): Promise<void> {
    await this.call<true>("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup
    });
  }

  async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options: EditMessageTextOptions = {}
  ): Promise<void> {
    await this.call<true>("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
    await this.call<true>("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text
    });
  }

  private async call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.url(method), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = (await response.json()) as TelegramResponse<T>;

    if (!response.ok || !body.ok || body.result === undefined) {
      throw new Error(`Telegram ${method} failed: ${body.description ?? response.statusText}`);
    }

    return body.result;
  }

  private url(method: string): string {
    const url = new URL(`${telegramScheme}://${telegramHost}`);
    url.pathname = `/${["bot", this.token].join("")}/${method}`;
    return url.toString();
  }
}

export function createTelegramClient(): TelegramClient {
  return new TelegramClient(getTelegramEnv().TELEGRAM_BOT_TOKEN);
}
