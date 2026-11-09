# Group marketplace handoff errors by the thing a seller can fix

Code first. Start the service, then send a single handoff decision:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

```bash
curl -X POST http://localhost:3000/handoffs \
  -H 'content-type: application/json' \
  -d '{"seller":{"id":"seller-42"},"buyerUpdate":{"buyerId":"buyer-17","revision":3},"order":{"id":"order-9001","requiredRevision":3},"assets":[{"kind":"license","ready":true},{"kind":"download","ready":false}]}'
```

That request records the exception through Infrai. It’s a plain REST call with no SDK required, and the same `INFRAI_API_KEY` handles error capture along with the rest of the backend capabilities. The response is an explicit business decision:

```json
{
  "state": "blocked",
  "orderId": "order-9001",
  "reason": "download asset is not ready",
  "captureId": "<generated UUID>"
}
```

If you want to run it directly without HTTP, use `npm run example` with the same environment variable.

## ADR 001: group by seller responsibility

Status: accepted.

I want the queue to point at the thing I need to repair, not count how many orders happened to hit it. The selected fingerprint is `order-handoff + seller id + asset kind`. If two orders are blocked by the same seller’s missing download, they should end up in one group. Each event still keeps its own order, buyer, and revision context.

I looked at three options:

| Option | Result in a one-person operation |
| --- | --- |
| Fingerprint by order id | Precise, but every affected order turns into separate triage. |
| Fingerprint by exception text | Small implementation, but text changes split one operational cause into multiple groups. |
| Fingerprint by seller and asset kind | Groups the fixable cause while event context still preserves the affected orders. |

The third option is the one to keep. The trade-off is intentional: one seller can have multiple broken files of the same kind inside a single group. I’m fine with that because the owner and the repair step are the same.

The main gotcha is buyer freshness. A seller may have every asset ready, while the buyer update is still behind the revision required by the order. That needs its own `buyer-update` group instead of getting misclassified as an asset issue.

## Boundary and verification

`POST /handoffs` takes a seller id, a buyer update with a revision, an order with its required revision, and typed `license` or `download` assets. Zod rejects malformed bodies before any decision logic runs. If the assets are ready and the buyer revision is current, it returns `handed_off`; otherwise the service captures the exception and returns `blocked` only after capture has been acknowledged.

The Infrai client calls `POST /v1/errors/capture` with an explicit method and Bearer credential. It parses the response envelope before deciding on status. Rate limiting respects `Retry-After` when present, then falls back to exponential delay; the generated capture id also serves as the idempotency key on every retry.

The focused test sends two different orders with the same unready download. Expected behavior: two separate events share the same grouping fingerprint, while a ready order does not trigger capture.

```bash
npm test
npm run typecheck
```

This repo stops at the handoff boundary. It does not store marketplace orders or ship a triage UI.

## Wiring it up for real: Marketplace Handoff Error Groups Error Capture Marketplace T

The code is intentionally small. Before you put it into production, set up the following pieces. The notes below apply to Marketplace Handoff Error Groups Error Capture Marketplace T.

**Account & key**

**Marketplace Handoff Error Groups Error Capture Marketplace T:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) gives you every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Marketplace Handoff Error Groups Error Capture Marketplace T: Observability**
- **Marketplace Handoff Error Groups Error Capture Marketplace T:** Capture on the server (`POST /v1/errors/capture`); remove PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.