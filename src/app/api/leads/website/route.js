import { db } from "@/lib/db";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      name,
      phone,
      email,
      serviceType,
      message,
    } = body;

    // very basic check
    if (!phone && !email) {
      return Response.json(
        { success: false, message: "Phone or Email is required" },
        { status: 400 }
      );
    }

    const [result] = await db.query(
      `
      INSERT INTO leads
        (name, phone, email, service_type, source, status, message)
      VALUES
        (?, ?, ?, ?, 'WEBSITE', 'NEW', ?)
      `,
      [name || null, phone || null, email || null, serviceType || null, message || null]
    );

    return Response.json(
      {
        success: true,
        message: "Lead created successfully",
        leadId: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create lead error:", error);

    return Response.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
