import { db } from "@/lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function GET(request) {
  try {
    /* =====================================================
       AUTH CHECK
    ===================================================== */

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

    if (user.role !== "SALES") {
      return Response.json(
        { success: false, message: "Access denied" },
        { status: 403 }
      );
    }

    const userId = user.id;

    /* =====================================================
       QUERY PARAMS (SEARCH + FILTERS + PAGINATION)
    ===================================================== */

    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const offset = (page - 1) * limit;

    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const followupFilter = searchParams.get("followup");
    const search = searchParams.get("search");

    /* =====================================================
       DYNAMIC WHERE CONDITIONS
    ===================================================== */

    let whereConditions = `
      l.assigned_to = ?
      AND l.deleted_at IS NULL
    `;

    let queryParams = [userId];

    // Status filter
    if (status) {
      whereConditions += ` AND l.status = ?`;
      queryParams.push(status);
    }

    // Source filter
    if (source) {
      whereConditions += ` AND l.source = ?`;
      queryParams.push(source);
    }

    // Search filter
    if (search) {
      whereConditions += `
        AND (
          l.name LIKE ?
          OR l.phone LIKE ?
          OR l.email LIKE ?
          OR l.campaign_name LIKE ?
        )
      `;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Follow-up filter
    if (followupFilter === "today") {
      whereConditions += ` AND DATE(f.next_followup) = CURDATE()`;
    }

    if (followupFilter === "overdue") {
      whereConditions += ` AND f.next_followup < NOW()`;
    }

    if (followupFilter === "upcoming") {
      whereConditions += ` AND f.next_followup > NOW()`;
    }

    if (followupFilter === "none") {
      whereConditions += ` AND f.next_followup IS NULL`;
    }

    /* =====================================================
       MAIN LEADS QUERY
    ===================================================== */

    const [leads] = await db.query(
      `
      SELECT
        l.id,
        l.name,
        l.phone,
        l.email,
        l.status,
        l.source,
        l.state,
        l.updated_at,
        f.next_followup
      FROM leads l
      LEFT JOIN (
        SELECT lead_id, MIN(followup_date) AS next_followup
        FROM followups
        WHERE status = 'PENDING'
        GROUP BY lead_id
      ) f ON f.lead_id = l.id
      WHERE ${whereConditions}
      ORDER BY l.updated_at DESC
      LIMIT ? OFFSET ?
      `,
      [...queryParams, limit, offset]
    );

    /* =====================================================
       TOTAL COUNT (FOR PAGINATION)
    ===================================================== */

    const [[{ total }]] = await db.query(
      `
      SELECT COUNT(*) as total
      FROM leads l
      LEFT JOIN (
        SELECT lead_id, MIN(followup_date) AS next_followup
        FROM followups
        WHERE status = 'PENDING'
        GROUP BY lead_id
      ) f ON f.lead_id = l.id
      WHERE ${whereConditions}
      `,
      queryParams
    );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return Response.json({
      success: true,
      leads,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (err) {
    console.error("Sales dashboard error:", err);

    return Response.json(
      { success: false, message: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
