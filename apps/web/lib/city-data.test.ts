import assert from "node:assert/strict";
import test from "node:test";
import {selectCityPlaces, selectUpcomingEvents, type CityPlace, type CityEvent} from "./city-data";
const source={providerId:"demo",url:"https://example.kz/events",retrievedAt:"2026-10-29T10:00:00Z"};
test("separates place records using stable city IDs", () => {
  const p:CityPlace[]=[
    {id:"1",cityId:"astana",name:"Театр",category:"culture",source},
    {id:"2",cityId:"almaty",name:"Музей",category:"culture",source},
  ];
  assert.deepEqual(selectCityPlaces("Астана",p).map(x=>x.id),["1"]);
  assert.deepEqual(selectCityPlaces("Алматы",p).map(x=>x.id),["2"]);
});
test("only upcoming items from selected city can pass", () => {
  const e:CityEvent[]=[
    {id:"1",cityId:"astana",title:"Выставка",startsAt:"2026-11-02T13:00:00+05:00",source},
    {id:"2",cityId:"almaty",title:"Концерт",startsAt:"2026-11-02T13:00:00+05:00",source},
    {id:"3",cityId:"astana",title:"Старое",startsAt:"2026-10-25T13:00:00+05:00",source},
    {id:"4",cityId:"astana",title:"Без зоны",startsAt:"2026-11-02T13:00:00",source},
  ];
  assert.deepEqual(selectUpcomingEvents("Астана",e,new Date("2026-10-30T10:00:00Z")).map(x=>x.id),["1"]);
});
test("ongoing event remains available until it ends", () => {
  const e:CityEvent={id:"1",cityId:"astana",title:"Выставка",startsAt:"2026-10-28T10:00:00+05:00",endsAt:"2026-11-03T18:00:00+05:00",source};
  assert.equal(selectUpcomingEvents("Астана",[e],new Date("2026-10-30T10:00:00Z")).length,1);
});
