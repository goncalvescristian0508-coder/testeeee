import { describe, expect, it } from "vitest";
import { circularDiffMinutes, consistency, sleepMetrics, windDownTime } from "@/lib/sleep";
import { nextDueDate, choreState } from "@/lib/home";
import { weeklySummary } from "@/lib/stats";
import { localToIso } from "@/lib/dates";

const TZ = "America/Sao_Paulo";

describe("sono", () => {
  it("diferencia tempo na cama de tempo dormindo", () => {
    const log = { date: "2026-10-22", bed_at: localToIso("2026-10-21", "23:00", TZ), asleep_at: localToIso("2026-10-21", "23:30", TZ), wake_at: localToIso("2026-10-22", "07:00", TZ), quality: 4 };
    const m = sleepMetrics(log);
    expect(m.timeInBedMin).toBe(480);
    expect(m.asleepMin).toBe(450);
    expect(m.latencyMin).toBe(30);
    expect(m.hasAsleepData).toBe(true);
  });
  it("sem horário de adormecer, usa tempo na cama", () => {
    const m = sleepMetrics({ date: "2026-10-22", bed_at: localToIso("2026-10-21", "23:00", TZ), asleep_at: null, wake_at: localToIso("2026-10-22", "06:00", TZ), quality: null });
    expect(m.asleepMin).toBe(420);
    expect(m.hasAsleepData).toBe(false);
  });
  it("diferença circular de horários e desacelerar", () => {
    expect(circularDiffMinutes("23:50", "00:10")).toBe(20);
    expect(windDownTime("00:15", 30)).toBe("23:45");
    const c = consistency([{ date: "2026-10-22", bed_at: localToIso("2026-10-21", "23:20", TZ), asleep_at: null, wake_at: localToIso("2026-10-22", "07:10", TZ), quality: null }], { bedtime: "23:00", wake_time: "07:00" }, TZ);
    expect(c).toEqual({ bedDeviation: 20, wakeDeviation: 10 });
  });
});

describe("casa", () => {
  it("calcula próxima data com periodicidade e dia preferido", () => {
    expect(nextDueDate("2026-10-16", 7, null, "2026-10-20")).toBe("2026-10-23");
    expect(nextDueDate("2026-10-16", 7, 5, "2026-10-20")).toBe("2026-10-23"); // já é sexta
    expect(nextDueDate("2026-10-16", 10, 5, "2026-10-20")).toBe("2026-10-30"); // 26 (seg) → próxima sexta
    expect(nextDueDate(null, 7, null, "2026-10-20")).toBe("2026-10-20");
  });
  it("estado da tarefa doméstica", () => {
    expect(choreState("2026-10-19", "2026-10-20")).toBe("overdue");
    expect(choreState("2026-10-20", "2026-10-20")).toBe("today");
    expect(choreState("2026-10-22", "2026-10-20")).toBe("soon");
    expect(choreState("2026-11-01", "2026-10-20")).toBe("later");
  });
});

describe("resumo semanal determinístico", () => {
  const habit = { id: "h1", name: "Ler", start_date: "2026-10-01", status: "active" as const, kind: "boolean" as const, target_value: null };
  const sch = [{ frequency: "daily" as const, weekdays: [0, 1, 2, 3, 4, 5, 6], times_per_week: null, effective_from: "2026-10-01", effective_to: null }];
  it("detecta melhora e sugere manter o plano", () => {
    // semana anterior 12–18: 2 de 7; semana atual 19–22 (até quinta): 4 de 4
    const comps = ["2026-10-12", "2026-10-13", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map((d) => ({ habit_id: "h1", date: d, status: "done" as const, value: null }));
    const s = weeklySummary({ bundles: [{ habit, schedules: sch, completions: comps }], tasks: [], focus: [], sleep: [], screen: [], today: "2026-10-22", tz: TZ, weekStartsOn: 1 });
    expect(s.current.habitRate).toBe(100);
    expect(s.previous.habitRate).toBe(29);
    expect(s.improved[0]).toContain("Hábitos concluídos");
    expect(s.suggestion).toContain("Semana sólida");
  });
  it("prioriza hábito inconsistente na sugestão e lista adiamentos", () => {
    const comps = [{ habit_id: "h1", date: "2026-10-12", status: "done" as const, value: null }];
    const s = weeklySummary({ bundles: [{ habit, schedules: sch, completions: comps }], tasks: [{ title: "Documentos", status: "pending", completed_at: null, due_date: "2026-10-20", postponed_count: 3 }], focus: [], sleep: [], screen: [], today: "2026-10-22", tz: TZ, weekStartsOn: 1 });
    expect(s.inconsistentHabits[0]?.name).toBe("Ler");
    expect(s.postponed[0]).toEqual({ title: "Documentos", count: 3 });
    expect(s.suggestion).toContain("Ler");
  });
});
