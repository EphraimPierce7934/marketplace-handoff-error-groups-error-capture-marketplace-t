import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CapturePayload } from "./infrai_errors.js";

export const handoffRequest = z.object({
  seller: z.object({ id: z.string().min(1) }),
  buyerUpdate: z.object({ buyerId: z.string().min(1), revision: z.number().int().nonnegative() }),
  order: z.object({ id: z.string().min(1), requiredRevision: z.number().int().nonnegative() }),
  assets: z.array(z.object({ kind: z.enum(["license", "download"]), ready: z.boolean() })).min(1),
});

export type HandoffRequest = z.infer<typeof handoffRequest>;
export type Capture = (payload: CapturePayload, idempotencyKey: string) => Promise<unknown>;

export type HandoffResult =
  | { state: "handed_off"; orderId: string; buyerId: string }
  | { state: "blocked"; orderId: string; reason: string; captureId: string };

export async function decideOrderHandoff(input: HandoffRequest, capture: Capture): Promise<HandoffResult> {
  const missing = input.assets.find((asset) => !asset.ready);
  const staleBuyerUpdate = input.buyerUpdate.revision < input.order.requiredRevision;
  if (!missing && !staleBuyerUpdate) {
    return { state: "handed_off", orderId: input.order.id, buyerId: input.buyerUpdate.buyerId };
  }

  const captureId = randomUUID();
  const reason = missing ? `${missing.kind} asset is not ready` : "buyer update is behind the order";
  const groupingKey = missing?.kind ?? "buyer-update";
  const exception = new Error(`Order handoff blocked: ${reason}`);

  await capture(
    {
      title: "Marketplace order handoff blocked",
      message: exception.message,
      level: "error",
      fingerprint: ["order-handoff", input.seller.id, groupingKey],
      exception: exception.stack ?? exception.message,
      context: {
        captureId,
        sellerId: input.seller.id,
        buyerId: input.buyerUpdate.buyerId,
        orderId: input.order.id,
        buyerRevision: input.buyerUpdate.revision,
        requiredRevision: input.order.requiredRevision,
      },
    },
    captureId,
  );

  return { state: "blocked", orderId: input.order.id, reason, captureId };
}
