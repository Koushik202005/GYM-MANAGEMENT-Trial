import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CheckCircle2, Dumbbell, Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getGymBranding } from "@/lib/gym.functions";

const credentials = z.object({ email: z.string().trim().email("Enter a valid email").max(255), password: z.string().min(8,"Use at least 8 characters").max(72) });

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in | Forge Fitness Pal" }, { name: "description", content: "Secure access for Forge Fitness members, coaches, and administrators." },
    { property: "og:title", content: "Sign in to Forge Fitness" }, { property: "og:description", content: "Access classes, workouts, membership, and gym operations." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}), component: AuthPage,
});

function AuthPage(){
  const loadBranding=useServerFn(getGymBranding); const {data:branding}=useQuery({queryKey:["gym-branding"],queryFn:()=>loadBranding()});
  const navigate=useNavigate(); const [mode,setMode]=useState<"signin"|"signup"|"forgot">("signin"); const [show,setShow]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  useEffect(()=>{supabase.auth.getSession().then(({data})=>{if(data.session)navigate({to:"/dashboard"});});const {data:sub}=supabase.auth.onAuthStateChange((ev,session)=>{if(session&&(ev==="SIGNED_IN"||ev==="INITIAL_SESSION"))navigate({to:"/dashboard"});});return()=>sub.subscription.unsubscribe();},[navigate]);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");setMessage("");const data=new FormData(e.currentTarget);const email=String(data.get("email")??"");
    if(mode==="forgot"){const parsed=z.string().trim().email("Enter a valid email").safeParse(email);if(!parsed.success){setError(parsed.error.issues[0]?.message??"Invalid email");setBusy(false);return;}const {error:resetError}=await supabase.auth.resetPasswordForEmail(parsed.data,{redirectTo:`${window.location.origin}/reset-password`});setBusy(false);if(resetError)setError(resetError.message);else setMessage("Check your email for a secure reset link.");return;}
    const parsed=credentials.safeParse({email,password:String(data.get("password")??"")});if(!parsed.success){setError(parsed.error.issues[0]?.message??"Check your details");setBusy(false);return;}
    if(mode==="signup"){const {data:result,error:signError}=await supabase.auth.signUp({email:parsed.data.email,password:parsed.data.password,options:{emailRedirectTo:window.location.origin}});setBusy(false);if(signError)setError(signError.message);else if(!result.session)setMessage("Check your email to confirm your account, then sign in.");else navigate({to:"/dashboard"});}
    else {const {error:signError}=await supabase.auth.signInWithPassword(parsed.data);setBusy(false);if(signError)setError(signError.message);else navigate({to:"/dashboard"});}
  }
  async function google(){setBusy(true);setError("");const onLovable=/lovable\.(app|dev)$/.test(window.location.hostname);if(!onLovable){const {error:oauthError}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/auth`}});if(oauthError){setError(oauthError.message);setBusy(false);}return;}const result=await lovable.auth.signInWithOAuth("google",{redirect_uri:`${window.location.origin}/auth`});if(result.error){setError(result.error.message);setBusy(false);}else if(!result.redirected)navigate({to:"/dashboard"});}
  return <main className="grid min-h-screen bg-auth lg:grid-cols-[1.05fr_.95fr]">
    <section className="hidden flex-col justify-between bg-feature p-12 text-feature-foreground lg:flex"><Link to="/" className="flex items-center gap-3">{branding?.logo_url?<img src={branding.logo_url} alt="" className="size-11 rounded-md bg-white object-contain"/>:<span className="grid size-11 place-items-center rounded-md bg-primary text-primary-foreground"><Dumbbell/></span>}<span className="font-display text-xl font-bold uppercase">{branding?.gym_name??"Forge"}</span></Link><div className="max-w-xl"><p className="text-xs font-bold uppercase text-primary">Built for stronger communities</p><h1 className="mt-5 font-display text-6xl font-bold uppercase leading-[.95]">Train hard.<br/>Run smarter.</h1><p className="mt-6 max-w-md text-base leading-7 text-feature-muted">One focused workspace for athletes, coaches, classes, memberships, and every rep that matters.</p><div className="mt-10 grid grid-cols-3 gap-3">{[["287","Athletes"],["38","Classes/week"],["4.9","Member rating"]].map(([v,l])=><div key={l} className="border-l-2 border-primary pl-4"><p className="font-display text-2xl font-bold">{v}</p><p className="text-xs text-feature-muted">{l}</p></div>)}</div></div><p className="text-xs text-feature-muted">Secure role-based access for every member of your gym.</p></section>
    <section className="flex items-center justify-center p-5 sm:p-10"><div className="w-full max-w-md"><Link to="/" className="mb-10 flex items-center gap-3 lg:hidden">{branding?.logo_url?<img src={branding.logo_url} alt="" className="size-10 rounded-md bg-white object-contain"/>:<span className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground"><Dumbbell size={20}/></span>}<span className="font-display text-lg font-bold uppercase">{branding?.gym_name??"Forge"}</span></Link><p className="text-xs font-bold uppercase text-primary">{mode==="forgot"?"Account recovery":"Member portal"}</p><h2 className="mt-3 font-display text-4xl font-bold uppercase">{mode==="signin"?"Welcome back":mode==="signup"?"Join the crew":"Reset password"}</h2><p className="mt-2 text-sm text-muted-foreground">{mode==="forgot"?"We’ll email you a secure reset link.":"Access your training and gym operations."}</p>
      {mode!=="forgot"&&<Button variant="outline" className="mt-8 w-full" onClick={google} disabled={busy}><span className="text-base font-bold">G</span> Continue with Google</Button>}
      {mode!=="forgot"&&<div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>or continue with email<span className="h-px flex-1 bg-border"/></div>}
      <form onSubmit={submit} className={mode==="forgot"?"mt-8 space-y-5":"space-y-5"}><label className="block"><span className="form-label">Email address</span><input name="email" type="email" required maxLength={255} placeholder="you@example.com" className="form-input"/></label>{mode!=="forgot"&&<label className="block"><span className="form-label">Password</span><span className="relative block"><input name="password" type={show?"text":"password"} required minLength={8} maxLength={72} placeholder="Minimum 8 characters" className="form-input pr-12"/><button type="button" aria-label={show?"Hide password":"Show password"} onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>}
      {error&&<p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}{message&&<p className="flex items-start gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-success"><CheckCircle2 className="mt-0.5 shrink-0" size={16}/>{message}</p>}<Button className="w-full" disabled={busy}>{busy?<Loader2 className="animate-spin" size={18}/>:<>{mode==="signin"?"Sign in":mode==="signup"?"Create account":"Send reset link"}<ArrowRight size={17}/></>}</Button></form>
      <div className="mt-6 flex items-center justify-between text-sm">{mode==="signin"&&<><button className="font-semibold text-primary" onClick={()=>setMode("signup")}>Create an account</button><button className="text-muted-foreground" onClick={()=>setMode("forgot")}>Forgot password?</button></>}{mode!=="signin"&&<button className="font-semibold text-primary" onClick={()=>setMode("signin")}>Back to sign in</button>}</div>
    </div></section>
  </main>
}
