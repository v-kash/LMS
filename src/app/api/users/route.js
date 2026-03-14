// import { db } from "@/lib/db";

// export async function GET() {
//   const [users] = await db.query(
//     `
//     SELECT id, name
//     FROM users
//     WHERE role = 'SALES' AND is_active = 1
//     ORDER BY name
//     `
//   );

//   return Response.json({
//     success: true,
//     users,
//   });
// }
// app/api/users/route.js
import { db } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function GET(req) {
  try {
    /* ---------------- AUTH ---------------- */

    const token = req.cookies.get("token")?.value;
    if (!token) return Response.json({ success: false }, { status: 401 });

    let user;
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch {
      return Response.json({ success: false }, { status: 401 });
    }

    /* ---------------- QUERY PARAMS ---------------- */

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role"); // e.g. ?role=MANAGER or ?role=SALES

    /* ---------------- QUERY ---------------- */

    // If a specific role is requested, use it.
    // Otherwise fall back to SALES (preserves existing manager dashboard behaviour).
    const targetRole = role || "SALES";

    const [users] = await db.query(
      `SELECT id, name
       FROM users
       WHERE role = ? AND is_active = 1
       ORDER BY name ASC`,
      [targetRole],
    );

    return Response.json({ success: true, users });
  } catch (error) {
    console.error("Fetch users error:", error);
    return Response.json(
      { success: false, message: "Failed to fetch users" },
      { status: 500 },
    );
  }
}
