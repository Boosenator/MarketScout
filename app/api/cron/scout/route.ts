import { NextResponse, type NextRequest } from "next/server";
import { getCronEnv } from "@/lib/config";
import { runScoutPipeline } from "@/lib/scout/pipeline";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = getCronEnv();
  const auth = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");
  const isAuthorized = auth === `Bearer ${env.CRON_SECRET}` || cronSecret === env.CRON_SECRET;

  if (!isAuthorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const marketId = request.nextUrl.searchParams.get("market") ?? undefined;
  const selfTriggerUrl = `${request.nextUrl.origin}/api/cron/scout`;
  const summary = await runScoutPipeline(selfTriggerUrl, marketId);

  return NextResponse.json({ ok: true, summary });
}
