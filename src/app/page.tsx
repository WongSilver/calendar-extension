'use client';

import { ChineseCalendar } from '@/components/ChineseCalendar';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted/30 py-8 overflow-x-visible">
      <ChineseCalendar />
    </main>
  );
}
