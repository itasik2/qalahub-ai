import assert from "node:assert/strict";
import test from "node:test";
import { fetchOverpassPlaces, OverpassLookupError, OVERPASS_SERVERS } from "./osm-places";

const payload = JSON.stringify({elements:[
  {type:"node",id:73,lat:51.18,lon:71.446,tags:{amenity:"cafe",name:"Проверенная точка"}},
]});

test("uses alternate Overpass provider after primary returns HTTP error", async () => {
  const visited: string[] = [];
  const mock: typeof fetch = async (input,init) => {
    visited.push(String(input));
    assert.equal(init?.method,"POST");
    if (visited.length === 1) return new Response("busy",{status:429});
    return new Response(payload,{status:200,headers:{"content-type":"application/json"}});
  };
  const data = await fetchOverpassPlaces("food",51.1801,71.44598,mock);
  assert.equal(data.length,1);
  assert.equal(data[0].name,"Проверенная точка");
  assert.deepEqual(visited,OVERPASS_SERVERS.map(x=>x.endpoint));
});
test("does not call the backup when the primary returns a valid empty list", async () => {
  let calls=0;
  const mock: typeof fetch = async () => {
    calls++;
    return new Response('{"elements":[]}',{status:200});
  };
  assert.deepEqual(await fetchOverpassPlaces("food",51.1801,71.44598,mock),[]);
  assert.equal(calls,1);
});
test("reports only generic status categories after both hosts fail", async () => {
  let i=0;
  const mock: typeof fetch = async () => {
    i++;
    return new Response("busy",{status:i===1?503:429});
  };
  await assert.rejects(fetchOverpassPlaces("culture",51.1801,71.44598,mock),(error:unknown) =>
    error instanceof OverpassLookupError && error.reasons.length===2
      && error.reasons[0]==="private-coffee:http_503"
      && error.reasons[1]==="fossgis:http_429");
});
test("invalid primary JSON triggers the alternate provider", async () => {
  let i=0;
  const mock: typeof fetch = async () => {
    i++;
    return new Response(i===1?"bad JSON":payload,{status:200});
  };
  const data=await fetchOverpassPlaces("food",51.1801,71.44598,mock);
  assert.equal(i,2);
  assert.equal(data.length,1);
});
