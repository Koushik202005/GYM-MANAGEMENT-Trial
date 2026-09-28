import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Dumbbell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { completeProfile, getGymBranding, sendPhoneOtp, verifyPhoneOtp } from "@/lib/gym.functions";
import { signOut } from "@/lib/sign-out";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [
    { title: "Complete your profile | Forge Fitness Pal" },
    { name: "description", content: "Add your details and verify your phone to start training at Forge." },
    { property: "og:title", content: "Complete your Forge profile" },
    { property: "og:description", content: "Verify your phone and add your details." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ]}),
  loader: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
    return data!;
  },
  errorComponent: ({ error }) => <p className="p-8 text-sm text-destructive">{error.message}</p>,
  component: Onboarding,
});

function Onboarding() {
  const profile = Route.useLoaderData();
  const navigate = useNavigate(); const router = useRouter();
  const loadBranding = useServerFn(getGymBranding); const { data: branding } = useQuery({ queryKey: ["gym-branding"], queryFn: () => loadBranding() });
  const send = useServerFn(sendPhoneOtp); const verify = useServerFn(verifyPhoneOtp); const save = useServerFn(completeProfile);
  const [phone, setPhone] = useState(profile.phone ?? ""); const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false); const [verified, setVerified] = useState(Boolean(profile.phone_verified_at));
  const [illness, setIllness] = useState<boolean | null>(profile.has_illness);
  const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  
  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); setError(""); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } setBusy(""); };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    if (!verified) return setError("Please verify your phone number first.");
    if (illness === null) return setError("Please tell us about any illness condition.");
    await run("save", async () => {
      await save({ data: { display_name: String(f.get("name")), address: String(f.get("address")), gender: String(f.get("gender")) as "male", has_illness: illness, medical_notes: String(f.get("notes") ?? "") } });
      await router.invalidate(); navigate({ to: "/dashboard" });
    });
  }

  return <main className="min-h-screen bg-auth p-5 sm:p-10"><div className="mx-auto max-w-xl">
    <div className="mb-8 flex items-center justify-between"><span className="flex items-center gap-3">{branding?.logo_url?<img src={branding.logo_url} alt="" className="size-10 rounded-md bg-white object-contain"/>:<span className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground"><Dumbbell size={20}/></span>}<span className="font-display text-lg font-bold uppercase">{branding?.gym_name??"Forge"}</span></span><Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button></div>
    <p className="text-xs font-bold uppercase text-primary">Step 1 of 2</p>
    <h1 className="mt-2 font-display text-4xl font-bold uppercase">Complete your profile</h1>
    <p className="mt-2 text-sm text-muted-foreground">We need these details before you can choose a membership.</p>
    <form onSubmit={submit} className="panel mt-8 space-y-5 p-6">
      <label className="block"><span className="form-label">Full name</span><input name="name" required minLength={2} maxLength={100} defaultValue={profile.display_name} className="form-input"/></label>
      <div><span className="form-label">Phone number</span>
        <div className="flex gap-2"><span className="form-input grid w-16 place-items-center">+91</span><input value={phone} onChange={(e)=>{setPhone(e.target.value.replace(/\D/g,"").slice(0,10));setVerified(false);setSent(false)}} inputMode="numeric" placeholder="10-digit mobile" className="form-input"/>
          {verified ? <span className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-success"><CheckCircle2 size={16}/>Verified</span> :
          <Button type="button" variant="outline" disabled={busy==="send"||phone.length!==10} onClick={()=>run("send",async()=>{await send({data:{phone}});setSent(true)})}>{busy==="send"?<Loader2 className="animate-spin" size={16}/>:sent?"Resend":"Send OTP"}</Button>}
        </div>
        {sent && !verified && <div className="mt-3 flex gap-2"><input value={otp} onChange={(e)=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" placeholder="Enter OTP" className="form-input"/><Button type="button" disabled={busy==="verify"||otp.length<4} onClick={()=>run("verify",async()=>{await verify({data:{phone,otp}});setVerified(true)})}>{busy==="verify"?<Loader2 className="animate-spin" size={16}/>:"Verify"}</Button></div>}
      </div>
      <label className="block"><span className="form-label">Communication address</span><textarea name="address" required minLength={5} maxLength={500} defaultValue={profile.address ?? ""} rows={3} className="form-input h-auto py-2"/></label>
      <label className="block"><span className="form-label">Gender</span><select name="gender" required defaultValue={profile.gender ?? ""} className="form-input"><option value="" disabled>Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
      <div><span className="form-label">Any illness or medical condition?</span><div className="flex gap-2">{[true,false].map(v=><Button key={String(v)} type="button" variant={illness===v?"default":"outline"} onClick={()=>setIllness(v)}>{v?"Yes":"No"}</Button>)}</div></div>
      {illness && <label className="block"><span className="form-label">Please describe (optional)</span><textarea name="notes" maxLength={1000} defaultValue={profile.medical_notes ?? ""} rows={2} className="form-input h-auto py-2"/></label>}
      {error && <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button className="w-full" disabled={busy==="save"}>{busy==="save"?<Loader2 className="animate-spin" size={18}/>:"Save and continue"}</Button>
    </form>
  </div></main>;
}
