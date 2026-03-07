import { db } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function GET(request, context) {
  try {
    /* -------- AUTH CHECK -------- */

    const token = request.cookies.get("token")?.value;

    if (!token) {
      return Response.json({ success: false }, { status: 401 });
    }

    let user;
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch {
      return Response.json({ success: false }, { status: 401 });
    }

    /* -------- GET PARAM -------- */

    const { id } = await context.params;
    const leadId = id;

    /* -------- FETCH LEAD -------- */

    const [[lead]] = await db.query(
      `
      SELECT
        l.*,
        u.name AS assigned_to_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.id = ? AND l.deleted_at IS NULL
      `,
      [leadId]
    );

    if (!lead) {
      return Response.json(
        { success: false, message: "Lead not found" },
        { status: 404 }
      );
    }

    /* -------- ROLE SECURITY -------- */

    // SALES can only access their assigned leads
    if (
      user.role === "SALES" &&
      lead.assigned_to !== user.id
    ) {
      return Response.json(
        { success: false, message: "Access denied" },
        { status: 403 }
      );
    }

    /* -------- SUCCESS -------- */

    return Response.json({ success: true, lead });

  } catch (err) {
    console.error("Lead detail error:", err);
    return Response.json(
      { success: false, message: "Failed to load lead" },
      { status: 500 }
    );
  }
}
