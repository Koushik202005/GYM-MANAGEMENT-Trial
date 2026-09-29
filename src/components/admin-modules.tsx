import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatMoney } from "@/lib/currency";
import { useGymCurrency } from "@/lib/currency-context";

export function PlansAdmin() {
  const currency = useGymCurrency();
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: async () => (await supabase.from("membership_plans").select("*").order("price_amount")).data ?? [] });
  const coupons = useQuery({ queryKey: ["admin-coupons"], queryFn: async () => (await supabase.from("coupons").select("*, membership_plans(name)").order("created_at", { ascending: false })).data ?? [] });
  const [err, setErr] = useState("");

  async function addCoupon(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); const f = new FormData(e.currentTarget); const form = e.currentTarget;
    const { error } = await supabase.from("coupons").insert({
      code: String(f.get("code")).trim().toUpperCase(), discount_type: String(f.get("type")), discount_value: Number(f.get("value")),
      plan_id: String(f.get("plan")) || null, valid_until: String(f.get("until")) || null,
      max_redemptions: f.get("max") ? Number(f.get("max")) : null, description: String(f.get("desc")) || null,
    });
    if (error) setErr(error.message); else { form.reset(); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); }
  }

  return <div className="space-y-6">
    <section className="panel p-5"><h2 className="section-title">Membership pricing</h2><p className="section-subtitle">Changes apply to new purchases and renewals immediately.</p>
      <div className="mt-4 space-y-3">{plans.data?.map(p=><PlanRow key={p.id} plan={p} currency={currency} onSaved={()=>qc.invalidateQueries({queryKey:["admin-plans"]})}/>)}</div>
    </section>
    <section className="panel p-5"><h2 className="section-title">Discount coupons</h2><p className="section-subtitle">Members enter these codes at checkout.</p>
      <form onSubmit={addCoupon} className="mt-4 grid gap-3 md:grid-cols-7">
        <input name="code" required maxLength={40} placeholder="CODE" className="form-input md:col-span-1"/>
        <select name="type" className="form-input"><option value="percent">% off</option><option value="flat">Flat amount off (INR value)</option></select>
        <input name="value" type="number" required min={1} step="any" placeholder="Value" className="form-input"/>
        <select name="plan" className="form-input"><option value="">All plans</option>{plans.data?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <input name="until" type="date" title="Valid until" className="form-input"/>
        <input name="max" type="number" min={1} placeholder="Max uses" className="form-input"/>
        <Button><Plus size={16}/> Add</Button>
        <input name="desc" maxLength={200} placeholder="Description (optional)" className="form-input md:col-span-7"/>
      </form>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-y border-border bg-muted text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Discount</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Valid until</th><th className="px-3 py-2">Used</th><th className="px-3 py-2">Active</th><th/></tr></thead>
        <tbody className="divide-y divide-border">{coupons.data?.map(c=><tr key={c.id}><td className="px-3 py-2 font-bold">{c.code}</td><td className="px-3 py-2">{c.discount_type==="percent"?`${c.discount_value}%`:formatMoney(c.discount_value, currency)}</td><td className="px-3 py-2">{c.membership_plans?.name ?? "All"}</td><td className="px-3 py-2">{c.valid_until ?? "—"}</td><td className="px-3 py-2">{c.redemptions_count}{c.max_redemptions?` / ${c.max_redemptions}`:""}</td>
          <td className="px-3 py-2"><input type="checkbox" checked={c.active} onChange={async(e)=>{await supabase.from("coupons").update({active:e.target.checked}).eq("id",c.id);qc.invalidateQueries({queryKey:["admin-coupons"]})}}/></td>
          <td className="px-3 py-2 text-right"><Button size="icon" variant="ghost" aria-label="Delete coupon" onClick={async()=>{await supabase.from("coupons").delete().eq("id",c.id);qc.invalidateQueries({queryKey:["admin-coupons"]})}}><Trash2 size={15}/></Button></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}

function PlanRow({ plan, currency, onSaved }: { plan: Tables<"membership_plans">; currency: string; onSaved: () => void }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg(""); const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("membership_plans").update({
      name: String(f.get("name")), price_amount: Number(f.get("price")), joining_fee_amount: Number(f.get("fee")), duration_days: Number(f.get("days")), active: f.get("active") === "on",
    }).eq("id", plan.id);
    setBusy(false); setMsg(error ? error.message : "Saved"); if (!error) onSaved();
  }
  return <form onSubmit={save} className="grid items-end gap-3 rounded-md border border-border p-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto_auto]">
    <label><span className="form-label">Plan</span><input name="name" defaultValue={plan.name} required className="form-input"/></label>
    <label><span className="form-label">Price ({currency})</span><input name="price" type="number" min={0} step="any" defaultValue={plan.price_amount} required className="form-input"/></label>
    <label><span className="form-label">Joining fee ({currency})</span><input name="fee" type="number" min={0} step="any" defaultValue={plan.joining_fee_amount} required className="form-input"/></label>
    <label><span className="form-label">Days</span><input name="days" type="number" min={1} defaultValue={plan.duration_days} required className="form-input"/></label>
    <label className="flex h-11 items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={plan.active}/> Active</label>
    <div className="flex items-center gap-2"><Button size="sm" disabled={busy}>{busy?<Loader2 size={15} className="animate-spin"/>:"Save"}</Button>{msg&&<span className="text-xs text-muted-foreground">{msg}</span>}</div>
  </form>;
}

export function MembersAdmin() {
  const { data } = useQuery({ queryKey: ["admin-members"], queryFn: async () => (await supabase.from("members").select("id, member_code, status, profiles(display_name, email, phone, gender, has_illness, medical_notes), memberships(ends_on, status)").order("created_at", { ascending: false })).data ?? [] });
  return <section className="panel overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-border bg-muted text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Gender</th><th className="px-4 py-3">Illness</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Plan ends</th></tr></thead>
    <tbody className="divide-y divide-border">{data?.map(m=>{const end=[...(m.memberships??[])].sort((a,b)=>b.ends_on.localeCompare(a.ends_on))[0];return <tr key={m.id}><td className="px-4 py-3"><p className="font-semibold">{m.profiles?.display_name}</p><p className="text-xs text-muted-foreground">{m.member_code} · {m.profiles?.email}</p></td><td className="px-4 py-3">{m.profiles?.phone ?? "—"}</td><td className="px-4 py-3 capitalize">{m.profiles?.gender ?? "—"}</td><td className="px-4 py-3" title={m.profiles?.medical_notes ?? ""}>{m.profiles?.has_illness==null?"—":m.profiles.has_illness?"Yes":"No"}</td><td className="px-4 py-3"><span className="status status-muted capitalize">{m.status}</span></td><td className="px-4 py-3">{end?.ends_on ?? "—"}</td></tr>})}</tbody></table>
    {!data?.length && <p className="p-6 text-sm text-muted-foreground">No members yet.</p>}</section>;
}

export function PaymentsAdmin() {
  const currency = useGymCurrency();
  const { data } = useQuery({ queryKey: ["admin-payments"], queryFn: async () => (await supabase.from("payments").select("*, members(member_code, profiles(display_name)), membership_plans(name)").order("created_at", { ascending: false }).limit(200)).data ?? [] });
  return <section className="panel overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-border bg-muted text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Receipt</th><th className="px-4 py-3">Member</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th></tr></thead>
    <tbody className="divide-y divide-border">{data?.map(p=><tr key={p.id}><td className="px-4 py-3 font-semibold">{p.receipt_number}</td><td className="px-4 py-3">{p.members?.profiles?.display_name}</td><td className="px-4 py-3">{p.membership_plans?.name ?? "—"}</td><td className="px-4 py-3">{Number(p.discount_amount)>0?formatMoney(p.discount_amount, p.currency):"—"}</td><td className="px-4 py-3">{formatMoney(p.amount, p.currency)}</td><td className="px-4 py-3"><span className={p.status==="verified"?"status status-active":"status status-muted"}>{p.status}</span></td><td className="px-4 py-3">{(p.paid_at ?? p.created_at).slice(0,10)}</td></tr>)}</tbody></table>
    {!data?.length && <p className="p-6 text-sm text-muted-foreground">No payments yet.</p>}</section>;
}
