import React, { useState, useEffect } from "react";
import { dataService } from "../../services/dataService";
import { Mail, Search, Trash2, Calendar, User, Paperclip, ChevronRight, X, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../lib/AuthContext";
import { cn, formatDate } from "../../lib/utils";

interface InboxEmail {
  id: number;
  email_date: string;
  subject: string;
  pm_id: number;
  client_id: number;
  project_id: number;
  from_address: string;
  to_address?: string;
  type?: "INBOX" | "SENT";
  source_role?: "PM" | "PMM";
  body: string;
  message_id: string;
  has_attachments: boolean;
  attachments: any[];
  clientName?: string;
  projectName?: string;
  pmName?: string;
}

export function InboxView() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);
  
  // Filters
  const [pmFilter, setPmFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [syncing, setSyncing] = useState(false);
  
  const triggerSync = async () => {
    setSyncing(true);
    try {
      await dataService.syncInbox();
      // Wait a bit for the background process to start and maybe get some results
      setTimeout(fetchInbox, 2000);
      setTimeout(fetchInbox, 5000);
    } catch (err) {
      console.error("Sync trigger failed", err);
    } finally {
      setSyncing(false);
    }
  };

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const data = await dataService.getInbox();
      setEmails(data);
    } catch (err) {
      console.error("Failed to fetch inbox", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  const uniquePMs = Array.from(new Set(emails.map(e => e.pmName || `PM #${e.pm_id}`))).sort();
  const uniqueClients = Array.from(new Set(emails.map(e => e.clientName))).filter(Boolean).sort();

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this email from inbox?")) return;
    try {
      await dataService.deleteInboxItem(id);
      setEmails(emails.filter(email => email.id !== id));
      if (selectedEmail?.id === id) setSelectedEmail(null);
    } catch (err) {
      alert("Failed to delete email");
    }
  };

  const filteredEmails = emails.filter(email => {
    if (!email) return false;
    const subj = (email.subject || "").toLowerCase();
    const from = (email.from_address || "").toLowerCase();
    const clientN = (email.clientName || "").toLowerCase();
    const projN = (email.projectName || "").toLowerCase();
    const pmN = (email.pmName || "").toLowerCase();
    const term = (searchTerm || "").toLowerCase();

    const matchesSearch = 
      subj.includes(term) ||
      from.includes(term) ||
      clientN.includes(term) ||
      projN.includes(term) ||
      pmN.includes(term);

    const matchesPM = !pmFilter || (email.pmName || `PM #${email.pm_id}`) === pmFilter;
    const matchesClient = !clientFilter || email.clientName === clientFilter;
    
    const emailDate = email.email_date ? new Date(email.email_date) : new Date(0);
    const matchesStartDate = !startDate || emailDate >= new Date(startDate);
    // End date should include the whole day
    const matchesEndDate = !endDate || emailDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999));

    return matchesSearch && matchesPM && matchesClient && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Project Inbox</h2>
            <p className="text-slate-500">Tracked communications from client email identifiers.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 w-64">
              <Search className="text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search inbox..." 
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-2 rounded-xl border transition-all flex items-center gap-2 text-sm font-semibold",
                showFilters 
                  ? "bg-primary/10 border-primary/20 text-primary" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Calendar className="w-4 h-4" />
              Filters
              {(pmFilter || clientFilter || startDate || endDate) && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </button>
            <button 
              onClick={triggerSync}
              disabled={syncing || loading}
              className={cn(
                "p-2 text-slate-400 hover:text-primary transition-colors flex items-center justify-center",
                (loading || syncing) && "animate-spin"
              )}
              title="Sync & Refresh Inbox"
            >
              <Mail className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PM Filter</label>
                  <select 
                    value={pmFilter}
                    onChange={(e) => setPmFilter(e.target.value)}
                    className="w-full bg-white border-slate-200 rounded-xl text-xs font-semibold focus:ring-primary focus:border-primary"
                  >
                    <option value="">All PMs</option>
                    {uniquePMs.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Client Filter</label>
                  <select 
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="w-full bg-white border-slate-200 rounded-xl text-xs font-semibold focus:ring-primary focus:border-primary"
                  >
                    <option value="">All Clients</option>
                    {uniqueClients.map(client => <option key={client} value={client}>{client}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border-slate-200 rounded-xl text-xs font-semibold focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                  <div className="flex gap-2">
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1 bg-white border-slate-200 rounded-xl text-xs font-semibold focus:ring-primary focus:border-primary"
                    />
                    {(pmFilter || clientFilter || startDate || endDate) && (
                      <button 
                        onClick={() => {
                          setPmFilter("");
                          setClientFilter("");
                          setStartDate("");
                          setEndDate("");
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Clear Filters"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Email List */}
        <div className={cn(
          "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all duration-300",
          selectedEmail ? "w-1/2" : "w-full"
        )}>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                <Mail className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium text-lg">Empty Inbox</p>
                <p className="text-sm">New emails will appear here when PMs sync or via cron jobs.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredEmails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={cn(
                      "p-4 cursor-pointer hover:bg-slate-50 transition-all group relative",
                      selectedEmail?.id === email.id ? "bg-slate-50 border-l-4 border-l-primary" : "",
                      email.type === "SENT" ? "bg-blue-50/20" : ""
                    )}
                  >
                    <div className="flex justify-between items-start mb-1 gap-4">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0",
                          email.type === "SENT" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                        )}>
                          {email.type || "INBOX"}
                        </div>
                        {email.source_role && (
                          <div className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0",
                            email.source_role === "PMM" ? "bg-purple-100 text-purple-600" :
                            (email.source_role === "PROJECTSBOT" || email.source_role === "PROJETSBOT" || email.source_role === "PROJECTBOT") ? "bg-indigo-100 text-indigo-600 border border-indigo-200" :
                            "bg-amber-100 text-amber-600"
                          )}>
                            Source: {email.source_role}
                          </div>
                        )}
                        <span 
                          className="font-black text-slate-900 truncate inline-block max-w-[180px] sm:max-w-[320px] min-w-0"
                          title={email.type === "SENT" ? `To: ${email.to_address}` : email.from_address}
                        >
                          {email.type === "SENT" ? `To: ${email.to_address}` : email.from_address}
                        </span>
                        {!!email.has_attachments && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-black uppercase tracking-wider shrink-0" title="Has Attachments">
                            <Paperclip className="w-3 h-3 text-amber-600" />
                            Attachment
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">
                        {formatDate(email.email_date)}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-700 truncate mb-1">
                      {email.subject}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase">
                          <span className="text-slate-400 opacity-70">Client:</span>
                          <span className="truncate max-w-[100px]">{email.clientName || "Unknown"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-bold uppercase">
                          <span className="text-primary/50 opacity-70">Project Name:</span>
                          <span className="truncate max-w-[150px]">{email.projectName || "Unassigned"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 ml-1">
                          <User className="w-3 h-3" />
                          <span className="truncate max-w-[100px]">{email.pmName || `PM #${email.pm_id}`}</span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => handleDelete(email.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Email Reading Pan */}
        <AnimatePresence>
          {selectedEmail && (
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="w-1/2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary relative">
                    <Mail className="w-5 h-5" />
                    {selectedEmail.type === "SENT" && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                  <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-slate-900 leading-tight truncate max-w-[200px]">{selectedEmail.subject}</h3>
                        <div className="flex gap-1">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                            selectedEmail.type === "SENT" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                          )}>
                            {selectedEmail.type || "INBOX"}
                          </span>
                          {selectedEmail.source_role && (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                              selectedEmail.source_role === "PMM" ? "bg-purple-100 text-purple-600" :
                              (selectedEmail.source_role === "PROJECTSBOT" || selectedEmail.source_role === "PROJETSBOT" || selectedEmail.source_role === "PROJECTBOT") ? "bg-indigo-100 text-indigo-600 border border-indigo-200" :
                              "bg-amber-100 text-amber-600"
                            )}>
                              {selectedEmail.source_role}
                            </span>
                          )}
                        </div>
                      </div>
                    <p className="text-xs text-slate-500">
                      {selectedEmail.type === "SENT" ? `To: ${selectedEmail.to_address}` : `From: ${selectedEmail.from_address}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!!selectedEmail.has_attachments && (
                    <button 
                      onClick={() => setShowAttachments(true)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                      title="View Attachments"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedEmail(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 prose prose-slate max-w-none">
                <div className="flex justify-between items-start mb-8 not-prose">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest w-16">Date</div>
                      <div className="text-xs font-semibold text-slate-600">{new Date(selectedEmail.email_date).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest w-16">Client</div>
                      <div className="text-xs font-semibold text-slate-600">{selectedEmail.clientName || "Unknown"}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest w-16">Project Name</div>
                      <div className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-bold uppercase tracking-wider">
                        {selectedEmail.projectName || "Unassigned"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest w-16">PM</div>
                      <div className="text-xs font-semibold text-slate-600">{selectedEmail.pmName}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Message ID</div>
                    <div className="text-[9px] font-mono text-slate-400 break-all max-w-[150px]">{selectedEmail.message_id}</div>
                  </div>
                </div>

                <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium">
                  {selectedEmail.body}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Attachments Modal */}
      <AnimatePresence>
        {showAttachments && selectedEmail && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary">
                    <Paperclip className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Email Attachments</h3>
                    <p className="text-xs text-slate-500">{selectedEmail.attachments.length} files detected</p>
                  </div>
                </div>
                <button onClick={() => setShowAttachments(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-3">
                {selectedEmail.attachments.length > 0 ? (
                  selectedEmail.attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 group hover:border-primary/20 hover:bg-white transition-all">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="shrink-0 w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-slate-400">
                          <Paperclip className="w-5 h-5" />
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-sm font-bold text-slate-900 truncate">{file.filename}</div>
                          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">
                            {file.mimeType} • {(file.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                      <button className="p-2 text-slate-300 hover:text-primary transition-colors">
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-400 italic text-sm">
                    Attachment metadata was not tracked for this email provider (Outlook).
                  </div>
                )}
              </div>
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Secure Attachment Viewer v1.0
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
