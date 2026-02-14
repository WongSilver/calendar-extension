'use client';

import { ChineseCalendar } from '@/components/ChineseCalendar';

export default function Home() {
  return (
    <main className="bg-gradient-to-br from-background to-muted/30 overflow-hidden">
      <ChineseCalendar />
    </main>
  );
}
