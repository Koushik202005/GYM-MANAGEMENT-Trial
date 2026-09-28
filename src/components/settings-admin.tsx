import { useState, type FormEvent, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dumbbell, ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGymSettings, saveGymSettings } from "@/lib/gym.functions";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      <p className="section-subtitle">Update the name, logo, and browser tab title used throughout the web app.</p>
    </div>

    <form key={`${settings.data.gym_name}:${settings.data.app_title}:${settings.data.logo_url ?? ""}`} onSubmit={submit} className="space-y-6">
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
