import { db } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return Response.json({ success: false }, { status: 401 });

    let user;
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch {
      return Response.json({ success: false }, { status: 401 });
    }

    if (user.role !== "REPORTER" && user.role !== "MANAGER") {
      return Response.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const campaign_name = searchParams.get("campaign_name");
    const ad_name = searchParams.get("ad_name");
    const date_from = searchParams.get("date_from"); // e.g. "2026-03-07T10:00:00"
    const date_to = searchParams.get("date_to");     // e.g. "2026-03-08T10:00:00"
    const isExport = searchParams.get("export") === "true";

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let where = "WHERE deleted_at IS NULL";
    const values = [];

    if (campaign_name) {
      where += " AND campaign_name = ?";
      values.push(campaign_name);
    }

    if (ad_name) {
      where += " AND ad_name = ?";
      values.push(ad_name);
    }

    if (date_from) {
      where += " AND created_at >= ?";
      values.push(date_from);
    }

    if (date_to) {
      where += " AND created_at <= ?";
      values.push(date_to);
    }

    // Total count
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM leads ${where}`,
      values
    );
    const total = countRows[0].total;

    const selectFields = `
      id, name, phone, email, source, status,
      campaign_name, ad_name, platform, state, created_at
    `;

    if (isExport) {
      // No pagination — return all matching rows
      const [leads] = await db.query(
        `SELECT ${selectFields} FROM leads ${where} ORDER BY created_at DESC`,
        values
      );
      return Response.json({ success: true, total: leads.length, leads });
    } else {
      const [leads] = await db.query(
        `SELECT ${selectFields} FROM leads ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...values, limit, offset]
      );
      return Response.json({ success: true, total, page, limit, leads });
    }

  } catch (error) {
    console.error("Export leads error:", error);
    return Response.json({ success: false, message: "Failed to fetch" }, { status: 500 });
  }
}