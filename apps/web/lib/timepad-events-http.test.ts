import assert from "node:assert/strict";
import test from "node:test";
import { getCityProfile } from "./cities";
import { TimepadApiError, fetchTimepadEvents } from "./timepad-events";

test("a public Timepad HTTP failure includes only the numeric status", async () => {
  const originalFetch = globalThis.fetch;
  const savedToken = process.env.TIMEPAD_TOKEN;
  delete process.env.TIMEPAD_TOKEN;
  let called = 0;
  try {
    globalThis.fetch = async (_input, init) => {
      called += 1;
      const headers = init?.headers as Record<string,string>;
      assert.equal(headers.Authorization, undefined);
      assert.match(String(_input),/cities=/);
      return {ok:false,status:403} as Response;
    };
    await assert.rejects(fetchTimepadEvents(getCityProfile("Астана")!), (error:unknown) =>
      error instanceof TimepadApiError && error.status === 403,
    );
    assert.equal(called, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (savedToken === undefined) delete process.env.TIMEPAD_TOKEN;
    else process.env.TIMEPAD_TOKEN = savedToken;
  }
});
