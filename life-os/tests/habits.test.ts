import { describe, expect, it } from "vitest";
import { completionRate, computeStreaks, dayStatus, isScheduled, scheduleFor, weeklyCount } from "@/lib/habits";

const habit = { id: "h1", start_date: "2026-10-01", status: "active" as const, kind: "boolean" as const, target_value: null };
const daily = [{ frequency: "daily" as const, weekdays: [0, 1, 2, 3, 4, 5, 6], times_per_week: null, effective_from: "2026-10-01", effective_to: null }];
const weekdaysOnly = [{ frequency: "weekdays" as const, weekdays: [1, 2, 3, 4, 5], times_per_week: null, effective_from: "2026-10-01", effective_to: null }];
const done = (date: string) => ({ habit_id: "h1", date, status: "done" as const, value: null });
const skipped = (date: string) => ({ habit_id: "h1", date, status: "skipped" as const, value: null });

describe("programação", () => {
  it("não está programado antes da data de início", () => {
    expect(isScheduled(habit, daily, "2026-09-30")).toBe(false);
    expect(isScheduled(habit, daily, "2026-10-01")).toBe(true);
  });
  it("dias da semana: fim de semana não conta", () => {
    expect(isScheduled(habit, weekdaysOnly, "2026-10-03")).toBe(false); // sábado
    expect(isScheduled(habit, weekdaysOnly, "2026-10-05")).toBe(true); // segunda
  });
  it("histórico de programação: usa a regra vigente na data", () => {
    const sch = [
      { frequency: "daily" as const, weekdays: [0, 1, 2, 3, 4, 5, 6], times_per_week: null, effective_from: "2026-10-01", effective_to: "2026-10-10" },
      { frequency: "weekdays" as const, weekdays: [1], times_per_week: null, effective_from: "2026-10-11", effective_to: null },
    ];
    expect(scheduleFor(sch, "2026-10-05")?.frequency).toBe("daily");
    expect(scheduleFor(sch, "2026-10-11")?.frequency).toBe("weekdays");
    expect(isScheduled(habit, sch, "2026-10-13")).toBe(false); // terça após a troca
    expect(isScheduled(habit, sch, "2026-10-12")).toBe(true); // segunda
  });
});

describe("dayStatus", () => {
  it("classifica corretamente", () => {
    expect(dayStatus(habit, weekdaysOnly, undefined, "2026-10-03", "2026-10-10")).toBe("not_scheduled");
    expect(dayStatus(habit, daily, undefined, "2026-10-05", "2026-10-10")).toBe("missed");
    expect(dayStatus(habit, daily, undefined, "2026-10-10", "2026-10-10")).toBe("pending");
    expect(dayStatus(habit, daily, undefined, "2026-10-11", "2026-10-10")).toBe("not_scheduled");
    expect(dayStatus(habit, daily, done("2026-10-05"), "2026-10-05", "2026-10-10")).toBe("done");
    expect(dayStatus(habit, daily, skipped("2026-10-05"), "2026-10-05", "2026-10-10")).toBe("skipped");
  });
  it("hábito por quantidade só conta se atingir a meta", () => {
    const qty = { ...habit, kind: "quantity" as const, target_value: 10 };
    expect(dayStatus(qty, daily, { habit_id: "h1", date: "2026-10-05", status: "done", value: 4 }, "2026-10-05", "2026-10-10")).toBe("missed");
    expect(dayStatus(qty, daily, { habit_id: "h1", date: "2026-10-05", status: "done", value: 10 }, "2026-10-05", "2026-10-10")).toBe("done");
  });
});

describe("sequências", () => {
  it("dias não programados não quebram a sequência", () => {
    // seg-sex programados; feito seg 05, ter 06 … sex 09, nada no fim de semana, feito seg 12
    const comps = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12"].map(done);
    expect(computeStreaks(habit, weekdaysOnly, comps, "2026-10-12").current).toBe(6);
  });
  it("dia justificado não quebra nem conta", () => {
    const comps = [done("2026-10-05"), done("2026-10-06"), skipped("2026-10-07"), done("2026-10-08")];
    expect(computeStreaks(habit, daily, comps, "2026-10-08").current).toBe(3);
  });
  it("dia perdido zera a sequência atual mas mantém a maior", () => {
    const comps = [done("2026-10-01"), done("2026-10-02"), done("2026-10-03"), done("2026-10-06")];
    const s = computeStreaks(habit, daily, comps, "2026-10-06");
    expect(s.current).toBe(1);
    expect(s.longest).toBe(3);
  });
  it("hoje pendente não quebra a sequência", () => {
    const comps = [done("2026-10-05"), done("2026-10-06")];
    expect(computeStreaks(habit, daily, comps, "2026-10-07").current).toBe(2);
  });
});

describe("taxas", () => {
  it("ignora dias não programados e justificados", () => {
    const comps = [done("2026-10-05"), skipped("2026-10-06"), done("2026-10-08")];
    // semana 05–09 (seg–sex), hoje 10 (sáb): programados = 05,07,08,09 (06 justificado) → 2 de 4
    const r = completionRate(habit, weekdaysOnly, comps, "2026-10-05", "2026-10-11", "2026-10-10");
    expect(r).toEqual({ scheduled: 4, done: 2, skipped: 1, rate: 50 });
  });
  it("weeklyCount conta conclusões na semana", () => {
    const comps = [done("2026-10-05"), done("2026-10-07"), done("2026-10-12")];
    expect(weeklyCount("h1", comps, "2026-10-08", 1)).toBe(2);
  });
});
