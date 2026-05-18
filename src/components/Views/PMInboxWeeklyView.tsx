import React, { useState, useEffect } from "react";
import { dataService } from "../../services/dataService";
import { Download, Calendar, Mail, User, ChevronRight, ChevronDown, BarChart3, Search } from "lucide-react";
import { cn } from "../../lib/utils";

interface WeeklyReportItem {
  pm_id: number;
  client_id: number;
  project_id: number;
  clientName: string;
  projectName: string;
  pmName: string;
  week_val: number;
  email_count: number;
  week_start: string;
  week_end: string;
}

export function PMInboxWeeklyView() {
  const [reportData, setReportData] = useState<WeeklyReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedPms, setExpandedPms] = useState<Record<string, boolean>>({});

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await dataService.getInboxWeeklyReport();
      setReportData(data);
    } catch (err) {
      console.error("Failed to fetch weekly report", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const togglePm = (pmName: string) => {
    setExpandedPms(prev => ({ ...prev, [pmName]: !prev[pmName] }));
  };

  // Group data: PM -> Client -> Weeks
  const groupedData: Record<string, Record<string, WeeklyReportItem[]>> = {};
  
  reportData.forEach(item => {
    const pm = item.pmName || `PM #${item.pm_id}`;
    const client = item.clientName || "Unknown Client";
    
    if (!groupedData[pm]) groupedData[pm] = {};
    if (!groupedData[pm][client]) groupedData[pm][client] = [];
    groupedData[pm][client].push(item);
  });

  const filteredPms = Object.keys(groupedData).filter(pm => 
    pm.toLowerCase().includes(searchTerm.toLowerCase()) ||
    Object.keys(groupedData[pm]).some(client => client.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDownload = (pmId: number, clientId: number, weekStart: string, weekEnd: string) => {
    dataService.downloadInboxConversations(pmId, clientId, weekStart, weekEnd);
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">PM Inbox (Weekly View)</h2>
          <p className="text-slate-500">Monitor communication volume and responsiveness per PM per week.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 w-64">
            <Search className="text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Filter by PM or Client..." 
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchReport}
            className={cn("p-2 text-slate-400 hover:text-primary transition-colors", loading && "animate-spin")}
          >
            <Calendar className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-slate-500 font-medium">Analyzing weekly metrics...</p>
            </div>
          </div>
        ) : filteredPms.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
            <BarChart3 className="w-12 h-12 opacity-20" />
            <p>No activity found for the selected period.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {filteredPms.sort().map(pmName => {
              const pmItems = Object.values(groupedData[pmName]).flat();
              const latestWeek = [...pmItems].sort((a,b) => b.week_val - a.week_val)[0];
              const weekNum = latestWeek.week_val % 100;
              const year = Math.floor(latestWeek.week_val / 100);
              
              return (
                <div key={pmName} className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30">
                  {/* PM Header */}
                  <button 
                    onClick={() => togglePm(pmName)}
                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors border-b border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-slate-900">{pmName}</h3>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-black tracking-widest">
                          <span>Active PM</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-600">
                            Week {weekNum} - {year} ({new Date(latestWeek.week_start).toLocaleDateString()} - {new Date(latestWeek.week_end).toLocaleDateString()})
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-lg font-bold text-slate-900">
                          {pmItems.reduce((acc, w) => acc + Number(w.email_count), 0)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold">TOTAL EMAILS</div>
                      </div>
                      {expandedPms[pmName] ? <ChevronDown className="text-slate-400" /> : <ChevronRight className="text-slate-400" />}
                    </div>
                  </button>

                {/* Clients under PM */}
                {expandedPms[pmName] && (
                  <div className="p-4 space-y-4">
                    {Object.keys(groupedData[pmName]).sort().map(clientName => (
                      <div key={clientName} className="bg-white rounded-lg border border-slate-100 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <h4 className="font-bold text-slate-800">{clientName}</h4>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Interactions</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {groupedData[pmName][clientName].sort((a,b) => b.week_val - a.week_val).map(week => {
                            const weekNum = week.week_val % 100;
                            const year = Math.floor(week.week_val / 100);
                            return (
                              <div key={week.week_val} className="group relative p-3 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-primary/[0.02] transition-all bg-slate-50/50">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Week {weekNum} - {year}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">
                                      {new Date(week.week_start).toLocaleDateString()} - {new Date(week.week_end).toLocaleDateString()}
                                    </div>
                                  </div>
                                  <div className="bg-white p-1.5 rounded-lg border border-slate-100 font-bold text-primary text-sm shadow-sm">
                                    {week.email_count}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                                  <button 
                                    onClick={() => handleDownload(week.pm_id, week.client_id, week.week_start, week.week_end)}
                                    className="flex items-center gap-2 text-[10px] font-bold text-primary hover:text-primary/70 transition-colors uppercase tracking-wider"
                                  >
                                    <Download className="w-3 h-3" />
                                    Download conversations
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}
