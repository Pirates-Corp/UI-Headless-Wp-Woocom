import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-wc-webhook-secret");
  if (!process.env.WC_WEBHOOK_SECRET || secret !== process.env.WC_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let product: { slug?: string } = {};
  try {
    product = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (product?.slug) {
    revalidatePath(`/product/${product.slug}`);
  }
  revalidateTag("categories", "max");
  revalidatePath("/shop");
  revalidatePath("/", "layout");
  revalidatePath("/");

  return NextResponse.json({ revalidated: true });
}
