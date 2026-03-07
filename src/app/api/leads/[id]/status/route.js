import { db } from "@/lib/db";

const STATUS_FLOW = {
  NEW: ["ASSIGNED"],
  ASSIGNED: ["CONTACTED", "NEW"], // NEW = manager reset
  CONTACTED: ["QUALIFIED", "CLOSED"],
  QUALIFIED: ["CLOSED"],
  CLOSED: [],
};

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const { status: newStatus, disposition } = await request.json();

    if (!newStatus) {
      return Response.json(
        { success: false, message: "Status is required" },
        { status: 400 }
      );
    }

    // Fetch current lead state
    const [[lead]] = await db.query(
      `
      SELECT status, disposition, assigned_to
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

    const currentStatus = lead.status;

    // 1️⃣ Validate transition
    const allowedNext = STATUS_FLOW[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      return Response.json(
        {
          success: false,
          message: `Invalid status transition: ${currentStatus} → ${newStatus}`,
        },
        { status: 400 }
      );
    }

    // 2️⃣ Assignment enforcement
    // Any status beyond NEW requires assignment
    if (
      newStatus !== "NEW" &&
      !lead.assigned_to
    ) {
      return Response.json(
        {
          success: false,
          message: "Lead must be assigned before progressing",
        },
        { status: 400 }
      );
    }

    // 3️⃣ Disposition rules
    if (newStatus === "CLOSED" && !disposition) {
      return Response.json(
        {
          success: false,
          message: "Disposition is required when closing a lead",
        },
        { status: 400 }
      );
    }

    if (newStatus !== "CLOSED" && disposition) {
      return Response.json(
        {
          success: false,
          message: "Disposition is only allowed when status is CLOSED",
        },
        { status: 400 }
      );
    }

    // 4️⃣ Apply update
    await db.query(
      `
      UPDATE leads
      SET
        status = ?,
        disposition = ?,
        assigned_to = CASE
          WHEN ? = 'NEW' THEN NULL
          ELSE assigned_to
        END
      WHERE id = ?
      `,
      [newStatus, disposition || null, newStatus, id]
    );

    // 5️⃣ Audit log
    await db.query(
      `
      INSERT INTO lead_logs
        (lead_id, action, old_value, new_value, performed_by)
      VALUES
        (?, 'STATUS_CHANGE', ?, ?, NULL)
      `,
      [
        id,
        JSON.stringify({
          status: currentStatus,
          disposition: lead.disposition,
          assigned_to: lead.assigned_to,
        }),
        JSON.stringify({
          status: newStatus,
          disposition: disposition || null,
          assigned_to: newStatus === "NEW" ? null : lead.assigned_to,
        }),
      ]
    );

    return Response.json({
      success: true,
      message: "Status updated successfully",
    });
  } catch (err) {
    console.error("Status update error:", err);
    return Response.json(
      { success: false, message: "Failed to update status" },
      { status: 500 }
    );
  }
}
