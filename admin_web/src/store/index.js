import { configureStore } from "@reduxjs/toolkit"
import authReducer from "./authSlice"
import analyticsReducer from "./analyticsSlice"

export const store = configureStore({
  reducer: {
    auth: authReducer,
    analytics: analyticsReducer,
  },
})
