import fs from "fs";
import csv from "csv-parser";
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_PASSWORD = "NextGen@123";

async function run() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const results = [];

  fs.createReadStream("emp.csv")
    .pipe(csv())
    .on("data", (row) => results.push(row))
    .on("end", async () => {
      for (const row of results) {
        try {
          if (!row.Role || row.Role.trim().toLowerCase() !== "sales") {
            continue;
          }

          const name = row["Name"]?.trim();
          const email = row["E Mail Id"]?.trim().toLowerCase();
          const branch = row["Branch Code"]?.trim().toUpperCase();
          const isActive = row["isActive"] === "TRUE" ? 1 : 0;

          if (!name || !email) continue;

          await db.query(
            `INSERT INTO users (name,email,password,role,branch,is_active)
             VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE email=email`,
            [name, email, passwordHash, "SALES", branch, isActive],
          );

          console.log("Inserted:", name);
        } catch (err) {
          console.log("Error:", row["Name"], err.message);
        }
      }

      console.log("✅ Import finished");
      process.exit();
    });
}

run();
