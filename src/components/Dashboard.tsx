import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { 
  Users, 
  Briefcase, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Mail,
  Link,
  Calendar,
  Layers
} from "lucide-react";
import { cn } from "../lib/utils";
import { ClientsView } from "./Views/ClientsView";
import { ProjectsView } from "./Views/ProjectsView";
import { DashboardView } from "./Views/DashboardView";
import { UsersView } from "./Views/UsersView";
import { ConnectionsView } from "./Views/ConnectionsView";
import { InboxView } from "./Views/InboxView";
import { CronLogsView } from "./Views/CronLogsView";
import { PMInboxWeeklyView } from "./Views/PMInboxWeeklyView";
import { BusinessUnitsView } from "./Views/BusinessUnitsView";

type View = "dashboard" | "clients" | "projects" | "users" | "connections" | "inbox" | "cronlogs" | "pm_weekly" | "business_units";

export function Dashboard() {
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3, roles: ["PM", "Admin", "PMM", "SuperAdmin"] },
    { id: "inbox", label: "Inbox", icon: Mail, roles: ["PM", "Admin", "PMM", "SuperAdmin"] },
    { id: "projects", label: "Projects", icon: Briefcase, roles: ["PM", "Admin", "PMM", "SuperAdmin"] },
    { id: "pm_weekly", label: "PM Inbox (Weekly)", icon: Calendar, roles: ["Admin", "PMM", "SuperAdmin"] },
    { id: "clients", label: "Clients", icon: Users, roles: ["PM", "Admin", "PMM", "SuperAdmin"] },
    { id: "users", label: "Users", icon: Users, roles: ["SuperAdmin", "Admin", "PMM"] },
    { id: "business_units", label: "Business Units", icon: Layers, roles: ["SuperAdmin", "Admin"] },
    { id: "connections", label: "Connections", icon: Link, roles: ["PM", "Admin", "PMM", "SuperAdmin"] },
    { id: "cronlogs", label: "Cron Logs", icon: Settings, roles: ["SuperAdmin", "Admin"] },
  ];

  const filteredMenu = menuItems.filter(item => {
    const userRole = (user?.role || "").replace(/_/g, "").toLowerCase();
    return item.roles.some(r => r.toLowerCase().replace(/_/g, "") === userRole);
  });

  const renderView = () => {
    switch (activeView) {
      case "dashboard": return <DashboardView />;
      case "inbox": return <InboxView />;
      case "users": return <UsersView />;
      case "connections": return <ConnectionsView />;
      case "clients": return <ClientsView onViewChange={setActiveView} />;
      case "projects": return <ProjectsView />;
      case "cronlogs": return <CronLogsView />;
      case "pm_weekly": return <PMInboxWeeklyView />;
      case "business_units": return <BusinessUnitsView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
            <Mail className="text-white w-6 h-6" />
          </div>
          {isSidebarOpen && <span className="font-bold text-slate-900 truncate">PM Monitor Tools</span>}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {filteredMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                activeView === item.id 
                  ? "bg-slate-900 text-white" 
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeView === item.id ? "text-white" : "text-slate-400 group-hover:text-slate-900")} />
              {isSidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span className="font-medium">Logout</span>}
          </button>
          {isSidebarOpen && user && (
            <div className="mt-4 px-3 py-2 bg-slate-50 rounded-lg">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">
                {user.role.replace("_", " ")}
              </p>
              <p className="text-sm font-bold text-slate-900 truncate">{user.full_name || user.displayName || user.email}</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
