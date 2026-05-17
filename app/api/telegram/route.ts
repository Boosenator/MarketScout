import { waitUntil } from "@vercel/functions";
import { NextResponse, type NextRequest } from "next/server";
import { handleTelegramUpdate, type TelegramUpdate } from "@/lib/telegram/handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const update = (await request.json()) as TelegramUpdate;
  waitUntil(handleTelegramUpdate(update).catch((error: unknown) => {
    console.error("Telegram update failed", error);
  }));

  return NextResponse.json({ ok: true });
}
