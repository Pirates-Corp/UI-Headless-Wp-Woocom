import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-wc-webhook-secret");
  if (!process.env.WC_WEBHOOK_SECRET || secret !== process.env.WC_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await req.json().catch(() => null);
  } catch {
    // Ignore empty/malformed body
  }

  // Purge categories cache tag and layout/pages displaying categories
  revalidateTag("categories", "max");
  revalidatePath("/", "layout");
  revalidatePath("/shop");
  revalidatePath("/");

  return NextResponse.json({ revalidated: true });
}
