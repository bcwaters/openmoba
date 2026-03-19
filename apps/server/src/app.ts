import express, { Express } from "express";
import { createServer as createHttpServer, Server as NodeHttpServer } from "node:http";
import { Server as ColyseusServer } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { OpenMobaRoom } from "./rooms/OpenMobaRoom.js";

export const DEFAULT_ROOM_NAME = "openmoba";
export const DEFAULT_PORT = 2567;

export interface CreateAppServerOptions {
  port?: number;
}

export interface AppServer {
  app: Express;
  httpServer: NodeHttpServer;
  gameServer: ColyseusServer;
  close: () => Promise<void>;
}

export async function createAppServer(
  options: CreateAppServerOptions = {},
): Promise<AppServer> {
  const app = express();
  const httpServer = createHttpServer(app);
  const transport = new WebSocketTransport({ server: httpServer });
  const gameServer = new ColyseusServer({
    transport,
    greet: false,
  });

  gameServer.define(DEFAULT_ROOM_NAME, OpenMobaRoom);

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "openmoba-server",
      roomName: DEFAULT_ROOM_NAME,
    });
  });

  await gameServer.listen(options.port ?? DEFAULT_PORT);

  return {
    app,
    httpServer,
    gameServer,
    close: async () => {
      await gameServer.gracefullyShutdown(false);
    },
  };
}
