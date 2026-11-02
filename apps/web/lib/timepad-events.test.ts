import assert from "node:assert/strict";
import test from "node:test";
import { getCityProfile } from "./cities";
import { buildTimepadUrl, normalizeTimepadEvents } from "./timepad-events";

const city = getCityProfile("Астана")!;
const now = new Date("2026-11-02T08:00:00.000Z");
const record = (overrides: Record<string,unknown> = {}) => ({
  id: 456, name:"Настоящее мероприятие",url:"https://organizer.timepad.ru/event/456/",
  starts_at:"2026-11-04T19:30:00+05:00",ends_at:"2026-11-04T21:00:00+05:00",
  access_status:"public",
  location:{city:"Астана",country:"Казахстан",address:"проспект Абая, 12"},
  ...overrides,
});
test("builds safe city-scoped API URL with a bounded date horizon", () => {
  const url = new URL(buildTimepadUrl(city,now));
  assert.equal(url.hostname,"api.timepad.ru");
  assert.equal(url.searchParams.get("cities"),"Астана");
  assert.equal(url.searchParams.get("limit"),"50");
  assert.equal(url.searchParams.get("fields"),"location");
  assert.equal(url.searchParams.get("sort"),"+starts_at");
});
test("keeps only upcoming events with matching city, KZ country, venue and original URL", () => {
  const items = normalizeTimepadEvents({values:[
    record(),
    record({id:789,location:{city:"Москва",country:"Россия",address:"Кремль"}}),
    record({id:800,location:{city:"Алматы",country:"Казахстан",address:"Арбат"}}),
    record({id:801,location:{city:"Астана",country:"Казахстан",address:""}}),
    record({id:802,starts_at:"2026-10-04T19:30:00+05:00"}),
    record({id:803,url:"https://evil.test/event/803/"}),
    record({id:804,access_status:"private"}),
    record(),
  ]},city,now);
  assert.equal(items.length,1);
  assert.equal(items[0].id,"456");
  assert.equal(items[0].cityId,"astana");
  assert.equal(items[0].address,"проспект Абая, 12");
  assert.equal(items[0].startsAt,"2026-11-04T14:30:00.000Z");
});
test("handles timezones without a colon, refuses naive datetimes", () => {
  const result = normalizeTimepadEvents({values:[
    record({id:1,starts_at:"2026-11-04T19:30:00+0500"}),
    record({id:2,starts_at:"2026-11-04T19:30:00"}),
    record({id:3,starts_at:"2027-01-04T19:30:00+05:00"}),
  ]},city,now);
  assert.deepEqual(result.map(x=>x.id),["1"]);
});
test("no events remain when the API has no relevant upcoming records", () => {
  assert.deepEqual(normalizeTimepadEvents({values:[]},city,now),[]);
  assert.throws(()=>normalizeTimepadEvents({foo:"bar"},city,now),/Invalid/);
});
test("does not invent currency or ticket availability", () => {
  const item = normalizeTimepadEvents({values:[record({registration_data:{price_min:1000}})]},city,now)[0];
  assert.ok(!Object.keys(item).some(key=>/price|currency|available/i.test(key)));
});
