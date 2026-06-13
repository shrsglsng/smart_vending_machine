import React from "react"
import { Routes, Route, Navigate } from "react-router-dom"

import { Login } from "./views/Login"
import { DashboardLayout } from "./views/DashboardLayout"
import { DashboardView } from "./views/DashboardView"
import { TenantsView } from "./views/TenantsView"
import { MachinesView } from "./views/MachinesView"
import { MachineConfigureView } from "./views/MachineConfigureView"
import { OrdersView } from "./views/OrdersView"
import { ReportsView } from "./views/ReportsView"
import { FoodItemsView } from "./views/FoodItemsView"
import { OperatorsView } from "./views/OperatorsView"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { useDynamicTheme } from "./hooks/useDynamicTheme"

function App() {
  // Activate the dynamic theming utility hook to automatically adjust --primary color based on active role
  useDynamicTheme()

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardView />} />
          <Route path="tenants" element={<TenantsView />} />
          <Route path="machines" element={<MachinesView />} />
          <Route path="machines/:machineId/configure" element={<MachineConfigureView />} />
          <Route path="orders" element={<OrdersView />} />
          <Route path="reports" element={<ReportsView />} />
          <Route path="food-items" element={<FoodItemsView />} />
          <Route path="operators" element={<OperatorsView />} />
        </Route>
      </Route>

      {/* Fallback route - Redirect any unmatched route to protected dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
