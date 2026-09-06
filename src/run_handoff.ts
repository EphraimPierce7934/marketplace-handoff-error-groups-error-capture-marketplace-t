import { infrai } from "./infrai_errors.js";
import { decideOrderHandoff, handoffRequest } from "./order_handoff.js";

const input = handoffRequest.parse({
  seller: { id: "seller-42" },
  buyerUpdate: { buyerId: "buyer-17", revision: 3 },
  order: { id: "order-9001", requiredRevision: 3 },
  assets: [
    { kind: "license", ready: true },
    { kind: "download", ready: false },
  ],
});

const result = await decideOrderHandoff(input, infrai.errors.capture);
console.log(JSON.stringify(result, null, 2));
