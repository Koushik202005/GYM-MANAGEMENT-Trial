import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fromMinorUnits, toMinorUnits } from "@/lib/currency";

const phoneSchema = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* ---------------- Phone OTP (MSG91) ---------------- */

export const sendPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { phone: string }) => z.object({ phone: phoneSchema }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["MSG91_AUTH_KEY"];
    const template = process.env["MSG91_OTP_TEMPLATE_ID"];
    if (!key || !template) throw new Error("SMS verification is not set up yet. Please contact the gym.");
    const res = await fetch(
      `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(template)}&mobile=91${data.phone}&otp_length=6&otp_expiry=10`,
      { method: "POST", headers: { authkey: key, "content-type": "application/json" }, body: "{}" },
    );
    const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!res.ok || body.type === "error") throw new Error(body.message || "Could not send the code. Try again.");
    return { sent: true };
  });

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { phone: string; otp: string }) =>
    z.object({ phone: phoneSchema, otp: z.string().regex(/^\d{4,6}$/, "Enter the code") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Allow test bypass code while TRAI DLT registration is pending
    const isTestOtp = data.otp === "812050";

    if (!isTestOtp) {
      const key = process.env["MSG91_AUTH_KEY"];
      if (!key) throw new Error("SMS verification is not set up yet.");
      const res = await fetch(
        `https://control.msg91.com/api/v5/otp/verify?otp=${data.otp}&mobile=91${data.phone}`,
        { headers: { authkey: key } },
      );
      const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
      if (!res.ok || body.type !== "success") throw new Error(body.message || "Incorrect or expired code.");
    }

    const db = await admin();
    const { error } = await db
      .from("profiles")
      .update({ phone: data.phone, phone_verified_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { verified: true };
  });


/* ---------------- Profile completion ---------------- */

const profileSchema = z.object({
  display_name: z.string().trim().min(2, "Enter your full name").max(100),
  address: z.string().trim().min(5, "Enter your address").max(500),
  gender: z.enum(["male", "female", "other"]),
  has_illness: z.boolean(),
  medical_notes: z.string().trim().max(1000).optional().default(""),
});

export const completeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof profileSchema>) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: p } = await db.from("profiles").select("phone_verified_at").eq("id", context.userId).single();
    if (!p?.phone_verified_at) throw new Error("Please verify your phone number first.");
    const { error } = await db.from("profiles").update({
      ...data,
      medical_notes: data.has_illness ? data.medical_notes || null : null,
      onboarding_completed: true,
    }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Pricing & coupons ---------------- */

type Quote = { planId: string; planName: string; base: number; joiningFee: number; discount: number; total: number; currency: string; couponId: string | null; couponCode: string | null };

async function buildQuote(db: Awaited<ReturnType<typeof admin>>, userId: string, planId: string, code?: string): Promise<Quote> {
  const { data: plan } = await db.from("membership_plans").select("*").eq("id", planId).eq("active", true).single();
  if (!plan) throw new Error("This plan is not available.");
  const { data: gym } = await db.from("gym_settings").select("currency").limit(1).maybeSingle();
  const currency = gym?.currency ?? "INR";
  if (!SUPPORTED_BILLING_CURRENCIES.includes(currency as typeof SUPPORTED_BILLING_CURRENCIES[number])) {
    throw new Error("The gym billing currency is not supported for checkout.");
  }
  const { data: member } = await db.from("members").select("id").eq("profile_id", userId).single();
  let joiningFee = fromMinorUnits(toMinorUnits(Number(plan.joining_fee_amount), currency), currency);
  if (member) {
    const { count } = await db.from("memberships").select("id", { count: "exact", head: true }).eq("member_id", member.id);
    if ((count ?? 0) > 0) joiningFee = 0; // renewals skip the joining fee
  }
  const base = fromMinorUnits(toMinorUnits(Number(plan.price_amount), currency), currency);
  let discount = 0; let couponId: string | null = null; let couponCode: string | null = null;
  if (code?.trim()) {
    const { data: c } = await db.from("coupons").select("*").ilike("code", code.trim()).eq("active", true).maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    if (!c) throw new Error("Coupon code not found.");
    if (c.plan_id && c.plan_id !== planId) throw new Error("This coupon doesn't apply to this plan.");
    if ((c.valid_from && today < c.valid_from) || (c.valid_until && today > c.valid_until)) throw new Error("This coupon has expired.");
    if (c.max_redemptions != null && c.redemptions_count >= c.max_redemptions) throw new Error("This coupon has been fully used.");
    const discountMinor = c.discount_type === "percent"
      ? Math.round((toMinorUnits(base, currency) * Number(c.discount_value)) / 100)
      : toMinorUnits(Number(c.discount_value), currency);
    discount = fromMinorUnits(Math.min(discountMinor, toMinorUnits(base, currency)), currency);
    couponId = c.id; couponCode = c.code;
  }
  const total = fromMinorUnits(toMinorUnits(base + joiningFee - discount, currency), currency);
  return { planId, planName: plan.name, base, joiningFee, discount, total, currency, couponId, couponCode };
}

const SUPPORTED_BILLING_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "CAD", "AUD", "SGD", "NZD", "JPY"] as const;

export const quotePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; coupon?: string }) => z.object({ planId: z.string().uuid(), coupon: z.string().max(40).optional() }).parse(d))
  .handler(async ({ data, context }) => buildQuote(await admin(), context.userId, data.planId, data.coupon));

/* ---------------- Razorpay ---------------- */

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; coupon?: string }) => z.object({ planId: z.string().uuid(), coupon: z.string().max(40).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const keyId = process.env["RAZORPAY_KEY_ID"]; const secret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keyId || !secret) throw new Error("Online payments are not switched on yet. Please pay at the front desk or try again later.");
    const db = await admin();
    const { data: gym } = await db.from("gym_settings").select("country_code, currency, payment_gateway").limit(1).maybeSingle();
    if (gym?.payment_gateway !== "razorpay" || gym.country_code !== "IN" || gym.currency !== "INR") throw new Error("Razorpay checkout requires India and INR and must be selected in Gym Settings.");
    const { data: profile } = await db.from("profiles").select("onboarding_completed, display_name, email, phone").eq("id", context.userId).single();
    if (!profile?.onboarding_completed) throw new Error("Complete your profile first.");
    const { data: member } = await db.from("members").select("id").eq("profile_id", context.userId).single();
    if (!member) throw new Error("Member record not found.");
    const q = await buildQuote(db, context.userId, data.planId, data.coupon);
    const receipt = `FRG${Date.now()}`;
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${btoa(`${keyId}:${secret}`)}` },
      body: JSON.stringify({ amount: toMinorUnits(q.total, q.currency), currency: q.currency, receipt, notes: { plan: q.planName, member: member.id } }),
    });
    const order = (await res.json()) as { id?: string; error?: { description?: string } };
    if (!res.ok || !order.id) throw new Error(order.error?.description || "Could not start payment.");
    const { error } = await db.from("payments").insert({
      member_id: member.id, plan_id: q.planId, coupon_id: q.couponId, amount: q.total, base_amount: q.base + q.joiningFee,
      discount_amount: q.discount, currency: q.currency, method: "razorpay", status: "created", provider_order_id: order.id, receipt_number: receipt, created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { keyId, orderId: order.id, amount: toMinorUnits(q.total, q.currency), currency: q.currency, name: profile.display_name, email: profile.email, phone: profile.phone ?? "" };
  });

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string; paymentId: string; signature: string }) =>
    z.object({ orderId: z.string().min(5).max(64), paymentId: z.string().min(5).max(64), signature: z.string().min(10).max(256) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const secret = process.env["RAZORPAY_KEY_SECRET"];
    if (!secret) throw new Error("Payments not configured.");
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const expected = createHmac("sha256", secret).update(`${data.orderId}|${data.paymentId}`).digest("hex");
    const a = Buffer.from(expected); const b = Buffer.from(data.signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Payment could not be verified.");
    const db = await admin();
    const { data: pay } = await db.from("payments").select("*").eq("provider_order_id", data.orderId).eq("method", "razorpay").single();
    const { data: member } = await db.from("members").select("id").eq("profile_id", context.userId).single();
    if (!pay || !member || pay.member_id !== member.id) throw new Error("Payment not found.");
    const keyId = process.env["RAZORPAY_KEY_ID"];
    if (!keyId) throw new Error("Payments not configured.");
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(data.paymentId)}`, {
      headers: { authorization: `Basic ${btoa(`${keyId}:${secret}`)}` },
    });
    const gatewayPayment = await paymentResponse.json() as { id?: string; order_id?: string; amount?: number; currency?: string; status?: string };
    if (!paymentResponse.ok || gatewayPayment.id !== data.paymentId || gatewayPayment.order_id !== data.orderId || gatewayPayment.status !== "captured") {
      throw new Error("Razorpay has not confirmed a captured payment for this order.");
    }
    const { completeMembershipPayment } = await import("@/lib/payment.server");
    const completion = await completeMembershipPayment(pay.id, data.paymentId, gatewayPayment.currency ?? "", gatewayPayment.amount ?? 0);
    if (completion.completed && pay.coupon_id) {
      const { data: c } = await db.from("coupons").select("redemptions_count").eq("id", pay.coupon_id).single();
      if (c) await db.from("coupons").update({ redemptions_count: c.redemptions_count + 1 }).eq("id", pay.coupon_id);
    }
    return { paymentId: pay.id };
  });

export const createStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; coupon?: string }) => z.object({ planId: z.string().uuid(), coupon: z.string().max(40).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const secret = process.env["STRIPE_SECRET_KEY"];
    const appUrl = process.env["APP_URL"] ?? process.env["URL"];
    if (!secret) throw new Error("Stripe is selected, but STRIPE_SECRET_KEY is not configured on the server.");
    if (!appUrl) throw new Error("Set APP_URL in the server environment before using Stripe checkout.");
    const db = await admin();
    const { data: gym } = await db.from("gym_settings").select("payment_gateway, currency").limit(1).maybeSingle();
    if (gym?.payment_gateway !== "stripe") throw new Error("Stripe is not the active payment gateway. Update Gym Settings first.");
    if (!SUPPORTED_BILLING_CURRENCIES.includes(gym.currency as typeof SUPPORTED_BILLING_CURRENCIES[number])) throw new Error("The selected billing currency is not supported by this checkout.");
    const { data: profile } = await db.from("profiles").select("onboarding_completed, display_name, email").eq("id", context.userId).single();
    if (!profile?.onboarding_completed) throw new Error("Complete your profile first.");
    const { data: member } = await db.from("members").select("id").eq("profile_id", context.userId).single();
    if (!member) throw new Error("Member record not found.");
    const quote = await buildQuote(db, context.userId, data.planId, data.coupon);
    const receipt = `FRG${Date.now()}`;
    const { data: payment, error: paymentError } = await db.from("payments").insert({
      member_id: member.id, plan_id: quote.planId, coupon_id: quote.couponId,
      amount: quote.total, base_amount: quote.base + quote.joiningFee, discount_amount: quote.discount,
      currency: quote.currency, method: "stripe", status: "created", receipt_number: receipt, created_by: context.userId,
    }).select("id").single();
    if (paymentError || !payment) throw new Error(paymentError?.message ?? "Could not create payment record.");

    const origin = appUrl.replace(/\/$/, "");
    const parameters = new URLSearchParams({
      mode: "payment",
      success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?checkout_cancelled=1`,
      client_reference_id: payment.id,
      "line_items[0][price_data][currency]": quote.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(toMinorUnits(quote.total, quote.currency)),
      "line_items[0][price_data][product_data][name]": quote.planName,
      "line_items[0][quantity]": "1",
      "metadata[payment_id]": payment.id,
      "metadata[member_id]": member.id,
      "metadata[plan_id]": quote.planId,
    });
    if (profile.email) parameters.set("customer_email", profile.email);
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: parameters.toString(),
    });
    const session = await response.json() as { id?: string; url?: string; error?: { message?: string } };
    if (!response.ok || !session.id || !session.url) {
      await db.from("payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "created");
      throw new Error(session.error?.message ?? "Stripe could not create a checkout session.");
    }
    const { error: updateError } = await db.from("payments").update({ provider_order_id: session.id }).eq("id", payment.id);
    if (updateError) throw new Error("Stripe created checkout but the gym could not save its payment reference.");
    return { checkoutUrl: session.url };
  });

export const verifyStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string }) => z.object({ sessionId: z.string().regex(/^cs_(test|live)_[A-Za-z0-9]+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const secret = process.env["STRIPE_SECRET_KEY"];
    if (!secret) throw new Error("Stripe payments are not configured.");
    const db = await admin();
    const { data: member } = await db.from("members").select("id").eq("profile_id", context.userId).single();
    if (!member) throw new Error("Member record not found.");
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(data.sessionId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const session = await response.json() as { id?: string; payment_status?: string; currency?: string; amount_total?: number | null; payment_intent?: string | { id?: string } | null; metadata?: Record<string, string | undefined> | null; error?: { message?: string } };
    if (!response.ok) throw new Error(session.error?.message ?? "Could not verify this Stripe checkout.");
    if (session.metadata?.member_id !== member.id) throw new Error("This checkout does not belong to your member account.");
    const { completeStripeSession } = await import("@/lib/payment.server");
    return completeStripeSession(session);
  });

/* ---------------- Admin: delete inactive member profile ---------------- */

export const deleteMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string }) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Only administrators can delete profiles");
    const db = await admin();
    const { data: member, error: mErr } = await db.from("members").select("id, profile_id").eq("id", data.memberId).single();
    if (mErr || !member) throw new Error("Member not found");
    if (member.profile_id === context.userId) throw new Error("You cannot delete your own profile");
    const { data: pays } = await db.from("payments").select("id").eq("member_id", member.id);
    const payIds = (pays ?? []).map((p) => p.id);
    if (payIds.length) await db.from("payment_events").delete().in("payment_id", payIds);
    await db.from("payments").delete().eq("member_id", member.id);
    await db.from("attendance").delete().eq("member_id", member.id);
    await db.from("access_events").delete().eq("member_id", member.id);
    await db.from("members").delete().eq("id", member.id);
    await db.from("user_roles").delete().eq("user_id", member.profile_id);
    await db.from("notifications").delete().eq("user_id", member.profile_id);
    await db.from("profiles").delete().eq("id", member.profile_id);
    const { error } = await db.auth.admin.deleteUser(member.profile_id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  });

/* ---------------- Admin: gym branding settings ---------------- */

const gymSettingsSchema = z.object({
  gym_name: z.string().trim().min(2, "Enter a gym name").max(100),
  app_title: z.string().trim().min(2, "Enter a web app title").max(100),
  color_theme: z.enum(["forge-green", "ocean-blue", "ember-orange", "violet", "rose"]),
  currency: z.enum(["INR", "USD", "EUR", "GBP", "AED", "CAD", "AUD", "SGD", "NZD", "JPY"]),
  country_code: z.enum(["IN", "US", "GB", "CA", "AU", "SG", "AE", "NZ", "JP", "DE", "FR", "IE"]),
  payment_gateway: z.enum(["razorpay", "stripe"]),
  logoDataUrl: z.string().max(2_800_000).optional(),
  clearLogo: z.boolean().optional().default(false),
}).superRefine((settings, context) => {
  if (settings.payment_gateway === "razorpay" && (settings.country_code !== "IN" || settings.currency !== "INR")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Razorpay requires gym country India and billing currency INR." });
  }
});

async function requireAdmin(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data: roleRow, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !roleRow) throw new Error("Only administrators can manage gym settings.");
}

export const getGymSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("gym_settings")
      .select("gym_name, logo_url, app_title, color_theme, timezone, currency, country_code, payment_gateway")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { gym_name: "Forge Functional Fitness", logo_url: null, app_title: "Forge Fitness Pal", color_theme: "forge-green", timezone: "Asia/Kolkata", currency: "INR", country_code: "IN", payment_gateway: "razorpay" };
  });

// Public web-app branding only; operational settings remain behind authenticated admin flows.
export const getGymBranding = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = await admin();
    const { data, error } = await db
      .from("gym_settings")
      .select("gym_name, logo_url, app_title, color_theme, timezone, currency, country_code, payment_gateway")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { gym_name: "Forge Functional Fitness", logo_url: null, app_title: "Forge Fitness Pal", color_theme: "forge-green", timezone: "Asia/Kolkata", currency: "INR", country_code: "IN", payment_gateway: "razorpay" };
  });

export const saveGymSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof gymSettingsSchema>) => gymSettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    let logoUrl: string | null | undefined;

    if (data.logoDataUrl) {
      const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(data.logoDataUrl);
      if (!match) throw new Error("Choose a PNG, JPG, or WebP image.");
      const mimeType = match[1];
      const encodedImage = match[2];
      if (!mimeType || !encodedImage) throw new Error("The selected logo is invalid.");
      const bytes = Buffer.from(encodedImage, "base64");
      if (bytes.byteLength === 0 || bytes.byteLength > 2 * 1024 * 1024) {
        throw new Error("The logo must be smaller than 2 MB.");
      }
      const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
      const objectPath = `logo.${extension}`;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const storage = supabaseAdmin.storage.from("gym-branding");
      const { error: uploadError } = await storage.upload(objectPath, bytes, {
        contentType: mimeType,
        cacheControl: "0",
        upsert: true,
      });
      if (uploadError) throw new Error(uploadError.message);
      logoUrl = `${storage.getPublicUrl(objectPath).data.publicUrl}?v=${Date.now()}`;
    } else if (data.clearLogo) {
      logoUrl = null;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings, error: readError } = await supabaseAdmin
      .from("gym_settings")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!settings) throw new Error("Gym settings have not been initialized.");

    const updates = {
      gym_name: data.gym_name,
      app_title: data.app_title,
      color_theme: data.color_theme,
      currency: data.currency,
      country_code: data.country_code,
      payment_gateway: data.payment_gateway,
      ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
    };
    const { error } = await supabaseAdmin.from("gym_settings").update(updates).eq("id", settings.id);
    if (error) throw new Error(error.message);
    if (data.logoDataUrl) {
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      const extension = logoUrl?.split("/logo.")[1]?.split("?")[0];
      await db.storage.from("gym-branding").remove(
        ["png", "jpg", "webp"].filter((ext) => ext !== extension).map((ext) => `logo.${ext}`),
      );
    } else if (data.clearLogo) {
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      await db.storage.from("gym-branding").remove(["logo.png", "logo.jpg", "logo.webp"]);
    }
    return { ...updates, ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}) };
  });
