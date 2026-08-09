'use client';

import { HistorySidebar } from '@/components/history-sidebar';
import { LineChart, BarChart, PieChart, Activity } from 'lucide-react';

export function AnimaChartHistorySidebar() {
  return (
    <HistorySidebar 
      apiEndpoint="/api/animachart/history"
      itemUrlPrefix="/animachart/"
      eventName="toggleAnimaChartHistorySidebar"
      title="Recent Charts"
      variant="quiet"
      emptyMessage="No previous animated charts found."
      onRenderTitle={(item: any) => item.chartData?.title || 'Untitled Chart'}
      onRenderIcon={(item: any) => {
        const type = item.chartData?.type;
        switch (type) {
          case 'bar': return <BarChart size={16} />;
          case 'pie': 
          case 'doughnut': return <PieChart size={16} />;
          case 'line': return <LineChart size={16} />;
          default: return <Activity size={16} />;
        }
      }}
    />
  );
}
