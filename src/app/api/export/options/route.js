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

    if (
      user.role !== "REPORTER" &&
      user.role !== "MANAGER" &&
      user.role !== "SUPER_ADMIN"
    ) {
      return Response.json({ success: false }, { status: 403 });
    }

    const [campaigns] = await db.query(
      `SELECT DISTINCT campaign_name FROM leads
       WHERE campaign_name IS NOT NULL AND deleted_at IS NULL
       ORDER BY campaign_name ASC`,
    );

    const [adNames] = await db.query(
      `SELECT DISTINCT ad_name FROM leads
       WHERE ad_name IS NOT NULL AND deleted_at IS NULL
       ORDER BY ad_name ASC`,
    );

    return Response.json({
      success: true,
      campaigns: campaigns.map((c) => c.campaign_name),
      adNames: adNames.map((a) => a.ad_name),
    });
  } catch (error) {
    console.error("Export options error:", error);
    return Response.json({ success: false }, { status: 500 });
  }
}
