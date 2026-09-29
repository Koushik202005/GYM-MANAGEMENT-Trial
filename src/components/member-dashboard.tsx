import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CalendarClock, CheckCircle2, Dumbbell, Loader2, LogOut, Receipt, RefreshCw, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { createRazorpayOrder, createStripeCheckout, getGymBranding, quotePlan, verifyRazorpayPayment, verifyStripeCheckout } from "@/lib/gym.functions";
import { signOut } from "@/lib/sign-out";
import { formatMoney } from "@/lib/currency";
import { useGymCurrency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";

declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } } }

function loadRazorpay() {
  return new Promise<void>((res, rej) => {
    if (window.Razorpay) return res();
    const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("Could not load payment window")); document.body.appendChild(s);
  });
}

export function MemberDashboard({ profile }: { profile: Tables<"profiles"> }) {
  const currency = useGymCurrency();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["member-home", profile.id],
    queryFn: async () => {
      const { data: member } = await supabase.from("members").select("id, member_code, status").eq("profile_id", profile.id).single();
      const [plans, memberships, payments, notes] = await Promise.all([
        supabase.from("membership_plans").select("*").eq("active", true).order("price_amount"),
        member ? supabase.from("memberships").select("*, membership_plans(name)").eq("member_id", member.id).order("ends_on", { ascending: false }) : Promise.resolve({ data: [] }),
        member ? supabase.from("payments").select("*").eq("member_id", member.id).eq("status", "verified").order("paid_at", { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.from("notifications").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(5),
      ]);
      return { member, plans: plans.data ?? [], memberships: memberships.data ?? [], payments: payments.data ?? [], notes: notes.data ?? [] };
    },
  });
  const loadGymSettings = useServerFn(getGymBranding);
  const verifyStripe = useServerFn(verifyStripeCheckout);
  const [stripeMessage, setStripeMessage] = useState("");
  const router = useRouter();
  const gymSettings = useQuery({ queryKey: ["gym-branding"], queryFn: () => loadGymSettings() });
  const gymName = gymSettings.data?.gym_name ?? "Forge Functional Fitness";
  const current = data?.memberships.find((m) => m.status === "active") ?? data?.memberships[0];
  const daysLeft = current ? Math.ceil((new Date(current.ends_on).getTime() - Date.now()) / 86400000) : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 7;

  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("session_id");
    const cancelled = url.searchParams.has("checkout_cancelled");
    if (cancelled) {
      setStripeMessage("Checkout was cancelled. No payment was taken.");
      url.searchParams.delete("checkout_cancelled");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      return;
    }
    if (!sessionId) return;
    setStripeMessage("Confirming your payment…");
    void verifyStripe({ data: { sessionId } }).then(() => {
      setStripeMessage("Payment confirmed. Your membership is active.");
      void qc.invalidateQueries({ queryKey: ["member-home"] });
      void router.invalidate();
    }).catch((error: unknown) => {
      setStripeMessage(error instanceof Error ? error.message : "Could not confirm the Stripe payment.");
    }).finally(() => {
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    });
  }, [qc, router, verifyStripe]);

  return <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-sidebar text-sidebar-foreground"><div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
      {gymSettings.data?.logo_url ? <img src={gymSettings.data.logo_url} alt="" className="size-9 rounded-md bg-white object-contain"/> : <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><Dumbbell size={18}/></span>}<span className="font-display text-lg font-bold uppercase">{gymName}</span>
      <span className="ml-auto hidden text-sm sm:inline">{profile.display_name}</span>
      <Button variant="ghost" size="sm" onClick={signOut}><LogOut size={16}/> Sign out</Button>
    </div></header>
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div><p className="text-xs font-bold uppercase text-primary">Member portal · {data?.member?.member_code}</p><h1 className="font-display text-4xl font-bold uppercase">Hey {profile.display_name.split(" ")[0]}</h1></div>

      {expiringSoon && current && <div className="flex flex-col gap-3 rounded-md border border-warning bg-warning-soft p-4 sm:flex-row sm:items-center"><CalendarClock className="text-warning"/><p className="flex-1 text-sm"><b>Your membership {daysLeft! < 0 ? "has expired" : `expires in ${daysLeft} day${daysLeft===1?"":"s"}`}.</b> Renew now — your details are already saved.</p><Button size="sm" onClick={()=>document.getElementById("plans")?.scrollIntoView({behavior:"smooth"})}><RefreshCw size={15}/> Renew</Button></div>}

      <section className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <div className="panel bg-feature p-6 text-feature-foreground">
          <p className="text-xs font-bold uppercase text-primary">Your membership</p>
          {current ? <><h2 className="mt-2 font-display text-3xl font-bold uppercase">{current.membership_plans?.name}</h2><p className="mt-1 text-sm text-feature-muted">{current.starts_on} → {current.ends_on}</p><p className="mt-5 font-display text-5xl font-bold">{Math.max(daysLeft ?? 0, 0)}<span className="ml-2 text-base font-normal text-feature-muted">days left</span></p></>
          : <><h2 className="mt-2 font-display text-3xl font-bold uppercase">No active plan</h2><p className="mt-2 text-sm text-feature-muted">Choose a plan below to start training.</p></>}
        </div>
        <div className="panel p-5"><h2 className="section-title flex items-center gap-2"><Bell size={17}/> Updates</h2><div className="mt-3 space-y-3">{data?.notes.length ? data.notes.map(n=><div key={n.id} className="border-l-2 border-primary pl-3"><p className="text-sm font-semibold">{n.title}</p><p className="text-xs text-muted-foreground">{n.message}</p></div>) : <p className="text-sm text-muted-foreground">No updates yet.</p>}</div></div>
      </section>

      <section id="plans"><h2 className="section-title">{current ? "Renew or change plan" : "Choose your plan"}</h2>
        {stripeMessage && <p role="status" className="mt-3 text-sm text-muted-foreground">{stripeMessage}</p>}
        <div className="mt-4 grid gap-4 md:grid-cols-3">{data?.plans.map(p=><PlanCard key={p.id} plan={p} gymName={gymName} currency={currency} paymentGateway={gymSettings.data?.payment_gateway ?? "razorpay"} onPaid={()=>qc.invalidateQueries({queryKey:["member-home"]})}/>)}</div>
      </section>

      <section className="panel overflow-hidden"><div className="p-5"><h2 className="section-title">Payment receipts</h2></div>
        {data?.payments.length ? <table className="w-full text-left text-sm"><thead className="border-y border-border bg-muted text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Receipt</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-5 py-3"/></tr></thead><tbody className="divide-y divide-border">{data.payments.map(p=><tr key={p.id}><td className="px-5 py-3 font-semibold">{p.receipt_number}</td><td className="px-4 py-3 text-muted-foreground">{p.paid_at?.slice(0,10)}</td><td className="px-4 py-3">{formatMoney(p.amount, p.currency)}</td><td className="px-5 py-3 text-right"><Button asChild size="sm" variant="outline"><Link to="/receipt/$paymentId" params={{paymentId:p.id}}><Receipt size={15}/> Download</Link></Button></td></tr>)}</tbody></table>
        : <p className="px-5 pb-5 text-sm text-muted-foreground">No payments yet.</p>}
      </section>
    </main>
  </div>;
}

function PlanCard({ plan, gymName, currency, paymentGateway, onPaid }: { plan: Tables<"membership_plans">; gymName: string; currency: string; paymentGateway: string; onPaid: () => void }) {
  const router = useRouter();
  const quote = useServerFn(quotePlan); const order = useServerFn(createRazorpayOrder); const verify = useServerFn(verifyRazorpayPayment); const stripeCheckout = useServerFn(createStripeCheckout);
  const [coupon, setCoupon] = useState(""); const [q, setQ] = useState<Awaited<ReturnType<typeof quotePlan>> | null>(null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [done, setDone] = useState<string | null>(null);

  async function apply() { setBusy("q"); setErr(""); try { setQ(await quote({ data: { planId: plan.id, coupon } })); } catch (e) { setErr((e as Error).message); setQ(null); } setBusy(""); }
  async function pay() {
    setBusy("pay"); setErr("");
    try {
      if (paymentGateway === "stripe") {
        const session = await stripeCheckout({ data: q?.couponCode ? { planId: plan.id, coupon: q.couponCode } : { planId: plan.id } });
        window.location.assign(session.checkoutUrl);
        return;
      }
      const o = await order({ data: q?.couponCode ? { planId: plan.id, coupon: q.couponCode } : { planId: plan.id } });
      await loadRazorpay();
      new window.Razorpay!({
        key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency, name: gymName, description: plan.name,
        prefill: { name: o.name, email: o.email, contact: o.phone }, theme: { color: "#9be22d" },
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try { const v = await verify({ data: { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature } }); setDone(v.paymentId); onPaid(); router.invalidate(); }
          catch (e) { setErr((e as Error).message); }
        },
        modal: { ondismiss: () => setBusy("") },
      }).open();
    } catch (e) { setErr((e as Error).message); }
    setBusy("");
  }

  return <article className="panel flex flex-col p-5">
    <h3 className="font-display text-2xl font-bold uppercase">{plan.name}</h3><p className="text-sm text-muted-foreground">{plan.duration_days} days</p>
    <p className="mt-3 font-display text-3xl font-bold">{formatMoney(plan.price_amount, currency)}</p>
    {Number(plan.joining_fee_amount) > 0 && <p className="text-xs text-muted-foreground">+ {formatMoney(plan.joining_fee_amount, currency)} joining fee for new members</p>}
    <ul className="mt-4 flex-1 space-y-1.5 text-sm">{plan.benefits.map(b=><li key={b} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success"/>{b}</li>)}</ul>
    <div className="mt-4 flex gap-2"><div className="relative flex-1"><Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={coupon} onChange={(e)=>setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" maxLength={40} className="form-input h-10 pl-8"/></div><Button variant="outline" size="sm" className="h-10" onClick={apply} disabled={busy!==""}>{busy==="q"?<Loader2 size={15} className="animate-spin"/>:"Apply"}</Button></div>
    {q && <div className="mt-3 space-y-1 rounded-md bg-muted p-3 text-sm"><p className="flex justify-between"><span>Plan</span><span>{formatMoney(q.base, currency)}</span></p>{q.joiningFee>0&&<p className="flex justify-between"><span>Joining fee</span><span>{formatMoney(q.joiningFee, currency)}</span></p>}{q.discount>0&&<p className="flex justify-between text-success"><span>Coupon {q.couponCode}</span><span>−{formatMoney(q.discount, currency)}</span></p>}<p className="flex justify-between border-t border-border pt-1 font-bold"><span>Total</span><span>{formatMoney(q.total, currency)}</span></p></div>}
    {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
    {done ? <Button asChild className="mt-4"><Link to="/receipt/$paymentId" params={{paymentId:done}}><Receipt size={16}/> Payment done — view receipt</Link></Button>
      : <Button className={cn("mt-4")} onClick={pay} disabled={busy!==""}>{busy==="pay"?<Loader2 size={16} className="animate-spin"/>:"Pay & activate"}</Button>}
  </article>;
}
