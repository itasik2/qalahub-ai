import { neon } from "@neondatabase/serverless";

export class DatabaseUnavailableError extends Error {
  constructor(message = "Городская база QalaHub AI пока не подключена.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}
export function cityDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new DatabaseUnavailableError();
  try {
    const url = new URL(connectionString);
    if (!["postgres:","postgresql:"].includes(url.protocol)) throw new Error("Invalid protocol");
  } catch {
    throw new DatabaseUnavailableError("Некорректная конфигурация городской базы.");
  }
  return neon(connectionString);
}
