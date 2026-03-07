import { db } from "@/lib/db";

export async function POST(req) {
  try {
    const { id } = await req.json();

    await db.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ?`,
      [id]
    );

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { success: false },
      { status: 500 }
    );
  }
}
