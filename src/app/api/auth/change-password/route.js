import { db } from "@/lib/db";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return Response.json({ success: false, message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const { oldPassword, newPassword } = await req.json();

    const [[user]] = await db.query(
      `SELECT id, password FROM users WHERE id = ?`,
      [decoded.id],
    );

    if (!user) {
      return Response.json({ success: false, message: "User not found" });
    }

    const match = await bcrypt.compare(oldPassword, user.password);

    if (!match) {
      return Response.json({
        success: false,
        message: "Old password is incorrect",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await db.query(`UPDATE users SET password = ? WHERE id = ?`, [
      hashed,
      decoded.id,
    ]);

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({
      success: false,
      message: "Server error",
    });
  }
}
