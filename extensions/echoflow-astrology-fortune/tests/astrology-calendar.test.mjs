import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
    getChineseZodiacForGregorianYear,
    getSunSign,
    parseBirthDate,
} from "../src/api/modules/astrology-fortune/services/astrology-calendar.ts";

const serviceSource = readFileSync(
    new URL("../src/api/modules/astrology-fortune/services/astrology-fortune.service.ts", import.meta.url),
    "utf8",
);

const signBoundaries = [
    ["水瓶座", "1990-01-20", "摩羯座", "水瓶座", "水瓶座"],
    ["双鱼座", "1990-02-19", "水瓶座", "双鱼座", "双鱼座"],
    ["白羊座", "1990-03-21", "双鱼座", "白羊座", "白羊座"],
    ["金牛座", "1990-04-20", "白羊座", "金牛座", "金牛座"],
    ["双子座", "1990-05-21", "金牛座", "双子座", "双子座"],
    ["巨蟹座", "1990-06-22", "双子座", "巨蟹座", "巨蟹座"],
    ["狮子座", "1990-07-23", "巨蟹座", "狮子座", "狮子座"],
    ["处女座", "1990-08-23", "狮子座", "处女座", "处女座"],
    ["天秤座", "1990-09-23", "处女座", "天秤座", "天秤座"],
    ["天蝎座", "1990-10-24", "天秤座", "天蝎座", "天蝎座"],
    ["射手座", "1990-11-23", "天蝎座", "射手座", "射手座"],
    ["摩羯座", "1990-12-22", "射手座", "摩羯座", "摩羯座"],
];

function shiftDate(date, offset) {
    const parsed = parseBirthDate(date);
    const daysInMonth = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
    if (offset === -1 && parsed.day > 1) {
        return `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day - 1).padStart(2, "0")}`;
    }
    if (offset === 1 && parsed.day < daysInMonth) {
        return `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day + 1).padStart(2, "0")}`;
    }
    throw new Error("test fixture must use a non-month-boundary date");
}

describe("astrology calendar facts", () => {
    it("uses strict calendar dates and never delegates parsing to Date", () => {
        for (const value of [
            "",
            "0000-02-29",
            "1990-1-02",
            "1990-01-2",
            "1990/01/02",
            "1990-01-02T00:00:00Z",
            "1990-01-02+08:00",
            "1990-02-30",
            "1991-02-29",
        ]) {
            assert.throws(() => parseBirthDate(value), /出生日期必须是有效的 YYYY-MM-DD/);
        }
        assert.deepEqual(parseBirthDate("2000-02-29"), { year: 2000, month: 2, day: 29 });
        assert.match(serviceSource, /parseBirthDate/);
        assert.doesNotMatch(serviceSource, /new Date\(date\)/);
        assert.doesNotMatch(serviceSource, /getMonth\(\)|getDate\(\)/);
    });

    it("returns the expected sign before, on, and after every boundary date", () => {
        for (const [, boundary, before, on, after] of signBoundaries) {
            assert.equal(getSunSign(shiftDate(boundary, -1)), before);
            assert.equal(getSunSign(boundary), on);
            assert.equal(getSunSign(shiftDate(boundary, 1)), after);
        }
    });

    it("uses Gregorian year zodiac semantics without lunar-new-year switching", () => {
        assert.equal(getChineseZodiacForGregorianYear("1990-01-01"), "马");
        assert.equal(getChineseZodiacForGregorianYear("1990-12-31"), "马");
        assert.equal(getChineseZodiacForGregorianYear("2024-01-01"), "龙");
        assert.equal(getChineseZodiacForGregorianYear("2024-12-31"), "龙");
    });
});
