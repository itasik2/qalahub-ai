import assert from "node:assert/strict";
import test from "node:test";
import { CatalogQueryError, getSeedCities, parseCatalogFilters } from "./city-catalog";

test("directory uses only canonical registry, never fake venues", () => {
  const cities = getSeedCities();
  assert.equal(cities.source,"seed");
  assert.equal(cities.data.length,22);
  assert.equal(cities.data.filter(x=>x.coverage==="pilot")[0].id,"astana");
});
test("city filters accept a Kazakh name, normalize to stable city ID", () => {
  const f=parseCatalogFilters(new URL("https://example.kz/api/events?city=%D3%A8%D1%81%D0%BA%D0%B5%D0%BC%D0%B5%D0%BD&limit=12&category=theater"));
  assert.deepEqual(f,{cityId:"oskemen",q:"",category:"theater",limit:12});
});
test("unknown city and unsafe filters fail closed", () => {
  for(const url of [
    "https://example.kz/api/events?city=Moscow",
    "https://example.kz/api/events?city=astana&limit=99",
    "https://example.kz/api/events?city=astana&category=a%27%3Bdrop",
    "https://example.kz/api/events?city=astana&q="+ "x".repeat(121),
  ]) assert.throws(()=>parseCatalogFilters(new URL(url)),CatalogQueryError);
});
test("default query has a bounded limit and correct city", () => {
  assert.deepEqual(parseCatalogFilters(new URL("https://example.kz/api/places?city=Астана")),
    {cityId:"astana",q:"",category:"",limit:20});
});
