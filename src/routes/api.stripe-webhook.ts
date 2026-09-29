import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        const signature = request.headers.get("stripe-signature");
        if (!secret || !signature) return new Response("Webhook is not configured", { status: 400 });
        const rawBody = await request.text();
        if (rawBody.length > 1_000_000) return new Response("Payload too large", { status: 413 });
        const entries = signature.split(",").map((part) => part.split("=", 2));
        const timestamp = entries.find(([key]) => key === "t")?.[1];
        const signatures = entries.filter(([key]) => key === "v1").map(([, value]) => value).filter((value): value is string => Boolean(value));
        if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
          return new Response("Invalid webhook timestamp", { status: 400 });
        }
        const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
        const valid = signatures.some((candidate) => {
          if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
          const provided = Buffer.from(candidate, "hex");
          return provided.length === expected.length && timingSafeEqual(provided, expected);
        });
        if (!valid) return new Response("Invalid webhook signature", { status: 400 });

        let event: { type?: string; data?: { object?: Record<string, unknown> } };
        try { event = JSON.parse(rawBody) as typeof event; }
        catch { return new Response("Invalid webhook payload", { status: 400 }); }
        if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
          return Response.json({ received: true });
        }
        const session = event.data?.object;
        if (!session || session.payment_status !== "paid") return Response.json({ received: true });
        try {
          const { completeStripeSession } = await import("@/lib/payment.server");
          await completeStripeSession(session as Parameters<typeof completeStripeSession>[0]);
          return Response.json({ received: true });
        } catch (error) {
          console.error("Stripe webhook fulfillment failed", error);
          return new Response("Payment fulfillment failed", { status: 500 });
        }
      },
    },
  },
});
