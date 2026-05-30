import React, { useState, useEffect } from "react";
import { dataService } from "../../services/dataService";
import { Link2, Mail, ExternalLink, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../../lib/AuthContext";

interface Connection {
  id: number;
  user_id: number;
  provider: "gmail" | "outlook" | null;
  email: string | null;
  status: "active" | "invalid" | "pending" | "expired";
  created_at: string;
  userEmail: string;
  userName: string;
  userRole: string;
}

export function ConnectionsView() {
  const { user: currentUser } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [authPopupOpen, setAuthPopupOpen] = useState(false);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const data = await dataService.getConnections();
      setConnections(data);
    } catch (err) {
      console.error("Failed to fetch connections", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const openAuthWindow = (url: string) => {
    const width = 600;
    const height = 700;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;
    
    const popup = window.open(
      url, 
      "oauth-auth", 
      `width=${width},height=${height},left=${left},top=${top}`
    );

    const checkPopup = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(checkPopup);
        fetchConnections();
      }
    }, 1000);
  };

  const handleConnectGmail = async (userId: number) => {
    try {
      const { url } = await dataService.getGoogleAuthUrl(userId);
      openAuthWindow(url);
    } catch (err) {
      alert("Failed to get Google auth URL");
    }
  };

  const handleConnectOutlook = async (userId: number) => {
    try {
      const { url } = await dataService.getMicrosoftAuthUrl(userId);
      openAuthWindow(url);
    } catch (err) {
      alert("Failed to get Microsoft auth URL");
    }
  };

  const [connectingId, setConnectingId] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Connections</h2>
          <p className="text-slate-500">Manage OAuth2 links for Gmail and Office 365.</p>
        </div>
        <button 
          onClick={fetchConnections}
          className="p-2 text-slate-400 hover:text-primary transition-colors"
          title="Refresh List"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {connections.map(conn => (
            <motion.div
              layout
              key={conn.id}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    conn.provider === 'gmail' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 capitalize">{conn.provider || "Unlinked"} Connection</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm text-slate-500">User: {conn.userName || conn.userEmail}</p>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold uppercase">Role: {conn.userRole === 'PMB' ? 'Project Bot' : (conn.userRole || 'PM')}</span>
                    </div>
                  </div>
                </div>
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase",
                  conn.status === 'active' ? "bg-green-50 text-green-600" : 
                  conn.status === 'pending' ? "bg-slate-50 text-slate-500" : 
                  conn.status === 'expired' ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-red-50 text-red-600"
                )}>
                  {conn.status === 'active' ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                  {conn.status}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Connected Email</div>
                  <div className="text-slate-700 font-medium break-all text-sm">
                    {conn.email || <span className="text-slate-400 italic">Not connected yet</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  {(() => {
                    const uRole = (currentUser?.role || "").replace(/_/g, "").toLowerCase();
                    const currentUserIdString = String(currentUser?.id || "");
                    const connectionUserIdString = String(conn.user_id || "");
                    
                    const isOwner = currentUserIdString === connectionUserIdString;
                    const isPM = uRole === "pm" || uRole === "projectmanager";
                    const isAdmin = uRole === "admin" || uRole === "superadmin" || uRole === "pmm";
                    
                    const isAuthorisedToLink = (isOwner || (isAdmin && isPM)) && uRole !== "quality"; // Admins can link PMs if they want? Or just PMs link themselves.
                    // Actually, let's just make it simple: if you are the user or if you are an admin.
                    const canLink = (isOwner || isAdmin) && uRole !== "quality";

                    const handleRevoke = async () => {
                      if (!confirm("Are you sure you want to revoke this connection?")) return;
                      try {
                        await dataService.revokeConnection(conn.id);
                        fetchConnections();
                      } catch (err: any) {
                        alert(err.message);
                      }
                    };

                    if (canLink) {
                      if (connectingId === conn.id) {
                        return (
                          <div className="p-2 border border-primary/20 rounded-lg bg-primary/5">
                            <div className="text-[10px] text-primary uppercase font-bold mb-2">Choose your provider</div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => { handleConnectGmail(conn.user_id); setConnectingId(null); }}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-all shadow-sm"
                              >
                                <Mail className="w-3 h-3" />
                                Gmail
                              </button>
                              <button
                                onClick={() => { handleConnectOutlook(conn.user_id); setConnectingId(null); }}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                              >
                                <Mail className="w-3 h-3" />
                                Office 365
                              </button>
                            </div>
                            <button 
                              onClick={() => setConnectingId(null)}
                              className="w-full mt-2 py-1 text-[10px] text-slate-400 hover:text-slate-600 uppercase font-bold"
                            >
                              Cancel
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-slate-400 uppercase">
                            Sync enabled: {conn.status === 'active' ? 'Yes' : 'No'}
                          </div>
                          <div className="flex items-center gap-2">
                            {conn.status === 'active' && (
                              <button
                                onClick={handleRevoke}
                                className="px-4 py-2 bg-red-50 text-red-600 text-sm font-bold rounded-lg hover:bg-red-100 transition-all"
                              >
                                Revoke
                              </button>
                            )}
                            <button
                              onClick={() => setConnectingId(conn.id)}
                              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm"
                            >
                              <Link2 className="w-4 h-4" />
                              {conn.status === 'active' ? 'Reconnect' : 'Connect Now'}
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-slate-400 uppercase">
                          Sync enabled: {conn.status === 'active' ? 'Yes' : 'No'}
                        </div>
                        <div className="text-[10px] text-slate-300 italic px-2 py-1 border border-slate-100 rounded bg-slate-50">
                          User intervention required
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && connections.length === 0 && (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <Link2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">No Connection Records</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            Connection records are automatically created for Project Managers.
          </p>
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
