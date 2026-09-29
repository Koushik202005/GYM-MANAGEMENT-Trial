import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

type Quote = { planId: string; planName: string; base: number; joiningFee: number; discount: number; total: number; couponId: string | null; couponCode: string | null };

async function buildQuote(db: Awaited<ReturnType<typeof admin>>, userId: string, planId: string, code?: string): Promise<Quote> {
  const { data: plan } = await db.from("membership_plans").select("*").eq("id", planId).eq("active", true).single();
  if (!plan) throw new Error("This plan is not available.");
  const { data: member } = await db.from("members").select("id").eq("profile_id", userId).single();
  let joiningFee = Number(plan.joining_fee_inr);
  if (member) {
    const { count } = await db.from("memberships").select("id", { count: "exact", head: true }).eq("member_id", member.id);
    if ((count ?? 0) > 0) joiningFee = 0; // renewals skip the joining fee
  }
  const base = Number(plan.price_inr);
  let discount = 0; let couponId: string | null = null; let couponCode: string | null = null;
  if (code?.trim()) {
    const { data: c } = await db.from("coupons").select("*").ilike("code", code.trim()).eq("active", true).maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    if (!c) throw new Error("Coupon code not found.");
    if (c.plan_id && c.plan_id !== planId) throw new Error("This coupon doesn't apply to this plan.");
    if ((c.valid_from && today < c.valid_from) || (c.valid_until && today > c.valid_until)) throw new Error("This coupon has expired.");
    if (c.max_redemptions != null && c.redemptions_count >= c.max_redemptions) throw new Error("This coupon has been fully used.");
    discount = c.discount_type === "percent" ? Math.round((base * Number(c.discount_value)) / 100) : Number(c.discount_value);
    discount = Math.min(discount, base);
    couponId = c.id; couponCode = c.code;
  }
  return { planId, planName: plan.name, base, joiningFee, discount, total: base + joiningFee - discount, couponId, couponCode };
}

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
    const { data: profile } = await db.from("profiles").select("onboarding_completed, display_name, email, phone").eq("id", context.userId).single();
    if (!profile?.onboarding_completed) throw new Error("Complete your profile first.");
    const { data: member } = await db.from("members").select("id").eq("profile_id", context.userId).single();
    if (!member) throw new Error("Member record not found.");
    const q = await buildQuote(db, context.userId, data.planId, data.coupon);
    const receipt = `FRG${Date.now()}`;
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${btoa(`${keyId}:${secret}`)}` },
      body: JSON.stringify({ amount: Math.round(q.total * 100), currency: "INR", receipt, notes: { plan: q.planName, member: member.id } }),
    });
    const order = (await res.json()) as { id?: string; error?: { description?: string } };
    if (!res.ok || !order.id) throw new Error(order.error?.description || "Could not start payment.");
    const { error } = await db.from("payments").insert({
      member_id: member.id, plan_id: q.planId, coupon_id: q.couponId, amount_inr: q.total, base_amount_inr: q.base + q.joiningFee,
      discount_inr: q.discount, method: "razorpay", status: "created", provider_order_id: order.id, receipt_number: receipt, created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { keyId, orderId: order.id, amount: Math.round(q.total * 100), name: profile.display_name, email: profile.email, phone: profile.phone ?? "" };
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
    const { data: member } = await db.from("members").select("id").eq("profile_id", context.userId).single();
    const { data: pay } = await db.from("payments").select("*").eq("provider_order_id", data.orderId).single();
    if (!pay || !member || pay.member_id !== member.id) throw new Error("Payment not found.");
    if (pay.status === "verified") return { paymentId: pay.id };
    const activated = await activateMembership(db, pay.member_id, pay.plan_id!);
    await db.from("payments").update({
      status: "verified", provider_payment_id: data.paymentId, verified_at: new Date().toISOString(), paid_at: new Date().toISOString(), membership_id: activated,
    }).eq("id", pay.id).eq("status", "created");
    if (pay.coupon_id) {
      const { data: c } = await db.from("coupons").select("redemptions_count").eq("id", pay.coupon_id).single();
      if (c) await db.from("coupons").update({ redemptions_count: c.redemptions_count + 1 }).eq("id", pay.coupon_id);
    }
    await db.from("members").update({ status: "active" }).eq("id", pay.member_id);
    await db.from("notifications").insert({ user_id: context.userId, title: "Payment received", message: `₹${pay.amount_inr} received. Your receipt ${pay.receipt_number} is ready to download.`, category: "payment" });
    return { paymentId: pay.id };
  });

async function activateMembership(db: Awaited<ReturnType<typeof admin>>, memberId: string, planId: string) {
  const { data: plan } = await db.from("membership_plans").select("duration_days").eq("id", planId).single();
  const { data: current } = await db.from("memberships").select("ends_on").eq("member_id", memberId).in("status", ["active", "pending"]).order("ends_on", { ascending: false }).limit(1).maybeSingle();
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const start = current && new Date(current.ends_on) >= today ? new Date(new Date(current.ends_on).getTime() + 86400000) : today;
  const end = new Date(start.getTime() + ((plan?.duration_days ?? 30) - 1) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const { data, error } = await db.from("memberships").insert({
    member_id: memberId, plan_id: planId, status: start > today ? "pending" : "active", starts_on: iso(start), ends_on: iso(end),
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

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
  logoDataUrl: z.string().max(2_800_000).optional(),
  clearLogo: z.boolean().optional().default(false),
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
      .select("gym_name, logo_url, app_title, color_theme, timezone")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { gym_name: "Forge Functional Fitness", logo_url: null, app_title: "Forge Fitness Pal", color_theme: "forge-green", timezone: "Asia/Kolkata" };
  });

// Public web-app branding only; operational settings remain behind authenticated admin flows.
export const getGymBranding = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = await admin();
    const { data, error } = await db
      .from("gym_settings")
      .select("gym_name, logo_url, app_title, color_theme, timezone")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { gym_name: "Forge Functional Fitness", logo_url: null, app_title: "Forge Fitness Pal", color_theme: "forge-green", timezone: "Asia/Kolkata" };
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
