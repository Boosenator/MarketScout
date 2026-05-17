import { NextResponse, type NextRequest } from "next/server";
import { createBot } from "@/lib/telegram/bot";
import { registerHandlers } from "@/lib/telegram/handlers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const bot = createBot();
  registerHandlers(bot);

  const update = await request.json();
  await bot.handleUpdate(update);

  return NextResponse.json({ ok: true });
}
