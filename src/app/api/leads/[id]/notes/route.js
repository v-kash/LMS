import { db } from "@/lib/db";

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const { note } = await request.json();

    if (!note || !note.trim()) {
      return Response.json(
        { success: false, message: "Note cannot be empty" },
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

    // Optional rule: block notes on CLOSED leads
    if (lead.status === "CLOSED") {
      return Response.json(
        {
          success: false,
          message: "Cannot add notes to a closed lead",
        },
        { status: 400 }
      );
    }

    await db.query(
      `
      INSERT INTO lead_logs
        (lead_id, action, new_value, performed_by)
      VALUES
        (?, 'NOTE_ADDED', ?, ?)
      `,
      [id, note.trim(), lead.assigned_to]
    );

    return Response.json({
      success: true,
      message: "Note added successfully",
    });
  } catch (err) {
    console.error("Add note error:", err);
    return Response.json(
      { success: false, message: "Failed to add note" },
      { status: 500 }
    );
  }
}
