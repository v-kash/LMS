// app/api/leads/unassign/bulk/route.js
import { db } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function POST(req) {
  try {
    /* ── AUTH ── */
    const token = req.cookies.get("token")?.value;
    if (!token) return Response.json({ success: false }, { status: 401 });

    let user;
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch {
      return Response.json({ success: false }, { status: 401 });
    }

    if (user.role !== "MANAGER") {
      return Response.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    /* ── BODY ── */
    const { leadIds } = await req.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return Response.json({ success: false, message: "No leads provided." }, { status: 400 });
    }

    /* ── VERIFY leads belong to this manager ── */
    // Only unassign leads that are scoped to this manager (assigned_manager = user.id)
    const placeholders = leadIds.map(() => "?").join(", ");

    await db.query(
      `UPDATE leads
       SET
         assigned_to = NULL,
         status = CASE
           WHEN status = 'ASSIGNED' AND (assigned_manager IS NULL OR assigned_manager = 0)
           THEN 'NEW'
           ELSE status
         END,
         updated_at = NOW()
       WHERE id IN (${placeholders})
         AND assigned_manager = ?
         AND deleted_at IS NULL`,
      [...leadIds, user.id],
    );

    return Response.json({ success: true, message: `${leadIds.length} lead(s) unassigned.` });

  } catch (error) {
    console.error("Unassign bulk error:", error);
    return Response.json({ success: false, message: "Failed to unassign." }, { status: 500 });
  }
}