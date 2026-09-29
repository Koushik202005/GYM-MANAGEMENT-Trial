import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { formatMoney } from "@/lib/currency";

export async function completeMembershipPayment(paymentId: string, providerPaymentId: string, currency: string, amountMinor: number) {
  const { data: result, error } = await supabaseAdmin.rpc("complete_membership_payment", {
    p_payment_id: paymentId,
    p_provider_payment_id: providerPaymentId,
    p_currency: currency.toUpperCase(),
    p_amount_minor: amountMinor,
  });
  if (error) throw new Error(error.message);
  const completion = Array.isArray(result) ? result[0] : result;
  if (!completion) throw new Error("Payment confirmation did not complete.");
  if (completion.completed) {
    const { data: payment } = await supabaseAdmin.from("payments").select("member_id, amount, currency, receipt_number").eq("id", paymentId).single();
    const { data: member } = payment ? await supabaseAdmin.from("members").select("profile_id").eq("id", payment.member_id).single() : { data: null };
    if (payment && member) {
      await supabaseAdmin.from("notifications").insert({
        user_id: member.profile_id,
        title: "Payment received",
        message: `${formatMoney(payment.amount, payment.currency)} received. Your receipt ${payment.receipt_number} is ready to download.`,
        category: "payment",
      });
    }
  }
  return { paymentId, completed: completion.completed };
}

export async function completeStripeSession(session: {
  id?: string;
  payment_status?: string;
  currency?: string;
  amount_total?: number | null;
  payment_intent?: string | { id?: string } | null;
  metadata?: Record<string, string | undefined> | null;
}) {
  if (!session.id || session.payment_status !== "paid" || !session.currency || session.amount_total == null) {
    throw new Error("Stripe has not confirmed a completed payment.");
  }
  const paymentId = session.metadata?.payment_id;
  const metadataMemberId = session.metadata?.member_id;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentId || !metadataMemberId || !paymentIntentId) throw new Error("Stripe session is missing its payment reference.");
  const { data: payment, error } = await supabaseAdmin.from("payments")
    .select("id, member_id, plan_id, coupon_id, currency, amount, method, provider_order_id")
    .eq("id", paymentId).single();
  if (error || !payment || payment.method !== "stripe" || payment.provider_order_id !== session.id || payment.member_id !== metadataMemberId) {
    throw new Error("Stripe session does not match a gym payment.");
  }
  if (session.metadata?.plan_id !== payment.plan_id || session.currency.toUpperCase() !== payment.currency) {
    throw new Error("Stripe session currency or plan does not match the payment.");
  }
  const result = await completeMembershipPayment(payment.id, paymentIntentId, session.currency, session.amount_total);
  if (result.completed && payment.coupon_id) {
    const { data: coupon } = await supabaseAdmin.from("coupons").select("redemptions_count").eq("id", payment.coupon_id).single();
    if (coupon) await supabaseAdmin.from("coupons").update({ redemptions_count: coupon.redemptions_count + 1 }).eq("id", payment.coupon_id);
  }
  return result;
}
