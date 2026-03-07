export async function GET(request, context) {
  const { id } = await context.params;

  const [[row]] = await db.query(
    `
    SELECT *
    FROM revenue
    WHERE lead_id = ?
    `,
    [id]
  );

  return Response.json({
    success: true,
    revenue: row || null,
  });
}


import { db } from "@/lib/db";

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const { amount, product } = await request.json();

    if (!amount || amount <= 0) {
      return Response.json(
        { success: false, message: "Valid amount is required" },
        { status: 400 }
      );
    }

    // 1️⃣ Validate lead
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

    // 2️⃣ Business rules
    if (lead.status !== "CLOSED" || lead.disposition !== "Converted") {
      return Response.json(
        {
          success: false,
          message:
            "Revenue can only be added for CLOSED leads with disposition Converted",
        },
        { status: 400 }
      );
    }

    // 3️⃣ Prevent duplicate revenue
    const [[existing]] = await db.query(
      `
      SELECT id
      FROM revenue
      WHERE lead_id = ?
      `,
      [id]
    );

    if (existing) {
      return Response.json(
        { success: false, message: "Revenue already exists for this lead" },
        { status: 400 }
      );
    }

    // 4️⃣ Insert revenue
    await db.query(
      `
      INSERT INTO revenue
        (lead_id, amount, product, converted_at, salesperson_id)
      VALUES
        (?, ?, ?, NOW(), ?)
      `,
      [id, amount, product || null, lead.assigned_to]
    );

    // 5️⃣ Audit log
    await db.query(
      `
      INSERT INTO lead_logs
        (lead_id, action, new_value, performed_by)
      VALUES
        (?, 'REVENUE_ADDED', ?, ?)
      `,
      [
        id,
        JSON.stringify({ amount, product }),
        lead.assigned_to,
      ]
    );

    return Response.json({
      success: true,
      message: "Revenue added successfully",
    });
  } catch (err) {
    console.error("Revenue create error:", err);
    return Response.json(
      { success: false, message: "Failed to add revenue" },
      { status: 500 }
    );
  }
}
