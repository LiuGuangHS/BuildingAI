const SUN_SIGN_NAMES = ["摩羯座", "水瓶座", "双鱼座", "白羊座", "金牛座", "双子座", "巨蟹座", "狮子座", "处女座", "天秤座", "天蝎座", "射手座", "摩羯座"] as const;
const SUN_SIGN_BOUNDARIES = [20, 19, 21, 20, 21, 22, 23, 23, 23, 24, 23, 22] as const;
const GREGORIAN_YEAR_ZODIACS = ["猴", "鸡", "狗", "猪", "鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊"] as const;

export interface BirthDateParts {
    year: number;
    month: number;
    day: number;
}

export function parseBirthDate(value: string): BirthDateParts {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error("出生日期必须是有效的 YYYY-MM-DD");
    }

    const [year, month, day] = value.split("-").map(Number);
    if (year < 1) throw new Error("出生日期必须是有效的 YYYY-MM-DD");
    const daysInMonth = getDaysInMonth(year, month);
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth) {
        throw new Error("出生日期必须是有效的 YYYY-MM-DD");
    }

    return { year, month, day };
}

function getDaysInMonth(year: number, month: number): number {
    if (month < 1 || month > 12) return 0;
    if (month === 2) return isLeapYear(year) ? 29 : 28;
    return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function getSunSign(value: string): string {
    const { month, day } = parseBirthDate(value);
    const boundary = SUN_SIGN_BOUNDARIES[month - 1];
    return SUN_SIGN_NAMES[day < boundary ? month - 1 : month];
}

export function getChineseZodiacForGregorianYear(value: string): string {
    const { year } = parseBirthDate(value);
    return GREGORIAN_YEAR_ZODIACS[year % 12];
}
