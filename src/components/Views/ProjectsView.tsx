import React, { useState, useEffect } from "react";
import { useAuth } from "../../lib/AuthContext";
import { dataService } from "../../services/dataService";
import { Project, Client } from "../../types";
import { Plus, Calendar, User, ChevronRight, Trash2, Edit3, Briefcase, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { cn, formatDate } from "../../lib/utils";
import { ProjectModal } from "../ProjectModal";

export function ProjectsView() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pData, cData] = await Promise.all([
        dataService.getProjects(),
        dataService.getClients()
      ]);
      setProjects(pData);
      setClients(cData);
    } catch (err) {
      console.error("Failed to fetch projects data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (project: any) => {
    setProjectToEdit(project);
    setIsModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "active": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "on-hold":
      case "on hold": return "bg-amber-100 text-amber-700 border-amber-200";
      case "closed":
      case "completed": return "bg-slate-100 text-slate-700 border-slate-200";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const userRole = (user?.role || "").toLowerCase().replace(/_/g, "");
  const canManage = ["superadmin", "admin", "pmm"].includes(userRole);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Projects Master List</h2>
          <p className="text-slate-500">Overview of all communication lifecycle states.</p>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <button
              onClick={() => { setProjectToEdit(null); setIsModalOpen(true); }}
              className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 font-bold"
            >
              <Plus className="w-4 h-4" />
              Add Project
            </button>
          )}
          <button 
            onClick={fetchData}
            className="p-2 text-slate-400 hover:text-primary transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Project Details</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Stakeholders</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Timeline</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {projects.map((project, idx) => {
                return (
                  <motion.tr 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={project.id} 
                    className="hover:bg-slate-50/50 transition-all group"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                          <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap pb-0.5">
                            <div className="font-bold text-slate-900 group-hover:text-primary transition-colors">{project.name}</div>
                            {project.businessUnitName && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-50/80 text-blue-600 border border-blue-100 uppercase tracking-wider">
                                {project.businessUnitName}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-medium">#{project.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-[10px] font-bold text-slate-300 uppercase w-12 tracking-tighter">Client</span>
                          <span className="text-slate-700 font-semibold">{project.clientName || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-[10px] font-bold text-slate-300 uppercase w-12 tracking-tighter">PM</span>
                          <div className="flex items-center gap-1 text-slate-500">
                            <User className="w-3 h-3" />
                            <span>{project.pmName || "Auto-assigned"}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                        <Calendar className="w-4 h-4 text-slate-300" />
                        {formatDate(project.startDate)}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={cn("inline-flex px-3 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider", getStatusColor(project.status))}>
                        {project.status === "on-hold" ? "On Hold" : project.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-1">
                        {canManage && (
                          <button 
                            onClick={() => handleEdit(project)}
                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                            title="Edit Project"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        <button className="p-2 text-slate-300 hover:text-slate-900 transition-colors">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
              {projects.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Briefcase className="w-12 h-12 text-slate-100" />
                      <div className="text-slate-400 font-medium text-lg">No projects active</div>
                      <p className="text-slate-400 text-sm max-w-xs mx-auto">Projects link clients to PMs and track email communication lifecycle.</p>
                      {canManage && (
                        <button
                          onClick={() => setIsModalOpen(true)}
                          className="mt-4 text-primary font-bold hover:underline"
                        >
                          Launch your first project →
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setProjectToEdit(null); }}
        onSuccess={fetchData}
        projectToEdit={projectToEdit}
      />
    </div>
  );
}
