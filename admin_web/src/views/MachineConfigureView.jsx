import React, { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { Cpu, ArrowLeft, Loader2, AlertCircle, ShieldCheck } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import api from "../services/api"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"

export function MachineConfigureView() {
  const { machineId } = useParams()
  const navigate = useNavigate()
  
  const { role, tenant_id } = useSelector((state) => state.auth)

  const [configureMachine, setConfigureMachine] = useState(null)
  const [configureSlots, setConfigureSlots] = useState([])
  const [catalogItems, setCatalogItems] = useState([])
  const [operators, setOperators] = useState([])
  const [selectedSlotId, setSelectedSlotId] = useState(null)
  const [mappingMode, setMappingMode] = useState("SINGLE") // "SINGLE" | "ROW" | "COLUMN"
  const [selectedOperatorId, setSelectedOperatorId] = useState("")
  const [selectedShift, setSelectedShift] = useState("BREAKFAST")
  const [clearoutRequired, setClearoutRequired] = useState(true)

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitLoading, setIsSubmitLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true)
      setErrorMsg(null)
      setSuccessMsg(null)
      try {
        // 1. Fetch slots and machine config
        const slotsRes = await api.get(`/admin/machine/slots/${machineId}`)
        const machineData = slotsRes.data || {}
        setConfigureMachine(machineData)

        // 2. Fetch catalog items
        const catalogRes = await api.get("/admin/catalog")
        setCatalogItems(catalogRes.data || [])

        // 3. Fetch operators with appropriate tenant context
        const activeTenant = role === "SUPER_ADMIN" ? machineData.tenant_id : tenant_id
        let operatorsUrl = "/admin/operators"
        if (role === "SUPER_ADMIN" && activeTenant) {
          operatorsUrl += `?tenant_id=${activeTenant}`
        }
        const operatorsRes = await api.get(operatorsUrl)
        const opsList = operatorsRes.data || []
        setOperators(opsList)
        if (opsList.length > 0) {
          setSelectedOperatorId(opsList[0]._id || opsList[0].id)
        }

        // Initialize slot layout grid
        const rowsCount = machineData.grid_config?.rows || 6
        const colsCount = machineData.grid_config?.columns || 8
        const machineSlots = machineData.slots || []
        const initialSlots = []

        for (let r = 1; r <= rowsCount; r++) {
          for (let c = 1; c <= colsCount; c++) {
            const slotId = `R${r}-C${c}`
            const existing = machineSlots.find((s) => s.slot_id === slotId)
            initialSlots.push({
              row: r,
              column: c,
              slot_id: slotId,
              item_id: existing ? existing.item_id : null,
              quantity: existing ? existing.quantity : 0,
              status: existing ? existing.status : "ACTIVE"
            })
          }
        }
        setConfigureSlots(initialSlots)
      } catch (err) {
        console.error("Failed to load slot configuration panel:", err)
        setErrorMsg(
          err.response?.data?.message || "Failed to initialize slot configuration parameters from the backend."
        )
      } finally {
        setIsLoading(false)
      }
    }

    if (machineId) {
      initData()
    }
  }, [machineId, role, tenant_id])

  // Clear slot selection and empty slot assignments on mapping mode switch
  useEffect(() => {
    setSelectedSlotId(null)
    setConfigureSlots((prev) =>
      prev.map((s) => ({
        ...s,
        item_id: null,
        quantity: 0
      }))
    )
  }, [mappingMode])

  const handleUpdateSlotAssignment = (slotId, itemId, qty) => {
    const targetSlot = configureSlots.find(s => s.slot_id === slotId)
    if (!targetSlot) return

    setConfigureSlots((prev) =>
      prev.map((s) => {
        let matches = false
        if (mappingMode === "ROW") {
          matches = s.row === targetSlot.row
        } else if (mappingMode === "COLUMN") {
          matches = s.column === targetSlot.column
        } else {
          matches = s.slot_id === slotId
        }

        if (matches) {
          return {
            ...s,
            item_id: itemId || null,
            quantity: itemId ? Number(qty) : 0
          }
        }
        return s
      })
    )

    // Clear active selection immediately after updating to close panels cleanly
    setSelectedSlotId(null)
  }

  const handleSelectSlot = (slotId) => {
    if (selectedSlotId === slotId) {
      setSelectedSlotId(null)
      return
    }
    setSelectedSlotId(slotId)

    const targetSlot = configureSlots.find(s => s.slot_id === slotId)
    if (targetSlot && targetSlot.item_id && mappingMode !== "SINGLE") {
      const maxD = configureMachine?.grid_config?.max_depth || 7
      setConfigureSlots((prev) =>
        prev.map((s) => {
          let matches = false
          if (mappingMode === "ROW") {
            matches = s.row === targetSlot.row
          } else if (mappingMode === "COLUMN") {
            matches = s.column === targetSlot.column
          }

          if (matches) {
            return {
              ...s,
              item_id: targetSlot.item_id,
              quantity: targetSlot.quantity || maxD
            }
          }
          return s
        })
      )

      // Clear the selection automatically after bulk propagation finishes
      setSelectedSlotId(null)
    }
  }

  const handleDispatchRestock = async (e) => {
    e.preventDefault()
    if (!configureMachine || !selectedOperatorId || !selectedShift) return

    setIsSubmitLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    // Formulate slot_assignments to POST to the backend
    const slotAssignments = configureSlots
      .filter((s) => s.item_id !== null && s.quantity > 0)
      .map((s) => ({
        slot_id: s.slot_id,
        item_id: s.item_id,
        target_quantity: s.quantity
      }))

    try {
      await api.post("/admin/machine/restock-job", {
        machine_id: configureMachine.machine_id,
        operator_id: selectedOperatorId,
        shift_type: selectedShift,
        clearout_required: clearoutRequired,
        slot_assignments: slotAssignments
      })

      setSuccessMsg(`Restock Job successfully dispatched for Machine ${configureMachine.machine_id}!`)
      
      // Navigate back to machines view after short delay to let user see success
      setTimeout(() => {
        navigate("/dashboard/machines")
      }, 2000)
    } catch (err) {
      console.error("Failed to dispatch restock job:", err)
      setErrorMsg(
        err.response?.data?.message || err.message || "Failed to create restock job. Please try again."
      )
    } finally {
      setIsSubmitLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary font-bold" />
        <span className="ml-2 text-sm text-muted-foreground font-bold font-mono">
          Synchronizing grid architecture nodes...
        </span>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Header section with Back Button and details */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/50 pb-5">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/dashboard/machines")}
            className="h-10 w-10 p-0 rounded-xl border-border hover:bg-muted cursor-pointer flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                Configure Machine
              </h1>
              <span className="font-mono text-xl font-extrabold text-primary bg-primary/10 px-3 py-0.5 rounded-xl border border-primary/20">
                {machineId}
              </span>
            </div>
            {configureMachine && (
              <p className="text-xs text-muted-foreground font-medium font-mono mt-1">
                Dimension: {configureMachine.grid_config?.rows} Rows x {configureMachine.grid_config?.columns} Columns | Capacity: {(configureMachine.grid_config?.rows || 0) * (configureMachine.grid_config?.columns || 0) * (configureMachine.grid_config?.max_depth || 0)} Units (Max Depth: {configureMachine.grid_config?.max_depth})
              </p>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 overflow-hidden"
          >
            <Cpu className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Hardware API Failure:</span> {errorMsg}
            </div>
          </motion.div>
        )}

        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 overflow-hidden"
          >
            <Cpu className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Success:</span> {successMsg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleDispatchRestock} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left & Middle Column (Grid Visualizer & Editor) */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-card rounded-2xl p-6 border border-border text-card-foreground shadow-sm"
            >
              <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                  Physical Slot Grid Selector
                </h3>
                <div className="text-[10px] font-bold text-muted-foreground uppercase font-mono">
                  Select a slot box to configure its contents
                </div>
              </div>

              {/* CSS grid mapping directly to machine config */}
              <div 
                className="grid gap-3 border border-border/40 bg-muted/10 p-6 rounded-xl overflow-auto max-h-[500px]" 
                style={{ 
                  gridTemplateColumns: `repeat(${configureMachine?.grid_config?.columns || 8}, minmax(100px, 1fr))` 
                }}
              >
                {configureSlots.map((slot) => {
                  const matchedItem = catalogItems.find((i) => i.item_id === slot.item_id);
                  
                  const activeSlot = configureSlots.find((s) => s.slot_id === selectedSlotId);
                  let isSelected = false;
                  if (activeSlot) {
                    if (mappingMode === "ROW") {
                      isSelected = slot.row === activeSlot.row;
                    } else if (mappingMode === "COLUMN") {
                      isSelected = slot.column === activeSlot.column;
                    } else {
                      isSelected = selectedSlotId === slot.slot_id;
                    }
                  }

                  return (
                    <motion.button
                      key={slot.slot_id}
                      type="button"
                      onClick={() => handleSelectSlot(slot.slot_id)}
                      whileHover={{ scale: 1.04, y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 350, damping: 14 }}
                      className={`h-20 flex flex-col items-center justify-between p-2 rounded-xl border text-center transition-all cursor-pointer relative group ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-md text-primary font-bold ring-2 ring-primary/20 scale-95"
                          : slot.item_id
                          ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 text-foreground"
                          : "border-border/60 bg-card hover:border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="text-[10px] font-mono font-bold tracking-tight absolute top-1 left-2">
                        {slot.slot_id}
                      </div>
                      {slot.item_id ? (
                        <>
                          <div className="text-[10px] font-extrabold truncate w-full px-1 pt-5 text-foreground leading-tight">
                            {matchedItem ? matchedItem.item_name : "Loaded Item"}
                          </div>
                          <div className="text-[10px] font-mono text-emerald-600 font-extrabold pb-1">
                            {slot.quantity}/{configureMachine?.grid_config?.max_depth}
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] font-bold mt-auto pb-3 select-none text-muted-foreground/60 group-hover:text-foreground/80">
                          + Empty
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Sub-Panel: Editing Selected Slot */}
            <AnimatePresence mode="wait">
              {selectedSlotId ? (
                <motion.div
                  key={selectedSlotId}
                  initial={{ opacity: 0, y: 15, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -15, height: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="bg-card border border-primary/20 bg-primary/5 rounded-2xl p-6 shadow-sm space-y-4 overflow-hidden"
                >
                  {(() => {
                    const activeSlot = configureSlots.find((s) => s.slot_id === selectedSlotId);
                    return (
                      <>
                        <div className="flex items-center justify-between pb-3 border-b border-primary/10">
                          <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                            Configure Slot: <span className="font-mono text-base underline">{selectedSlotId}</span>
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            Max Depth Allowed: {configureMachine?.grid_config?.max_depth} Units
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Food Selector */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Map Catalog Food Item</label>
                            <Select 
                              value={activeSlot?.item_id || "NONE"} 
                              onValueChange={(val) => {
                                const itemId = val === "NONE" ? null : val;
                                const maxD = configureMachine?.grid_config?.max_depth || 7;
                                handleUpdateSlotAssignment(selectedSlotId, itemId, itemId ? maxD : 0);
                              }}
                            >
                              <SelectTrigger className="bg-background border-border text-foreground rounded-lg h-10 text-xs font-semibold">
                                <SelectValue placeholder="Select Dish" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border text-card-foreground max-h-56 overflow-y-auto font-sans">
                                <SelectItem value="NONE" className="text-xs font-semibold cursor-pointer">
                                  [ None - Leave Unassigned ]
                                </SelectItem>
                                {catalogItems.map((item) => (
                                  <SelectItem key={item.item_id} value={item.item_id} className="text-xs font-semibold cursor-pointer focus:bg-muted focus:text-foreground">
                                    {item.item_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Quantity Input */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Target Restocking Quantity</label>
                            <Input
                              type="number"
                              min="1"
                              max={configureMachine?.grid_config?.max_depth || 7}
                              disabled={!activeSlot?.item_id}
                              value={activeSlot?.item_id ? activeSlot.quantity : ""}
                              onChange={(e) => {
                                let qty = Number(e.target.value);
                                const maxD = configureMachine?.grid_config?.max_depth || 7;
                                if (qty > maxD) qty = maxD;
                                if (qty < 0) qty = 0;
                                handleUpdateSlotAssignment(selectedSlotId, activeSlot.item_id, qty);
                              }}
                              placeholder="Quantity (e.g. 5)"
                              className="h-10 text-xs bg-background border-border rounded-lg text-foreground font-mono font-semibold"
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              ) : (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border border-dashed border-border p-6 rounded-2xl bg-muted/10 text-center text-xs text-muted-foreground select-none font-mono"
                >
                  💡 Tap any slot box inside the Selector grid above to configure its mapped catalog dish and target quantity bounds.
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column (Dispatch & Logistics Console) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="bg-card rounded-2xl p-6 border border-border text-card-foreground shadow-sm space-y-6">
              <h3 className="text-base font-bold text-foreground border-b border-border/40 pb-2.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                Logistics Dispatch Console
              </h3>

              {/* Mapping Mode Options */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Grid Mapping Mode</label>
                <div className="grid grid-cols-2 gap-2 bg-muted p-1 rounded-xl text-xs font-bold font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setMappingMode(mappingMode === "ROW" ? "SINGLE" : "ROW")
                      setSelectedSlotId(null)
                    }}
                    className={`py-2 rounded-lg transition-all cursor-pointer text-center ${
                      mappingMode === "ROW"
                        ? "bg-primary text-primary-foreground shadow-sm font-extrabold"
                        : "text-muted-foreground hover:text-foreground bg-transparent font-medium"
                    }`}
                  >
                    Row mapping
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMappingMode(mappingMode === "COLUMN" ? "SINGLE" : "COLUMN")
                      setSelectedSlotId(null)
                    }}
                    className={`py-2 rounded-lg transition-all cursor-pointer text-center ${
                      mappingMode === "COLUMN"
                        ? "bg-primary text-primary-foreground shadow-sm font-extrabold"
                        : "text-muted-foreground hover:text-foreground bg-transparent font-medium"
                    }`}
                  >
                    Column mapping
                  </button>
                </div>
                <div className="text-[9px] text-muted-foreground px-1">
                  Active mode: <span className="font-bold text-primary font-mono">{mappingMode === "SINGLE" ? "Single Slot mapping" : `${mappingMode} mapping`}</span>
                </div>
              </div>

              {/* Shift Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Target Restock Shift</label>
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger className="w-full bg-background border-border text-foreground rounded-lg h-10 text-xs font-semibold">
                    <SelectValue placeholder="Select Shift" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-card-foreground">
                    <SelectItem value="BREAKFAST" className="text-xs font-semibold cursor-pointer font-sans">Breakfast Shift</SelectItem>
                    <SelectItem value="LUNCH" className="text-xs font-semibold cursor-pointer font-sans">Lunch Shift</SelectItem>
                    <SelectItem value="SNACKS" className="text-xs font-semibold cursor-pointer font-sans">Evening Snacks Shift</SelectItem>
                    <SelectItem value="ADHOC" className="text-xs font-semibold cursor-pointer font-sans">Adhoc Refill Shift</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Operator Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Restock Operator</label>
                <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
                  <SelectTrigger className="w-full bg-background border-border text-foreground rounded-lg h-10 text-xs font-mono font-semibold">
                    <SelectValue placeholder="Assign Operator" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-card-foreground max-h-48 overflow-y-auto">
                    {operators.length === 0 ? (
                      <div className="py-2 px-3 text-xs text-muted-foreground font-medium text-center font-mono">
                        No operators registered
                      </div>
                    ) : (
                      operators.map((op) => (
                        <SelectItem key={op._id || op.id} value={op._id || op.id} className="text-xs font-mono font-semibold cursor-pointer focus:bg-muted focus:text-foreground">
                          {op.mobile_number}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <div className="text-[9px] text-muted-foreground px-1 leading-relaxed">
                  Select the field restocker who will execute this shift.
                </div>
              </div>

              {/* Clearout Checkbox Toggle */}
              <div className="border border-border/60 bg-muted/20 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="clearout-toggle"
                    checked={clearoutRequired}
                    onChange={(e) => setClearoutRequired(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                  />
                  <label htmlFor="clearout-toggle" className="text-xs font-bold text-foreground cursor-pointer select-none">
                    Shift Clear-Out required
                  </label>
                </div>
                <div className="text-[9px] text-muted-foreground leading-relaxed">
                  If checked, the operator will be forced to empty the machine first. Expected remaining items inside slots will be automatically zeroed out and logged as <span className="font-semibold text-emerald-600 bg-emerald-500/10 px-1 py-0.2 rounded font-mono">SHIFT_CLEAROUT_DONATION</span>.
                </div>
              </div>

              {/* Summary Box */}
              <div className="border border-border bg-muted/10 rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold text-foreground pb-1.5 border-b border-border/40">Aggregated Totals Summary</div>
                {(() => {
                  const activeSlots = configureSlots.filter(s => s.item_id !== null && s.quantity > 0);
                  const totals = {};
                  activeSlots.forEach(s => {
                    if (!totals[s.item_id]) {
                      const itemObj = catalogItems.find(i => i.item_id === s.item_id);
                      totals[s.item_id] = { name: itemObj ? itemObj.item_name : 'Unknown', qty: 0 };
                    }
                    totals[s.item_id].qty += s.quantity;
                  });
                  const keys = Object.keys(totals);

                  return (
                    <div className="space-y-2 font-mono text-[10px] max-h-40 overflow-y-auto pr-1">
                      {keys.length === 0 ? (
                        <div className="text-muted-foreground italic py-1">No items configured yet.</div>
                      ) : (
                        keys.map(k => (
                          <motion.div 
                            key={k} 
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.25 }}
                            className="flex justify-between font-semibold text-muted-foreground border-b border-border/20 pb-1 last:border-0 last:pb-0"
                          >
                            <span className="truncate pr-2 text-foreground">{totals[k].name}</span>
                            <span className="text-primary font-bold shrink-0">{totals[k].qty} units</span>
                          </motion.div>
                        ))
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Dispatch Action Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitLoading || operators.length === 0}
                  className="w-full h-11 text-sm font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-[0.98]"
                >
                  {isSubmitLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Dispatch Restock Job
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </form>
    </motion.div>
  )
}
