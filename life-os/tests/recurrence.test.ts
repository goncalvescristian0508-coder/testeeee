import { describe, expect, it } from "vitest";
import { describeRule, expandOccurrences, expandRuleDates, nextOccurrence } from "@/lib/recurrence";
import { localToIso } from "@/lib/dates";

const TZ = "America/Sao_Paulo";

describe("expandRuleDates", () => {
  it("diário a cada 15 dias (cortar cabelo)", () => {
    const dates = expandRuleDates("2026-10-01", { freq: "daily", interval: 15 }, "2026-10-01", "2026-12-01");
    expect(dates).toEqual(["2026-10-01", "2026-10-16", "2026-10-31", "2026-11-15", "2026-11-30"]);
  });

  it("diário com intervalo alinha quando a janela começa depois do início", () => {
    const dates = expandRuleDates("2026-10-01", { freq: "daily", interval: 15 }, "2026-11-01", "2026-11-30");
    expect(dates).toEqual(["2026-11-15", "2026-11-30"]);
  });

  it("semanal toda sexta (faxina geral)", () => {
    const dates = expandRuleDates("2026-10-02", { freq: "weekly", by_weekday: [5] }, "2026-10-01", "2026-10-31");
    expect(dates).toEqual(["2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"]);
  });

  it("semanal com vários dias e intervalo 2", () => {
    const dates = expandRuleDates("2026-10-05", { freq: "weekly", interval: 2, by_weekday: [1, 3] }, "2026-10-01", "2026-10-31");
    expect(dates).toEqual(["2026-10-05", "2026-10-07", "2026-10-19", "2026-10-21"]);
  });

  it("mensal no dia 31 cai no último dia em meses curtos", () => {
    const dates = expandRuleDates("2026-01-31", { freq: "monthly", by_monthday: 31 }, "2026-01-01", "2026-04-30");
    expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("respeita until e count", () => {
    expect(expandRuleDates("2026-10-01", { freq: "daily", until: "2026-10-03" }, "2026-10-01", "2026-10-31")).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(expandRuleDates("2026-10-01", { freq: "daily", count: 2 }, "2026-10-01", "2026-10-31")).toEqual(["2026-10-01", "2026-10-02"]);
    // count conta desde o início mesmo se a janela começa depois
    expect(expandRuleDates("2026-10-01", { freq: "daily", count: 3 }, "2026-10-02", "2026-10-31")).toEqual(["2026-10-02", "2026-10-03"]);
  });

  it("anual", () => {
    expect(expandRuleDates("2024-02-29", { freq: "yearly" }, "2024-01-01", "2027-12-31")).toEqual(["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28"]);
  });

  it("nunca gera datas antes do início", () => {
    expect(expandRuleDates("2026-10-10", { freq: "weekly", by_weekday: [1, 5] }, "2026-10-01", "2026-10-20")).toEqual(["2026-10-12", "2026-10-16", "2026-10-19"]);
  });
});

describe("expandOccurrences", () => {
  const base = { id: "e1", start_at: localToIso("2026-10-02", "09:00", TZ), end_at: localToIso("2026-10-02", "10:30", TZ) };

  it("mantém a hora local em cada ocorrência (inclusive após mudança de mês)", () => {
    const occ = expandOccurrences([{ ...base, rule: { freq: "weekly", by_weekday: [5] } }], "2026-10-01", "2026-11-15", TZ);
    expect(occ.map((o) => o.originalDate)).toEqual(["2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30", "2026-11-06", "2026-11-13"]);
    for (const o of occ) {
      expect(o.start_at).toBe(localToIso(o.originalDate, "09:00", TZ));
      expect(new Date(o.end_at).getTime() - new Date(o.start_at).getTime()).toBe(90 * 60000);
    }
  });

  it("evento sem regra aparece uma vez e só dentro do intervalo", () => {
    expect(expandOccurrences([{ ...base, rule: null }], "2026-10-01", "2026-10-31", TZ)).toHaveLength(1);
    expect(expandOccurrences([{ ...base, rule: null }], "2026-10-03", "2026-10-31", TZ)).toHaveLength(0);
  });

  it("aplica exceção de pular", () => {
    const occ = expandOccurrences([{ ...base, rule: { freq: "weekly", by_weekday: [5] }, exceptions: [{ original_date: "2026-10-09", kind: "skip" }] }], "2026-10-01", "2026-10-16", TZ);
    expect(occ.map((o) => o.originalDate)).toEqual(["2026-10-02", "2026-10-16"]);
  });

  it("aplica exceção de remarcação e ordena pelo novo horário", () => {
    const moved = localToIso("2026-10-10", "15:00", TZ);
    const occ = expandOccurrences([{ ...base, rule: { freq: "weekly", by_weekday: [5] }, exceptions: [{ original_date: "2026-10-09", kind: "moved", new_start_at: moved, new_end_at: localToIso("2026-10-10", "16:00", TZ) }] }], "2026-10-01", "2026-10-16", TZ);
    const m = occ.find((o) => o.originalDate === "2026-10-09")!;
    expect(m.moved).toBe(true);
    expect(m.start_at).toBe(moved);
    expect(occ.map((o) => o.originalDate)).toEqual(["2026-10-02", "2026-10-09", "2026-10-16"]);
  });

  it("remarcação para fora do intervalo some da lista e para dentro aparece", () => {
    const occ = expandOccurrences([{ ...base, rule: null, exceptions: [{ original_date: "2026-10-02", kind: "moved", new_start_at: localToIso("2026-11-02", "09:00", TZ), new_end_at: localToIso("2026-11-02", "10:00", TZ) }] }], "2026-10-01", "2026-10-31", TZ);
    expect(occ).toHaveLength(0);
  });

  it("evento noturno perto da meia-noite fica no dia local correto", () => {
    const night = { id: "n", start_at: localToIso("2026-10-05", "23:30", TZ), end_at: localToIso("2026-10-06", "00:30", TZ), rule: { freq: "daily" as const } };
    const occ = expandOccurrences([night], "2026-10-05", "2026-10-06", TZ);
    expect(occ.map((o) => o.originalDate)).toEqual(["2026-10-05", "2026-10-06"]);
    expect(occ[0].start_at).toBe("2026-10-06T02:30:00.000Z");
  });

  it("nextOccurrence encontra a próxima a partir de um instante", () => {
    const n = nextOccurrence([{ ...base, rule: { freq: "weekly", by_weekday: [5] } }], localToIso("2026-10-09", "11:00", TZ), TZ);
    expect(n?.originalDate).toBe("2026-10-16");
  });
});

describe("describeRule", () => {
  it("descreve em português", () => {
    expect(describeRule(null)).toBe("Não se repete");
    expect(describeRule({ freq: "daily", interval: 15 })).toBe("A cada 15 dias");
    expect(describeRule({ freq: "weekly", by_weekday: [5] })).toBe("Toda semana (sex)");
    expect(describeRule({ freq: "monthly", by_monthday: 10, until: "2026-12-31" })).toBe("Todo mês no dia 10 até 31/12/2026");
  });
});
