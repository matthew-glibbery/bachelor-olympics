import { NextResponse } from "next/server";
import { isGroomPinValid } from "@/lib/session/identity";

/**
 * Checks a submitted groom PIN server-side against process.env.GROOM_PIN, so
 * the real PIN never ships in the client JS bundle (unlike a NEXT_PUBLIC_ var).
 * On success the client persists its own local "unlocked" flag — see
 * src/lib/session/identity.ts.
 */
export async function POST(request: Request) {
  const { pin } = (await request.json()) as { pin?: string };
  const expected = process.env.GROOM_PIN ?? "";
  const ok = isGroomPinValid(pin ?? "", expected);
  return NextResponse.json({ ok });
}
