import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import { getVoteCounts } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const db = createSupabaseAdmin();
  const counts = await getVoteCounts(db, params.id);
  return NextResponse.json(counts);
}
