import { db } from "@/lib/db";

export async function POST(req) {
  try {
    const body = await req.json();
    const { leadId, userId } = body;

    if (!leadId || !userId) {
      return Response.json(
        { success: false, message: "leadId and userId are required" },
        { status: 400 }
      );
    }

    // Get current assignment
    const [existing] = await db.query(
      "SELECT assigned_to, name FROM leads WHERE id = ?",
      [leadId]
    );

    

    if (existing.length === 0) {
      return Response.json(
        { success: false, message: "Lead not found" },
        { status: 404 }
      );
    }

    const oldAssignedTo = existing[0].assigned_to;
    const leadName = existing[0].name;

    // Update lead
    await db.query(
      `
      UPDATE leads
      SET assigned_to = ?, status = 'ASSIGNED'
      WHERE id = ?
      `,
      [userId, leadId]
    );

    await db.query(
  `
  INSERT INTO notifications
  (user_id, title, message, type, reference_id)
  VALUES (?, ?, ?, ?, ?)
  `,
  [
    userId,
    "New Lead Assigned",
    `You have been assigned lead: ${leadName}`,
    "LEAD_ASSIGN",
    leadId,
  ]
);

    if (global.io) {
        global.io.to(`user_${userId}`).emit("lead_assigned", {
          leadId,
          message: "New lead assigned to you",
        });
      }

    // Log assignment
    await db.query(
      `
      INSERT INTO lead_logs
        (lead_id, action, old_value, new_value, performed_by)
      VALUES
        (?, 'ASSIGNED', ?, ?, NULL)
      `,
      [
        leadId,
        oldAssignedTo ? `assigned_to=${oldAssignedTo}` : null,
        `assigned_to=${userId}`,
      ]
    );

    return Response.json({
      success: true,
      message: "Lead assigned successfully",
    });
  } catch (error) {
    console.error("Assign lead error:", error);

    return Response.json(
      { success: false, message: "Assignment failed" },
      { status: 500 }
    );
  }
}
