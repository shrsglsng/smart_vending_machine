import React from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate, Link, useLocation, Outlet } from "react-router-dom"
import {
  LogOut,
  LayoutDashboard,
  Cpu,
  ShoppingBag,
  AlertTriangle,
  Building,
  Sun,
  Moon,
  Utensils,
  UserCheck,
} from "lucide-react"

import { logout } from "../store/authSlice"
import { motion, AnimatePresence } from "framer-motion"

export function DashboardLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  
  const { role, tenant_id } = useSelector((state) => state.auth)

  // Dynamic Dark Mode State persisted to localStorage
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    return localStorage.getItem("theme") === "dark"
  })

  React.useEffect(() => {
    const root = document.documentElement
    if (isDarkMode) {
      root.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      root.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [isDarkMode])

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev)
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate("/login", { replace: true })
  }

  // Sidebar navigation mapping grouped to make layout balanced and structured
  const navGroups = [
    {
      title: "Core Monitor",
      items: [
        { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      title: "Fleet & Access",
      items: [
        ...(role === "SUPER_ADMIN" ? [{ label: "Tenants", path: "/dashboard/tenants", icon: Building }] : []),
        { label: "Machines", path: "/dashboard/machines", icon: Cpu },
        { label: "Food items", path: "/dashboard/food-items", icon: Utensils },
        { label: "Operators", path: "/dashboard/operators", icon: UserCheck },
      ],
    },
    {
      title: "Operations Feed",
      items: [
        { label: "Orders", path: "/dashboard/orders", icon: ShoppingBag },
        { label: "Reports", path: "/dashboard/reports", icon: AlertTriangle },
      ],
    },
  ]

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Fixed Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground z-20 flex flex-col justify-between overflow-hidden transition-colors duration-200">
        <div>
          {/* Logo and Dark Mode Switcher */}
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md font-mono">
              V
            </div>
            
            {/* Dynamic Theme Toggle Button */}
            <motion.button
              whileHover={{ scale: 1.1, rotate: 12 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleDarkMode}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 focus-visible:outline-none cursor-pointer"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="h-4 w-4 text-amber-500 animate-pulse" /> : <Moon className="h-4 w-4" />}
            </motion.button>
          </div>

          {/* Sidebar Nav Groups */}
          <div className="space-y-5 p-4">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <h3 className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-sidebar-foreground/40 font-mono">
                  {group.title}
                </h3>
                <nav className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path
                    return (
                      <motion.div
                        key={item.path}
                        whileHover={{ x: isActive ? 0 : 4 }}
                        whileTap={{ scale: 0.985 }}
                      >
                        <Link
                          to={item.path}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 ${isActive
                            ? "bg-primary/10 text-primary border-l-3 border-primary rounded-l-none pl-2.5"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      </motion.div>
                    )
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Footer Info (Tightly integrated, dynamic card) */}
        <div className="p-4 space-y-3">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3 flex flex-col gap-0.5 select-none">
            <p className="text-[9px] font-extrabold text-sidebar-foreground/40 uppercase tracking-widest font-mono">System Role</p>
            <p className="text-xs font-extrabold text-primary font-mono">
              {role === "SUPER_ADMIN" ? "Super Admin" : "Tenant Admin"}
            </p>
            <p className="text-[10px] font-medium text-sidebar-foreground/60 break-all truncate" title={role === "SUPER_ADMIN" ? "aibotink.web@gmail.com" : tenant_id}>
              {role === "SUPER_ADMIN" ? "aibotink.web@gmail.com" : tenant_id}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-destructive bg-destructive/10 hover:bg-destructive/20 hover:text-destructive transition-all duration-200 cursor-pointer font-mono"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </motion.button>
        </div>
      </aside>

      <div className="ml-64 flex flex-1 flex-col h-screen overflow-y-auto bg-background transition-colors duration-200">
        <main className="flex-1 p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
