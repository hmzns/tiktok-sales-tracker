import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../src/app";

test("sync history is API-key protected and rejects an excessive limit safely", async () => {
  const originalApiKey = process.env.APP_API_KEY;
  process.env.APP_API_KEY = "sync-history-test-key";
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}/tiktok-shop/sync-history?limit=51`;

  try {
    const unauthorizedResponse = await fetch(url);
    const unauthorizedBody = await unauthorizedResponse.json();

    assert.equal(unauthorizedResponse.status, 401);
    assert.deepEqual(unauthorizedBody, {
      success: false,
      message: "Unauthorized.",
    });

    const validationResponse = await fetch(url, {
      headers: { "x-api-key": "sync-history-test-key" },
    });
    const validationBody = await validationResponse.json();

    assert.equal(validationResponse.status, 400);
    assert.equal(validationBody.success, false);
    assert.equal(validationBody.message, "Validation failed");
    assert.deepEqual(validationBody.errors, [
      { field: "limit", message: "Limit must be at most 50" },
    ]);
    assert.equal(JSON.stringify(validationBody).includes("stack"), false);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

    if (originalApiKey === undefined) {
      delete process.env.APP_API_KEY;
    } else {
      process.env.APP_API_KEY = originalApiKey;
    }
  }
});
