// 中国节假日数据 - 直接从外部 API 获取，并缓存到 localStorage

export interface Holiday {
  name: string;
  date: string; // YYYY-MM-DD 格式
  type: 'holiday' | 'workday'; // holiday: 假期, workday: 调休工作日
}

export interface HolidayInfo {
  name: string;
  isHoliday: boolean;
  isWorkday: boolean; // 调休工作日
  isWeekend: boolean;
}

// localStorage 缓存键
const CACHE_KEY = 'chinese-holidays-cache';
// 缓存永久有效，只有用户手动刷新时才更新

// 外部 API URL
const HOLIDAY_API_URL = 'https://www.shuyz.com/githubfiles/china-holiday-calender/master/holidayAPI.json';

// 内存缓存
let holidaysCache: Holiday[] = [];
let holidayMapCache = new Map<string, HolidayInfo>();
let isInitialized = false;

// 节假日 API 数据结构
interface HolidayAPIResponse {
  Years: Record<string, {
    Name: string;
    StartDate: string;
    EndDate: string;
    CompDays: string[];
  }[]>;
}

// 创建日期到节假日的映射
function buildHolidayMap(holidays: Holiday[]): Map<string, HolidayInfo> {
  const map = new Map<string, HolidayInfo>();
  
  holidays.forEach(holiday => {
    const existingInfo = map.get(holiday.date);
    if (existingInfo) {
      if (holiday.type === 'holiday') {
        existingInfo.name = existingInfo.name ? `${existingInfo.name}、${holiday.name}` : holiday.name;
        existingInfo.isHoliday = true;
      } else {
        existingInfo.isWorkday = true;
      }
    } else {
      map.set(holiday.date, {
        name: holiday.name,
        isHoliday: holiday.type === 'holiday',
        isWorkday: holiday.type === 'workday',
        isWeekend: false,
      });
    }
  });
  
  return map;
}

// 转换 API 数据为日历使用的格式
function transformHolidayData(apiData: HolidayAPIResponse): Holiday[] {
  const holidays: Holiday[] = [];
  
  for (const year of Object.keys(apiData.Years)) {
    const yearHolidays = apiData.Years[year];
    
    for (const item of yearHolidays) {
      // 添加假期日期
      const startDate = new Date(item.StartDate + 'T00:00:00');
      const endDate = new Date(item.EndDate + 'T00:00:00');
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${month}-${day}`;
        holidays.push({
          name: item.Name,
          date: dateStr,
          type: 'holiday',
        });
      }
      
      // 添加补班日期
      for (const compDay of item.CompDays) {
        holidays.push({
          name: `${item.Name}调休`,
          date: compDay,
          type: 'workday',
        });
      }
    }
  }
  
  return holidays;
}

// 从 localStorage 读取缓存
function loadFromLocalStorage(): Holiday[] | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Failed to load holidays from localStorage:', error);
  }
  
  return null;
}

// 保存到 localStorage
function saveToLocalStorage(holidays: Holiday[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(holidays));
  } catch (error) {
    console.error('Failed to save holidays to localStorage:', error);
  }
}

// 从外部 API 获取节假日数据
async function fetchHolidaysFromAPI(): Promise<Holiday[]> {
  try {
    const response = await fetch(HOLIDAY_API_URL);
    if (!response.ok) throw new Error('Failed to fetch holidays');
    return transformHolidayData(await response.json());
  } catch {
    return [];
  }
}

// 确保数据已加载
async function ensureDataLoaded(): Promise<void> {
  if (isInitialized && holidaysCache.length > 0) return;

  const cached = loadFromLocalStorage();

  // 使用缓存（永久有效）
  if (cached?.length) {
    holidaysCache = cached;
    holidayMapCache = buildHolidayMap(holidaysCache);
    isInitialized = true;
    return;
  }

  // 无缓存时从 API 获取
  const holidays = await fetchHolidaysFromAPI();

  if (holidays.length > 0) {
    holidaysCache = holidays;
    holidayMapCache = buildHolidayMap(holidaysCache);
    saveToLocalStorage(holidays);
  }
  isInitialized = true;
}

/**
 * 同步获取节假日数据
 */
export function getHolidaysData(): Holiday[] {
  return holidaysCache;
}

/**
 * 获取指定日期的节假日信息
 */
export function getHolidayInfo(date: Date): HolidayInfo {
  const dateStr = formatDate(date);
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  
  const holidayInfo = holidayMapCache.get(dateStr);
  
  if (holidayInfo) {
    return {
      ...holidayInfo,
      isWeekend,
    };
  }
  
  return {
    name: '',
    isHoliday: false,
    isWorkday: false,
    isWeekend,
  };
}

/**
 * 格式化日期为 YYYY-MM-DD 格式
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 初始化节假日数据
 */
export async function initializeHolidays(): Promise<void> {
  await ensureDataLoaded();
}

/**
 * 强制刷新节假日数据
 */
export async function refreshHolidays(): Promise<void> {
  isInitialized = false;
  
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CACHE_KEY);
  }
  
  await ensureDataLoaded();
}

/**
 * 获取指定年份的所有节假日
 */
export function getHolidaysByYear(year: number): Holiday[] {
  return holidaysCache.filter(h => h.date.startsWith(String(year)));
}

/**
 * 获取指定月份的所有节假日
 */
export function getHolidaysByMonth(year: number, month: number): Holiday[] {
  const monthStr = String(month).padStart(2, '0');
  const prefix = `${year}-${monthStr}`;
  return holidaysCache.filter(h => h.date.startsWith(prefix));
}
