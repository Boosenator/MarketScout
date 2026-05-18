import { NextResponse, type NextRequest } from "next/server";
import { getAnthropicEnv } from "@/lib/config";
import { deepDiveIdea } from "@/lib/scout/phase3-deepdive";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import { attachDeepDive, attachTelegramMessage, getIdea } from "@/lib/supabase/queries";
import { createTelegramClient } from "@/lib/telegram/client";
import { postIdea } from "@/lib/telegram/post-idea";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const db = createSupabaseAdmin();
  const idea = await getIdea(db, params.id);

  if (!idea) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (idea.telegram_message_id) {
    return NextResponse.json({ ok: false, error: "already_posted" });
  }

  const ideaToPost = idea.deep_dive
    ? idea
    : await attachDeepDive(
        db,
        idea.id,
        await deepDiveIdea(getAnthropicEnv().ANTHROPIC_API_KEY, idea, { useWebSearch: false })
      );

  const telegram = createTelegramClient();
  const messageId = await postIdea(telegram, ideaToPost);
  await attachTelegramMessage(db, idea.id, messageId);

  return NextResponse.json({ ok: true, messageId });
}
