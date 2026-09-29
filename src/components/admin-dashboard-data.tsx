import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatGymTime, gymDateKey, gymDateStartUtc, shiftDateKey } from "@/lib/gym-time";

export type RevenuePoint = { date: string; day: string; amount: number };
export type TodayClass = { id: string; name: string; coach: string; time: string; duration: number; booked: number; capacity: number };
export type MemberActivity = { id: string; initials: string; name: string; plan: string; status: string; checkin: string };

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function membershipLabel(status: string | undefined, startsOn: string | undefined, endsOn: string | undefined, today: string) {
  if (status === "frozen") return "Frozen";
  if (!status || !startsOn || !endsOn || status !== "active" || startsOn > today || endsOn < today) return "Inactive";
  const expiresSoon = endsOn <= shiftDateKey(today, 7);
  return expiresSoon ? "Expiring" : "Active";
}

export function useAdminDashboardData(timeZone: string, targetDate?: string, currency = "INR") {
  const today = targetDate ?? gymDateKey(new Date(), timeZone);
  return useQuery({
    queryKey: ["admin-live", "dashboard", today, timeZone, currency],
    refetchInterval: 30_000,
    queryFn: async () => {
      const now = new Date();
      const monthStart = `${today.slice(0, 7)}-01`;
      const previousMonthStart = `${shiftDateKey(monthStart, -1).slice(0, 7)}-01`;
      const dayStart = gymDateStartUtc(today, timeZone);
      const tomorrowStart = gymDateStartUtc(shiftDateKey(today, 1), timeZone);

      const [paymentsResult, activeResult, attendanceCountResult, expiringResult, schedulesResult, activityResult] = await Promise.all([
        supabase.from("payments").select("amount, refund_amount, paid_at").eq("currency", currency).in("status", ["verified", "partially_refunded"]).not("paid_at", "is", null).gte("paid_at", gymDateStartUtc(previousMonthStart, timeZone).toISOString()).lte("paid_at", now.toISOString()),
        supabase.from("memberships").select("member_id").eq("status", "active").lte("starts_on", today).gte("ends_on", today),
        supabase.from("attendance").select("id", { count: "exact", head: true }).gte("checked_in_at", dayStart.toISOString()).lt("checked_in_at", tomorrowStart.toISOString()),
        supabase.from("memberships").select("member_id").eq("status", "active").lte("starts_on", today).gte("ends_on", today).lte("ends_on", shiftDateKey(today, 7)),
        supabase.from("class_schedules").select("id, class_id, trainer_id, starts_at, ends_at, capacity").eq("status", "scheduled").gte("starts_at", dayStart.toISOString()).lt("starts_at", tomorrowStart.toISOString()).order("starts_at"),
        supabase.from("attendance").select("id, member_id, checked_in_at").order("checked_in_at", { ascending: false }).limit(6),
      ]);
      fail(paymentsResult.error); fail(activeResult.error); fail(attendanceCountResult.error); fail(expiringResult.error); fail(schedulesResult.error); fail(activityResult.error);

      const points = new Map<string, number>();
      const pointKeys = Array.from({ length: 7 }, (_, index) => shiftDateKey(today, index - 6));
      pointKeys.forEach((key) => points.set(key, 0));
      let monthlyRevenue = 0;
      let previousMonthRevenue = 0;
      for (const payment of paymentsResult.data ?? []) {
        if (!payment.paid_at) continue;
        const date = gymDateKey(new Date(payment.paid_at), timeZone);
        const netAmount = Math.max(0, Number(payment.amount) - Number(payment.refund_amount));
        if (date >= monthStart) monthlyRevenue += netAmount;
        else if (date >= previousMonthStart) previousMonthRevenue += netAmount;
        if (points.has(date)) points.set(date, (points.get(date) ?? 0) + netAmount);
      }
      const revenuePulse: RevenuePoint[] = pointKeys.map((date) => ({
        date,
        day: new Intl.DateTimeFormat("en-IN", { timeZone, weekday: "short" }).format(gymDateStartUtc(date, timeZone)),
        amount: points.get(date) ?? 0,
      }));

      const schedules = schedulesResult.data ?? [];
      const scheduleIds = schedules.map((schedule) => schedule.id);
      const classIds = [...new Set(schedules.map((schedule) => schedule.class_id))];
      const trainerIds = [...new Set(schedules.flatMap((schedule) => schedule.trainer_id ? [schedule.trainer_id] : []))];
      const [classesResult, trainersResult, bookingsResult] = await Promise.all([
        classIds.length ? supabase.from("classes").select("id, name, duration_minutes").in("id", classIds) : Promise.resolve({ data: [], error: null }),
        trainerIds.length ? supabase.from("trainers").select("id, profile_id").in("id", trainerIds) : Promise.resolve({ data: [], error: null }),
        scheduleIds.length ? supabase.from("class_bookings").select("schedule_id").in("schedule_id", scheduleIds).eq("status", "booked") : Promise.resolve({ data: [], error: null }),
      ]);
      fail(classesResult.error); fail(trainersResult.error); fail(bookingsResult.error);
      const classMap = new Map((classesResult.data ?? []).map((item) => [item.id, item]));
      const trainerRows = trainersResult.data ?? [];
      const trainerProfileIds = [...new Set(trainerRows.map((trainer) => trainer.profile_id))];
      const profilesResult = trainerProfileIds.length
        ? await supabase.from("profiles").select("id, display_name").in("id", trainerProfileIds)
        : { data: [], error: null };
      fail(profilesResult.error);
      const profileNameById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));
      const trainerNameById = new Map(trainerRows.map((trainer) => [trainer.id, profileNameById.get(trainer.profile_id) ?? "Coach"]));
      const bookingCountBySchedule = new Map<string, number>();
      for (const booking of bookingsResult.data ?? []) bookingCountBySchedule.set(booking.schedule_id, (bookingCountBySchedule.get(booking.schedule_id) ?? 0) + 1);
      const todayClasses: TodayClass[] = schedules.map((schedule) => ({
        id: schedule.id,
        name: classMap.get(schedule.class_id)?.name ?? "Class",
        coach: schedule.trainer_id ? trainerNameById.get(schedule.trainer_id) ?? "Coach" : "Coach to be assigned",
        time: formatGymTime(schedule.starts_at, timeZone),
        duration: classMap.get(schedule.class_id)?.duration_minutes ?? Math.max(1, Math.round((new Date(schedule.ends_at).getTime() - new Date(schedule.starts_at).getTime()) / 60_000)),
        booked: bookingCountBySchedule.get(schedule.id) ?? 0,
        capacity: schedule.capacity,
      }));

      const attendanceRows = activityResult.data ?? [];
      const memberIds = [...new Set(attendanceRows.map((row) => row.member_id))];
      const membersResult = memberIds.length
        ? await supabase.from("members").select("id, profile_id, member_code, status").in("id", memberIds)
        : { data: [], error: null };
      fail(membersResult.error);
      const memberRows = membersResult.data ?? [];
      const profileIds = [...new Set(memberRows.map((member) => member.profile_id))];
      const [memberProfilesResult, membershipsResult] = await Promise.all([
        profileIds.length ? supabase.from("profiles").select("id, display_name").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
        memberIds.length ? supabase.from("memberships").select("member_id, plan_id, status, starts_on, ends_on").in("member_id", memberIds).order("ends_on", { ascending: false }) : Promise.resolve({ data: [], error: null }),
      ]);
      fail(memberProfilesResult.error); fail(membershipsResult.error);
      type MembershipInfo = NonNullable<typeof membershipsResult.data>[number];
      const memberById = new Map(memberRows.map((member) => [member.id, member]));
      const displayNameByProfile = new Map((memberProfilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));
      const membershipsByMember = new Map<string, MembershipInfo[]>();
      for (const membership of membershipsResult.data ?? []) {
        const list = membershipsByMember.get(membership.member_id) ?? [];
        list.push(membership);
        membershipsByMember.set(membership.member_id, list);
      }
      const planIds = [...new Set((membershipsResult.data ?? []).flatMap((membership) => membership.plan_id ? [membership.plan_id] : []))];
      const plansResult = planIds.length ? await supabase.from("membership_plans").select("id, name").in("id", planIds) : { data: [], error: null };
      fail(plansResult.error);
      const planNameById = new Map((plansResult.data ?? []).map((plan) => [plan.id, plan.name]));
      const memberActivity: MemberActivity[] = attendanceRows.flatMap((row) => {
        const member = memberById.get(row.member_id);
        if (!member) return [];
        const memberName = displayNameByProfile.get(member.profile_id) || member.member_code;
        const latestMembership = membershipsByMember.get(member.id)?.[0];
        return [{
          id: member.id,
          initials: initials(memberName),
          name: memberName,
          plan: latestMembership?.plan_id ? planNameById.get(latestMembership.plan_id) ?? "Membership" : "No membership",
          status: latestMembership ? membershipLabel(latestMembership.status, latestMembership.starts_on, latestMembership.ends_on, today) : "Inactive",
          checkin: `${formatGymTime(row.checked_in_at, timeZone)} · ${new Intl.DateTimeFormat("en-IN", { timeZone, day: "numeric", month: "short" }).format(new Date(row.checked_in_at))}`,
        }];
      });

      return {
        monthlyRevenue,
        previousMonthRevenue,
        revenuePulse,
        weekRevenue: revenuePulse.reduce((total, point) => total + point.amount, 0),
        activeMembers: new Set((activeResult.data ?? []).map((membership) => membership.member_id)).size,
        todayCheckins: attendanceCountResult.count ?? 0,
        expiringMembers: new Set((expiringResult.data ?? []).map((membership) => membership.member_id)).size,
        todayClasses,
        classBookings: todayClasses.reduce((total, item) => total + item.booked, 0),
        memberActivity,
      };
    },
  });
}
