import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { AddressInfo } from "node:net";
import request from "supertest";
import { Client } from "colyseus.js";
import { createAppServer } from "../src/app.js";

const activeServers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  while (activeServers.length > 0) {
    const server = activeServers.pop();
    if (server) {
      await server.close();
    }
  }
});

describe("createAppServer", () => {
  it("serves a health endpoint", async () => {
    const server = await createAppServer({ port: 0 });
    activeServers.push(server);

    const response = await request(server.app).get("/health");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      status: "ok",
      service: "openmoba-server",
      roomName: "openmoba",
    });
  });

  it("allows a client to join the openmoba room", async () => {
    const server = await createAppServer({ port: 0 });
    activeServers.push(server);

    const address = server.httpServer.address() as AddressInfo;
    const client = new Client(`ws://127.0.0.1:${address.port}`);
    const room = await client.joinOrCreate("openmoba", {});

    assert.equal(room.name, "openmoba");
    assert.ok(room.sessionId.length > 0);

    await room.leave();
  });
});
