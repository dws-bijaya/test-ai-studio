import React, { useState, useEffect } from "react";
import { dataService } from "../../services/dataService";
import { UserProfile, UserRole } from "../../types";
import { User, Shield, Mail, Search, Plus, X, Edit2, Trash2, Calendar, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../lib/AuthContext";

export function UsersView() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    role: "PM" as UserRole,
    password: "",
    managerId: ""
  });

  const roles: UserRole[] = ["SuperAdmin", "Admin", "PMM", "PM", "Quality", "PMB"];
  const managers = users.filter(u => u.role === "PMM");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await dataService.getUsers();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({ fullName: "", email: "", role: "PM", password: "", managerId: "" });
    setShowModal(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({ 
      fullName: user.displayName || user.full_name || "", 
      email: user.email, 
      role: user.role, 
      password: "",
      managerId: user.manager_id ? String(user.manager_id) : ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await dataService.updateUser(editingUser.id, formData);
      } else {
        await dataService.createUser(formData);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || "Failed to save user");
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await dataService.deleteUser(id);
      fetchUsers();
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.displayName || user.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canCreate = ["SuperAdmin", "Admin", "PMM"].includes(currentUser?.role || "") && currentUser?.role !== "Quality";
  const isSuperAdmin = currentUser?.role === "SuperAdmin";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Users Management</h2>
          <p className="text-slate-500">Manage team members and their access levels.</p>
        </div>
        {canCreate && (
          <button 
            onClick={handleOpenAdd}
            className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Search by name or email..." 
          className="flex-1 bg-transparent border-none focus:ring-0 text-slate-900 placeholder:text-slate-400"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(user => (
            <motion.div
              layout
              key={user.id}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-slate-100 p-3 rounded-full">
                  <User className="text-slate-600 w-6 h-6" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canCreate && (
                    <button 
                      onClick={() => handleOpenEdit(user)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg"
                      title="Edit Profile"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {isSuperAdmin && currentUser?.role !== "Quality" && String(user.id) !== String(currentUser?.id) && (
                    <button 
                      onClick={() => handleDelete(user.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete User"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0 mb-4">
                <h3 className="font-bold text-slate-900 truncate">{user.displayName || user.full_name || "Unknown User"}</h3>
                <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-1">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{user.email}</span>
                </div>
                {user.created_at && (
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <Calendar className="w-3 h-3" />
                    <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                  user.role === "SuperAdmin" 
                    ? "bg-red-50 text-red-600 border border-red-100" 
                    : user.role === "Admin"
                    ? "bg-amber-50 text-amber-600 border border-amber-100"
                    : user.role === "PMM"
                    ? "bg-purple-50 text-purple-600 border border-purple-100"
                    : user.role === "PMB"
                    ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                    : user.role === "Quality"
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    : "bg-blue-50 text-blue-600 border border-blue-100"
                )}>
                  <Shield className="w-3 h-3" />
                  {user.role === "PMB" ? "Project Bot" : user.role}
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-slate-300 font-mono uppercase">ID: {user.id}</span>
                  {user.created_by && (
                    <span className="text-[9px] text-slate-400">By Admin #{user.created_by}</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      
      {!loading && filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">No users found.</p>
        </div>
      )}

      {/* Modal */}
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
                    {editingUser ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingUser ? "Edit Profile" : "Create New User"}
                  </h3>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Full Name</label>
                  <input
                    required
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Email ID</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="john@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  >
                    {roles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                
                {formData.role === "PM" && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Reporting To (PMM)</label>
                    <select
                      value={formData.managerId}
                      onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                    >
                      <option value="">Select Manager</option>
                      {managers.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.displayName || p.full_name} ({p.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!editingUser && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Password (Optional)</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="Leave blank for default"
                    />
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
                  >
                    {editingUser ? "Save Changes" : "Create User"}
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

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
