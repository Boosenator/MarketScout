import { NextResponse, type NextRequest } from "next/server";
import { handleTelegramUpdate, type TelegramUpdate } from "@/lib/telegram/handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const update = (await request.json()) as TelegramUpdate;
  await handleTelegramUpdate(update);

  return NextResponse.json({ ok: true });
}
