// app/api/superadmin/leads/unassign/route.js
import { db } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function POST(req) {
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

    if (user.role !== "SUPER_ADMIN") {
      return Response.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    /* ---------------- BODY ---------------- */

    const { leadIds } = await req.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return Response.json({ success: false, message: "No leads provided." }, { status: 400 });
    }

    /* ---------------- UPDATE ---------------- */

    // Clear assigned_manager only.
    // If the lead was ASSIGNED and has no sales user either, flip back to NEW.
    // If it already has a sales user (assigned_to), keep status as-is.
    const placeholders = leadIds.map(() => "?").join(", ");

    await db.query(
      `UPDATE leads
       SET
         assigned_manager = NULL,
         status = CASE
           WHEN status = 'ASSIGNED' AND (assigned_to IS NULL OR assigned_to = 0)
           THEN 'NEW'
           ELSE status
         END,
         updated_at = NOW()
       WHERE id IN (${placeholders})
         AND deleted_at IS NULL`,
      [...leadIds],
    );

    return Response.json({ success: true, message: `${leadIds.length} lead(s) unassigned.` });

  } catch (error) {
    console.error("Unassign error:", error);
    return Response.json({ success: false, message: "Failed to unassign." }, { status: 500 });
  }
}