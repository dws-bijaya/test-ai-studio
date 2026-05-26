import React, { useState, useEffect } from "react";
import { dataService } from "../../services/dataService";
import { useAuth } from "../../lib/AuthContext";
import { 
  Video, 
  Calendar, 
  Clock, 
  Users, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  Edit3, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  FileText,
  Link,
  Save,
  AlertCircle
} from "lucide-react";
import { cn } from "../../lib/utils";

interface FathomMeeting {
  id: number;
  fathom_id: string;
  title: string;
  started_at: string;
  duration: number; // seconds
  recording_url: string;
  summary: string;
  transcript: string;
  people: string;
  project_id: number | null;
  projectName?: string;
}

export function FathomMeetingsView() {
  const { user: currentUser } = useAuth();
  const uRole = (currentUser?.role || "").replace(/_/g, "").toLowerCase();
  const isQuality = uRole === "quality";

  const [meetings, setMeetings] = useState<FathomMeeting[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  
  // Note editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedNotes, setEditedNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchMeetingsAndProjects = async () => {
    setLoading(true);
    try {
      const [meetingsData, projectsData] = await Promise.all([
        dataService.getFathomMeetings(),
        dataService.getProjects()
      ]);
      setMeetings(meetingsData);
      setProjects(projectsData);
    } catch (err) {
      console.error("Failed to load meetings data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetingsAndProjects();
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    setStatusMessage(null);
    try {
      const res = await dataService.syncFathomMeetings();
      await fetchMeetingsAndProjects();
      showStatus(res.message || "Fathom meetings synchronized successfully!", "success");
    } catch (err: any) {
      console.error("Fathom sync failed", err);
      showStatus(err.message || "Failed to sync with Fathom. Please verify API configuration.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const showStatus = (text: string, type: "success" | "error") => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 5000);
  };

  const handleLinkProject = async (meetingId: number, projIdStr: string) => {
    try {
      const projectId = projIdStr === "unlinked" ? null : Number(projIdStr);
      await dataService.linkFathomMeeting(meetingId, projectId);
      
      // Update local state smoothly
      setMeetings(prev => prev.map(m => {
        if (m.id === meetingId) {
          const matchedProj = projects.find(p => p.id === projectId);
          return {
            ...m,
            project_id: projectId,
            projectName: matchedProj ? matchedProj.name : undefined
          };
        }
        return m;
      }));
      
      showStatus("Meeting successfully linked to project!", "success");
    } catch (err: any) {
      showStatus("Failed to update project link", "error");
    }
  };

  const startEditingNotes = (meeting: FathomMeeting) => {
    setEditingId(meeting.id);
    setEditedNotes(meeting.summary || "");
  };

  const handleSaveNotes = async (meetingId: number) => {
    setSavingNotes(true);
    try {
      await dataService.updateFathomNotes(meetingId, editedNotes);
      setMeetings(prev => prev.map(m => {
        if (m.id === meetingId) {
          return { ...m, summary: editedNotes };
        }
        return m;
      }));
      setEditingId(null);
      showStatus("Notes updated successfully!", "success");
    } catch (err: any) {
      showStatus("Failed to save notes", "error");
    } finally {
      setSavingNotes(false);
    }
  };

  // Helper selectors
  const formatDuration = (seconds: number) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    return `${minutes}m ${remainingSecs}s`;
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "";
    try {
      return new Date(isoStr).toLocaleDateString("en-IN", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return isoStr;
    }
  };

  const filteredMeetings = meetings.filter(m => {
    const matchesSearch = 
      (m.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.people || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.summary || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.fathom_id || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesProject = 
      selectedProjectId === "all" ||
      (selectedProjectId === "unlinked" && !m.project_id) ||
      String(m.project_id) === selectedProjectId;

    return matchesSearch && matchesProject;
  });

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Video className="w-7 h-7 text-indigo-600 animate-pulse" />
            Fathom Video Meetings
          </h2>
          <p className="text-slate-500">
            Review auto-summarized calls and transcripts linked directly to clients and active projects.
          </p>
        </div>
        {!isQuality && (
          <div className="shrink-0">
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-100",
                syncing && "opacity-85 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
              {syncing ? "Syncing Fathom API..." : "Sync Fathom Now"}
            </button>
          </div>
        )}
      </div>

      {statusMessage && (
        <div className={cn(
          "p-4 rounded-xl border flex items-center gap-3 text-sm font-semibold transition-all",
          statusMessage.type === "success" 
            ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
            : "bg-red-50 text-red-700 border-red-100"
        )}>
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search meetings by title, people, summaries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 font-medium"
          />
        </div>
        <div className="w-full sm:w-60">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-700 font-semibold"
          >
            <option value="all">⚡ All Projects</option>
            <option value="unlinked">⚠️ Unlinked Only</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                📋 {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List / Cards */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-10 h-10 animate-spin text-indigo-500" />
          <p className="font-semibold text-slate-500">Loading Fathom meeting records...</p>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="flex-1 bg-white border border-slate-150 rounded-2xl p-16 flex flex-col items-center text-center max-w-xl mx-auto my-4 shadow-sm">
          <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mb-6">
            <Video className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No Fathom Meetings Found</h3>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            There are no meetings corresponding to your search criteria. Trigger a dynamic pull from the API key to populate meetings.
          </p>
          {!isQuality && (
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="px-5 py-2.5 rounded-xl border-2 border-indigo-150 text-indigo-600 font-bold hover:bg-slate-50 transition-all text-sm flex items-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
              Test Fathom Connection
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4">
          {filteredMeetings.map((meeting) => {
            const isExpanded = expandedId === meeting.id;
            const isEditing = editingId === meeting.id;

            return (
              <div 
                key={meeting.id}
                className={cn(
                  "bg-white rounded-2xl border border-slate-200 shadow-sm transition-all overflow-hidden flex flex-col group",
                  isExpanded ? "ring-1 ring-indigo-500 border-indigo-500 shadow-md" : "hover:shadow-md hover:border-slate-300"
                )}
              >
                {/* Meeting Header Row */}
                <div 
                  className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 cursor-pointer select-none"
                  onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
                >
                  <div className="flex gap-4 items-start flex-1 min-w-0">
                    <div className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                      <Video className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors truncate max-w-md">
                          {meeting.title}
                        </h4>
                        {meeting.projectName ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wide">
                            {meeting.projectName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-150 uppercase tracking-wide">
                            Unlinked
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(meeting.started_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatDuration(meeting.duration)}
                        </span>
                        {meeting.people && (
                          <span className="flex items-center gap-1 truncate max-w-[200px]" title={meeting.people}>
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {meeting.people}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Project Link selector */}
                  <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 self-stretch lg:self-center justify-end" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none hidden sm:inline">Project Link</span>
                      <select
                        value={meeting.project_id || "unlinked"}
                        disabled={isQuality}
                        onChange={(e) => handleLinkProject(meeting.id, e.target.value)}
                        className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                      >
                        <option value="unlinked">⚠️ Unlinked </option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>📋 {p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {meeting.recording_url && (
                        <a
                          href={meeting.recording_url}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible details section (Transcript & AI summary) */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-200/60 p-5 space-y-6">
                    {/* Two column notes / transcript details */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* AI Summary Section */}
                      <div className="flex flex-col gap-3 bg-white p-5 rounded-xl border border-slate-200/80">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h5 className="font-bold text-slate-950 text-sm flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            AI Summary & Key Takeaways
                          </h5>
                          {!isEditing && !isQuality ? (
                            <button
                              onClick={() => startEditingNotes(meeting)}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Refine Notes
                            </button>
                          ) : isEditing ? (
                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-150 px-2 py-0.5 rounded font-extrabold uppercase">Editing</span>
                          ) : null}
                        </div>

                        {isEditing ? (
                          <div className="flex flex-col gap-3 flex-1">
                            <textarea
                              rows={8}
                              value={editedNotes}
                              onChange={(e) => setEditedNotes(e.target.value)}
                              className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                              placeholder="Write meeting summary here..."
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveNotes(meeting.id)}
                                disabled={savingNotes}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-md shadow-indigo-100"
                              >
                                <Save className="w-3 h-3" />
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap flex-1">
                            {meeting.summary || "No automated summary notes compiled for this meeting record yet."}
                          </div>
                        )}
                      </div>

                      {/* Participant / Metadata / Transcript Section */}
                      <div className="flex flex-col gap-3 bg-white p-5 rounded-xl border border-slate-200/80">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h5 className="font-bold text-slate-950 text-sm flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-emerald-500" />
                            Meeting Participants
                          </h5>
                        </div>
                        <div className="text-sm text-slate-700 font-medium p-2 bg-slate-50/50 rounded-xl">
                          {meeting.people ? (
                            <div className="flex flex-wrap gap-2">
                              {meeting.people.split(",").map((person, index) => (
                                <span key={index} className="inline-flex bg-slate-100 text-slate-700 border border-slate-150 rounded-lg px-2.5 py-1 text-xs font-bold shadow-sm">
                                  {person.trim()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="italic text-slate-400">No participants registered in Fathom.</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 pt-4">
                          <h5 className="font-bold text-slate-950 text-sm flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-amber-500" />
                            Highlights & Call Details
                          </h5>
                        </div>
                        <div className="text-xs text-slate-500 font-mono space-y-1.5">
                          <p><strong className="text-slate-750">Fathom Meeting ID:</strong> {meeting.fathom_id}</p>
                          <p><strong className="text-slate-750">Linked Client ID:</strong> {meeting.project_id ? `#${meeting.project_id}` : "None"}</p>
                          <p><strong className="text-slate-750">Recording:</strong> {meeting.recording_url ? <a className="text-indigo-600 font-semibold underline hover:text-indigo-800" href={meeting.recording_url} target="_blank" rel="noopener noreferrer">Open Watch Recording Link</a> : "N/A"}</p>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
