// app/api/superadmin/leads/assign-by-filter/route.js
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

    const { filters, managerId } = await req.json();

    if (!managerId) {
      return Response.json({ success: false, message: "Manager ID required." }, { status: 400 });
    }

    /* ---------------- VALIDATE MANAGER ---------------- */

    const [managerRows] = await db.query(
      "SELECT id, name FROM users WHERE id = ? AND role = 'MANAGER' LIMIT 1",
      [managerId],
    );

    if (managerRows.length === 0) {
      return Response.json({ success: false, message: "Invalid manager." }, { status: 400 });
    }

    /* ---------------- BUILD WHERE from filters ---------------- */

    let where = "WHERE deleted_at IS NULL";
    const values = [];

    if (filters?.source) {
      where += " AND source = ?";
      values.push(filters.source);
    }

    if (filters?.status) {
      where += " AND status = ?";
      values.push(filters.status);
    }

    if (filters?.campaign_name) {
      where += " AND campaign_name = ?";
      values.push(filters.campaign_name);
    }

    if (filters?.ad_name) {
      where += " AND ad_name = ?";
      values.push(filters.ad_name);
    }

    if (filters?.date_from) {
      where += " AND created_at >= ?";
      values.push(filters.date_from);
    }

    if (filters?.date_to) {
      where += " AND created_at <= ?";
      values.push(filters.date_to);
    }

    if (filters?.assigned_manager) {
      where += " AND assigned_manager = ?";
      values.push(filters.assigned_manager);
    }

    /* ---------------- UPDATE ---------------- */

    const [result] = await db.query(
      `UPDATE leads
       SET
         assigned_manager = ?,
         status = CASE WHEN status = 'NEW' THEN 'ASSIGNED' ELSE status END,
         updated_at = NOW()
       ${where}`,
      [managerId, ...values],
    );

    return Response.json({
      success: true,
      affected: result.affectedRows,
      message: `${result.affectedRows} lead(s) assigned to ${managerRows[0].name}.`,
    });

  } catch (error) {
    console.error("Assign by filter error:", error);
    return Response.json({ success: false, message: "Failed to assign." }, { status: 500 });
  }
}