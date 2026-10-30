import assert from "node:assert/strict";
import test from "node:test";
import { getCityProfile, isKazakhstanCity, KZ_CITY_PROFILES } from "./cities";
test("city registry uses unique IDs and pilot only in Astana", () => {
  assert.equal(KZ_CITY_PROFILES.length,22);
  assert.equal(new Set(KZ_CITY_PROFILES.map(x=>x.id)).size,22);
  assert.deepEqual(KZ_CITY_PROFILES.filter(x=>x.coverage==="pilot").map(x=>x.id),["astana"]);
});
test("resolves canonical and Kazakh names without changing selected city", () => {
  assert.equal(getCityProfile("Астана")?.id,"astana");
  assert.equal(getCityProfile("Нур-Султан")?.id,"astana");
  assert.equal(getCityProfile("Қызылорда")?.id,"kyzylorda");
  assert.equal(getCityProfile("Өскемен")?.id,"oskemen");
  assert.equal(getCityProfile("almaty")?.nameRu,"Алматы");
});
test("unknown and non-KZ cities are not accepted", () => {
  for (const name of ["Москва","Минск","","Москва-Сити"]) assert.equal(isKazakhstanCity(name),false);
});
