import { db } from "@/lib/db";


export async function GET(request, context) {
  const { id } = await context.params;

  const [rows] = await db.query(
    `
    SELECT *
    FROM followups
    WHERE lead_id = ?
    ORDER BY followup_date ASC
    `,
    [id]
  );

  return Response.json({
    success: true,
    followups: rows,
  });
}


export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const { followup_date, note } = await request.json();

    if (!followup_date) {
      return Response.json(
        { success: false, message: "Follow-up date is required" },
        { status: 400 }
      );
    }

    const [[lead]] = await db.query(
      `
      SELECT status, assigned_to
      FROM leads
      WHERE id = ? AND deleted_at IS NULL
      `,
      [id]
    );

    if (!lead) {
      return Response.json(
        { success: false, message: "Lead not found" },
        { status: 404 }
      );
    }

    if (lead.status === "NEW") {
      return Response.json(
        {
          success: false,
          message: "Assign the lead before adding follow-up",
        },
        { status: 400 }
      );
    }

    if (lead.status === "CLOSED") {
      return Response.json(
        {
          success: false,
          message: "Cannot add follow-up to a closed lead",
        },
        { status: 400 }
      );
    }

    await db.query(
      `
      INSERT INTO followups
        (lead_id, followup_date, note, status, created_by)
      VALUES
        (?, ?, ?, 'PENDING', ?)
      `,
      [id, followup_date, note || null, lead.assigned_to]
    );

    await db.query(
      `
      INSERT INTO lead_logs
        (lead_id, action, new_value, performed_by)
      VALUES
        (?, 'FOLLOWUP_ADDED', ?, ?)
      `,
      [
        id,
        JSON.stringify({ followup_date, note }),
        lead.assigned_to,
      ]
    );

    return Response.json({
      success: true,
      message: "Follow-up added",
    });
  } catch (err) {
    console.error("Follow-up create error:", err);
    return Response.json(
      { success: false, message: "Failed to add follow-up" },
      { status: 500 }
    );
  }
}
