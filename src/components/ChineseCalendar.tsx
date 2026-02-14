'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  subMonths,
  addMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Lunar, Solar } from 'lunar-typescript';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar as CalendarIcon,
  Gift,
  Briefcase,
  Loader2,
  AlertCircle,
  Github,
  Settings,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getHolidayInfo, type HolidayInfo, initializeHolidays, getHolidaysData, refreshHolidays, getCacheTime } from '@/lib/holidays';

// 常量配置
const WEEKDAYS_SUNDAY = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAYS_MONDAY = ['一', '二', '三', '四', '五', '六', '日'];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 201 }, (_, i) => 1900 + i);
const CHINESE_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

// 布局尺寸常量
const LAYOUT = {
  calendarWidth: 520,
  calendarHeight: 420,
  sidebarWidth: 150,
  gap: 4,
};

// 设置存储键
const SETTINGS_KEY = 'chinese-calendar-settings';
const REFRESH_COOLDOWN = 10 * 60 * 1000; // 10分钟冷却时间

interface Settings {
  weekStartsOn: 0 | 1; // 0 = 周日, 1 = 周一
  showTooltip: boolean; // 是否显示日期气泡
  scrollMode: 'month' | 'week'; // 滚动切换模式
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  holidayInfo: HolidayInfo;
  lunarDay: string;
  lunarMonth: string;
  lunarText: string;
  isLunarFestival: boolean;
  lunarFestivalName: string;
}

// 获取农历完整信息
function getFullLunarInfo(date: Date) {
  const solar = Solar.fromDate(date);
  const lunar = solar.getLunar();

  const festivals = lunar.getFestivals();
  const lunarFestivalName = festivals.length > 0 ? festivals[0] : '';
  const jieQi = lunar.getJieQi();

  let nineInfo = '';
  const prevJieQi = lunar.getPrevJieQi(false);
  if (prevJieQi?.getName() === '冬至') {
    const dongZhiSolar = prevJieQi.getSolar();
    const diffDays = Math.floor((solar.getTime() - dongZhiSolar.getTime()) / (24 * 60 * 60 * 1000));
    const nineNum = Math.floor(diffDays / 9) + 1;
    if (nineNum >= 1 && nineNum <= 9) {
      nineInfo = `${CHINESE_NUMBERS[nineNum - 1]}九天`;
    }
  }

  return {
    lunarDay: lunar.getDayInChinese(),
    lunarMonth: lunar.getMonthInChinese(),
    lunarFestivalName,
    jieQi,
    yearGanZhi: lunar.getYearInGanZhi(),
    yearShengXiao: lunar.getYearShengXiao(),
    monthGanZhi: lunar.getMonthInGanZhi(),
    dayGanZhi: lunar.getDayInGanZhi(),
    nineInfo,
  };
}

// 获取农历显示文本
function getLunarInfo(date: Date) {
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

// 加载设置
function loadSettings(): Settings {
  if (typeof window === 'undefined') return { weekStartsOn: 0, showTooltip: false, scrollMode: 'month' };
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 确保所有字段都有默认值
      return {
        weekStartsOn: parsed.weekStartsOn ?? 0,
        showTooltip: parsed.showTooltip ?? false,
        scrollMode: parsed.scrollMode ?? 'month',
      };
    }
  } catch {
    // ignore
  }
  return { weekStartsOn: 0, showTooltip: false, scrollMode: 'month' };
}

// 保存设置
function saveSettings(settings: Settings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function ChineseCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [hasHolidayData, setHasHolidayData] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLimitToast, setShowLimitToast] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const [settings, setSettings] = useState<Settings>({ weekStartsOn: 0, showTooltip: false, scrollMode: 'month' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
  const [cacheTime, setCacheTime] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const { theme, setTheme } = useTheme();
  const currentDateRef = useRef(currentDate);
  const wheelAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    currentDateRef.current = currentDate;
  }, [currentDate]);

  // 客户端挂载
  useEffect(() => {
    setMounted(true);
    setSettings(loadSettings());
    setCacheTime(getCacheTime());
  }, []);

  // 加载节假日数据 - 只在初始化时加载一次
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        await initializeHolidays();
        const holidays = getHolidaysData();
        setHasHolidayData(holidays.length > 0);
        setCacheTime(getCacheTime());
      } catch (error) {
        console.error('Failed to load holidays:', error);
        setHasHolidayData(false);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // 显示边界提示
  const showLimitAlert = useCallback((message: string) => {
    setLimitMessage(message);
    setShowLimitToast(true);
    setTimeout(() => setShowLimitToast(false), 2000);
  }, []);

  // 导航函数
  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  }, []);

  const goToPrevYear = useCallback(() => {
    const current = currentDateRef.current;
    if (current.getFullYear() <= 1900) {
      showLimitAlert('已到达最小年份 1900 年');
      return;
    }
    setCurrentDate(new Date(current.getFullYear() - 1, current.getMonth(), 1));
  }, [showLimitAlert]);

  const goToNextYear = useCallback(() => {
    const current = currentDateRef.current;
    if (current.getFullYear() >= 2100) {
      showLimitAlert('已到达最大年份 2100 年');
      return;
    }
    setCurrentDate(new Date(current.getFullYear() + 1, current.getMonth(), 1));
  }, [showLimitAlert]);

  const goToPrevMonth = useCallback(() => {
    const current = currentDateRef.current;
    const newDate = subMonths(current, 1);
    if (newDate.getFullYear() < 1900) {
      showLimitAlert('已到达最小日期 1900年1月');
      return;
    }
    setCurrentDate(newDate);
  }, [showLimitAlert]);

  const goToNextMonth = useCallback(() => {
    const current = currentDateRef.current;
    const newDate = addMonths(current, 1);
    if (newDate.getFullYear() > 2100) {
      showLimitAlert('已到达最大日期 2100年12月');
      return;
    }
    setCurrentDate(newDate);
  }, [showLimitAlert]);

  const goToPrevWeek = useCallback(() => {
    const current = currentDateRef.current;
    const newDate = new Date(current.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (newDate.getFullYear() < 1900) {
      showLimitAlert('已到达最小日期 1900年1月');
      return;
    }
    setCurrentDate(newDate);
  }, [showLimitAlert]);

  const goToNextWeek = useCallback(() => {
    const current = currentDateRef.current;
    const newDate = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (newDate.getFullYear() > 2100) {
      showLimitAlert('已到达最大日期 2100年12月');
      return;
    }
    setCurrentDate(newDate);
  }, [showLimitAlert]);

  // 滚轮切换处理函数
  const handleWheelChange = useCallback((e: WheelEvent) => {
    if (isSelectOpen || isSettingsOpen) return;
    e.preventDefault();
    if (settings.scrollMode === 'week') {
      if (e.deltaY > 0) {
        goToNextWeek();
      } else {
        goToPrevWeek();
      }
    } else {
      if (e.deltaY > 0) {
        goToNextMonth();
      } else {
        goToPrevMonth();
      }
    }
  }, [goToNextMonth, goToPrevMonth, goToNextWeek, goToPrevWeek, isSelectOpen, isSettingsOpen, settings.scrollMode]);

  // 使用原生事件监听器处理滚轮（非被动模式）
  // 只有在加载完成后才绑定事件
  useEffect(() => {
    if (isLoading) return;
    
    const area = wheelAreaRef.current;
    if (!area) return;

    area.addEventListener('wheel', handleWheelChange, { passive: false });
    return () => {
      area.removeEventListener('wheel', handleWheelChange);
    };
  }, [isLoading, handleWheelChange]);

  const handleYearChange = useCallback((year: string) => {
    setCurrentDate(prev => new Date(parseInt(year), prev.getMonth(), 1));
  }, []);

  const handleMonthChange = useCallback((month: string) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), parseInt(month) - 1, 1));
  }, []);

  // 刷新节假日数据
  const handleRefreshHolidays = useCallback(async () => {
    const now = Date.now();
    if (lastRefreshTime && now - lastRefreshTime < REFRESH_COOLDOWN) {
      const remaining = Math.ceil((REFRESH_COOLDOWN - (now - lastRefreshTime)) / 1000);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      if (minutes > 0) {
        showLimitAlert(`请等待 ${minutes}分${seconds}秒后再刷新`);
      } else {
        showLimitAlert(`请等待 ${seconds}秒后再刷新`);
      }
      return;
    }

    setIsRefreshing(true);
    try {
      await refreshHolidays();
      const holidays = getHolidaysData();
      setHasHolidayData(holidays.length > 0);
      setCacheTime(getCacheTime());
      setLastRefreshTime(now);
      showLimitAlert('✓ 已刷新');
    } catch (error) {
      console.error('Failed to refresh holidays:', error);
      showLimitAlert('刷新失败，请稍后重试');
    } finally {
      setIsRefreshing(false);
    }
  }, [lastRefreshTime, showLimitAlert]);

  // 更新设置
  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  }, []);

  // 生成日历数据
  const calendarDays = useMemo(() => {
    let startDate: Date;
    
    if (settings.scrollMode === 'week') {
      // 周模式：以当前日期所在周为中心，向前2周，向后3周（共6周）
      const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: settings.weekStartsOn });
      startDate = addDays(currentWeekStart, -14); // 向前2周
    } else {
      // 月模式：显示当前月份
      const monthStart = startOfMonth(currentDate);
      startDate = startOfWeek(monthStart, { weekStartsOn: settings.weekStartsOn });
    }

    return Array.from({ length: 42 }, (_, i) => {
      const day = addDays(startDate, i);
      const lunarInfo = getLunarInfo(day);
      return {
        date: day,
        isCurrentMonth: isSameMonth(day, currentDate),
        holidayInfo: getHolidayInfo(day),
        ...lunarInfo,
      };
    });
  }, [currentDate, hasHolidayData, settings.weekStartsOn, settings.scrollMode]);

  // 按周分组
  const weeks = useMemo(() => {
    const result: CalendarDay[][] = [];
    for (let i = 0; i < 42; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  // 当前月份节假日列表
  const monthHolidays = useMemo(() => {
    if (!hasHolidayData) return [];
    return calendarDays
      .filter(day => day.isCurrentMonth && (day.holidayInfo.isHoliday || day.holidayInfo.isWorkday))
      .map(day => ({ date: day.date, info: day.holidayInfo }));
  }, [calendarDays, hasHolidayData]);

  // 星期头部
  const weekdays = settings.weekStartsOn === 1 ? WEEKDAYS_MONDAY : WEEKDAYS_SUNDAY;

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // 格式化缓存时间
  const formatCacheTime = (timestamp: number | null) => {
    if (!timestamp) return '未知';
    const date = new Date(timestamp);
    return format(date, 'MM-dd HH:mm');
  };

  // 加载状态
  if (isLoading) {
    const containerWidth = LAYOUT.calendarWidth + LAYOUT.sidebarWidth + 6 + 8; // gap-1.5(6px) + p-1(8px)
    const containerHeight = LAYOUT.calendarHeight + 8; // p-1(8px)
    
    return (
      <div className="w-full flex justify-center">
        <div
          className="relative flex items-center justify-center"
          style={{ width: containerWidth, height: containerHeight }}
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">加载节假日数据...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <div className="relative select-none">
        {/* 边界提示 Toast - fixed定位确保显示在最上层 */}
        {showLimitToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-100 rounded-lg shadow-lg border border-amber-200 dark:border-amber-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{limitMessage}</span>
            </div>
          </div>
        )}

        <div className="flex gap-1.5 items-start p-1">
          {/* 日历主区域 */}
          <div 
            ref={wheelAreaRef}
            className="shrink-0 calendar-wheel-area"
          >
            <Card
              className="p-0 flex flex-col"
              style={{ width: LAYOUT.calendarWidth, height: LAYOUT.calendarHeight }}
            >
              <CardHeader className="pb-1 pt-2 px-3">
                {/* 导航栏 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={goToPrevYear} title="上一年" className="h-8 w-8">
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={goToPrevMonth} title="上一月" className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={String(currentYear)}
                      onValueChange={handleYearChange}
                      onOpenChange={setIsSelectOpen}
                    >
                      <SelectTrigger className="w-[100px] h-8">
                        <SelectValue placeholder="年份" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[150px] overflow-y-auto">
                        {YEARS.map(year => (
                          <SelectItem key={year} value={String(year)}>{year} 年</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={String(currentMonth)}
                      onValueChange={handleMonthChange}
                      onOpenChange={setIsSelectOpen}
                    >
                      <SelectTrigger className="w-[90px] h-8">
                        <SelectValue placeholder="月份" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[150px] overflow-y-auto">
                        {MONTHS.map(month => (
                          <SelectItem key={month} value={String(month)}>{month} 月</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={goToToday}
                      className="h-8 px-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                    >
                      今天
                    </Button>

                    {/* 设置 */}
                    <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Settings className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-2" align="end" sideOffset={5}>
                        <div className="space-y-2 text-xs">
                          {/* 节假日数据 */}
                          <div className="flex items-center justify-between">
                            <span className="font-medium">节假日数据</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">{formatCacheTime(cacheTime)}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-5 w-5 p-0"
                                onClick={handleRefreshHolidays}
                                disabled={isRefreshing}
                                title="刷新数据（10分钟一次）"
                              >
                                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                              </Button>
                            </div>
                          </div>

                          {/* 周起始日 */}
                          <div className="pt-1.5 border-t border-border/50">
                            <p className="font-medium mb-1">每周起始日</p>
                            <div className="flex gap-1">
                              <Button
                                variant={settings.weekStartsOn === 0 ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-6 text-[10px]"
                                onClick={() => updateSettings({ weekStartsOn: 0 })}
                              >
                                周日
                              </Button>
                              <Button
                                variant={settings.weekStartsOn === 1 ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-6 text-[10px]"
                                onClick={() => updateSettings({ weekStartsOn: 1 })}
                              >
                                周一
                              </Button>
                            </div>
                          </div>

                          {/* 主题 */}
                          {mounted && (
                            <div className="pt-1.5 border-t border-border/50">
                              <p className="font-medium mb-1">主题</p>
                              <div className="grid grid-cols-3 gap-1">
                                <Button
                                  variant={theme === 'light' ? 'default' : 'outline'}
                                  size="sm"
                                  className="h-6 text-[10px] px-1"
                                  onClick={() => setTheme('light')}
                                >
                                  <Sun className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant={theme === 'dark' ? 'default' : 'outline'}
                                  size="sm"
                                  className="h-6 text-[10px] px-1"
                                  onClick={() => setTheme('dark')}
                                >
                                  <Moon className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant={theme === 'system' ? 'default' : 'outline'}
                                  size="sm"
                                  className="h-6 text-[10px] px-1"
                                  onClick={() => setTheme('system')}
                                >
                                  <Monitor className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* 气泡提示 */}
                          <div className="pt-1.5 border-t border-border/50">
                            <p className="font-medium mb-1">日期气泡</p>
                            <div className="flex gap-1">
                              <Button
                                variant={settings.showTooltip ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-6 text-[10px]"
                                onClick={() => updateSettings({ showTooltip: true })}
                              >
                                显示
                              </Button>
                              <Button
                                variant={!settings.showTooltip ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-6 text-[10px]"
                                onClick={() => updateSettings({ showTooltip: false })}
                              >
                                隐藏
                              </Button>
                            </div>
                          </div>

                          {/* 滚动切换 */}
                          <div className="pt-1.5 border-t border-border/50">
                            <p className="font-medium mb-1">滚动切换</p>
                            <div className="flex gap-1">
                              <Button
                                variant={settings.scrollMode === 'month' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-6 text-[10px]"
                                onClick={() => updateSettings({ scrollMode: 'month' })}
                              >
                                月
                              </Button>
                              <Button
                                variant={settings.scrollMode === 'week' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-6 text-[10px]"
                                onClick={() => updateSettings({ scrollMode: 'week' })}
                              >
                                周
                              </Button>
                            </div>
                          </div>

                          {/* 关于 */}
                          <div className="pt-1.5 border-t border-border/50 flex items-center justify-between">
                            <span className="font-medium">关于</span>
                            <a
                              href="https://github.com/WongSilver"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Github className="h-3 w-3" />
                              <span className="text-[10px]">GitHub</span>
                            </a>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="icon" onClick={goToNextMonth} title="下一月" className="h-8 w-8">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={goToNextYear} title="下一年" className="h-8 w-8">
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-3 pb-2 pt-0 flex-1 flex flex-col overflow-hidden">
                {/* 星期头部 */}
                <div className="grid grid-cols-7 mb-0.5 shrink-0">
                  {weekdays.map((day, index) => {
                    // 判断是否是周末
                    const isWeekend = settings.weekStartsOn === 1 
                      ? (index === 5 || index === 6)  // 周一开始：周六、周日是红色
                      : (index === 0 || index === 6); // 周日开始：周日、周六是红色
                    return (
                      <div
                        key={day}
                        className={`text-center py-0.5 text-sm font-medium ${
                          isWeekend ? 'text-red-500' : 'text-muted-foreground'
                        }`}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>

                {/* 日历格子 */}
                <div className="grid grid-cols-7 gap-1 flex-1">
                  {weeks.map((week, weekIndex) =>
                    week.map((day, dayIndex) => {
                      const isSelected = isSameDay(day.date, selectedDate);
                      const isCurrentDay = isToday(day.date);
                      const { holidayInfo, lunarText, isLunarFestival } = day;

                      // 判断是否是周末
                      const dayOfWeek = day.date.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                      const bgClass = isCurrentDay
                        ? 'bg-primary/20'
                        : holidayInfo.isHoliday
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : holidayInfo.isWorkday
                            ? 'bg-orange-100 dark:bg-orange-900/30'
                            : '';

                      const textClass = holidayInfo.isHoliday
                        ? 'text-red-600 dark:text-red-300'
                        : holidayInfo.isWorkday
                          ? 'text-orange-600 dark:text-orange-300'
                          : isWeekend && day.isCurrentMonth
                            ? 'text-red-500 dark:text-red-300'
                            : '';

                      const borderClass = isCurrentDay
                        ? 'ring-2 ring-primary'
                        : isSelected
                          ? 'ring-2 ring-primary ring-offset-1'
                          : '';

                      return settings.showTooltip ? (
                        <TooltipProvider key={`${weekIndex}-${dayIndex}`}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setSelectedDate(day.date)}
                                className={`
                                  relative p-0.5 h-[48px] rounded-lg transition-all duration-200
                                  hover:scale-105 hover:shadow-md cursor-pointer
                                  ${day.isCurrentMonth ? 'opacity-100' : 'opacity-30'}
                                  ${bgClass} ${textClass} ${borderClass}
                                  flex flex-col items-center justify-start
                                `}
                              >
                                <span className={`text-xs font-semibold ${isCurrentDay ? 'text-primary' : ''}`}>
                                  {format(day.date, 'd')}
                                </span>
                                <span className={`text-[9px] mt-0.5 ${isLunarFestival ? 'text-purple-600 dark:text-purple-300 font-medium' : 'text-muted-foreground'}`}>
                                  {lunarText}
                                </span>
                                {hasHolidayData && holidayInfo.name && day.isCurrentMonth && (
                                  <span className="text-[8px] truncate max-w-full px-0.5 mt-0.5">
                                    {holidayInfo.name}
                                  </span>
                                )}
                                {hasHolidayData && day.isCurrentMonth && (
                                  holidayInfo.isHoliday ? (
                                    <Gift className="absolute top-0.5 right-0.5 h-2 w-2 text-red-500 dark:text-red-300" />
                                  ) : holidayInfo.isWorkday ? (
                                    <Briefcase className="absolute top-0.5 right-0.5 h-2 w-2 text-orange-500 dark:text-orange-300" />
                                  ) : null
                                )}
                              </button>
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
                                {(!hasHolidayData || !holidayInfo.name) && isWeekend && (
                                  <p className="text-sm mt-1">周末休息</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <button
                          key={`${weekIndex}-${dayIndex}`}
                          onClick={() => setSelectedDate(day.date)}
                          className={`
                            relative p-0.5 h-[48px] rounded-lg transition-all duration-200
                            hover:scale-105 hover:shadow-md cursor-pointer
                            ${day.isCurrentMonth ? 'opacity-100' : 'opacity-30'}
                            ${bgClass} ${textClass} ${borderClass}
                            flex flex-col items-center justify-start
                          `}
                        >
                          <span className={`text-xs font-semibold ${isCurrentDay ? 'text-primary' : ''}`}>
                            {format(day.date, 'd')}
                          </span>
                          <span className={`text-[9px] mt-0.5 ${isLunarFestival ? 'text-purple-600 dark:text-purple-300 font-medium' : 'text-muted-foreground'}`}>
                            {lunarText}
                          </span>
                          {hasHolidayData && holidayInfo.name && day.isCurrentMonth && (
                            <span className="text-[8px] truncate max-w-full px-0.5 mt-0.5">
                              {holidayInfo.name}
                            </span>
                          )}
                          {hasHolidayData && day.isCurrentMonth && (
                            holidayInfo.isHoliday ? (
                              <Gift className="absolute top-0.5 right-0.5 h-2 w-2 text-red-500 dark:text-red-300" />
                            ) : holidayInfo.isWorkday ? (
                              <Briefcase className="absolute top-0.5 right-0.5 h-2 w-2 text-orange-500 dark:text-orange-300" />
                            ) : null
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

              </CardContent>
            </Card>
          </div>

          {/* 侧边栏 */}
          <div
            className="shrink-0 flex flex-col gap-1.5 overflow-hidden"
            style={{ width: LAYOUT.sidebarWidth, height: LAYOUT.calendarHeight }}
          >
            {/* 日期详情卡片 */}
            <Card className="shrink-0 p-0">
              <CardHeader className="pb-0.5 pt-2 px-3">
                <CardTitle className="text-base">{format(selectedDate, 'M月d日')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 pb-2 px-3">
                {(() => {
                  const fullLunar = getFullLunarInfo(selectedDate);
                  const holidayInfo = getHolidayInfo(selectedDate);

                  return (
                    <>
                      <p className="text-base font-semibold text-purple-600 dark:text-purple-300">
                        {fullLunar.lunarMonth}月{fullLunar.lunarDay}
                        {fullLunar.jieQi && <span className="text-orange-500 dark:text-orange-300 ml-1">· {fullLunar.jieQi}</span>}
                      </p>
                      <p className="text-xs text-foreground">{fullLunar.yearGanZhi}年 {fullLunar.yearShengXiao}</p>
                      <p className="text-xs text-muted-foreground">{fullLunar.monthGanZhi}月 {fullLunar.dayGanZhi}日</p>
                      {fullLunar.nineInfo && (
                        <p className="text-xs text-blue-600 dark:text-blue-300">{fullLunar.nineInfo}</p>
                      )}
                      {fullLunar.lunarFestivalName && (
                        <p className="text-xs text-orange-600 dark:text-orange-300">🎉 {fullLunar.lunarFestivalName}</p>
                      )}
                      {hasHolidayData && (
                        <div className="pt-0.5">
                          {holidayInfo.name ? (
                            <Badge className={`${holidayInfo.isHoliday ? 'bg-red-500' : 'bg-orange-500'} text-[10px]`}>
                              {holidayInfo.isHoliday ? '🎉 ' : '💼 '}
                              {holidayInfo.name}
                              {holidayInfo.isWorkday ? '（调休）' : ''}
                            </Badge>
                          ) : holidayInfo.isWeekend ? (
                            <Badge variant="outline" className="text-[10px]">周末休息</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">工作日</Badge>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* 本月节假日 */}
            {hasHolidayData && (
              <Card className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden">
                <CardHeader className="pb-0.5 pt-2 px-3 shrink-0">
                  <CardTitle className="text-sm flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    本月假期
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto overflow-x-hidden pb-3 px-3 pt-0 min-h-0 scrollbar-hide">
                  <div className="space-y-1 pb-1">
                    {monthHolidays.length > 0 ? (
                      monthHolidays.map(({ date, info }, index) => {
                        const lunarInfo = getLunarInfo(date);
                        return (
                          <div
                            key={index}
                            className={`p-1.5 rounded text-[10px] ${
                              info.isHoliday
                                ? 'bg-red-50 dark:bg-red-900/20'
                                : 'bg-orange-50 dark:bg-orange-900/20'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{format(date, 'M/d')}</span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] h-4 ${
                                  info.isHoliday
                                    ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-300'
                                    : 'border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-300'
                                }`}
                              >
                                {info.isHoliday ? '假期' : '调休'}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground truncate">{info.name}</p>
                            <p className="text-purple-600 dark:text-purple-300">
                              农历 {lunarInfo.lunarMonth}月{lunarInfo.lunarDay}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[10px] text-muted-foreground text-center py-4">本月没有假期安排</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
