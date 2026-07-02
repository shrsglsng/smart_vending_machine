import { createSlice } from "@reduxjs/toolkit"

const analyticsSlice = createSlice({
  name: "analytics",
  initialState: {
    range: "daily",
  },
  reducers: {
    setRange: (state, action) => {
      state.range = action.payload
    },
  },
})

export const { setRange } = analyticsSlice.actions
export default analyticsSlice.reducer
