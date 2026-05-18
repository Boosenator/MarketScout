import { NextResponse, type NextRequest } from "next/server";
import { getCronEnv } from "@/lib/config";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import { findRunningSession } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const db = createSupabaseAdmin();
  const running = await findRunningSession(db);

  if (running) {
    return NextResponse.json({ ok: false, error: "already_running", date: running.date });
  }

  const { CRON_SECRET } = getCronEnv();
  const selfUrl = `${request.nextUrl.origin}/api/cron/scout`;

  void fetch(selfUrl, {
    method: "GET",
    headers: { "x-cron-secret": CRON_SECRET }
  }).catch((err: unknown) => {
    console.error("Pipeline trigger from UI failed", err);
  });

  return NextResponse.json({ ok: true });
}
