import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;

export const db = mysql.createPool(DATABASE_URL);
