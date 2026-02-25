'use client';

import { memo } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getDayCellStyles, DATE_FONT_CONFIGS, type CalendarDay, type FontSize } from '@/lib/calendar';

interface CalendarDayCellProps {
  day: CalendarDay;
  isSelected: boolean;
  isCurrentDay: boolean;
  hasHolidayData: boolean;
  showTooltip: boolean;
  dateFontSize: FontSize;
  onSelect: (date: Date) => void;
}

export const CalendarDayCell = memo(function CalendarDayCell({
  day,
  isSelected,
  isCurrentDay,
  hasHolidayData,
  showTooltip,
  dateFontSize,
  onSelect,
}: CalendarDayCellProps) {
  const { holidayInfo, lunarText, isLunarFestival, isCurrentMonth } = day;
  const { bgClass, textClass, borderClass } = getDayCellStyles(day, isSelected, isCurrentDay);
  const fontConfig = DATE_FONT_CONFIGS[dateFontSize];

  const cellContent = (
    <button
      onClick={() => onSelect(day.date)}
      className={`
        relative p-1 h-[52px] rounded-lg transition-all duration-150
        hover:scale-105 cursor-pointer
        ${isSelected ? '' : 'hover:shadow-md'}
        ${bgClass} ${textClass} ${borderClass}
        flex flex-col items-center justify-start
        ${isCurrentMonth ? 'opacity-100' : 'opacity-45'}
      `}
    >
      <span className={`${fontConfig.date} font-bold ${isCurrentDay ? 'text-primary' : ''}`}>
        {format(day.date, 'd')}
      </span>
      <span className={`${fontConfig.lunar} leading-tight ${isLunarFestival ? 'text-purple-600 dark:text-purple-300 font-medium' : 'text-muted-foreground'}`}>
        {lunarText}
      </span>
      {hasHolidayData && fontConfig.showHolidayName && holidayInfo.name && (
        <span className="text-[7px] leading-tight text-center w-full truncate px-0.5">
          {holidayInfo.name}
        </span>
      )}
      {hasHolidayData && (
        holidayInfo.isHoliday ? (
          <span className="absolute top-0.5 right-0.5 text-[8px] font-bold text-red-500 dark:text-red-300">假</span>
        ) : holidayInfo.isWorkday ? (
          <span className="absolute top-0.5 right-0.5 text-[8px] font-bold text-orange-500 dark:text-orange-300">班</span>
        ) : null
      )}
    </button>
  );

  if (!showTooltip) {
    return cellContent;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {cellContent}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="text-center">
          <p className="font-medium">{format(day.date, 'yyyy年M月d日 EEEE', { locale: zhCN })}</p>
          <p className="text-sm text-muted-foreground">
            农历 {day.lunarMonth}月{day.lunarDay}
            {day.lunarFestivalName && ` · ${day.lunarFestivalName}`}
          </p>
          {hasHolidayData && holidayInfo.name && (
            <p className="text-sm mt-1">
              {holidayInfo.isHoliday ? '🎉 ' : '💼 '}
              {holidayInfo.name}
              {holidayInfo.isWorkday ? '（调休上班）' : ''}
            </p>
          )}
          {(!hasHolidayData || !holidayInfo.name) && holidayInfo.isWeekend && (
            <p className="text-sm mt-1">周末休息</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});
