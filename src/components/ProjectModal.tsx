import React, { useState, useEffect } from "react";
import { dataService } from "../services/dataService";
import { Client } from "../types";
import { X, Calendar, User, Briefcase, Tag } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../lib/AuthContext";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectToEdit?: any;
}

export function ProjectModal({ isOpen, onClose, onSuccess, projectToEdit }: ProjectModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    clientId: "",
    pmId: "",
    startDate: new Date().toISOString().split("T")[0],
    status: "active" as const
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [pms, setPms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchOptions();
      if (projectToEdit) {
        setFormData({
          name: projectToEdit.name,
          clientId: projectToEdit.clientId,
          pmId: projectToEdit.pmId,
          startDate: projectToEdit.startDate,
          status: projectToEdit.status
        });
      } else {
        setFormData({
          name: "",
          clientId: "",
          pmId: "",
          startDate: new Date().toISOString().split("T")[0],
          status: "active"
        });
      }
    }
  }, [isOpen, projectToEdit]);

  const fetchOptions = async () => {
    try {
      const [eligibleClients, allUsers] = await Promise.all([
        dataService.getEligibleClients(),
        dataService.getUsers()
      ]);
      
      let clientsList = eligibleClients;
      // If editing, add the current client back to the list if they aren't there
      if (projectToEdit) {
        const currentClient = (await dataService.getClients()).find((c: any) => c.id === projectToEdit.clientId);
        if (currentClient && !clientsList.find((c: any) => c.id === currentClient.id)) {
          clientsList = [currentClient, ...clientsList];
        }
      }
      
      setClients(clientsList);
      
      const managers = allUsers.filter((u: any) => ["pmm", "admin", "superadmin"].includes(u.role.toLowerCase()));
      const pmUsers = allUsers.filter((u: any) => u.role.toLowerCase().includes("pm"));
      
      const grouped: any[] = [];
      managers.forEach((m: any) => {
        const managed = pmUsers.filter((pm: any) => Number(pm.manager_id) === Number(m.id));
        if (managed.length > 0 || m.role.toLowerCase() === "pmm") {
          grouped.push({ isManager: true, ...m });
          managed.forEach((pm: any) => {
            grouped.push({ isManager: false, ...pm });
          });
        }
      });
      
      // Add unmanaged PMs
      const unmanaged = pmUsers.filter((pm: any) => !managers.find(m => Number(m.id) === Number(pm.manager_id)));
      if (unmanaged.length > 0) {
        grouped.push({ isManager: true, displayName: "Other Project Managers", id: "other" });
        unmanaged.forEach((pm: any) => {
          grouped.push({ isManager: false, ...pm });
        });
      }

      setPms(grouped);
    } catch (err) {
      console.error("Failed to fetch modal options:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (projectToEdit) {
        await dataService.updateProject(projectToEdit.id, formData);
      } else {
        await dataService.createProject(formData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save project");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              {projectToEdit ? "Edit Project" : "Add New Project"}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Website Overhaul"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    Client <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none bg-white"
                  >
                    <option value="">Select Client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    Project Manager <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.pmId}
                    onChange={(e) => setFormData({ ...formData, pmId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none bg-white"
                  >
                    <option value="">--- Select a PM ---</option>
                    {pms.map((p) => (
                      <option 
                        key={p.id} 
                        value={p.isManager ? "" : p.id}
                        disabled={p.isManager}
                        className={p.isManager ? "font-bold text-slate-500 bg-slate-50" : ""}
                      >
                        {p.isManager ? `----- ${p.displayName || p.userName || p.email}` : `--------- ${p.displayName || p.userName || p.email}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] bg-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? "Saving..." : projectToEdit ? "Update Project" : "Create Project"}
              </button>
            </div>
          </form>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
              Author: {user?.full_name || user?.displayName || user?.email}
            </div>
            <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
              System Stamp: {new Date().toLocaleDateString()}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
