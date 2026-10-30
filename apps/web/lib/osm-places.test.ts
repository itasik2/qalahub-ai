import assert from "node:assert/strict";
import test from "node:test";
import { buildOverpassQuery, normalizeOsmPlaces, parsePlaceKind } from "./osm-places";

test("only allows supported categories and Kazakhstan coordinates", () => {
  assert.equal(parsePlaceKind("food"),"food");
  assert.equal(parsePlaceKind("culture"),"culture");
  assert.equal(parsePlaceKind("fast"),null);
  assert.throws(()=>buildOverpassQuery("food",55,700),/Invalid/);
  assert.throws(()=>buildOverpassQuery("culture",0,0),/Invalid/);
});
test("builds a fixed, bounded query with no arbitrary user query injection", () => {
  const q=buildOverpassQuery("food",51.1801,71.44598);
  assert.match(q,/2700,51\.180100,71\.445980/);
  assert.match(q,/\btimeout:18/);
  assert.match(q,/out center 100/);
  assert.doesNotMatch(q,/around:50000/);
});
test("normalizes real OSM-style POIs, checks distance and excludes foreign category", () => {
  const items=normalizeOsmPlaces({elements:[
    {type:"node",id:10,lat:51.18,lon:71.446,tags:{"amenity":"restaurant","name":"Кафе А","addr:street":"улица 1","addr:housenumber":"5"}},
    {type:"way",id:11,center:{lat:51.181,lon:71.447},tags:{"amenity":"cafe","name":"Кофейня"}},
    {type:"node",id:12,lat:55,lon:71.4,tags:{"amenity":"cafe","name":"Далеко"}},
    {type:"node",id:13,lat:51.18,lon:71.446,tags:{"amenity":"bank","name":"Банк"}},
    {type:"node",id:14,lat:51.18,lon:71.446,tags:{"amenity":"restaurant","name":"  "}},
  ]},"food",51.1801,71.44598);
  assert.equal(items.length,2);
  assert.equal(items[0].name,"Кафе А");
  assert.equal(items[0].address,"улица 1, 5");
  assert.equal(items[0].osmUrl,"https://www.openstreetmap.org/node/10");
  assert.ok(items.every(x=>x.distanceMeters<2700));
});
test("does not fabricate results if Overpass response has no suitable named places", () => {
  assert.deepEqual(normalizeOsmPlaces({elements:[]},"culture",51.18,71.44),[]);
  assert.throws(()=>normalizeOsmPlaces({bad:"response"},"food",51.18,71.44));
});
