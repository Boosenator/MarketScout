import { NextResponse, type NextRequest } from "next/server";
import { getCronEnv } from "@/lib/config";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import { findRunningSession } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as { marketId?: string };
  const marketId = typeof body.marketId === "string" && body.marketId.length > 0 ? body.marketId : undefined;

  // Duplicate-run guard only for full pipeline runs
  if (!marketId) {
    const db = createSupabaseAdmin();
    const running = await findRunningSession(db);

    if (running) {
      return NextResponse.json({ ok: false, error: "already_running", date: running.date });
    }
  }

  const { CRON_SECRET } = getCronEnv();
  const baseUrl = `${request.nextUrl.origin}/api/cron/scout`;
  const triggerUrl = marketId
    ? `${baseUrl}?market=${encodeURIComponent(marketId)}&background=1`
    : `${baseUrl}?background=1`;

  void fetch(triggerUrl, {
    method: "GET",
    headers: { "x-cron-secret": CRON_SECRET }
  }).catch((err: unknown) => {
    console.error("Pipeline trigger from UI failed", err);
  });

  return NextResponse.json({ ok: true });
}
