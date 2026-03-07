import { db } from "@/lib/db";

export async function POST(req) {
  try {
    const body = await req.json();
    const { leadIds, userId } = body;

    if (!Array.isArray(leadIds) || !userId) {
      return Response.json(
        { success: false, message: "leadIds[] and userId required" },
        { status: 400 },
      );
    }

    for (const leadId of leadIds) {
      const [existing] = await db.query(
        "SELECT assigned_to, name FROM leads WHERE id = ?",
        [leadId],
      );

      if (existing.length === 0) continue;

      const oldAssignedTo = existing[0].assigned_to;
      const leadName = existing[0].name;

      await db.query(
        `
        UPDATE leads
        SET assigned_to = ?, status = 'ASSIGNED'
        WHERE id = ?
        `,
        [userId, leadId],
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
        ],
      );

     
    }

    if (global.io) {
  global.io.to(`user_${userId}`).emit("bulk_lead_assigned", {
    count: leadIds.length,
  });
}


    return Response.json({
      success: true,
      message: "Leads assigned successfully",
    });
  } catch (error) {
    console.error("Bulk assign error:", error);

    return Response.json(
      { success: false, message: "Bulk assignment failed" },
      { status: 500 },
    );
  }
}
