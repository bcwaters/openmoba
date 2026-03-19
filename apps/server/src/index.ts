import { DEFAULT_PORT, createAppServer } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10);

const server = await createAppServer({ port });
const address = server.httpServer.address();
const boundPort = typeof address === "object" && address ? address.port : port;

console.log(`OpenMOBA Colyseus server listening on port ${boundPort}`);
