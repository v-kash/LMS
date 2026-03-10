import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {

  console.log("🔥 LMS POST HIT");

  try {
    const apiKey = req.headers.get("x-api-key");

    if (apiKey !== process.env.INTERNAL_API_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const origin = req.headers.get("origin");

if (origin !== "https://www.nextgenbusiness.co.in") {
  return NextResponse.json(
    { error: "Invalid origin" },
    { status: 403 }
  );
}

    const body = await req.json();
    console.log("LMS received:", body);

    const { name, email, phone, message, domain } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Insert lead into DB
    const [result] = await db.query(`
  INSERT INTO leads
  (name, email, phone, source, status, created_at)
  VALUES (?, ?, ?, ?, ?, NOW())
`, [name, email || null, phone, "WEBSITE", "NEW"]);

const leadId = result.insertId;


// Get all managers
const [managers] = await db.query(`
  SELECT id FROM users WHERE role = 'MANAGER' AND is_active = 1
`);

for (const manager of managers) {
  await db.query(
    `
    INSERT INTO notifications
    (user_id, title, message, type, reference_id)
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      manager.id,
      "New Lead Generated",
      `New lead received: ${name}`,
      "NEW_LEAD",
      leadId,
    ]
  );

  // Emit real-time socket event
  if (global.io) {
    global.io.to(`user_${manager.id}`).emit("new_lead_generated", {
      leadId,
      leadName: name,
    });
  }
}



    return NextResponse.json(
      { success: true, message: "Lead created successfully" },
      { status: 201 }
    );

  } catch (error) {
    console.error("External Lead Error:", error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
