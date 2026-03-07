import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";
import iconv from "iconv-lite";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json(
        { success: false, message: "No file uploaded" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    let rows = [];

    /* ---------- CSV (META EXPORT) ---------- */
    if (fileName.endsWith(".csv")) {
      // Decode UTF-16 → UTF-8
      const decoded = iconv.decode(buffer, "utf-16le");

      rows = parse(decoded, {
        columns: true,
        delimiter: "\t", // META uses TAB
        relax_quotes: true,
        relax_column_count: true,
        skip_empty_lines: true,
        trim: true,
      });
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      /* ---------- EXCEL ---------- */
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: "",
      });
    } else {
      return Response.json(
        { success: false, message: "Unsupported file type" },
        { status: 400 },
      );
    }

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const name = row.full_name || row.name || null;

      // Clean phone (remove p:)
      let phone = row.phone || null;
      if (phone && typeof phone === "string") {
        phone = phone.replace(/^p:/i, "").trim();
      }

      const email = row.email || null;

      // Extra Meta fields
      const externalLeadId = row.id || null;
      const campaignName = row.campaign_name || null;
      const adName = row.ad_name || null;
      const platform = row.platform || null;
      const state = row.state || null;

      // Skip invalid rows
      if (!phone && !email) {
        skipped++;
        continue;
      }

      // Check duplicate
      const [existing] = await db.query(
        `
  SELECT id FROM leads
  WHERE deleted_at IS NULL
  AND (
    (external_lead_id IS NOT NULL AND external_lead_id = ?)
    OR (phone IS NOT NULL AND phone = ?)
    OR (email IS NOT NULL AND email = ?)
  )
  LIMIT 1
  `,
        [externalLeadId, phone, email],
      );

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.query(
        `
    INSERT INTO leads
      (
        name,
        phone,
        email,
        source,
        status,
        external_lead_id,
        campaign_name,
        ad_name,
        platform,
        state,
        created_at
      )
    VALUES
      (?, ?, ?, 'EXCEL', 'NEW', ?, ?, ?, ?, ?, NOW())
    `,
        [
          name,
          phone,
          email,
          externalLeadId,
          campaignName,
          adName,
          platform,
          state,
        ],
      );

      inserted++;
    }

    return Response.json({
      success: true,
      message: "Leads imported successfully",
      inserted,
      skipped,
    });
  } catch (error) {
    console.error("Import error:", error);

    return Response.json(
      { success: false, message: "Import failed" },
      { status: 500 },
    );
  }
}
