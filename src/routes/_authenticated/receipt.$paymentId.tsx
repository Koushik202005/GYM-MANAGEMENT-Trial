import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Dumbbell, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/receipt/$paymentId")({
  head: () => ({ meta: [
    { title: "Payment receipt | Forge Fitness Pal" },
    { name: "description", content: "Your Forge Fitness membership payment receipt." },
    { property: "og:title", content: "Forge payment receipt" },
    { property: "og:description", content: "Membership payment receipt." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ]}),
  loader: async ({ params }) => {
    const { data: pay, error } = await supabase.from("payments").select("*, membership_plans(name, duration_days), memberships(starts_on, ends_on), members(member_code, profiles(display_name, email, phone, address))").eq("id", params.paymentId).single();
    if (error || !pay) throw new Error("Receipt not found");
    const { data: gym } = await supabase.from("gym_settings").select("*").limit(1).maybeSingle();
    return { pay, gym };
  },
  errorComponent: ({ error }) => <p className="p-8 text-sm text-destructive">{error.message}</p>,
  component: ReceiptPage,
});

function ReceiptPage() {
  const { pay, gym } = Route.useLoaderData();
  const p = pay.members?.profiles;
  return <main className="min-h-screen bg-muted p-4 print:bg-card print:p-0 md:p-10">
    <div className="mx-auto mb-4 flex max-w-2xl justify-between print:hidden"><Button asChild variant="ghost"><Link to="/dashboard"><ArrowLeft size={16}/> Back</Link></Button><Button onClick={()=>window.print()}><Printer size={16}/> Download / Print PDF</Button></div>
    <article className="panel mx-auto max-w-2xl p-8 print:border-0 print:shadow-none">
      <header className="flex items-start justify-between border-b border-border pb-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground"><Dumbbell size={20}/></span><div><p className="font-display text-xl font-bold uppercase">{gym?.gym_name ?? "Forge Fitness"}</p><p className="text-xs text-muted-foreground">{gym?.address}</p></div></div><div className="text-right"><p className="text-xs uppercase text-muted-foreground">Receipt</p><p className="font-bold">{pay.receipt_number}</p><p className="text-xs text-muted-foreground">{pay.paid_at?.slice(0,10)}</p></div></header>
      <section className="grid gap-4 border-b border-border py-6 text-sm sm:grid-cols-2"><div><p className="text-xs uppercase text-muted-foreground">Billed to</p><p className="font-semibold">{p?.display_name}</p><p>{p?.email}</p><p>{p?.phone && `+91 ${p.phone}`}</p><p className="text-muted-foreground">{p?.address}</p></div><div className="sm:text-right"><p className="text-xs uppercase text-muted-foreground">Member ID</p><p className="font-semibold">{pay.members?.member_code}</p><p className="mt-2 text-xs uppercase text-muted-foreground">Payment ID</p><p className="break-all">{pay.provider_payment_id ?? pay.method}</p></div></section>
      <table className="my-6 w-full text-sm"><tbody>
        <tr><td className="py-1.5">{pay.membership_plans?.name} membership{pay.memberships ? ` (${pay.memberships.starts_on} to ${pay.memberships.ends_on})` : ""}</td><td className="text-right">{formatMoney(pay.base_amount, pay.currency)}</td></tr>
        {Number(pay.discount_amount) > 0 && <tr className="text-success"><td className="py-1.5">Coupon discount</td><td className="text-right">−{formatMoney(pay.discount_amount, pay.currency)}</td></tr>}
        <tr className="border-t border-border font-bold"><td className="pt-3">Total paid</td><td className="pt-3 text-right">{formatMoney(pay.amount, pay.currency)}</td></tr>
      </tbody></table>
      <p className="text-xs text-muted-foreground">Status: {pay.status}. This is a computer-generated receipt.</p>
    </article>
  </main>;
}
