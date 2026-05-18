import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../lib/AuthContext";
import { dataService } from "../../services/dataService";
import { Project, EmailLog, Client } from "../../types";
import { 
  BarChart3, 
  Calendar, 
  RefreshCcw, 
  Download, 
  ChevronDown,
  Filter,
  Mail,
  MoreVertical
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatDate, formatDateTime } from "../../lib/utils";
import { differenceInDays, addDays, isWithinInterval, startOfDay } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function DashboardView() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      const data = await dataService.getProjects();
      setProjects(data);
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      const fetchLogs = async () => {
        const data = await dataService.getEmailLogs(selectedProjectId);
        setEmails(data);
      };
      fetchLogs();
    }
  }, [selectedProjectId]);

  const activeProject = useMemo(() => 
    projects.find(p => String(p.id) === String(selectedProjectId)), 
  [projects, selectedProjectId]);

  // Weekly Aggregation Logic
  const weeklyData = useMemo(() => {
    if (!activeProject || emails.length === 0) return [];
    
    const startDate = startOfDay(new Date(activeProject.startDate));
    const weeks: { weekNumber: number, emails: EmailLog[], start: Date, end: Date }[] = [];
    
    // Create weeks from start date to today
    const now = new Date();
    const daysSinceStart = differenceInDays(now, startDate);
    const totalWeeks = Math.ceil((daysSinceStart + 1) / 7) || 1;

    for (let i = 0; i < totalWeeks; i++) {
      const weekStart = addDays(startDate, i * 7);
      const weekEnd = addDays(weekStart, 6);
      
      const weekEmails = emails.filter(email => {
        const emailDate = new Date(email.timestamp);
        return isWithinInterval(emailDate, { start: weekStart, end: weekEnd });
      });

      weeks.push({
        weekNumber: i + 1,
        emails: weekEmails,
        start: weekStart,
        end: weekEnd
      });
    }

    return weeks.reverse(); // Show newest week first
  }, [activeProject, emails]);

  const handleSync = async () => {
    if (!activeProject || !user) return;
    setIsSyncing(true);
    try {
      const response = await fetch(`/api/sync/${activeProject.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pmId: user.id })
      });
      const result = await response.json();
      if (result.status === "success") {
        console.log(`Synced ${result.synced} new emails`);
      } else {
        alert(result.message || "Sync failed. Make sure you have connected your Gmail account in Settings.");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred during sync. Check console for details.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportPDF = () => {
    if (!activeProject) return;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text(`Communication Audit: ${activeProject.name}`, 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Project Start Date: ${activeProject.startDate}`, 14, 35);
    
    const tableData = emails.map(email => [
      formatDateTime(email.timestamp),
      email.sender,
      email.subject,
      email.body.substring(0, 100) + "..."
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Date', 'From', 'Subject', 'Snippet']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [223, 223, 223], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    doc.save(`${activeProject.name}_audit.pdf`);
  };

  return (
    <div className="space-y-8">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Project Dashboard</h2>
          <p className="text-slate-500">Weekly communication aggregation and reporting.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="appearance-none bg-white border border-slate-200 px-4 py-2 pr-10 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border",
              isSyncing 
                ? "bg-slate-50 text-slate-400 border-slate-100" 
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
          >
            <RefreshCcw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing..." : "Sync Emails"}
          </button>

          <button
            onClick={handleExportPDF}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Mail className="text-emerald-600 w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded">Volume</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{emails.length}</div>
          <div className="text-sm text-slate-500 mt-1">Total Emails Captured</div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Calendar className="text-blue-600 w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-1 rounded">Time</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{weeklyData.length}</div>
          <div className="text-sm text-slate-500 mt-1">Weeks of Activity</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <BarChart3 className="text-purple-600 w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider bg-purple-50 px-2 py-1 rounded">Growth</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{Math.round(emails.length / (weeklyData.length || 1))}</div>
          <div className="text-sm text-slate-500 mt-1">Avg. Emails / Week</div>
        </div>
      </div>

      {/* Weekly Feed */}
      <div className="space-y-6">
        {weeklyData.map((week) => (
          <div key={week.weekNumber} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">
                  Week {week.weekNumber}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  ({formatDate(week.start)} - {formatDate(week.end)})
                </span>
              </div>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid grid-cols-1 gap-4">
              {week.emails.length > 0 ? (
                week.emails.map(email => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={email.id}
                    className="bg-white rounded-xl border border-slate-100 p-4 hover:border-slate-200 hover:shadow-md transition-all flex items-start gap-4 group"
                  >
                    <div className="bg-slate-50 p-2 rounded-lg group-hover:bg-primary/5 transition-colors">
                      <Mail className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-slate-900 truncate">{email.sender}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(email.timestamp)}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-1">{email.subject}</h4>
                      <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                        {email.body}
                      </p>
                    </div>
                    <button className="text-slate-300 hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-all">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                  No activity recorded for this week.
                </div>
              )}
            </div>
          </div>
        ))}
        {weeklyData.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No communication data yet</h3>
            <p className="text-slate-500 max-w-xs mx-auto">Select an active project or trigger a manual sync to populate your dashboard.</p>
          </div>
        )}
      </div>
    </div>
  );
}
