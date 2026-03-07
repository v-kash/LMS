import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import { db } from "@/lib/db";

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
      const decoded = iconv.decode(buffer, "utf-16le");

      rows = parse(decoded, {
        columns: true,
        delimiter: "\t",
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

    let previewRows = [];
    let newCount = 0;
    let duplicateCount = 0;

    for (const row of rows) {
      const name = row.full_name || row.name || null;

      let phone = row.phone || null;
      if (phone && typeof phone === "string") {
        phone = phone.replace(/^p:/i, "").trim();
      }

      const email = row.email || null;

      const externalLeadId = row.id || null;
      const campaignName = row.campaign_name || null;
      const adName = row.ad_name || null;
      const platform = row.platform || null;
      const state = row.state || null;

      // Skip rows without phone & email
      if (!phone && !email) {
        continue;
      }

      // Dedup check
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

      const isDuplicate = existing.length > 0;

      if (isDuplicate) duplicateCount++;
      else newCount++;

      previewRows.push({
        name,
        phone,
        email,
        external_lead_id: externalLeadId,
        campaign_name: campaignName,
        ad_name: adName,
        platform,
        state,
        isDuplicate,
        duplicateReason: isDuplicate
          ? "Matched phone/email/external_lead_id"
          : null,
      });
    }

    return Response.json({
      success: true,
      total: previewRows.length,
      new: newCount,
      duplicates: duplicateCount,
      rows: previewRows,
    });
  } catch (error) {
    console.error("Import preview error:", error);

    return Response.json(
      { success: false, message: "Preview failed" },
      { status: 500 },
    );
  }
}
