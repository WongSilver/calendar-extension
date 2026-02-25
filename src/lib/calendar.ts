import { Lunar, Solar } from 'lunar-typescript';
import type { HolidayInfo } from './holidays';

// 常量定义
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
export const YEARS = Array.from({ length: 201 }, (_, i) => 1900 + i);
export const CHINESE_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

// 日期范围限制
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

// 布局尺寸
export const LAYOUT = {
  calendarWidth: 520,
  calendarHeight: 430,
  sidebarWidth: 150,
  gap: 4,
} as const;

// 侧边栏模块高度
export const SIDEBAR_HEIGHTS = {
  dateDetail: 155,
  stats: 142,
  nextHoliday: 125,
} as const;

// 字号类型
export type FontSize = 'sm' | 'base' | 'lg';

// 侧边栏字号配置
export const SIDEBAR_FONT_CONFIGS: Record<FontSize, {
  dateDetail_lunar: string;
  dateDetail_text: string;
  dateDetail_small: string;
  stats_text: string;
  nextHoliday_name: string;
  nextHoliday_days: string;
  nextHoliday_date: string;
}> = {
  sm: {
    dateDetail_lunar: 'text-xs',
    dateDetail_text: 'text-[9px]',
    dateDetail_small: 'text-[8px]',
    stats_text: 'text-[9px]',
    nextHoliday_name: 'text-sm',
    nextHoliday_days: 'text-[10px]',
    nextHoliday_date: 'text-[9px]',
  },
  base: {
    dateDetail_lunar: 'text-sm',
    dateDetail_text: 'text-[10px]',
    dateDetail_small: 'text-[9px]',
    stats_text: 'text-[10px]',
    nextHoliday_name: 'text-base',
    nextHoliday_days: 'text-xs',
    nextHoliday_date: 'text-[10px]',
  },
  lg: {
    dateDetail_lunar: 'text-base',
    dateDetail_text: 'text-xs',
    dateDetail_small: 'text-[10px]',
    stats_text: 'text-xs',
    nextHoliday_name: 'text-lg',
    nextHoliday_days: 'text-sm',
    nextHoliday_date: 'text-xs',
  },
};

// 日历格子字号配置
export const DATE_FONT_CONFIGS: Record<FontSize, {
  date: string;
  lunar: string;
  showHolidayName: boolean;
}> = {
  sm: {
    date: 'text-base',
    lunar: 'text-[8px]',
    showHolidayName: true,
  },
  base: {
    date: 'text-lg',
    lunar: 'text-[8px]',
    showHolidayName: false,
  },
  lg: {
    date: 'text-xl',
    lunar: 'text-[10px]',
    showHolidayName: false,
  },
};

// 类型定义
export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  holidayInfo: HolidayInfo;
  lunarDay: string;
  lunarMonth: string;
  lunarText: string;
  isLunarFestival: boolean;
  lunarFestivalName: string;
}

export interface FullLunarInfo {
  lunarDay: string;
  lunarMonth: string;
  lunarFestivalName: string;
  jieQi: string;
  yearGanZhi: string;
  yearShengXiao: string;
  monthGanZhi: string;
  dayGanZhi: string;
  nineInfo: string;
}

// 获取农历完整信息
export function getFullLunarInfo(date: Date): FullLunarInfo {
  const solar = Solar.fromDate(date);
  const lunar = solar.getLunar();

  const lunarDay = lunar.getDayInChinese();
  const lunarMonth = lunar.getMonthInChinese();

  const festivals = lunar.getFestivals();
  const lunarFestivalName = festivals.length > 0 ? festivals[0] : '';
  const jieQi = lunar.getJieQi();

  const yearGanZhi = lunar.getYearInGanZhi();
  const yearShengXiao = lunar.getYearShengXiao();
  const monthGanZhi = lunar.getMonthInGanZhi();
  const dayGanZhi = lunar.getDayInGanZhi();

  // 数九信息
  let nineInfo = '';
  const prevJieQi = lunar.getPrevJieQi(false);
  if (prevJieQi?.getName() === '冬至') {
    const dongZhiSolar = prevJieQi.getSolar();
    const dongZhiDate = new Date(dongZhiSolar.getYear(), dongZhiSolar.getMonth() - 1, dongZhiSolar.getDay());
    const diffDays = Math.floor((date.getTime() - dongZhiDate.getTime()) / (24 * 60 * 60 * 1000));
    const nineNum = Math.floor(diffDays / 9) + 1;
    if (nineNum >= 1 && nineNum <= 9) {
      nineInfo = `${CHINESE_NUMBERS[nineNum - 1]}九天`;
    }
  }

  return {
    lunarDay,
    lunarMonth,
    lunarFestivalName,
    jieQi,
    yearGanZhi,
    yearShengXiao,
    monthGanZhi,
    dayGanZhi,
    nineInfo,
  };
}

// 获取农历显示信息
export function getLunarInfo(date: Date): Omit<CalendarDay, 'date' | 'isCurrentMonth' | 'holidayInfo'> {
  const solar = Solar.fromDate(date);
  const lunar = solar.getLunar();

  const lunarDay = lunar.getDayInChinese();
  const lunarMonth = lunar.getMonthInChinese();
  const festivals = lunar.getFestivals();
  const lunarFestivalName = festivals.length > 0 ? festivals[0] : '';
  const jieQi = lunar.getJieQi();

  let lunarText = lunarDay;
  if (lunarDay === '初一') lunarText = lunarMonth + '月';
  if (lunarFestivalName) lunarText = lunarFestivalName;
  if (jieQi) lunarText = jieQi;

  return {
    lunarDay,
    lunarMonth,
    lunarText,
    isLunarFestival: !!lunarFestivalName || !!jieQi,
    lunarFestivalName,
  };
}

// 获取日期格子样式
export function getDayCellStyles(
  day: CalendarDay,
  isSelected: boolean,
  isCurrentDay: boolean
): { bgClass: string; textClass: string; borderClass: string } {
  const { holidayInfo } = day;

  let bgClass = '';
  let textClass = '';
  let borderClass = '';

  // 背景色和文字色
  if (holidayInfo.isHoliday) {
    bgClass = 'bg-red-100 dark:bg-red-900/30';
    textClass = 'text-red-600 dark:text-red-300';
  } else if (holidayInfo.isWorkday) {
    bgClass = 'bg-orange-100 dark:bg-orange-900/30';
    textClass = 'text-orange-600 dark:text-orange-300';
  } else if (isCurrentDay) {
    bgClass = 'bg-primary/20';
  } else if (holidayInfo.isWeekend) {
    textClass = 'text-red-500 dark:text-red-300';
  }

  // 边框 - 选中状态优先，其次是今天
  borderClass = isSelected
    ? 'border-2 border-primary'
    : isCurrentDay
      ? 'border border-gray-400 dark:border-gray-500'
      : 'border border-transparent';

  return { bgClass, textClass, borderClass };
}
