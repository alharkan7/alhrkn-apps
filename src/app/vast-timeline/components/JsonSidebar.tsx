import React, { useState, useRef, useEffect } from 'react';

interface JsonSidebarProps {
    isOpen: boolean;
    jsonData: any;
    onJsonUpdate: (newData: any) => void;
    onError: (error: string) => void;
    onClose: () => void;
    footerHeight: number;
    isEditing: boolean;
    onEditingChange: (editing: boolean) => void;
    saveRequested: boolean;
    onSaveComplete: () => void;
    viewMode: 'table' | 'json';
    onViewModeChange: (mode: 'table' | 'json') => void;
}

// Inline Editable Cell Component
const EditableCell = ({
    value,
    type = 'text',
    onSave,
    multiline = false,
    className = '',
    placeholder = ''
}: {
    value: any,
    type?: string,
    onSave: (val: any) => void,
    multiline?: boolean,
    className?: string,
    placeholder?: string
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    useEffect(() => {
        setTempValue(value);
    }, [value]);

    const handleSave = () => {
        let finalValue = tempValue;
        if (type === 'number') {
            finalValue = parseInt(tempValue, 10);
            if (isNaN(finalValue)) finalValue = 0;
        }
        onSave(finalValue);
        setIsEditing(false);
    };

    if (isEditing) {
        if (multiline) {
            return (
                <textarea
                    autoFocus
                    value={tempValue}
                    onChange={e => setTempValue(e.target.value)}
                    onBlur={handleSave}
                    className="w-full text-xs border border-blue-400 rounded px-1 py-0.5 min-h-[60px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            );
        }
        return (
            <input
                autoFocus
                type={type}
                value={tempValue}
                onChange={e => setTempValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur();
                    }
                }}
                className={`w-full border border-blue-400 rounded px-1 py-0.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
            />
        );
    }

    return (
        <div
            onDoubleClick={() => setIsEditing(true)}
            className={`cursor-text hover:bg-slate-200/50 rounded transition-colors -mx-1 px-1 min-h-[1.5rem] ${!value ? 'text-slate-400 italic' : ''} ${className}`}
            title="Double click to edit"
        >
            {value || placeholder || '...'}
        </div>
    );
};

const JsonSidebar: React.FC<JsonSidebarProps> = ({
    isOpen,
    jsonData,
    onJsonUpdate,
    onError,
    onClose,
    footerHeight,
    isEditing,
    onEditingChange,
    saveRequested,
    onSaveComplete,
    viewMode,
    onViewModeChange
}) => {
    const [editedJson, setEditedJson] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Start editing (only for JSON view mode now, table edits directly)
    useEffect(() => {
        if (isEditing) {
            setEditedJson(JSON.stringify(jsonData, null, 2));
        }
    }, [isEditing, jsonData]);

    // Handle save request from parent (only for JSON view)
    useEffect(() => {
        if (saveRequested && isEditing) {
            handleSaveEdit();
            onSaveComplete();
        }
    }, [saveRequested]);

    const handleSaveEdit = () => {
        try {
            const parsedData = JSON.parse(editedJson);
            onJsonUpdate(parsedData);
            onEditingChange(false);
            setEditedJson('');
        } catch (error) {
            onError('Invalid JSON format. Please check your syntax.');
        }
    };

    const handleStartEdit = () => {
        onViewModeChange('json');
        onEditingChange(true);
    };

    // Direct table update helpers
    const directUpdatePeriod = (pIndex: number, field: string, value: any) => {
        const newData = JSON.parse(JSON.stringify(jsonData));
        newData.rawData[pIndex][field] = value;
        onJsonUpdate(newData);
    };

    const directUpdateEvent = (pIndex: number, eIndex: number, field: string, value: any) => {
        const newData = JSON.parse(JSON.stringify(jsonData));
        newData.rawData[pIndex].events[eIndex][field] = value;
        onJsonUpdate(newData);
    };

    const directAddPeriod = () => {
        const newData = JSON.parse(JSON.stringify(jsonData));
        newData.rawData.push({
            period_title: "New Period",
            start_year: 0,
            end_year: 0,
            description: "",
            events: []
        });
        onJsonUpdate(newData);
    };

    const directAddEvent = () => {
        const newData = JSON.parse(JSON.stringify(jsonData));
        if (newData.rawData.length === 0) {
            directAddPeriod(); // Make sure there's at least one period
            return;
        }
        // Add event to the first period by default, or last active. We'll choose the first period for simplicity.
        const targetPeriodIndex = 0; 
        newData.rawData[targetPeriodIndex].events.unshift({
            title: "New Event",
            description: "",
            year: newData.rawData[targetPeriodIndex].start_year || 0,
            date_display: "Unknown Date",
            illustrations: ""
        });
        onJsonUpdate(newData);
    };

    const renderTable = (data: any) => {
        if (!data || !data.rawData || !Array.isArray(data.rawData)) {
            return <div className="text-sm text-slate-400 p-3 border border-slate-700 rounded border-dashed">Invalid data format for table view. Required structure: {`{ rawData: [...] }`}</div>;
        }

        return (
            <div className="overflow-x-auto rounded border border-slate-200 bg-slate-50 flex flex-col h-max relative">
                <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                    <thead>
                        <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 select-none">
                            <th className="p-3 border-r border-slate-200 font-semibold whitespace-nowrap w-[140px] group relative">
                                Period
                                <button onClick={directAddPeriod} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-blue-600 hover:bg-blue-100 rounded-full w-5 h-5 flex items-center justify-center font-bold transition-all" title="Add Period">
                                    +
                                </button>
                            </th>
                            <th className="p-3 border-r border-slate-200 font-semibold whitespace-nowrap w-[100px]">Date</th>
                            <th className="p-3 font-semibold group relative">
                                Event
                                <button onClick={directAddEvent} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-blue-600 hover:bg-blue-100 rounded-full w-5 h-5 flex items-center justify-center font-bold transition-all" title="Add Event (to first period)">
                                    +
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.rawData.map((period: any, pIndex: number) => {
                            const rowSpan = period.events && period.events.length > 0 ? period.events.length : 1;
                            const events = period.events || [];

                            const periodCell = (
                                <td 
                                    className="p-3 border-r border-slate-200 align-top bg-slate-50/40 group relative" 
                                    rowSpan={rowSpan}
                                >
                                    <EditableCell 
                                        value={period.period_title} 
                                        onSave={val => directUpdatePeriod(pIndex, 'period_title', val)} 
                                        className="font-semibold text-slate-900 text-[13px] mb-1.5"
                                        placeholder="Period Title"
                                    />
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                        <EditableCell 
                                            type="number"
                                            value={period.start_year} 
                                            onSave={val => directUpdatePeriod(pIndex, 'start_year', val)} 
                                            className="w-12 text-center"
                                        />
                                        <span>to</span>
                                        <EditableCell 
                                            type="number"
                                            value={period.end_year} 
                                            onSave={val => directUpdatePeriod(pIndex, 'end_year', val)} 
                                            className="w-12 text-center"
                                        />
                                    </div>
                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
                                        <button 
                                            onClick={() => {
                                                const newData = JSON.parse(JSON.stringify(jsonData));
                                                newData.rawData.splice(pIndex, 1);
                                                onJsonUpdate(newData);
                                            }}
                                            className="text-[10px] bg-red-100 hover:bg-red-200 text-red-600 px-1.5 py-0.5 rounded transition-all"
                                            title="Delete this period"
                                        >
                                            Delete
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const newData = JSON.parse(JSON.stringify(jsonData));
                                                newData.rawData[pIndex].events.unshift({
                                                    title: "New Event",
                                                    description: "",
                                                    year: period.start_year || 0,
                                                    date_display: "",
                                                    illustrations: ""
                                                });
                                                onJsonUpdate(newData);
                                            }} 
                                            className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-600 px-1.5 py-0.5 rounded transition-all"
                                            title="Add event to this period"
                                        >
                                            + Event
                                        </button>
                                    </div>
                                </td>
                            );

                            if (events.length === 0) {
                                return (
                                    <tr key={`p-${pIndex}`} className="border-b border-slate-200">
                                        {periodCell}
                                        <td className="p-3 text-slate-400 italic" colSpan={2}>
                                            No events
                                        </td>
                                    </tr>
                                );
                            }

                            return events.map((event: any, eIndex: number) => (
                                <tr key={`p-${pIndex}-e-${eIndex}`} className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                                    {eIndex === 0 && periodCell}
                                    <td className="p-3 border-r border-slate-200 align-top whitespace-nowrap text-slate-700 bg-white/20">
                                        <EditableCell 
                                            value={event.date_display} 
                                            onSave={val => directUpdateEvent(pIndex, eIndex, 'date_display', val)} 
                                            className="font-medium text-[11px] mb-1"
                                            placeholder="Display Date"
                                        />
                                        <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-0.5">
                                            <span>Yr:</span>
                                            <EditableCell 
                                                type="number"
                                                value={event.year} 
                                                onSave={val => directUpdateEvent(pIndex, eIndex, 'year', val)} 
                                                className="w-12"
                                            />
                                        </div>
                                    </td>
                                    <td className="p-3 align-top group/event relative">
                                        <EditableCell 
                                            value={event.title} 
                                            onSave={val => directUpdateEvent(pIndex, eIndex, 'title', val)} 
                                            className="font-semibold text-slate-900 text-[13px] mb-1"
                                            placeholder="Event Title"
                                        />
                                        <EditableCell 
                                            value={event.description} 
                                            onSave={val => directUpdateEvent(pIndex, eIndex, 'description', val)} 
                                            multiline={true}
                                            className="text-slate-600 mt-1.5 leading-relaxed text-[11px]"
                                            placeholder="Event Description..."
                                        />
                                        <button 
                                            onClick={() => {
                                                const newData = JSON.parse(JSON.stringify(jsonData));
                                                newData.rawData[pIndex].events.splice(eIndex, 1);
                                                onJsonUpdate(newData);
                                            }}
                                            className="absolute top-2 right-2 opacity-0 group-hover/event:opacity-100 text-[10px] text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-1.5 py-0.5 rounded transition-all"
                                            title="Delete Event"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ));
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div
            className={`fixed left-0 bg-white border-r border-slate-200 text-slate-900 transition-all duration-300 overflow-hidden ${isOpen ? 'w-80 sm:w-96' : 'w-0'
                }`}
            style={{
                top: '64px', // Start right after main header
                height: `calc(100vh - 64px - ${footerHeight}px)`,
                zIndex: 25
            }}
        >
            <div className="h-full flex flex-col w-80 sm:w-96">
                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {viewMode === 'table' ? (
                        renderTable(jsonData)
                    ) : (
                        !isEditing ? (
                            <pre
                                className="text-xs overflow-x-auto bg-slate-100 p-3 rounded cursor-pointer hover:bg-slate-200 transition-colors"
                                onClick={handleStartEdit}
                                title="Click to edit JSON"
                            >
                                {JSON.stringify(jsonData, null, 2)}
                            </pre>
                        ) : (
                            <textarea
                                ref={textareaRef}
                                value={editedJson}
                                onChange={(e) => setEditedJson(e.target.value)}
                                className="w-full h-full min-h-[500px] bg-white border border-slate-200 text-slate-900 p-3 rounded font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                spellCheck={false}
                                autoFocus
                            />
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default JsonSidebar;
export type { JsonSidebarProps };
