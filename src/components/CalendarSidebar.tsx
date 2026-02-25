'use client';

import { memo, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { BarChart3, Timer, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getFullLunarInfo, LAYOUT, SIDEBAR_HEIGHTS, SIDEBAR_FONT_CONFIGS, type FontSize } from '@/lib/calendar';
import { getHolidayInfo, type HolidayInfo, getHolidaysData } from '@/lib/holidays';

interface CalendarSidebarProps {
  currentDate: Date;
  selectedDate: Date;
  hasHolidayData: boolean;
  holidayInfo: HolidayInfo;
  dateFontSize: FontSize;
  onNavigate?: (date: Date) => void;
}

interface MonthStats {
  workdays: number;
  restDays: number;
  holidays: number;
  workdaysAdjusted: number;
}

interface NextHoliday {
  name: string;
  daysLeft: number;
  dateRange: string;
  startDate: Date; // 用于跳转
}

// 计算月度统计
function calculateMonthStats(currentDate: Date, hasHolidayData: boolean): MonthStats {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let workdays = 0, restDays = 0, holidays = 0, workdaysAdjusted = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const info = getHolidayInfo(new Date(year, month, day));

    if (hasHolidayData) {
      if (info.isHoliday) { holidays++; restDays++; }
      else if (info.isWorkday) { workdaysAdjusted++; workdays++; }
      else if (info.isWeekend) restDays++;
      else workdays++;
    } else {
      if (info.isWeekend) restDays++;
      else workdays++;
    }
  }

  return { workdays, restDays, holidays, workdaysAdjusted };
}

// 获取所有未来假期
function getFutureHolidays(): NextHoliday[] {
  const holidays = getHolidaysData();
  if (!holidays.length) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 按假期名称分组
  const holidayMap = new Map<string, string[]>();

  holidays
    .filter(h => h.type === 'holiday' && new Date(h.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach(h => {
      const dates = holidayMap.get(h.name) || [];
      dates.push(h.date);
      holidayMap.set(h.name, dates);
    });

  if (!holidayMap.size) return [];

  const result: NextHoliday[] = [];
  const DAY_MS = 1000 * 60 * 60 * 24;

  holidayMap.forEach((dates, name) => {
    const startDate = new Date(dates[0] + 'T00:00:00');
    const daysLeft = Math.ceil((startDate.getTime() - today.getTime()) / DAY_MS);
    const start = dates[0];
    const end = dates[dates.length - 1];

    result.push({
      name,
      daysLeft,
      dateRange: start === end
        ? format(new Date(start), 'M.d')
        : `${format(new Date(start), 'M.d')}-${format(new Date(end), 'M.d')}`,
      startDate,
    });
  });

  return result.sort((a, b) => a.daysLeft - b.daysLeft);
}

// 日期详情模块
const DateDetailCard = memo(function DateDetailCard({
  selectedDate,
  hasHolidayData,
  holidayInfo,
  fontSize,
}: {
  selectedDate: Date;
  hasHolidayData: boolean;
  holidayInfo: HolidayInfo;
  fontSize: typeof SIDEBAR_FONT_CONFIGS[FontSize];
}) {
  const fullLunar = getFullLunarInfo(selectedDate);

  return (
    <Card className="shrink-0 p-0" style={{ height: SIDEBAR_HEIGHTS.dateDetail }}>
      <CardHeader className="pb-0 pt-1 px-2">
        <CardTitle className="text-sm">{format(selectedDate, 'M月d日')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 pb-1 px-2 pt-0 overflow-hidden">
        <p className={`${fontSize.dateDetail_lunar} font-semibold text-purple-600 dark:text-purple-300 truncate`}>
          {fullLunar.lunarMonth}月{fullLunar.lunarDay}
          {fullLunar.jieQi && <span className="text-orange-500 dark:text-orange-300 ml-0.5">· {fullLunar.jieQi}</span>}
        </p>
        <p className={`${fontSize.dateDetail_text} text-foreground truncate`}>{fullLunar.yearGanZhi}年 {fullLunar.yearShengXiao}</p>
        <p className={`${fontSize.dateDetail_text} text-muted-foreground truncate`}>{fullLunar.monthGanZhi}月 {fullLunar.dayGanZhi}日</p>
        {fullLunar.nineInfo && (
          <p className={`${fontSize.dateDetail_text} text-blue-600 dark:text-blue-300 truncate`}>{fullLunar.nineInfo}</p>
        )}
        {fullLunar.lunarFestivalName && (
          <p className={`${fontSize.dateDetail_text} text-orange-600 dark:text-orange-300 truncate`}>🎉 {fullLunar.lunarFestivalName}</p>
        )}
        {hasHolidayData && (
          <div className="pt-0.5">
            {holidayInfo.name ? (
              <Badge className={`${holidayInfo.isHoliday ? 'bg-red-500' : 'bg-orange-500'} ${fontSize.dateDetail_small} h-4 px-1`}>
                {holidayInfo.isHoliday ? '🎉 ' : '💼 '}
                {holidayInfo.name}
                {holidayInfo.isWorkday ? '（调休）' : ''}
              </Badge>
            ) : holidayInfo.isWeekend ? (
              <Badge variant="outline" className={`${fontSize.dateDetail_small} h-4 px-1`}>周末休息</Badge>
            ) : (
              <Badge variant="outline" className={`${fontSize.dateDetail_small} h-4 px-1`}>工作日</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// 统计模块
const StatsCard = memo(function StatsCard({
  stats,
  fontSize,
}: {
  stats: MonthStats;
  fontSize: typeof SIDEBAR_FONT_CONFIGS[FontSize];
}) {
  const statItems = [
    { label: '工作日', value: `${stats.workdays}天`, bgClass: 'bg-muted/50', valueClass: '' },
    { label: '休息日', value: `${stats.restDays}天`, bgClass: 'bg-muted/50', valueClass: 'text-red-500' },
    { label: '假期', value: `${stats.holidays}天`, bgClass: 'bg-red-50 dark:bg-red-900/20', valueClass: 'text-red-600 dark:text-red-300' },
    { label: '调休', value: `${stats.workdaysAdjusted}天`, bgClass: 'bg-orange-50 dark:bg-orange-900/20', valueClass: 'text-orange-600 dark:text-orange-300' },
  ];

  return (
    <Card className="shrink-0 p-0" style={{ height: SIDEBAR_HEIGHTS.stats }}>
      <CardHeader className="pb-0 pt-1 px-2">
        <CardTitle className="text-xs flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          统计
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-1 px-2 pt-0 space-y-0.5 overflow-hidden">
        {statItems.map((item) => (
          <div
            key={item.label}
            className={`flex items-center justify-between px-1.5 py-0.5 rounded ${item.bgClass} ${fontSize.stats_text}`}
          >
            <span className="text-muted-foreground">{item.label}</span>
            <span className={`font-semibold ${item.valueClass}`}>{item.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
});

// 下一假期模块
const NextHolidayCard = memo(function NextHolidayCard({
  holidays,
  currentIndex,
  onPrev,
  onNext,
  onNavigate,
  fontSize,
}: {
  holidays: NextHoliday[];
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onNavigate: (date: Date) => void;
  fontSize: typeof SIDEBAR_FONT_CONFIGS[FontSize];
}) {
  const holiday = holidays[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < holidays.length - 1;

  return (
    <Card className="shrink-0 p-0" style={{ height: SIDEBAR_HEIGHTS.nextHoliday }}>
      <CardHeader className="pb-0 pt-1 px-2">
        <CardTitle className="text-xs flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Timer className="h-3 w-3" />
            <span>节假日</span>
          </div>
          {holidays.length > 1 && (
            <span className="text-[10px] text-muted-foreground">{currentIndex + 1}/{holidays.length}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-0 px-2 pt-0">
        <div className="flex items-center justify-between gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 shrink-0 rounded-full p-0"
            onClick={onPrev}
            disabled={!hasPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-center flex-1 min-w-0 leading-tight">
            <button
              className={`${fontSize.nextHoliday_name} font-bold text-red-600 dark:text-red-300 truncate cursor-pointer hover:text-red-700 dark:hover:text-red-200 transition-colors`}
              onClick={() => onNavigate(holiday.startDate)}
              title="跳转到该月份"
            >
              {holiday.name}
            </button>
            <p className={`${fontSize.nextHoliday_days} text-muted-foreground whitespace-nowrap`}>
              还有 <span className="text-red-500 font-medium">{holiday.daysLeft}</span> 天
            </p>
            <p className={`${fontSize.nextHoliday_date} text-muted-foreground truncate`}>{holiday.dateRange}</p>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 shrink-0 rounded-full p-0"
            onClick={onNext}
            disabled={!hasNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

export const CalendarSidebar = memo(function CalendarSidebar({
  currentDate,
  selectedDate,
  hasHolidayData,
  holidayInfo,
  dateFontSize,
  onNavigate,
}: CalendarSidebarProps) {
  const monthStats = useMemo(() => calculateMonthStats(currentDate, hasHolidayData), [currentDate, hasHolidayData]);
  const futureHolidays = useMemo(() => hasHolidayData ? getFutureHolidays() : [], [hasHolidayData]);
  const [holidayIndex, setHolidayIndex] = useState(0);
  const fontSize = SIDEBAR_FONT_CONFIGS[dateFontSize];

  return (
    <div
      className="shrink-0 flex flex-col gap-1"
      style={{ width: LAYOUT.sidebarWidth, height: LAYOUT.calendarHeight }}
    >
      <DateDetailCard
        selectedDate={selectedDate}
        hasHolidayData={hasHolidayData}
        holidayInfo={holidayInfo}
        fontSize={fontSize}
      />
      <StatsCard stats={monthStats} fontSize={fontSize} />
      {futureHolidays.length > 0 && (
        <NextHolidayCard
          holidays={futureHolidays}
          currentIndex={holidayIndex}
          onPrev={() => setHolidayIndex(i => Math.max(0, i - 1))}
          onNext={() => setHolidayIndex(i => Math.min(futureHolidays.length - 1, i + 1))}
          onNavigate={(date) => onNavigate?.(date)}
          fontSize={fontSize}
        />
      )}
    </div>
  );
});
