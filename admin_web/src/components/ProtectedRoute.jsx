import React from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useSelector } from "react-redux"

export function ProtectedRoute({ allowedRoles }) {
  const { token, role } = useSelector((state) => state.auth)

  if (!token) {
    // Redirect to login page
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Role is not allowed, redirect to main protected dashboard or unauthorized
    return <Navigate to="/dashboard" replace />
  }

  // Renders nested routes
  return <Outlet />
}
