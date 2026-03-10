// // app/api/meta/webhook/route.js

// import { NextResponse } from "next/server";

// const VERIFY_TOKEN = "myVerifyToken123";

// export async function GET(req) {
//   const searchParams = req.nextUrl.searchParams;

//   const mode = searchParams.get("hub.mode");
//   const token = searchParams.get("hub.verify_token");
//   const challenge = searchParams.get("hub.challenge");

//   console.log("🔍 Verification attempt:", { mode, token, challenge });

//   if (mode === "subscribe" && token === VERIFY_TOKEN) {
//     console.log("✅ Webhook verified successfully");
//     return new NextResponse(challenge, {
//       status: 200,
//       headers: {
//         "Content-Type": "text/plain",
//         "ngrok-skip-browser-warning": "true", // 👈 add this
//       },
//     });
//   }

//   console.log("❌ Verification failed");
//   return new NextResponse("Verification failed", { status: 403 });
// }
// // 🔹 Receive Lead Event
// export async function POST(req) {
//   const body = await req.json();
//   console.log("🔥 Webhook payload:", JSON.stringify(body, null, 2));

//   if (body.object !== "page") {
//     return NextResponse.json({ received: true });
//   }

//   for (const entry of body.entry ?? []) {
//     for (const change of entry.changes ?? []) {
//       if (change.field === "leadgen") {
//         const leadId = change.value?.leadgen_id;
//         console.log(`📋 New lead ID: ${leadId}`);

//         try {
//           const url = `https://graph.facebook.com/v19.0/${leadId}?fields=id,created_time,field_data&access_token=${process.env.PAGE_ACCESS_TOKEN}`;
//           const res = await fetch(url);
//           const data = await res.json();

//           if (data.error) {
//             console.error("❌ Graph API error:", JSON.stringify(data.error));
//           } else {
//             console.log("✅ Lead Data:", JSON.stringify(data, null, 2));
//           }
//         } catch (err) {
//           console.error("❌ Fetch error:", err.message);
//         }
//       }
//     }
//   }

//   return NextResponse.json({ received: true });
// }

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

async function fetchLeadWithRetry(leadId, retries = 5) {
  const url = `https://graph.facebook.com/v19.0/${leadId}?fields=id,created_time,field_data,ad_name,campaign_name,platform&access_token=${process.env.PAGE_ACCESS_TOKEN}`;

  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.error) return data;

    console.log(`⏳ Retry ${i + 1} for lead ${leadId}`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error("Failed to fetch lead after retries");
}

export async function GET(req) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("🔍 Verification attempt:", { mode, token, challenge });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "ngrok-skip-browser-warning": "true",
      },
    });
  }

  console.log("❌ Verification failed");
  return new NextResponse("Verification failed", { status: 403 });
}

export async function POST(req) {
  const body = await req.json();
  console.log("🔥 Webhook payload:", JSON.stringify(body, null, 2));

  if (body.object !== "page") {
    return NextResponse.json({ received: true });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === "leadgen") {
        const leadId = change.value?.leadgen_id;
        const formId = change.value?.form_id;
        const pageId = change.value?.page_id;

        console.log(`📋 New lead ID: ${leadId}`);

        const data = await fetchLeadWithRetry(leadId);

        try {
          // Fetch lead data from Meta
          // const url = `https://graph.facebook.com/v19.0/${leadId}?fields=id,created_time,field_data,ad_name,campaign_name,platform&access_token=${process.env.PAGE_ACCESS_TOKEN}`;
          // const res = await fetch(url);
          // const data = await res.json();

          // if (data.error) {
          //   console.error("❌ Graph API error:", JSON.stringify(data.error));
          //   continue;
          // }

          console.log("✅ Lead Data:", JSON.stringify(data, null, 2));

          // Parse field_data into key-value
          const fields = {};
          data.field_data.forEach((f) => {
            fields[f.name] = f.values?.[0] ?? null;
          });

          const name = fields.full_name || fields.name || null;
          const phone = fields.phone_number || fields.phone || null;
          const email = fields.email || null;
          const state = fields.state || fields.city || null;

          // Check for duplicate by external_lead_id
          const [existing] = await db.query(
            `SELECT id FROM leads WHERE external_lead_id = ? LIMIT 1`,
            [String(leadId)],
          );

          if (existing.length > 0) {
            console.log(`⚠️ Duplicate lead skipped: ${leadId}`);
            continue;
          }

          // Save to database
          const [result] = await db.query(
            `INSERT INTO leads 
              (name, phone, email, source, status, external_lead_id, campaign_name, ad_name, platform, state)
             VALUES 
              (?, ?, ?, 'META', 'NEW', ?, ?, ?, ?, ?)`,
            [
              name,
              phone,
              email,
              String(leadId),
              data.campaign_name || null,
              data.ad_name || null,
              data.platform || "META",
              state,
            ],
          );

          console.log(`💾 Lead saved to DB! Row ID: ${result.insertId}`);

          const [managers] = await db.query(
            `SELECT id FROM users WHERE role = 'MANAGER'`,
          );

          if (managers.length > 0) {
            const notificationValues = managers.map((m) => [
              m.id,
              "New Meta Lead",
              `New lead received: ${name || "Unknown"} — ${phone || email || "No contact"}`,
              "NEW_LEAD",
              result.insertId,
            ]);

            await db.query(
              `INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES ?`,
              [notificationValues],
            );

            console.log(`🔔 Notifications sent to ${managers.length} managers`);
          }

          // 🔔 Notify via Socket.io (real-time)
          if (global.io) {
            global.io.emit("new_lead_generated", {
              id: result.insertId,
              name,
              phone,
              email,
              source: "META",
              status: "NEW",
              campaign_name: data.campaign_name || null,
              ad_name: data.ad_name || null,
            });
            console.log("📡 Socket.io notification sent!");
          }
        } catch (err) {
          console.error("❌ Error processing lead:", err.message);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
