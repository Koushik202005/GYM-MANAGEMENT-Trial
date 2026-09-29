import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dumbbell, ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGymSettings, saveGymSettings } from "@/lib/gym.functions";
import { CURRENCIES, GYM_COUNTRIES, type CountryCode, type CurrencyCode } from "@/lib/currency";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const THEMES = [
  { id: "forge-green", name: "Forge Green", color: "#8bdd20", foreground: "#17200b" },
  { id: "ocean-blue", name: "Ocean Blue", color: "#2875d6", foreground: "#ffffff" },
  { id: "ember-orange", name: "Ember Orange", color: "#d88720", foreground: "#251603" },
  { id: "violet", name: "Violet", color: "#8052cf", foreground: "#ffffff" },
  { id: "rose", name: "Rose", color: "#d33b65", foreground: "#ffffff" },
] as const;
type ThemeId = (typeof THEMES)[number]["id"];

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the logo file."));
    reader.onerror = () => reject(new Error("Could not read the logo file."));
    reader.readAsDataURL(file);
  });
}

export function SettingsAdmin() {
  const queryClient = useQueryClient();
  const loadSettings = useServerFn(getGymSettings);
  const saveSettings = useServerFn(saveGymSettings);
  const settings = useQuery({ queryKey: ["gym-settings"], queryFn: () => loadSettings() });
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [clearLogo, setClearLogo] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>("forge-green");
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>("INR");
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>("IN");
  const [selectedGateway, setSelectedGateway] = useState<"razorpay" | "stripe">("razorpay");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const savedTheme = THEMES.find((theme) => theme.id === settings.data?.color_theme);
    if (savedTheme) setSelectedTheme(savedTheme.id);
  }, [settings.data?.color_theme]);

  useEffect(() => {
    const savedCurrency = CURRENCIES.find((currency) => currency.code === settings.data?.currency);
    if (savedCurrency) setSelectedCurrency(savedCurrency.code);
  }, [settings.data?.currency]);

  useEffect(() => {
    const savedCountry = GYM_COUNTRIES.find((country) => country.code === settings.data?.country_code);
    if (savedCountry) setSelectedCountry(savedCountry.code);
    if (settings.data?.payment_gateway === "stripe" || settings.data?.payment_gateway === "razorpay") {
      setSelectedGateway(settings.data.payment_gateway);
    }
  }, [settings.data?.country_code, settings.data?.payment_gateway]);

  async function pickLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError("");
    setMessage("");
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      setError("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setError("The logo must be smaller than 2 MB.");
      return;
    }
    try {
      setLogoDataUrl(await readAsDataUrl(file));
      setClearLogo(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the logo file.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await saveSettings({
        data: {
          gym_name: String(form.get("gymName")),
          app_title: String(form.get("appTitle")),
          color_theme: selectedTheme,
          currency: selectedCurrency,
          country_code: selectedCountry,
          payment_gateway: selectedGateway,
          ...(logoDataUrl ? { logoDataUrl } : {}),
          clearLogo,
        },
      });
      setLogoDataUrl("");
      setClearLogo(false);
      setMessage("Branding settings saved.");
      await queryClient.invalidateQueries({ queryKey: ["gym-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["gym-branding"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  const previewUrl = clearLogo ? "" : logoDataUrl || settings.data?.logo_url || "";

  if (settings.isLoading) {
    return <section className="panel flex min-h-64 items-center justify-center p-6"><Loader2 className="animate-spin text-primary" size={22}/><span className="ml-3 text-sm text-muted-foreground">Loading gym settings…</span></section>;
  }

  if (settings.isError || !settings.data) {
    return <section className="panel p-6"><h2 className="section-title">Gym branding</h2><p className="mt-3 text-sm text-destructive">{settings.error instanceof Error ? settings.error.message : "Could not load gym settings."}</p></section>;
  }

  return <section className="panel max-w-4xl p-5 md:p-7">
    <div className="mb-6 border-b border-border pb-5">
      <h2 className="section-title">Gym branding</h2>
      <p className="section-subtitle">Update the name, logo, browser tab title, colors, and currency presentation used throughout the web app.</p>
    </div>

    <form key={`${settings.data.gym_name}:${settings.data.app_title}:${settings.data.logo_url ?? ""}:${settings.data.color_theme}:${settings.data.currency}:${settings.data.country_code}:${settings.data.payment_gateway}`} onSubmit={submit} className="space-y-6">
      <label className="block">
        <span className="form-label">Gym name</span>
        <input name="gymName" required minLength={2} maxLength={100} defaultValue={settings.data.gym_name} className="form-input" />
        <span className="mt-1 block text-xs text-muted-foreground">Shown in the admin and member app navigation.</span>
      </label>

      <div>
        <span className="form-label">Gym logo</span>
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-muted/30 p-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-card">
            {previewUrl ? <img src={previewUrl} alt="Gym logo preview" className="size-full object-contain" /> : <Dumbbell className="text-primary" size={26} />}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent">
              <ImagePlus size={16}/>{previewUrl ? "Replace logo" : "Upload logo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={pickLogo} />
            </label>
            {previewUrl && <Button type="button" variant="outline" onClick={() => { setLogoDataUrl(""); setClearLogo(true); }}><Trash2 size={15}/>Remove logo</Button>}
          </div>
          <p className="w-full text-xs text-muted-foreground">PNG, JPG, or WebP. Maximum file size: 2 MB.</p>
        </div>
      </div>

      <fieldset>
        <legend className="form-label">Color theme</legend>
        <p className="mb-3 text-xs text-muted-foreground">Choose the accent colors used across the admin and member app. Changes apply after you save.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Color theme">
          {THEMES.map((theme) => <label key={theme.id} className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${selectedTheme === theme.id ? "border-primary bg-secondary" : "border-border hover:bg-muted/50"}`}>
            <input type="radio" name="colorTheme" value={theme.id} checked={selectedTheme === theme.id} onChange={() => setSelectedTheme(theme.id)} className="peer sr-only" />
            <span className="grid size-9 shrink-0 place-items-center rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-ring" style={{ backgroundColor: theme.color, color: theme.foreground }}><span className="text-sm font-bold">A</span></span>
            <span><span className="block text-sm font-semibold">{theme.name}</span><span className="mt-1 flex gap-1" aria-hidden="true">{[theme.color, theme.foreground, "var(--secondary)"].map((color, index) => <span key={index} className="size-3 rounded-full border border-border/70" style={{ backgroundColor: color }} />)}</span></span>
          </label>)}
        </div>
      </fieldset>

      <label className="block max-w-md">
        <span className="form-label">Gym country</span>
        <select name="country" value={selectedCountry} onChange={(event) => {
          const country = GYM_COUNTRIES.find((item) => item.code === event.target.value);
          if (!country) return;
          setSelectedCountry(country.code);
          setSelectedCurrency(country.currency);
          if (country.code !== "IN" && selectedGateway === "razorpay") setSelectedGateway("stripe");
          if (country.code === "IN" && selectedGateway === "razorpay") setSelectedCurrency("INR");
        }} className="form-input">
          {GYM_COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
        </select>
      </label>

      <label className="block max-w-md">
        <span className="form-label">Billing currency</span>
        <select name="currency" value={selectedCurrency} onChange={(event) => setSelectedCurrency(event.target.value as CurrencyCode)} disabled={selectedGateway === "razorpay"} className="form-input">
          {CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.name} ({currency.code})</option>)}
        </select>
        <span className="mt-1 block text-xs text-muted-foreground">New plan prices, coupons, and payments use this currency. Changing it reinterprets existing numeric plan and flat-coupon values without converting them; review prices before switching. Historical payments keep their recorded currency.</span>
      </label>

      <label className="block max-w-md">
        <span className="form-label">Member payment gateway</span>
        <select name="paymentGateway" value={selectedGateway} onChange={(event) => {
          const gateway = event.target.value as "razorpay" | "stripe";
          setSelectedGateway(gateway);
          if (gateway === "razorpay") setSelectedCurrency("INR");
        }} className="form-input">
          <option value="razorpay" disabled={selectedCountry !== "IN"}>Razorpay{selectedCountry === "IN" ? " (recommended for India)" : " (India only; select Stripe outside India)"}</option>
          <option value="stripe">Stripe</option>
        </select>
        {selectedGateway === "stripe" && <span className="mt-1 block text-xs text-muted-foreground">Configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and APP_URL in the server environment. Register {"/api/stripe-webhook"} in Stripe for checkout.session.completed and checkout.session.async_payment_succeeded events.</span>}
      </label>

      <label className="block">
        <span className="form-label">Web app title</span>
        <input name="appTitle" required minLength={2} maxLength={100} defaultValue={settings.data.app_title} className="form-input" />
        <span className="mt-1 block text-xs text-muted-foreground">Shown as the browser tab title when an app page is open.</span>
      </label>

      {(error || message) && <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-destructive" : "text-success"}`}>{error || message}</p>}
      <div className="flex justify-end border-t border-border pt-5">
        <Button disabled={busy}>{busy ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}Save settings</Button>
      </div>
    </form>
  </section>;
}
