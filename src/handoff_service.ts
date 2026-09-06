import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, infrai } from "./infrai_errors.js";
import { decideOrderHandoff, handoffRequest } from "./order_handoff.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.method !== "POST" || request.url !== "/handoffs") {
    response.writeHead(404).end(JSON.stringify({ error: "route not found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = handoffRequest.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await decideOrderHandoff(input, infrai.errors.capture);
    response.writeHead(result.state === "handed_off" ? 200 : 409).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "invalid handoff request" }));
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      response.writeHead(error.status).end(JSON.stringify({ error: error.message }));
      return;
    }
    response.writeHead(502).end(JSON.stringify({ error: "error capture could not be confirmed" }));
  }
});

server.listen(port, () => console.log(`Marketplace handoff service listening on http://localhost:${port}`));
