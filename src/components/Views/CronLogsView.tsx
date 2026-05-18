import React, { useState, useEffect } from "react";
import { dataService } from "../../services/dataService";
import { Terminal, Trash2, RefreshCw, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "../../lib/utils";

interface CronLog {
  id: number;
  message: string;
  level: string;
  created_at: string;
}

export function CronLogsView() {
  const [logs, setLogs] = useState<CronLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await dataService.getCronLogs();
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch cron logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000); // Auto refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleClear = async () => {
    if (!confirm("Clear all cron logs?")) return;
    try {
      await dataService.clearCronLogs();
      setLogs([]);
    } catch (err) {
      alert("Failed to clear logs");
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "success": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "error": return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Background Job Logs</h2>
          <p className="text-slate-500">Monitor email scanning activity and sync status.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchLogs}
            className={cn("p-2 text-slate-400 hover:text-primary transition-all", loading && "animate-spin")}
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button 
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all font-semibold text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Clear Logs
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col font-mono text-sm">
        <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-400">
            <Terminal className="w-4 h-4" />
            <span>system@pmm-dashboard:~/cron_logs$ tail -n 100</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 italic">
              <p>No log entries found. Scan job runs every 5 minutes.</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-4 group hover:bg-slate-800/30 p-1 rounded transition-colors border-l-2 border-transparent hover:border-slate-700">
                <span className="text-slate-500 shrink-0 whitespace-nowrap">
                   {new Date(log.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="shrink-0">{getLevelIcon(log.level)}</span>
                <span className={cn(
                  "break-all",
                  log.level === "error" ? "text-red-400" : 
                  log.level === "success" ? "text-emerald-400" : "text-slate-300"
                )}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
        
        <div className="p-2 bg-slate-950/50 text-[10px] text-slate-500 flex justify-between items-center">
          <span>{logs.length} entries shown</span>
          <span className="animate-pulse flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-emerald-500" />
            Active Monitor
          </span>
        </div>
      </div>
    </div>
  );
}
