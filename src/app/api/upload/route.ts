import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/server/auth/config";
import { prisma } from "@/server/db/prisma";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }

  // Verify the user has a business
  const membership = await prisma.businessUser.findFirst({
    where: { userId },
    select: { businessId: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "לא נשלח קובץ" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "סוג קובץ לא נתמך. יש להעלות JPG, PNG או WEBP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "הקובץ גדול מדי. הגודל המקסימלי הוא 10MB." },
      { status: 400 }
    );
  }

  const ext = file.type.split("/")[1];
  const filename = `businesses/${membership.businessId}/${Date.now()}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}
