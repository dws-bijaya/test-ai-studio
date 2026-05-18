import React, { useState, useEffect } from "react";
import { useAuth } from "../../lib/AuthContext";
import { dataService } from "../../services/dataService";
import { Client } from "../../types";
import { Plus, Search, Trash2, Mail, Globe, X, User, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function ClientsView({ onViewChange }: { onViewChange?: (view: any) => void }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({ name: "", emailIds: "", url: "" });
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await dataService.getClients();
      setClients(data);
    } catch (err) {
      console.error("Failed to fetch clients", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setNewClient({
      name: client.name,
      emailIds: client.emailIdentifiers.join(", "),
      url: client.url || ""
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClient(null);
    setNewClient({ name: "", emailIds: "", url: "" });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      // Split comma separated emails and clean them
      const emailList = newClient.emailIds
        .split(/[\s,]+/)
        .map(email => email.trim())
        .filter(email => email.length > 0 && email.includes("@"));

      if (emailList.length === 0) {
        alert("Please provide at least one valid email address.");
        return;
      }

      if (editingClient) {
        await dataService.updateClient(editingClient.id, {
          name: newClient.name,
          emailIdentifiers: emailList,
          url: newClient.url
        });
      } else {
        await dataService.createClient({
          name: newClient.name,
          emailIdentifiers: emailList,
          url: newClient.url,
          pmId: String(user.id)
        });
      }

      closeModal();
      fetchClients();
    } catch (err: any) {
      alert("Failed to save client: " + (err.message || ""));
    }
  };

  const userRole = (user?.role || "").toLowerCase().replace(/_/g, "");
  const canManage = ["superadmin", "admin", "pmm"].includes(userRole);

  const handleDelete = async (id: string | number) => {
    if (confirm("Are you sure you want to delete this client? Linked projects will also be deleted.")) {
      try {
        await dataService.deleteClient(id);
        fetchClients();
      } catch (err) {
        alert("Failed to delete client");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Clients Master List</h2>
          <p className="text-slate-500">Manage clients and their tracked email addresses.</p>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap shadow-lg shadow-primary/20 font-bold"
            >
              <Plus className="w-4 h-4" />
              Add Client
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => (
            <motion.div
              layout
              key={client.id}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-primary/5 p-3 rounded-lg">
                  <Mail className="text-primary w-5 h-5" />
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleEdit(client)}
                      className="text-slate-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100 p-2 hover:bg-blue-50 rounded-lg"
                      title="Edit Client"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(client.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg"
                      title="Delete Client"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              <h3 className="font-bold text-slate-900 text-xl mb-1">{client.name}</h3>
              
              {client.url && (
                <div className="flex items-center gap-1.5 text-blue-600 text-sm mb-4 hover:underline">
                  <Globe className="w-3.5 h-3.5" />
                  <a href={client.url.startsWith('http') ? client.url : `https://${client.url}`} target="_blank" rel="noreferrer">
                    {client.url.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2 text-left">Tracked Email ID</p>
                  <div className="flex flex-wrap gap-2">
                    {client.emailIdentifiers.map((email, idx) => (
                      <span key={idx} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-md text-sm font-medium border border-slate-200">
                        {email}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <User className="w-3 h-3" />
                    <span>By {client.created_by_name || 'System'}</span>
                  </div>
                  {client.created_at && (
                    <div className="text-[10px] text-slate-400">
                      {new Date(client.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && clients.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">No clients found.</p>
        </div>
      )}

      {/* Add Client Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{editingClient ? "Edit Client" : "Add New Client"}</h3>
                </div>
                <button 
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 text-left block">Client Name</label>
                  <input
                    required
                    type="text"
                    value={newClient.name}
                    onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="e.g. Google Inc."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 text-left block flex items-center justify-between">
                    <span>Email Identifiers</span>
                    <span className="text-[10px] text-slate-400 font-normal uppercase">Comma separated</span>
                  </label>
                  <textarea
                    required
                    value={newClient.emailIds}
                    onChange={e => setNewClient({ ...newClient, emailIds: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[80px] text-sm"
                    placeholder="sns@edsltd.com, hnw@edsltd.com, jackie@nerdzee.com"
                  />
                  <p className="text-[10px] text-slate-400">Emails used to track communication related to this client.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 text-left block">Company URL</label>
                  <input
                    type="text"
                    value={newClient.url}
                    onChange={e => setNewClient({ ...newClient, url: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="https://google.com"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
                  >
                    {editingClient ? "Update Client" : "Save Client"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
