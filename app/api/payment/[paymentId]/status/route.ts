import { getPayment, updatePayment } from "@/lib/db";

const POLL_INTERVAL_MS = 5_000; // check every 5 seconds
const MAX_DURATION_MS = 16 * 60 * 1000; // max 16 min SSE session

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;
  
  // Fetch from PostgreSQL
  const payment = await getPayment(paymentId);

  if (!payment) {
    return Response.json({ error: "Payment not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let pollTimer: ReturnType<typeof setTimeout> | null = null;

      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearTimeout(pollTimer);
        try { controller.close(); } catch {}
      };

      // If already completed or expired, send final status immediately
      if (payment.status === "completed") {
        send({ status: "completed", txHash: payment.txHash });
        close();
        return;
      }
      if (payment.status === "expired" || payment.status === "cancelled") {
        send({ status: payment.status });
        close();
        return;
      }

      const startTime = Date.now();

      const poll = async () => {
        if (closed) return;

        try {
          // Fetch fresh payment data from PostgreSQL
          const current = await getPayment(paymentId);
          
          if (!current) {
            send({ status: "error", message: "Payment not found" });
            close();
            return;
          }

          // Check expiration
          if (current.status !== "withheld" && Date.now() > current.expiresAt) {
            await updatePayment(paymentId, { status: "expired" });
            send({ status: "expired" });
            close();
            return;
          }

          // Check if completed, expired, or cancelled
          if (current.status === "completed") {
            send({ status: "completed", txHash: current.txHash });
            close();
            return;
          }

          if (current.status === "expired" || current.status === "cancelled") {
            send({ status: current.status });
            close();
            return;
          }

          // P2P Gateway Flow status updates (Database only - no blockchain calls)
          send({
            status: current.status, // "pending", "confirming", or "withheld"
            vendorApproval: current.vendorApproval,
            timeLeft: current.status === "withheld"
              ? (current.frozenTimeLeft ?? 0)
              : Math.max(0, current.expiresAt - Date.now()),
          });

          // Check max SSE duration
          if (Date.now() - startTime > MAX_DURATION_MS) {
            send({ status: "timeout" });
            close();
            return;
          }

          // Continue polling DB
          if (!closed) {
            pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
          }
        } catch (err) {
          console.error("Poll error:", err);
          if (!closed) {
            send({ status: "error", message: "Polling error" });
            pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
          }
        }
      };

      // Start first poll
      poll();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}