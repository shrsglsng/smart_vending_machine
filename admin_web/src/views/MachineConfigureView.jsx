import React, { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { Cpu, ArrowLeft, Loader2, AlertCircle, ShieldCheck } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import api from "../services/api"
import { config } from "../config"
import { Button } from "../components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  const [mappingMode, setMappingMode] = useState("ROW") // "ROW" is default; toggle toggles to "SINGLE"
  const [selectedOperatorId, setSelectedOperatorId] = useState("")
  const [selectedShift, setSelectedShift] = useState("BREAKFAST")
  const [clearoutRequired, setClearoutRequired] = useState(true)

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitLoading, setIsSubmitLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Dynamic image resolution helper
  const getImageUrl = (imagePath) => {
    if (!imagePath) return ""
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      return imagePath
    }
    const base = config.apiBaseUrl.replace(/\/api\/v1\/?$/, "")
    return `${base}${imagePath}`
  }

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

  const capacityCount = (configureMachine?.grid_config?.rows || 0) * (configureMachine?.grid_config?.columns || 0) * (configureMachine?.grid_config?.max_depth || 0);

  const filteredCatalogItems = (() => {
    if (selectedShift === "BREAKFAST") {
      return catalogItems.filter(i => i.category === "BREAKFAST");
    }
    if (selectedShift === "LUNCH") {
      return catalogItems.filter(i => i.category === "LUNCH");
    }
    if (selectedShift === "SNACKS") {
      return catalogItems.filter(i => i.category === "SNACK");
    }
    return catalogItems;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="-m-6 md:-m-8 h-screen overflow-hidden flex flex-col bg-background text-foreground"
    >
      <style>{`
        .custom-grid-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-grid-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-grid-scroll::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 9999px;
          transition: background-color 0.2s ease-in-out;
        }
        .custom-grid-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
        }
      `}</style>

      {/* Header section with Back Button and details */}
      <div className="h-16 border-b border-border/50 flex items-center justify-between px-6 bg-card shrink-0 select-none">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/dashboard/machines")}
            className="h-9 w-9 p-0 rounded-xl border-border hover:bg-muted cursor-pointer flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold tracking-tight text-foreground">
              Configure Machine
            </h1>
            <span className="font-mono text-xs font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
              {machineId}
            </span>
            {configureMachine && (
              <>
                <span className="text-border font-mono text-xs mx-1">|</span>
                <span className="font-mono text-xs font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                  Dimension: {configureMachine.grid_config?.rows}R × {configureMachine.grid_config?.columns}C × {configureMachine.grid_config?.max_depth}D
                </span>
                <span className="text-border font-mono text-xs mx-1">|</span>
                <span className="font-mono text-xs font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                  Capacity: {capacityCount} Units
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace (Scroll-free Layout) */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <form onSubmit={handleDispatchRestock} className="flex flex-1 overflow-hidden min-h-0 w-full">
          {/* Left Column (Grid Visualizer & Editor) */}
          <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0 bg-background">
            
            {/* Live Message Banners */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 mb-4 overflow-hidden shrink-0"
                >
                  <Cpu className="h-4 w-4 shrink-0" />
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
                  className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 mb-4 overflow-hidden shrink-0"
                >
                  <Cpu className="h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-bold">Success:</span> {successMsg}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="flex items-center justify-end mb-3.5 shrink-0 select-none">
                
                {/* Dynamic Inline Grid Mapping Mode Selectors */}
                <div className="flex items-center gap-2 bg-muted p-1 rounded-xl text-xs font-bold font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setMappingMode(mappingMode === "ROW" ? "SINGLE" : "ROW")
                      setSelectedSlotId(null)
                    }}
                    className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer text-center ${mappingMode === "ROW"
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
                    className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer text-center ${mappingMode === "COLUMN"
                      ? "bg-primary text-primary-foreground shadow-sm font-extrabold"
                      : "text-muted-foreground hover:text-foreground bg-transparent font-medium"
                      }`}
                  >
                    Column mapping
                  </button>
                </div>
              </div>

              {/* CSS grid mapping directly to machine config */}
              <div
                className="grid gap-3 border border-border/40 bg-muted/5 p-5 rounded-2xl overflow-y-auto flex-1 min-h-0 custom-grid-scroll"
                style={{
                  gridTemplateColumns: `repeat(${configureMachine?.grid_config?.columns || 5}, minmax(0, 1fr))`
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

                  const maxDepth = configureMachine?.grid_config?.max_depth || 7;

                  return (
                    <motion.button
                      key={slot.slot_id}
                      type="button"
                      onClick={() => handleSelectSlot(slot.slot_id)}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 350, damping: 14 }}
                      className={`h-24 flex flex-col items-stretch justify-between p-2.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group select-none ${isSelected
                        ? "border-primary bg-primary/10 shadow-md text-primary ring-2 ring-primary/20 scale-95"
                        : slot.item_id
                          ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 text-foreground"
                          : "border-border/60 bg-card hover:border-border text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {/* Slot background product image with dark overlay if loaded */}
                      {slot.item_id && matchedItem && matchedItem.image_path && (
                        <>
                          <img
                            src={getImageUrl(matchedItem.image_path)}
                            alt={matchedItem.item_name}
                            className="absolute inset-0 w-full h-full object-cover z-0 opacity-80 dark:opacity-70 transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop"
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent z-[1]" />
                        </>
                      )}

                      {/* Header line containing slot_id and quantity/max_depth */}
                      <div className={`flex items-center justify-between w-full font-mono text-[10px] font-bold tracking-tight z-10 ${slot.item_id ? "text-white drop-shadow-md" : "text-muted-foreground/80"}`}>
                        <span>{slot.slot_id}</span>
                        <span>{slot.item_id ? `${slot.quantity}/${maxDepth}` : `0/${maxDepth}`}</span>
                      </div>

                      {/* Center or Bottom content */}
                      {slot.item_id ? (
                        <div className="text-[10px] font-extrabold truncate w-full px-1 text-white z-10 drop-shadow-md uppercase text-center mt-auto pb-1">
                          {matchedItem ? matchedItem.item_name : "Loaded"}
                        </div>
                      ) : (
                        <div className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider m-auto z-10 select-none group-hover:text-foreground/45 transition-colors">
                          Empty
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (Dispatch & Logistics Console) */}
          <div className="w-[340px] border-l border-border/50 bg-card p-6 overflow-y-auto flex flex-col shrink-0 space-y-5">
            <h3 className="text-sm font-bold text-foreground border-b border-border/40 pb-2.5 flex items-center gap-1.5 shrink-0 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
              Logistics Dispatch Console
            </h3>

            {/* Target Restock Shift (Moved to top of the options!) */}
            <div className="space-y-1.5 shrink-0 select-none">
              <Select value={selectedShift} onValueChange={(val) => {
                setSelectedShift(val);
                // Reset slot selection on shift changes to prevent mismatch assignment
                setSelectedSlotId(null);
              }}>
                <SelectTrigger className="w-full bg-background border-border text-foreground rounded-lg h-9 text-xs font-semibold">
                  <SelectValue placeholder="Select Shift" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-card-foreground z-[30]">
                  <SelectItem value="BREAKFAST" className="text-xs font-semibold cursor-pointer font-sans">Breakfast Shift</SelectItem>
                  <SelectItem value="LUNCH" className="text-xs font-semibold cursor-pointer font-sans">Lunch Shift</SelectItem>
                  <SelectItem value="SNACKS" className="text-xs font-semibold cursor-pointer font-sans">Evening Snacks Shift</SelectItem>
                  <SelectItem value="ADHOC" className="text-xs font-semibold cursor-pointer font-sans">Adhoc Refill Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Selection / Map Catalog Food Item (Unified Here!) */}
            <div className="border border-border/60 bg-muted/10 rounded-xl p-3 shrink-0">
              {selectedSlotId ? (
                (() => {
                  const activeSlot = configureSlots.find((s) => s.slot_id === selectedSlotId);
                  const labelText = mappingMode === "ROW" 
                    ? `Row ${activeSlot?.row}` 
                    : mappingMode === "COLUMN" 
                    ? `Column ${activeSlot?.column}` 
                    : `Slot ${selectedSlotId}`;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-border/40 pb-1.5 select-none">
                        <span className="text-[10px] font-bold text-primary uppercase font-mono">
                          Configuring: {labelText}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedSlotId(null)}
                          className="text-[9px] font-bold text-muted-foreground hover:text-foreground uppercase font-mono underline"
                        >
                          Deselect
                        </button>
                      </div>
                      <div className="space-y-1">
                        <Select
                          value={activeSlot?.item_id || "NONE"}
                          onValueChange={(val) => {
                            const itemId = val === "NONE" ? null : val;
                            const maxD = configureMachine?.grid_config?.max_depth || 7;
                            handleUpdateSlotAssignment(selectedSlotId, itemId, itemId ? maxD : 0);
                          }}
                        >
                          <SelectTrigger className="bg-background border-border text-foreground rounded-lg h-9 text-xs font-semibold">
                            <SelectValue placeholder="Select Dish" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-card-foreground max-h-56 overflow-y-auto font-sans z-[30]">
                            <SelectItem value="NONE" className="text-xs font-semibold cursor-pointer">
                              [ None - Leave Unassigned ]
                            </SelectItem>
                            
                            {/* Breakfast Section */}
                            {filteredCatalogItems.some(i => i.category === "BREAKFAST") && (
                              <SelectGroup>
                                <SelectLabel className="font-extrabold text-[9px] uppercase font-mono tracking-wider text-primary bg-primary/5 px-2.5 py-1 select-none border-y border-border/20 mt-1 first:mt-0">
                                  Breakfast
                                </SelectLabel>
                                {filteredCatalogItems.filter(i => i.category === "BREAKFAST").map((item) => (
                                  <SelectItem key={item.item_id} value={item.item_id} className="text-xs font-semibold cursor-pointer focus:bg-muted focus:text-foreground">
                                    {item.item_name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}

                            {/* Lunch Section */}
                            {filteredCatalogItems.some(i => i.category === "LUNCH") && (
                              <SelectGroup>
                                <SelectLabel className="font-extrabold text-[9px] uppercase font-mono tracking-wider text-primary bg-primary/5 px-2.5 py-1 select-none border-y border-border/20 mt-1">
                                  Lunch
                                </SelectLabel>
                                {filteredCatalogItems.filter(i => i.category === "LUNCH").map((item) => (
                                  <SelectItem key={item.item_id} value={item.item_id} className="text-xs font-semibold cursor-pointer focus:bg-muted focus:text-foreground">
                                    {item.item_name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}

                            {/* Evening Snacks Section */}
                            {filteredCatalogItems.some(i => i.category === "SNACK") && (
                              <SelectGroup>
                                <SelectLabel className="font-extrabold text-[9px] uppercase font-mono tracking-wider text-primary bg-primary/5 px-2.5 py-1 select-none border-y border-border/20 mt-1">
                                  Evening Snacks
                                </SelectLabel>
                                {filteredCatalogItems.filter(i => i.category === "SNACK").map((item) => (
                                  <SelectItem key={item.item_id} value={item.item_id} className="text-xs font-semibold cursor-pointer focus:bg-muted focus:text-foreground">
                                    {item.item_name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}

                            {/* Other/Uncategorized Items */}
                            {filteredCatalogItems.some(i => !["BREAKFAST", "LUNCH", "SNACK"].includes(i.category)) && (
                              <SelectGroup>
                                <SelectLabel className="font-extrabold text-[9px] uppercase font-mono tracking-wider text-primary bg-primary/5 px-2.5 py-1 select-none border-y border-border/20 mt-1">
                                  Other Items
                                </SelectLabel>
                                {filteredCatalogItems.filter(i => !["BREAKFAST", "LUNCH", "SNACK"].includes(i.category)).map((item) => (
                                  <SelectItem key={item.item_id} value={item.item_id} className="text-xs font-semibold cursor-pointer focus:bg-muted focus:text-foreground">
                                    {item.item_name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )
                })()
              ) : (
                <div className="text-[10px] text-muted-foreground/80 leading-relaxed py-1.5 text-center font-mono select-none">
                  💡 Click a slot or row in the grid to assign a food item.
                </div>
              )}
            </div>

            {/* Restock Operator */}
            <div className="space-y-1.5 shrink-0 select-none">
              <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
                <SelectTrigger className="w-full bg-background border-border text-foreground rounded-lg h-9 text-xs font-sans font-semibold">
                  <SelectValue placeholder="Assign Operator" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-card-foreground max-h-40 overflow-y-auto z-[30]">
                  {operators.length === 0 ? (
                    <div className="py-2 px-3 text-xs text-muted-foreground font-medium text-center font-mono">
                      No operators registered
                    </div>
                  ) : (
                    operators.map((op) => (
                      <SelectItem key={op._id || op.id} value={op._id || op.id} className="text-xs font-sans font-semibold cursor-pointer focus:bg-muted focus:text-foreground">
                        {op.name} ({op.mobile_number})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Shift Clearout Toggle */}
            <div className="border border-border/60 bg-muted/10 rounded-xl p-3 space-y-1.5 shrink-0 select-none">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="clearout-toggle"
                  checked={clearoutRequired}
                  onChange={(e) => setClearoutRequired(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                />
                <label htmlFor="clearout-toggle" className="text-[11px] font-bold text-foreground cursor-pointer select-none">
                  Shift Clear-Out required
                </label>
              </div>
              <div className="text-[8.5px] text-muted-foreground leading-normal">
                If checked, operator empties machine first. Rest logged as <span className="font-semibold text-emerald-600 font-mono">SHIFT_CLEAROUT_DONATION</span>.
              </div>
            </div>

            {/* Summary Box */}
            <div className="border border-border bg-muted/5 rounded-xl p-3 flex-1 min-h-[90px] flex flex-col overflow-hidden">
              <div className="text-[11px] font-bold text-foreground pb-1 border-b border-border/40 shrink-0 select-none">Total Items</div>
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
                  <div className="flex-1 overflow-y-auto pr-1 py-1 font-mono text-[9.5px] space-y-1.5 min-h-0">
                    {keys.length === 0 ? (
                      <div className="text-muted-foreground italic py-1 select-none">No items configured yet.</div>
                    ) : (
                      keys.map(k => (
                        <motion.div
                          key={k}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex justify-between font-semibold text-muted-foreground border-b border-border/20 pb-0.5 last:border-0 last:pb-0"
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
            <div className="shrink-0 pt-1">
              <Button
                type="submit"
                disabled={isSubmitLoading || operators.length === 0}
                className="w-full h-10 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-[0.98]"
              >
                {isSubmitLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                Dispatch Restock Job
              </Button>
            </div>
          </div>
        </form>
      </div>
    </motion.div>
  )
}
