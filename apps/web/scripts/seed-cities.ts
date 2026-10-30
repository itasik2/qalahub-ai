/**
 * Explicit, opt-in command. Requires a dedicated QalaHub DATABASE_URL and
 * migration 0001. Does not write any event/place data.
 */
import { cityDatabase } from "../lib/database";
import { KZ_CITY_PROFILES } from "../lib/cities";

async function main() {
  if (process.env.QALAHUB_CONFIRM_SEED !== "yes") {
    throw new Error("Refusing to write without QALAHUB_CONFIRM_SEED=yes");
  }
  const sql = cityDatabase();
  for (const city of KZ_CITY_PROFILES) {
    await sql.query(
      "INSERT INTO city (id,name_ru,name_kk,aliases,timezone,coverage,country_code) "+
      "VALUES ($1,$2,$3,$4,$5,$6,'KZ') "+
      "ON CONFLICT (id) DO UPDATE SET "+
      "name_ru=EXCLUDED.name_ru,name_kk=EXCLUDED.name_kk,aliases=EXCLUDED.aliases,"+
      "timezone=EXCLUDED.timezone,updated_at=now()",
      [city.id,city.nameRu,city.nameKk??null,[...city.aliases],city.timezone,city.coverage],
    );
  }
  console.info("Seeded or updated",KZ_CITY_PROFILES.length,"city records (no places or events).");
}
main().catch((err:unknown)=>{
  console.error("City seed failed:",err instanceof Error?err.name:"error");
  process.exitCode=1;
});
