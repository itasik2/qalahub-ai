import assert from "node:assert/strict";
import test from "node:test";
import { collectSearchSourceUrls, countSourceMatches } from "./source-evidence";

test("reads consulted URLs from actual web-search action", () => {
  const urls = collectSearchSourceUrls({
    output: [
      {type:"web_search_call",action:{type:"search",sources:[
        {type:"url", url:"https://example.kz/astana/event?utm_source=search"},
        {type:"url", url:"https://example.kz/astana/event?utm_source=search"},
        {type:"url", url:"javascript:bad()"},
      ]}},
      {type:"message",content:[]},
    ],
  });
  assert.deepEqual(urls, ["https://example.kz/astana/event?utm_source=search"]);
});

test("matches cited URL against consulted source ignoring tracking params", () => {
  const cited = { answer: "Концерт", citations: [], sources: [
    {title:"Театр",url:"https://example.kz/astana/event"},
    {title:"Где угодно",url:"https://fake.example.com"},
  ]};
  assert.equal(countSourceMatches(cited,
    ["https://example.kz/astana/event?utm_medium=web"]), 1);
});

test("missing source metadata does not invent evidence", () => {
  assert.deepEqual(collectSearchSourceUrls({output:[{type:"web_search_call",action:{type:"search"}}]}), []);
  assert.equal(countSourceMatches({answer:"",sources:[],citations:[]},[]),0);
});
