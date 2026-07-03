import { createSlice } from "@reduxjs/toolkit"

const initialState = {
  token: localStorage.getItem("auth_token") || null,
  role: localStorage.getItem("auth_role") || null,
  tenant_id: localStorage.getItem("auth_tenant_id") || null,
  impersonatedTenantId: null,
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { token, role, tenant_id } = action.payload
      state.token = token
      state.role = role
      state.tenant_id = tenant_id

      if (token) {
        localStorage.setItem("auth_token", token)
        localStorage.setItem("auth_role", role)
        localStorage.setItem("auth_tenant_id", tenant_id)
      } else {
        localStorage.removeItem("auth_token")
        localStorage.removeItem("auth_role")
        localStorage.removeItem("auth_tenant_id")
      }
    },
    setImpersonatedTenant: (state, action) => {
      state.impersonatedTenantId = action.payload
    },
    logout: (state) => {
      state.token = null
      state.role = null
      state.tenant_id = null
      state.impersonatedTenantId = null
      localStorage.removeItem("auth_token")
      localStorage.removeItem("auth_role")
      localStorage.removeItem("auth_tenant_id")
    },
  },
})

export const { setCredentials, setImpersonatedTenant, logout } = authSlice.actions
export default authSlice.reducer
