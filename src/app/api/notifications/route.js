import { db } from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return Response.json({ success: false }, { status: 401 });
    }

    const user = jwt.verify(token, JWT_SECRET);

    const [notifications] = await db.query(
      `
      SELECT *
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [user.id]
    );

    return Response.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return Response.json(
      { success: false },
      { status: 500 }
    );
  }
}
