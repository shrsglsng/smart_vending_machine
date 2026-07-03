import { useEffect } from "react"
import { useSelector } from "react-redux"

export function useDynamicTheme() {
  const role = useSelector((state) => state.auth.role)

  useEffect(() => {
    const root = document.documentElement

    // Clear any legacy inline styles to let the scoped CSS classes take full control
    root.style.removeProperty("--primary")

    if (role === "SUPER_ADMIN") {
      root.setAttribute("data-theme", "super-admin")
    } else if (role === "TENANT_ADMIN") {
      root.setAttribute("data-theme", "tenant-admin")
    } else {
      // Fallback default theme (Super Admin light configuration is base default in index.css)
      root.removeAttribute("data-theme")
    }
  }, [role])
}
