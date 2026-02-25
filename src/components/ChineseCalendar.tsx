'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  addWeeks,
  subMonths,
  addMonths,
  isSameDay,
  isToday,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  AlertCircle,
  Settings,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  Github,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDayCell } from '@/components/CalendarDayCell';
import { CalendarSidebar } from '@/components/CalendarSidebar';
import { getHolidayInfo, initializeHolidays, getHolidaysData, refreshHolidays } from '@/lib/holidays';
import {
  WEEKDAYS,
  MONTHS,
  YEARS,
  LAYOUT,
  MIN_YEAR,
  MAX_YEAR,
  getLunarInfo,
  type CalendarDay,
  type FontSize,
} from '@/lib/calendar';

const SETTINGS_KEY = 'chinese-calendar-settings';
const REFRESH_COOLDOWN = 10 * 60 * 1000;
const DAY_MS = 1000 * 60 * 60 * 24;

interface Settings {
  weekStartsOn: 0 | 1;
  showTooltip: boolean;
  scrollMode: 'month' | 'week';
  dateFontSize: FontSize;
}

const defaultSettings: Settings = {
  weekStartsOn: 0,
  showTooltip: false,
  scrollMode: 'month',
  dateFontSize: 'base',
};

const settingsStorage = {
  load: (): Settings => {
    if (typeof window === 'undefined') return defaultSettings;
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  },
  save: (settings: Settings) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch { /* ignore */ }
    }
  },
};

// 生成日历数据（42天）
function generateCalendarData(startDate: Date, referenceDate: Date): CalendarDay[] {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();

  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(startDate, i);
    const holidayInfo = getHolidayInfo(day);
    const lunarInfo = getLunarInfo(day);
    return {
      date: day,
      isCurrentMonth: day.getFullYear() === refYear && day.getMonth() === refMonth,
      holidayInfo: {
        name: holidayInfo.name,
        isHoliday: holidayInfo.isHoliday,
        isWorkday: holidayInfo.isWorkday,
        isWeekend: holidayInfo.isWeekend,
      },
      ...lunarInfo,
    };
  });
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
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const wheelAreaRef = useRef<HTMLDivElement>(null);
  const wheelLockRef = useRef(false);
  const { theme, setTheme } = useTheme();

  // 初始化
  useEffect(() => {
    setMounted(true);
    setSettings(settingsStorage.load());
  }, []);

  // 加载节假日数据
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        await initializeHolidays();
        setHasHolidayData(getHolidaysData().length > 0);
        setDataVersion(v => v + 1);
      } catch (error) {
        console.error('Failed to load holidays:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 显示提示
  const showAlert = useCallback((message: string) => {
    setLimitMessage(message);
    setShowLimitToast(true);
    setTimeout(() => setShowLimitToast(false), 2000);
  }, []);

  // 年月信息
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // 日历数据
  const calendarData = useMemo(() => {
    const startDate = settings.scrollMode === 'month'
      ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: settings.weekStartsOn })
      : startOfWeek(currentDate, { weekStartsOn: settings.weekStartsOn });
    return generateCalendarData(startDate, currentDate);
  }, [currentDate, settings.weekStartsOn, settings.scrollMode, dataVersion]);

  // 导航
  const navigate = useCallback((direction: 'prev' | 'next', unit: 'year' | 'month' | 'week') => {
    const delta = direction === 'prev' ? -1 : 1;
    let newDate: Date;

    if (unit === 'year') {
      const year = currentDate.getFullYear() + delta;
      if (year < MIN_YEAR || year > MAX_YEAR) {
        showAlert(`已到达${year < MIN_YEAR ? '最小' : '最大'}年份 ${year < MIN_YEAR ? MIN_YEAR : MAX_YEAR} 年`);
        return;
      }
      newDate = new Date(year, currentDate.getMonth(), 1);
    } else if (unit === 'month') {
      newDate = delta > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
    } else {
      newDate = addWeeks(currentDate, delta);
    }

    const newYear = newDate.getFullYear();
    if (newYear < MIN_YEAR || newYear > MAX_YEAR) {
      showAlert('已到达日期边界');
      return;
    }

    setCurrentDate(newDate);
  }, [currentDate, showAlert]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  }, []);

  // 滚轮事件（带防抖）
  const handleWheel = useCallback((e: WheelEvent) => {
    if (isSelectOpen || isSettingsOpen || wheelLockRef.current) return;
    e.preventDefault();

    wheelLockRef.current = true;
    navigate(e.deltaY > 0 ? 'next' : 'prev', settings.scrollMode === 'week' ? 'week' : 'month');

    // 70ms 防抖
    setTimeout(() => {
      wheelLockRef.current = false;
    }, 70);
  }, [isSelectOpen, isSettingsOpen, settings.scrollMode, navigate]);

  useEffect(() => {
    if (isLoading) return;
    const area = wheelAreaRef.current;
    if (!area) return;
    area.addEventListener('wheel', handleWheel, { passive: false });
    return () => area.removeEventListener('wheel', handleWheel);
  }, [isLoading, handleWheel]);

  // 刷新节假日
  const handleRefresh = useCallback(async () => {
    const now = Date.now();
    if (lastRefreshTime && now - lastRefreshTime < REFRESH_COOLDOWN) {
      const remaining = Math.ceil((REFRESH_COOLDOWN - (now - lastRefreshTime)) / 1000);
      showAlert(remaining > 60 ? `请等待 ${Math.floor(remaining / 60)}分${remaining % 60}秒后再刷新` : `请等待 ${remaining}秒后再刷新`);
      return;
    }

    setIsRefreshing(true);
    try {
      await refreshHolidays();
      setHasHolidayData(getHolidaysData().length > 0);
      setLastRefreshTime(now);
      showAlert('✓ 已刷新');
    } catch {
      showAlert('刷新失败，请稍后重试');
    } finally {
      setIsRefreshing(false);
    }
  }, [lastRefreshTime, showAlert]);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      settingsStorage.save(next);
      return next;
    });
  }, []);

  const selectedHolidayInfo = useMemo(() => getHolidayInfo(selectedDate), [selectedDate]);
  const weekdays = settings.weekStartsOn === 1 ? ['一', '二', '三', '四', '五', '六', '日'] : WEEKDAYS;

  if (isLoading) {
    return (
      <div className="w-full flex justify-center">
        <div className="flex items-center justify-center"
          style={{ width: LAYOUT.calendarWidth + LAYOUT.sidebarWidth + 14, height: LAYOUT.calendarHeight + 8 }}>
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
        {showLimitToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-100 rounded-lg shadow-lg border border-amber-200 dark:border-amber-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{limitMessage}</span>
            </div>
          </div>
        )}

        <div className="flex gap-1.5 items-start p-1">
          <div ref={wheelAreaRef} className="shrink-0">
            <Card className="p-0 flex flex-col" style={{ width: LAYOUT.calendarWidth, height: LAYOUT.calendarHeight }}>
              <CardHeader className="pb-0 pt-1 px-3">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => navigate('prev', 'year')} title="上一年" className="h-8 w-8">
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => navigate('prev', 'month')} title="上一月" className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={String(currentYear)} onValueChange={(v) => setCurrentDate(new Date(parseInt(v), currentMonth - 1, 1))} onOpenChange={setIsSelectOpen}>
                      <SelectTrigger className="w-[100px] h-8"><SelectValue placeholder="年份" /></SelectTrigger>
                      <SelectContent className="max-h-[150px] overflow-y-auto">
                        {YEARS.map(year => <SelectItem key={year} value={String(year)}>{year} 年</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Select value={String(currentMonth)} onValueChange={(v) => setCurrentDate(new Date(currentYear, parseInt(v) - 1, 1))} onOpenChange={setIsSelectOpen}>
                      <SelectTrigger className="w-[90px] h-8"><SelectValue placeholder="月份" /></SelectTrigger>
                      <SelectContent className="max-h-[150px] overflow-y-auto">
                        {MONTHS.map(month => <SelectItem key={month} value={String(month)}>{month} 月</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Button variant="default" size="sm" onClick={goToToday}
                      className="h-8 px-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600">
                      今天
                    </Button>

                    <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Settings className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-2" align="end" sideOffset={5}>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">节假日数据</span>
                            <div className="flex items-center gap-1">
                              {lastRefreshTime && (
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(lastRefreshTime), 'HH:mm')}
                                </span>
                              )}
                              <Button variant="outline" size="sm" className="h-5 w-5 p-0" onClick={handleRefresh} disabled={isRefreshing}>
                                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                              </Button>
                            </div>
                          </div>

                          <SettingSection title="每周起始日">
                            <ToggleButtonGroup
                              options={[{ value: 0, label: '周日' }, { value: 1, label: '周一' }]}
                              value={settings.weekStartsOn}
                              onChange={(v) => updateSettings({ weekStartsOn: v })}
                            />
                          </SettingSection>

                          {mounted && (
                            <SettingSection title="主题">
                              <ToggleButtonGroup
                                options={[{ value: 'light', icon: Sun }, { value: 'dark', icon: Moon }, { value: 'system', icon: Monitor }]}
                                value={theme ?? 'system'}
                                onChange={setTheme}
                              />
                            </SettingSection>
                          )}

                          <SettingSection title="日期气泡">
                            <ToggleButtonGroup
                              options={[{ value: true, label: '显示' }, { value: false, label: '隐藏' }]}
                              value={settings.showTooltip}
                              onChange={(v) => updateSettings({ showTooltip: v })}
                            />
                          </SettingSection>

                          <SettingSection title="字号">
                            <ToggleButtonGroup
                              options={[{ value: 'sm', label: '小' }, { value: 'base', label: '中' }, { value: 'lg', label: '大' }]}
                              value={settings.dateFontSize}
                              onChange={(v) => updateSettings({ dateFontSize: v })}
                            />
                          </SettingSection>

                          <SettingSection title="滚动切换">
                            <ToggleButtonGroup
                              options={[{ value: 'month', label: '月' }, { value: 'week', label: '周' }]}
                              value={settings.scrollMode}
                              onChange={(v) => updateSettings({ scrollMode: v })}
                            />
                          </SettingSection>

                          <div className="pt-1.5 border-t border-border/50 flex items-center justify-between">
                            <span className="font-medium">关于</span>
                            <a href="https://github.com/WongSilver" target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                              <Github className="h-3 w-3" />
                              <span className="text-[10px]">GitHub</span>
                            </a>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="icon" onClick={() => navigate('next', 'month')} title="下一月" className="h-8 w-8">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => navigate('next', 'year')} title="下一年" className="h-8 w-8">
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-3 pb-0 pt-0 flex-1 flex flex-col">
                <div className="grid grid-cols-7 mb-0 shrink-0">
                  {weekdays.map((day, index) => (
                    <div key={day}
                      className={`text-center py-0.5 text-sm font-medium ${
                        (settings.weekStartsOn === 1 ? index >= 5 : index === 0 || index === 6) ? 'text-red-500' : 'text-muted-foreground'
                      }`}>
                      {day}
                    </div>
                  ))}
                </div>

                <TooltipProvider>
                  <div className="flex-1 bg-card p-1">
                    <div className="grid grid-cols-7 gap-1 w-full h-full">
                      {calendarData.map((day) => (
                        <CalendarDayCell
                          key={format(day.date, 'yyyy-MM-dd')}
                          day={day}
                          isSelected={isSameDay(day.date, selectedDate)}
                          isCurrentDay={isToday(day.date)}
                          hasHolidayData={hasHolidayData}
                          showTooltip={settings.showTooltip}
                          dateFontSize={settings.dateFontSize}
                          onSelect={setSelectedDate}
                        />
                      ))}
                    </div>
                  </div>
                </TooltipProvider>
              </CardContent>
            </Card>
          </div>

          <CalendarSidebar
            currentDate={currentDate}
            selectedDate={selectedDate}
            hasHolidayData={hasHolidayData}
            holidayInfo={selectedHolidayInfo}
            dateFontSize={settings.dateFontSize}
            onNavigate={(date) => setCurrentDate(date)}
          />
        </div>
      </div>
    </div>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-1.5 border-t border-border/50">
      <p className="font-medium mb-1">{title}</p>
      {children}
    </div>
  );
}

function ToggleButtonGroup<T extends string | number | boolean>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label?: string; icon?: React.ComponentType<{ className?: string }> }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const Icon = opt.icon;
        return (
          <Button
            key={String(opt.value)}
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            className="flex-1 h-6 text-[10px] px-1"
            onClick={() => onChange(opt.value)}
          >
            {Icon ? <Icon className="h-3 w-3" /> : opt.label}
          </Button>
        );
      })}
    </div>
  );
}
