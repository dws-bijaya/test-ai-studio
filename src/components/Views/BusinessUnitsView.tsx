import React, { useState, useEffect } from "react";
import { dataService } from "../../services/dataService";
import { BusinessUnit } from "../../types";
import { Layers, Edit2, Check, X, Building, Loader2, Save } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../lib/AuthContext";

export function BusinessUnitsView() {
  const { user } = useAuth();
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const data = await dataService.getBusinessUnits();
      setUnits(data);
    } catch (err) {
      console.error("Failed to fetch business units", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleStartEdit = (b: BusinessUnit) => {
    setEditingId(b.id);
    setEditName(b.name);
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setErrorMsg("");
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) {
      setErrorMsg("Name cannot be empty.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      await dataService.updateBusinessUnit(id, editName.trim());
      setSuccessMsg("Business Unit updated successfully!");
      setEditingId(null);
      setEditName("");
      // Refresh list
      const data = await dataService.getBusinessUnits();
      setUnits(data);
      // Auto-hide success message
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save name.");
    } finally {
      setSaving(false);
    }
  };

  const isAuthorized = ["superadmin", "admin"].includes(
    (user?.role || "").toLowerCase().replace(/_/g, "")
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 font-sans tracking-tight">Business Units</h2>
        <p className="text-slate-500">View and manage target operations and brand business units.</p>
      </div>

      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl flex items-center gap-2 text-sm font-medium"
        >
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl flex items-center gap-2 text-sm font-medium"
        >
          <X className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-primary w-8 h-8" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {units.map((unit) => {
            const isEditing = editingId === unit.id;
            return (
              <motion.div
                key={unit.id}
                layout
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between h-48 relative overflow-hidden"
              >
                {/* Visual accent lines */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-80" />

                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                      <Building className="w-6 h-6" />
                    </div>
                    {isAuthorized && !isEditing && (
                      <button
                        onClick={() => handleStartEdit(unit)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all"
                        title="Edit Business Unit Name"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm font-bold text-slate-900 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="Business unit name"
                        autoFocus
                        disabled={saving}
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={handleCancelEdit}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                          disabled={saving}
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(unit.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Save className="w-3 h-3" />
                          )}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-lg tracking-tight font-sans capitalize group-hover:text-blue-600 transition-colors">
                        {unit.name}
                      </h3>
                      <p className="text-slate-400 font-mono text-[11px] uppercase tracking-wider mt-0.5">
                        Brand Unit
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="text-[10px] text-slate-400 font-mono font-bold tracking-wider">
                    ID: #{unit.id}
                  </div>
                  <div className="flex items-center gap-1 bg-blue-50/50 text-blue-700 text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-blue-100/50">
                    <Layers className="w-3 h-3" />
                    BU
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
