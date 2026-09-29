import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock3, Loader2, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdminDashboardData } from "@/components/admin-dashboard-data";
import { formatGymDate, gymDateTimeToUtc } from "@/lib/gym-time";

type ClassOption = { id: string; name: string; category: string; default_capacity: number; duration_minutes: number };
type CoachOption = { id: string; name: string };

export function ClassesAdmin({ timeZone, todayKey, currency }: { timeZone: string; todayKey: string; currency: string }) {
  const queryClient = useQueryClient();
  const [scheduleDate, setScheduleDate] = useState(todayKey);
  const dashboard = useAdminDashboardData(timeZone, scheduleDate, currency);
  const templates = useQuery({
    queryKey: ["admin-classes", "templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name, category, default_capacity, duration_minutes").eq("active", true).order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const coaches = useQuery({
    queryKey: ["admin-classes", "coaches"],
    queryFn: async (): Promise<CoachOption[]> => {
      const { data: trainerRows, error } = await supabase.from("trainers").select("id, profile_id").eq("active", true);
      if (error) throw new Error(error.message);
      if (!trainerRows?.length) return [];
      const { data: profiles, error: profileError } = await supabase.from("profiles").select("id, display_name").in("id", trainerRows.map((trainer) => trainer.profile_id));
      if (profileError) throw new Error(profileError.message);
      const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
      return trainerRows.map((trainer) => ({ id: trainer.id, name: profileNames.get(trainer.profile_id) || "Coach" }));
    },
  });

  const [classId, setClassId] = useState("");
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selectedClass = templates.data?.find((item) => item.id === classId) ?? templates.data?.[0];

  useEffect(() => {
    if (!classId && templates.data?.[0]) setClassId(templates.data[0].id);
  }, [classId, templates.data]);

  useEffect(() => {
    if (scheduleDate < todayKey) setScheduleDate(todayKey);
  }, [scheduleDate, todayKey]);

  async function scheduleClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClass) return setError("Add an active class type before scheduling a session.");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const startTime = String(form.get("startTime"));
    const startsAt = gymDateTimeToUtc(scheduleDate, startTime, timeZone);
    if (startsAt.getTime() < Date.now()) return setError("Choose a start time that has not passed yet.");
    const endsAt = new Date(startsAt.getTime() + selectedClass.duration_minutes * 60_000);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: insertError } = await supabase.from("class_schedules").insert({
        class_id: selectedClass.id,
        trainer_id: String(form.get("coachId")) || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        capacity: Number(form.get("capacity")),
        status: "scheduled",
      });
      if (insertError) setError(insertError.message);
      else {
      setMessage(`${selectedClass.name} scheduled for ${formatGymDate(startsAt, timeZone)}.`);
      formElement.reset();
      setCapacity("");
      await queryClient.invalidateQueries({ queryKey: ["admin-live", "dashboard"] });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not schedule this class.");
    } finally {
      setBusy(false);
    }
  }

  const sessions = dashboard.data?.todayClasses ?? [];
  const totalBookings = sessions.reduce((total, item) => total + item.booked, 0);

  return <div className="space-y-5">
    <section className="panel p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div><h2 className="section-title">Schedule a class</h2><p className="section-subtitle">Sessions are saved for one date and do not repeat. Choose a date to manage its schedule.</p></div>
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"><CalendarDays size={15}/>{sessions.length} sessions · {totalBookings} booked</span>
      </div>
      {templates.isError && <p role="alert" className="mb-4 text-sm text-destructive">{templates.error instanceof Error ? templates.error.message : "Could not load class types."}</p>}
      {templates.data?.length === 0 && <p className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">There are no active class types to schedule.</p>}
      <form onSubmit={scheduleClass} className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr_0.8fr_1fr_auto]">
        <label><span className="form-label">Schedule date</span><input name="scheduleDate" type="date" min={todayKey} value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} required className="form-input" /></label>
        <label><span className="form-label">Class type</span><select name="classId" value={selectedClass?.id ?? ""} onChange={(event) => { setClassId(event.target.value); setCapacity(""); }} required disabled={!templates.data?.length} className="form-input">{templates.data?.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}</select></label>
        <label><span className="form-label">Start time</span><input name="startTime" type="time" required className="form-input" /></label>
        <label><span className="form-label">Capacity</span><input name="capacity" type="number" min={1} max={500} required value={capacity || selectedClass?.default_capacity || ""} onChange={(event) => setCapacity(event.target.value)} className="form-input" /></label>
        <label><span className="form-label">Coach <span className="font-normal text-muted-foreground">(optional)</span></span><select name="coachId" className="form-input"><option value="">Assign later</option>{coaches.data?.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}</select></label>
        <Button disabled={busy || !selectedClass}>{busy ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>}Schedule</Button>
      </form>
      {selectedClass && <p className="mt-2 text-xs text-muted-foreground">Session length: {selectedClass.duration_minutes} minutes.</p>}
      {(error || message) && <p role={error ? "alert" : "status"} className={`mt-3 text-sm ${error ? "text-destructive" : "text-success"}`}>{error || message}</p>}
    </section>

    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="section-title">{scheduleDate === todayKey ? "Today’s schedule" : "Daily schedule"}</h2><p className="section-subtitle">{formatGymDate(gymDateTimeToUtc(scheduleDate, "12:00", timeZone), timeZone)} · Sessions do not repeat automatically.</p></div>{dashboard.isFetching && <Loader2 size={17} className="animate-spin text-muted-foreground" aria-label="Refreshing schedule"/>}</div>
      {dashboard.isError && <p role="alert" className="px-5 pb-5 text-sm text-destructive">{dashboard.error instanceof Error ? dashboard.error.message : "Could not load today’s schedule."}</p>}
      {sessions.length > 0 ? <div className="divide-y divide-border">{sessions.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex w-24 items-center gap-2 font-display text-lg font-bold"><Clock3 size={16} className="text-primary"/>{item.time}</div>
        <div className="min-w-48 flex-1"><p className="font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{item.coach} · {item.duration} min</p></div>
        <div className="flex items-center gap-2 text-sm"><Users size={16} className="text-muted-foreground"/><span>{item.booked}/{item.capacity} booked</span></div>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.booked / item.capacity * 100)}%` }} /></div>
      </div>)}</div> : !dashboard.isError && <p className="px-5 pb-6 text-sm text-muted-foreground">No classes scheduled for today yet.</p>}
    </section>
  </div>;
}
