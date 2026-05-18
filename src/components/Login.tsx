import React, { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { motion } from "motion/react";
import { Mail, ShieldCheck, Key, Lock } from "lucide-react";

export function Login() {
  const { loginWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);

  const handleEmailSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  const seedSystem = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch("/api/setup-admin", { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        alert("System seeded! Super Admin created. Use: bijaya.kumar@digitalwebsolutions.in / Admin123@123!");
      } else {
        alert("Seed failed: " + data.message);
      }
    } catch (err) {
      alert("Error seeding system.");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-10 text-center border border-slate-100"
      >
        <div className="bg-primary/5 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Mail className="text-primary w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">PM Monitor Tools</h1>
        <p className="text-slate-500 mb-8">Centralized project communication dashboard for professional agencies.</p>
        
        <form onSubmit={handleEmailSubmit} className="space-y-4 text-left">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="admin@example.com"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          {error && <p className="text-red-500 text-xs italic">{error}</p>}
          <button 
            type="submit"
            className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
          >
            Login
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
            <ShieldCheck className="w-4 h-4" />
            Secure Enterprise Authentication
          </div>
          <button 
            onClick={seedSystem}
            disabled={isSeeding}
            className="text-[10px] text-slate-300 hover:text-primary transition-colors flex items-center gap-1 mx-auto"
          >
            <Key className="w-3 h-3" />
            {isSeeding ? "Seeding..." : "Seed System Admin"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
