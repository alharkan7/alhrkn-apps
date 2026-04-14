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

    // Start editing
    useEffect(() => {
        if (isEditing) {
            setEditedJson(JSON.stringify(jsonData, null, 2));
        }
    }, [isEditing, jsonData]);

    // Handle save request from parent
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

    const handleCancelEdit = () => {
        onEditingChange(false);
        setEditedJson('');
    };

    const handleStartEdit = () => {
        onViewModeChange('json');
        onEditingChange(true);
    };

    const renderTable = (data: any) => {
        if (!data || !data.rawData || !Array.isArray(data.rawData)) {
            return <div className="text-sm text-slate-400 p-3 border border-slate-700 rounded border-dashed">Invalid data format for table view. Required structure: {`{ rawData: [...] }`}</div>;
        }

        return (
            <div className="overflow-x-auto rounded border border-slate-700 bg-slate-800/20">
                <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                    <thead>
                        <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
                            <th className="p-3 border-r border-slate-700 font-semibold whitespace-nowrap w-[130px]">Period</th>
                            <th className="p-3 border-r border-slate-700 font-semibold whitespace-nowrap w-[110px]">Date</th>
                            <th className="p-3 font-semibold">Event</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.rawData.map((period: any, pIndex: number) => {
                            const rowSpan = period.events && period.events.length > 0 ? period.events.length : 1;
                            const events = period.events || [];

                            if (events.length === 0) {
                                return (
                                    <tr key={`p-${pIndex}`} className="border-b border-slate-700">
                                        <td className="p-3 border-r border-slate-700 align-top bg-slate-800/40">
                                            <div className="font-semibold text-slate-200">{period.period_title}</div>
                                            <div className="text-slate-400 text-[10px] mt-1.5">{period.start_year} to {period.end_year}</div>
                                        </td>
                                        <td className="p-3 text-slate-500 italic" colSpan={2}>No events</td>
                                    </tr>
                                );
                            }

                            return events.map((event: any, eIndex: number) => (
                                <tr key={`p-${pIndex}-e-${eIndex}`} className="border-b border-slate-700 hover:bg-slate-750/50 transition-colors">
                                    {eIndex === 0 && (
                                        <td 
                                            className="p-3 border-r border-slate-700 align-top bg-slate-800/40" 
                                            rowSpan={rowSpan}
                                        >
                                            <div className="font-semibold text-slate-200">{period.period_title}</div>
                                            <div className="text-slate-400 text-[10px] mt-1.5">{period.start_year} to {period.end_year}</div>
                                        </td>
                                    )}
                                    <td className="p-3 border-r border-slate-700 align-top whitespace-nowrap text-slate-300 font-medium bg-slate-900/20">
                                        {event.date_display}
                                    </td>
                                    <td className="p-3 align-top">
                                        <div className="font-semibold text-slate-200 text-[13px]">{event.title}</div>
                                        <div className="text-slate-400 mt-1.5 leading-relaxed">{event.description}</div>
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
            className={`fixed left-0 bg-slate-900 text-slate-100 transition-all duration-300 overflow-hidden ${isOpen ? 'w-80 sm:w-96' : 'w-0'
                }`}
            style={{
                top: '64px', // Start right after main header
                height: `calc(100vh - 64px - ${footerHeight}px)`,
                zIndex: 25
            }}
        >
            <div className="h-full flex flex-col w-80 sm:w-96">
                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4">
                    {!isEditing ? (
                        viewMode === 'table' ? (
                            renderTable(jsonData)
                        ) : (
                            <pre
                                className="text-xs overflow-x-auto bg-slate-800 p-3 rounded cursor-pointer hover:bg-slate-750 transition-colors"
                                onClick={handleStartEdit}
                                title="Click to edit"
                            >
                                {JSON.stringify(jsonData, null, 2)}
                            </pre>
                        )
                    ) : (
                        <textarea
                            ref={textareaRef}
                            value={editedJson}
                            onChange={(e) => setEditedJson(e.target.value)}
                            className="w-full h-full min-h-[500px] bg-slate-800 text-slate-100 p-3 rounded font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            spellCheck={false}
                            autoFocus
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default JsonSidebar;
export type { JsonSidebarProps };
