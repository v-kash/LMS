import { db } from "@/lib/db";

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    const [logs] = await db.query(
      `
      SELECT
        ll.*,
        u.name AS performed_by_name
      FROM lead_logs ll
      LEFT JOIN users u ON ll.performed_by = u.id
      WHERE ll.lead_id = ?
      ORDER BY ll.created_at DESC
      `,
      [id]
    );

    return Response.json({ success: true, logs });
  } catch (err) {
    console.error("Lead logs error:", err);
    return Response.json(
      { success: false, message: "Failed to load logs" },
      { status: 500 }
    );
  }
}
