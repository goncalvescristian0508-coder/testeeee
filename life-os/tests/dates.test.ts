import { describe, expect, it } from "vitest";
import { addDaysStr, dateRange, localToIso, periodOfTime, startOfWeekStr, toDateStr, toTimeStr, todayStr, weekdayOf, minutesToTime, timeToMinutes } from "@/lib/dates";

const TZ = "America/Sao_Paulo";

describe("datas e fuso horário", () => {
  it("todayStr usa o fuso local, não UTC", () => {
    // 2026-10-22 01:30 UTC = 2026-10-21 22:30 em São Paulo (UTC-3)
    expect(todayStr(TZ, new Date("2026-10-22T01:30:00Z"))).toBe("2026-10-21");
    expect(todayStr("UTC", new Date("2026-10-22T01:30:00Z"))).toBe("2026-10-22");
  });

  it("localToIso converte horário local para UTC corretamente", () => {
    expect(localToIso("2026-10-22", "23:00", TZ)).toBe("2026-10-23T02:00:00.000Z");
    expect(toDateStr("2026-10-23T02:00:00.000Z", TZ)).toBe("2026-10-22");
    expect(toTimeStr("2026-10-23T02:00:00.000Z", TZ)).toBe("23:00");
  });

  it("ida e volta preserva hora local em diferentes datas", () => {
    for (const d of ["2026-01-15", "2026-06-30", "2026-12-31"]) {
      const iso = localToIso(d, "07:45", TZ);
      expect(toDateStr(iso, TZ)).toBe(d);
      expect(toTimeStr(iso, TZ)).toBe("07:45");
    }
  });

  it("addDaysStr atravessa meses e anos", () => {
    expect(addDaysStr("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysStr("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysStr("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("weekdayOf e startOfWeekStr respeitam início da semana", () => {
    expect(weekdayOf("2026-10-22")).toBe(4); // quinta
    expect(startOfWeekStr("2026-10-22", 1)).toBe("2026-10-19"); // segunda
    expect(startOfWeekStr("2026-10-22", 0)).toBe("2026-10-18"); // domingo
  });

  it("dateRange é inclusivo e vazio quando invertido", () => {
    expect(dateRange("2026-10-20", "2026-10-22")).toEqual(["2026-10-20", "2026-10-21", "2026-10-22"]);
    expect(dateRange("2026-10-22", "2026-10-20")).toEqual([]);
  });

  it("periodOfTime classifica manhã/tarde/noite com períodos configuráveis", () => {
    expect(periodOfTime("07:00")).toBe("morning");
    expect(periodOfTime("13:00")).toBe("afternoon");
    expect(periodOfTime("20:00")).toBe("evening");
    expect(periodOfTime("02:00")).toBe("evening");
    expect(periodOfTime("13:00", { morning: "06:00", afternoon: "14:00", evening: "19:00" })).toBe("morning");
  });

  it("minutesToTime/timeToMinutes são inversos e circulares", () => {
    expect(timeToMinutes("23:30")).toBe(1410);
    expect(minutesToTime(1410)).toBe("23:30");
    expect(minutesToTime(1440 + 15)).toBe("00:15");
    expect(minutesToTime(-30)).toBe("23:30");
  });
});
