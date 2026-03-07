import { db } from "@/lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function GET(request) {
  try {
    /* ---------- AUTH CHECK ---------- */

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return Response.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const [[user]] = await db.query(
      `SELECT id, role FROM users WHERE id = ? AND is_active = 1`,
      [decoded.id]
    );

    if (!user) {
      return Response.json(
        { success: false, message: "User not found" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Optional: restrict to SALES only
    if (user.role !== "SALES") {
      return Response.json(
        { success: false, message: "Access denied" },
        { status: 403 }
      );
    }

    /* ---------- KPIs ---------- */

    const [[openLeads]] = await db.query(
      `
      SELECT COUNT(*) AS count
      FROM leads
      WHERE assigned_to = ?
        AND status IN ('ASSIGNED','CONTACTED','QUALIFIED')
        AND deleted_at IS NULL
      `,
      [userId]
    );

    const [[todayFollowups]] = await db.query(
      `
      SELECT COUNT(*) AS count
      FROM followups
      WHERE created_by = ?
        AND status = 'PENDING'
        AND DATE(followup_date) = CURDATE()
      `,
      [userId]
    );

    const [[monthlyConversions]] = await db.query(
      `
      SELECT COUNT(*) AS count
      FROM revenue
      WHERE salesperson_id = ?
        AND MONTH(converted_at) = MONTH(CURDATE())
        AND YEAR(converted_at) = YEAR(CURDATE())
      `,
      [userId]
    );

    /* ---------- FOLLOWUPS ---------- */

    const [followups] = await db.query(
      `
      SELECT
        f.id,
        f.followup_date,
        f.note,
        l.id AS lead_id,
        l.name AS lead_name,
        l.status
      FROM followups f
      JOIN leads l ON l.id = f.lead_id
      WHERE f.created_by = ?
        AND f.status = 'PENDING'
        AND l.deleted_at IS NULL
      ORDER BY f.followup_date ASC
      LIMIT 15
      `,
      [userId]
    );

    /* ---------- ACTIVE LEADS ---------- */

    const [activeLeads] = await db.query(
      `
      SELECT
        id,
        name,
        source,
        status,
        updated_at
      FROM leads
      WHERE assigned_to = ?
        AND status IN ('ASSIGNED','CONTACTED','QUALIFIED')
        AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 10
      `,
      [userId]
    );

    /* ---------- RECENT CONVERSIONS ---------- */

    const [recentConversions] = await db.query(
      `
      SELECT
        r.amount,
        r.converted_at,
        l.name AS lead_name
      FROM revenue r
      JOIN leads l ON l.id = r.lead_id
      WHERE r.salesperson_id = ?
      ORDER BY r.converted_at DESC
      LIMIT 5
      `,
      [userId]
    );

    /* ---------- RESPONSE ---------- */

    return Response.json({
      success: true,
      kpis: {
        openLeads: openLeads.count,
        todayFollowups: todayFollowups.count,
        monthlyConversions: monthlyConversions.count,
      },
      followups,
      activeLeads,
      recentConversions,
    });

  } catch (err) {
    console.error("Sales dashboard error:", err);

    return Response.json(
      { success: false, message: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
