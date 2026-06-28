import React from 'react';
import { HistoricalEvent } from '../types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavigatorProps {
  events: HistoricalEvent[];
  onSelect: (event: HistoricalEvent) => void;
  onBackgroundClick: () => void;
  selectedYear: number | null;
}

const Navigator: React.FC<NavigatorProps> = ({ events, onSelect, onBackgroundClick, selectedYear }) => {
  return (
    <div
        className="h-full w-full bg-white border-t border-slate-200 flex flex-col"
        onClick={onBackgroundClick}
    >
        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div className="flex items-center h-full px-2 sm:px-3 md:px-4 space-x-1 sm:space-x-1.5 min-w-max">
            {events.map((event, idx) => {
               const isSelected = selectedYear === event.year;
               return (
                  <Tooltip key={`${event.year}-${idx}`}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelect(event); }}
                        className={`
                          group relative flex flex-col items-center justify-center
                          h-[60px] sm:h-[70px] md:h-3/4
                          min-w-[70px] sm:min-w-[80px] max-w-[120px] sm:max-w-[140px]
                          px-1.5 sm:px-2 rounded transition-all duration-200 touch-manipulation
                          ${isSelected ? 'bg-slate-100 ring-1 ring-slate-900/10 shadow-sm' : 'hover:bg-slate-50 active:bg-slate-100'}
                        `}
                      >
                          {/* Color Marker */}
                          <div
                              className={`w-full h-1 sm:h-1.5 rounded-full mb-1.5 sm:mb-2 transition-all ${isSelected ? 'scale-100' : 'scale-75 opacity-70 group-hover:scale-95 group-hover:opacity-100'}`}
                              style={{ backgroundColor: event.periodColor || '#ccc' }}
                          />

                          <span className={`text-[10px] sm:text-xs font-medium truncate w-full text-center leading-tight ${isSelected ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-900'}`}>
                              {event.title}
                          </span>
                          <span className={`text-[8px] sm:text-[10px] font-mono truncate w-full text-center leading-tight ${isSelected ? 'text-slate-700' : 'text-slate-400 group-hover:text-slate-600'}`}>
                              {event.date_display}
                          </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p className="max-w-xs">{event.title}</p>
                    </TooltipContent>
                  </Tooltip>
               )
            })}
          </div>
        </div>
      </div>
  );
};

export default Navigator;