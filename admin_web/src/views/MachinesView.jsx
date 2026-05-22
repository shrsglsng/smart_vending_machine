import React, { useState, useEffect } from "react"
import { Cpu, Ban, Loader2, AlertCircle, ShieldCheck, Plus, Eye, EyeOff } from "lucide-react"

import api from "../services/api"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"

export function MachinesView() {
  const [machines, setMachines] = useState([])
  const [tenants, setTenants] = useState([])
  const [isFetchLoading, setIsFetchLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Dialog Control
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Machine Creation fields
  const [machineId, setMachineId] = useState("")
  const [location, setLocation] = useState("")
  const [rows, setRows] = useState(6)
  const [columns, setColumns] = useState(8)
  const [maxDepth, setMaxDepth] = useState(7)
  const [assignmentType, setAssignmentType] = useState("NEW") // "NEW" | "EXISTING" | "UNASSIGNED"
  const [existingTenantId, setExistingTenantId] = useState("")

  // New Tenant fields
  const [newTenantBusinessName, setNewTenantBusinessName] = useState("")
  const [newTenantEmail, setNewTenantEmail] = useState("")
  const [newTenantMobile, setNewTenantMobile] = useState("")
  const [newTenantPassword, setNewTenantPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Edit Dialog Control
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingMachine, setEditingMachine] = useState(null)
  const [editMachineId, setEditMachineId] = useState("")
  const [editLocation, setEditLocation] = useState("")
  const [editRows, setEditRows] = useState(6)
  const [editColumns, setEditColumns] = useState(8)
  const [editMaxDepth, setEditMaxDepth] = useState(7)
  const [editTenantId, setEditTenantId] = useState("")

  // Fetch machines and active tenants
  const fetchMachinesAndTenants = async () => {
    try {
      const [machinesRes, tenantsRes] = await Promise.all([
        api.get("/admin/machines"),
        api.get("/admin/tenants")
      ])
      setMachines(machinesRes.data || [])
      setTenants(tenantsRes.data || [])
    } catch (err) {
      console.error("Failed to fetch machines/tenants:", err)
      setErrorMsg("Failed to synchronize with database fleet node data.")
    } finally {
      setIsFetchLoading(false)
    }
  }

  useEffect(() => {
    fetchMachinesAndTenants()
  }, [])

  // Machine ID mask validation
  const handleMachineIdChange = (e) => {
    let val = e.target.value
    let cleaned = val.replace(/[^vV0-9]/g, "")
    if (cleaned.length > 0) {
      if (!/^[vV]/.test(cleaned)) {
        cleaned = "V" + cleaned.replace(/[^0-9]/g, "")
      } else {
        cleaned = "V" + cleaned.slice(1).replace(/[^0-9]/g, "")
      }
    }
    setMachineId(cleaned)
  }

  // Location capitalization
  const handleLocationChange = (e) => {
    const val = e.target.value
    const words = val.split(" ")
    const capitalizedWords = words.map(word => {
      if (word.length === 0) return ""
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    setLocation(capitalizedWords.join(" "))
  }

  // Unassign machine endpoint wrapper
  const handleUnassign = async (machineId) => {
    setIsLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      await api.post("/admin/machine/unassign", {
        machine_id: machineId,
      })

      setSuccessMsg(`Machine ${machineId} successfully unassigned!`)
      await fetchMachinesAndTenants()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      console.error("Machine unassign failed:", err)
      setErrorMsg(
        err.response?.data?.message || `Failed to unassign ${machineId}. Ensure the backend is active.`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Edit machine handlers
  const handleOpenEdit = (machine) => {
    setEditingMachine(machine)
    setEditMachineId(machine.machine_id)
    setEditLocation(machine.location || "")
    setEditRows(machine.grid_config?.rows || 6)
    setEditColumns(machine.grid_config?.columns || 8)
    setEditMaxDepth(machine.grid_config?.max_depth || 7)
    setEditTenantId(machine.tenant_id === "TEN_PLATFORM_ROOT" ? "" : machine.tenant_id)
    setIsEditOpen(true)
  }

  const handleEditConfirm = async (e) => {
    e.preventDefault()
    if (!editingMachine || !editMachineId) return

    setIsLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      await api.post("/admin/machine/edit", {
        id: editingMachine.id || editingMachine._id,
        machine_id: editMachineId,
        location: editLocation,
        rows: editRows ? Number(editRows) : 6,
        columns: editColumns ? Number(editColumns) : 8,
        max_depth: editMaxDepth ? Number(editMaxDepth) : 7,
        tenant_id: editTenantId || undefined
      })

      setSuccessMsg(`Machine ${editMachineId} successfully updated!`)
      setIsEditOpen(false)
      setEditingMachine(null)

      // Re-fetch machines
      await fetchMachinesAndTenants()

      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      console.error("Machine edit failed:", err)
      setErrorMsg(
        err.response?.data?.message || err.message || "Failed to update machine. Check server connections."
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Stage-wise Confirm Handler
  const handleConfirm = async (e) => {
    e.preventDefault()
    if (!machineId) return

    setIsLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      let finalTenantId = "TEN_PLATFORM_ROOT"

      if (assignmentType === "NEW") {
        if (!newTenantBusinessName || !newTenantEmail || !newTenantMobile) {
          throw new Error("All fields for registering a new tenant must be completed.")
        }

        // Step 1: Create Tenant atomically
        const tenantRes = await api.post("/admin/tenant/create", {
          business_name: newTenantBusinessName,
          contact_email: newTenantEmail,
          mobile_number: newTenantMobile,
          password: newTenantPassword
        })

        finalTenantId = tenantRes.data.tenant.tenant_id
      } else if (assignmentType === "EXISTING") {
        if (!existingTenantId) {
          throw new Error("An active tenant must be selected.")
        }
        finalTenantId = existingTenantId
      }

      // Step 2: Register Machine
      await api.post("/admin/machine/create", {
        machine_id: machineId,
        tenant_id: finalTenantId,
        location: location,
        rows: rows ? Number(rows) : 6,
        columns: columns ? Number(columns) : 8,
        max_depth: maxDepth ? Number(maxDepth) : 7
      })

      setSuccessMsg(`Machine ${machineId} successfully created and registered!`)

      // Reset form states
      setMachineId("")
      setLocation("")
      setRows(6)
      setColumns(8)
      setMaxDepth(7)
      setAssignmentType("NEW")
      setNewTenantBusinessName("")
      setNewTenantEmail("")
      setNewTenantMobile("")
      setExistingTenantId("")

      // Close modal
      setIsCreateOpen(false)

      // Re-fetch machines
      await fetchMachinesAndTenants()

      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      console.error("Machine creation failed:", err)
      setErrorMsg(
        err.response?.data?.message || err.message || "Failed to create machine. Check server connections."
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetchLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary font-bold" />
        <span className="ml-2 text-sm text-muted-foreground font-bold font-mono">
          Loading hardware database...
        </span>
      </div>
    )
  }

  const activeFleet = machines.filter((m) => m.assignment_status === "ACTIVE")
  const unassignedFleet = machines.filter((m) => m.assignment_status === "UNASSIGNED")
  const activeTenants = tenants.filter((t) => t.status !== "DISABLED")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Machine Management
          </h1>
        </div>

        {/* Dialog Modal Trigger */}
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (open) {
            const rand = Math.floor(1000 + Math.random() * 9000)
            setNewTenantPassword(`aibotink${rand}`)
            setRows(6)
            setColumns(8)
            setMaxDepth(7)
            setErrorMsg(null)
            setSuccessMsg(null)
          }
        }}>
          <DialogTrigger asChild>
            <Button className="font-bold flex items-center gap-2 rounded-xl shadow-sm bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">
              <Plus className="h-4 w-4" />
              Create New Machine
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[700px] bg-card rounded-2xl p-6 border border-border text-card-foreground">
            <DialogHeader className="space-y-1.5 pb-4 border-b border-border/50">
              <DialogTitle className="text-2xl font-extrabold text-foreground flex items-center gap-2">
                <Cpu className="h-6 w-6 text-primary animate-pulse" />
                Add New Machine
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleConfirm} className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column (Hardware Configuration) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground border-b border-border/40 pb-1 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                    Vending Configuration
                  </h3>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Machine ID</label>
                    <Input
                      placeholder="e.g. V05"
                      value={machineId}
                      onChange={handleMachineIdChange}
                      required
                      className="h-9 text-xs bg-background border-border rounded-lg text-foreground placeholder:text-muted-foreground font-mono font-semibold"
                    />
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Formatted ID: <span className="font-bold text-primary">{machineId || "VXX"}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Location</label>
                    <Input
                      placeholder="e.g. Primary Lobby"
                      value={location}
                      onChange={handleLocationChange}
                      className="h-9 text-xs bg-background border-border rounded-lg text-foreground placeholder:text-muted-foreground"
                    />
                    <div className="text-[10px] text-muted-foreground">
                      Auto-capitalizes words to match premium design guidelines.
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Rows</label>
                      <Input
                        type="number"
                        min="1"
                        required
                        value={rows}
                        onChange={(e) => setRows(e.target.value)}
                        className="h-9 text-xs bg-background border-border rounded-lg text-foreground font-mono font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Columns</label>
                      <Input
                        type="number"
                        min="1"
                        required
                        value={columns}
                        onChange={(e) => setColumns(e.target.value)}
                        className="h-9 text-xs bg-background border-border rounded-lg text-foreground font-mono font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Max Depth</label>
                      <Input
                        type="number"
                        min="1"
                        required
                        value={maxDepth}
                        onChange={(e) => setMaxDepth(e.target.value)}
                        className="h-9 text-xs bg-background border-border rounded-lg text-foreground font-mono font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column (Tenancy Assignment) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground border-b border-border/40 pb-1 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                    Tenancy Assignment
                  </h3>

                  <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setAssignmentType("NEW")}
                      className={`py-1.5 px-1 rounded-md transition-all cursor-pointer text-center ${assignmentType === "NEW"
                        ? "bg-background text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      New Tenant
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignmentType("EXISTING")}
                      className={`py-1.5 px-1 rounded-md transition-all cursor-pointer text-center ${assignmentType === "EXISTING"
                        ? "bg-background text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignmentType("UNASSIGNED")}
                      className={`py-1.5 px-1 rounded-md transition-all cursor-pointer text-center ${assignmentType === "UNASSIGNED"
                        ? "bg-background text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Unassigned
                    </button>
                  </div>

                  {assignmentType === "NEW" && (
                    <div className="space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Tenant Name</label>
                        <Input
                          placeholder="Acme Corp"
                          value={newTenantBusinessName}
                          onChange={(e) => setNewTenantBusinessName(e.target.value)}
                          required={assignmentType === "NEW"}
                          className="h-8 text-xs bg-background border-border rounded-lg text-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Contact Email</label>
                        <Input
                          type="email"
                          placeholder="billing@acme.com"
                          value={newTenantEmail}
                          onChange={(e) => setNewTenantEmail(e.target.value)}
                          required={assignmentType === "NEW"}
                          className="h-8 text-xs bg-background border-border rounded-lg text-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Mobile Number</label>
                        <Input
                          placeholder="+919999999999"
                          value={newTenantMobile}
                          onChange={(e) => setNewTenantMobile(e.target.value)}
                          required={assignmentType === "NEW"}
                          className="h-8 text-xs bg-background border-border rounded-lg text-foreground placeholder:text-muted-foreground font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Generated Password</label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={newTenantPassword}
                            readOnly
                            className="h-8 pr-8 text-xs bg-background border-border rounded-lg text-foreground font-mono font-semibold"
                          />
                          <button
                            type="button"
                            onMouseDown={() => setShowPassword(true)}
                            onMouseUp={() => setShowPassword(false)}
                            onMouseLeave={() => setShowPassword(false)}
                            onTouchStart={() => setShowPassword(true)}
                            onTouchEnd={() => setShowPassword(false)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none p-0.5"
                            title="Hold to reveal"
                          >
                            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          Hold eye icon to securely display auto-generated password credentials.
                        </div>
                      </div>
                    </div>
                  )}

                  {assignmentType === "EXISTING" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                      <label className="text-[10px] font-bold text-muted-foreground">Select Active Tenant</label>
                      <Select value={existingTenantId} onValueChange={setExistingTenantId}>
                        <SelectTrigger className="w-full bg-background border-border text-foreground rounded-lg h-9 text-xs">
                          <SelectValue placeholder="Select active tenant context..." />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-card-foreground">
                          {activeTenants.length === 0 ? (
                            <div className="py-2 px-3 text-xs text-muted-foreground font-medium text-center font-mono">
                              No active tenants available
                            </div>
                          ) : (
                            activeTenants.map((t) => (
                              <SelectItem key={t.tenant_id} value={t.tenant_id} className="text-xs cursor-pointer focus:bg-muted focus:text-foreground font-semibold">
                                {t.business_name} ({t.tenant_id})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {assignmentType === "UNASSIGNED" && (
                    <div className="rounded-lg border border-dashed border-border p-4 bg-muted/30 text-center text-xs text-muted-foreground space-y-2 animate-in fade-in slide-in-from-top-1 duration-150 font-mono">
                      <div>
                        This machine will be registered but mapped to the platform root context. Its initial status will be <span className="font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">UNASSIGNED</span>.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="h-9 text-xs font-bold rounded-lg border-border hover:bg-muted cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-9 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirm
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold">Hardware API Failure:</span> {errorMsg}
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold">Success:</span> {successMsg}
          </div>
        </div>
      )}

      {/* Assigned Machines Table Grid */}
      <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
        Assigned ({activeFleet.length})
      </h2>
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold text-muted-foreground">Machine ID</TableHead>
              <TableHead className="font-bold text-muted-foreground">Assigned Tenant</TableHead>
              <TableHead className="font-bold text-muted-foreground">Location</TableHead>
              <TableHead className="font-bold text-muted-foreground">RXCXD</TableHead>
              <TableHead className="font-bold text-muted-foreground">Capacity</TableHead>
              <TableHead className="font-bold text-muted-foreground">Status</TableHead>
              <TableHead className="font-bold text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeFleet.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-medium font-mono text-xs">
                  No active operational fleet nodes found.
                </TableCell>
              </TableRow>
            ) : (
              activeFleet.map((machine) => (
                <TableRow key={machine.machine_id} className="hover:bg-muted/30">
                  <TableCell className="font-bold text-foreground flex items-center gap-2 font-mono">
                    <Cpu className="h-4 w-4 text-emerald-500" />
                    {machine.machine_id}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground font-semibold">
                    {machine.tenant_name || machine.tenant_id}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-medium text-xs">
                    {machine.location || "N/A"}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-medium text-xs font-mono">
                    {(machine.grid_config?.rows || 6)} x {(machine.grid_config?.columns || 8)} x {(machine.grid_config?.max_depth || 7)}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-medium text-xs font-mono">
                    {(machine.grid_config?.rows || 6) * (machine.grid_config?.columns || 8) * (machine.grid_config?.max_depth || 7)}
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
                      Active
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(machine)}
                        className="h-8 text-xs font-bold rounded-lg border-border hover:bg-muted cursor-pointer flex items-center gap-1.5"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isLoading}
                        onClick={() => handleUnassign(machine.machine_id)}
                        className="h-8 text-xs font-bold rounded-lg flex items-center gap-1.5 bg-red-600 text-white hover:bg-red-700 shadow-sm cursor-pointer"
                      >

                        Unassign
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Unassigned Machines Table Grid */}
      <div className="mt-10">
        <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
          Unassigned ({unassignedFleet.length})
        </h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold text-muted-foreground">Machine ID</TableHead>
                <TableHead className="font-bold text-muted-foreground">Tenant</TableHead>
                <TableHead className="font-bold text-muted-foreground">Location</TableHead>
                <TableHead className="font-bold text-muted-foreground">RXCXD</TableHead>
                <TableHead className="font-bold text-muted-foreground">Capacity</TableHead>
                <TableHead className="font-bold text-muted-foreground">Status</TableHead>
                <TableHead className="font-bold text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unassignedFleet.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-medium font-mono text-xs">
                    No unassigned warehouse hardware fleet registered yet.
                  </TableCell>
                </TableRow>
              ) : (
                unassignedFleet.map((machine) => (
                  <TableRow key={machine.machine_id} className="hover:bg-muted/30">
                    <TableCell className="font-bold text-foreground flex items-center gap-2 font-mono">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      {machine.machine_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground font-semibold">
                      {machine.tenant_name || machine.tenant_id}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium text-xs">
                      {machine.location || "N/A"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium text-xs font-mono">
                      {(machine.grid_config?.rows || 6)} x {(machine.grid_config?.columns || 8)} x {(machine.grid_config?.max_depth || 7)}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium text-xs font-mono">
                      {(machine.grid_config?.rows || 6) * (machine.grid_config?.columns || 8) * (machine.grid_config?.max_depth || 7)}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted border border-border/50 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        Unassigned Warehouse
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(machine)}
                        className="h-8 text-xs font-bold rounded-lg border-border hover:bg-muted cursor-pointer flex items-center gap-1.5 ml-auto"
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Machine Dialog Modal */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open)
        if (!open) {
          setEditingMachine(null)
        }
      }}>
        <DialogContent className={`bg-card rounded-2xl p-6 border border-border text-card-foreground transition-all duration-200 ${editingMachine?.assignment_status === "UNASSIGNED" ? "sm:max-w-[700px]" : "sm:max-w-[420px]"}`}>
          <DialogHeader className="space-y-1.5 pb-4 border-b border-border/50">
            <DialogTitle className="text-xl font-extrabold text-foreground flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary animate-pulse" />
              Edit Machine
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditConfirm} className="space-y-4 pt-4">
            {editingMachine?.assignment_status === "UNASSIGNED" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column (Hardware Configuration) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground border-b border-border/40 pb-1 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                    Vending Configuration
                  </h3>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Machine ID</label>
                    <Input
                      placeholder="e.g. V05"
                      value={editMachineId}
                      onChange={(e) => {
                        let val = e.target.value
                        let cleaned = val.replace(/[^vV0-9]/g, "")
                        if (cleaned.length > 0) {
                          if (!/^[vV]/.test(cleaned)) {
                            cleaned = "V" + cleaned.replace(/[^0-9]/g, "")
                          } else {
                            cleaned = "V" + cleaned.slice(1).replace(/[^0-9]/g, "")
                          }
                        }
                        setEditMachineId(cleaned)
                      }}
                      required
                      className="h-9 text-xs bg-background border-border rounded-lg text-foreground placeholder:text-muted-foreground font-mono font-semibold"
                    />
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Formatted ID: <span className="font-bold text-primary">{editMachineId || "VXX"}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Location</label>
                    <Input
                      placeholder="e.g. Primary Lobby"
                      value={editLocation}
                      onChange={(e) => {
                        const val = e.target.value
                        const words = val.split(" ")
                        const capitalizedWords = words.map(word => {
                          if (word.length === 0) return ""
                          return word.charAt(0).toUpperCase() + word.slice(1)
                        })
                        setEditLocation(capitalizedWords.join(" "))
                      }}
                      className="h-9 text-xs bg-background border-border rounded-lg text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Rows</label>
                      <Input
                        type="number"
                        min="1"
                        required
                        value={editRows}
                        onChange={(e) => setEditRows(e.target.value)}
                        className="h-9 text-xs bg-background border-border rounded-lg text-foreground font-mono font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Columns</label>
                      <Input
                        type="number"
                        min="1"
                        required
                        value={editColumns}
                        onChange={(e) => setEditColumns(e.target.value)}
                        className="h-9 text-xs bg-background border-border rounded-lg text-foreground font-mono font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Max Depth</label>
                      <Input
                        type="number"
                        min="1"
                        required
                        value={editMaxDepth}
                        onChange={(e) => setEditMaxDepth(e.target.value)}
                        className="h-9 text-xs bg-background border-border rounded-lg text-foreground font-mono font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column (Tenancy Assignment) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground border-b border-border/40 pb-1 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                    Tenancy Assignment
                  </h3>

                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <label className="text-[10px] font-bold text-muted-foreground">Select Active Tenant</label>
                    <Select value={editTenantId} onValueChange={setEditTenantId}>
                      <SelectTrigger className="w-full bg-background border-border text-foreground rounded-lg h-9 text-xs">
                        <SelectValue placeholder="Select active tenant context..." />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-card-foreground">
                        {activeTenants.length === 0 ? (
                          <div className="py-2 px-3 text-xs text-muted-foreground font-medium text-center font-mono">
                            No active tenants available
                          </div>
                        ) : (
                          activeTenants.map((t) => (
                            <SelectItem key={t.tenant_id} value={t.tenant_id} className="text-xs cursor-pointer focus:bg-muted focus:text-foreground font-semibold">
                              {t.business_name} ({t.tenant_id})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <div className="text-[10px] text-muted-foreground pt-1.5">
                      Assigning this node to a tenant moves it immediately into the <span className="font-semibold text-primary">Active Fleet</span>.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Machine ID</label>
                  <Input
                    placeholder="e.g. V05"
                    value={editMachineId}
                    onChange={(e) => {
                      let val = e.target.value
                      let cleaned = val.replace(/[^vV0-9]/g, "")
                      if (cleaned.length > 0) {
                        if (!/^[vV]/.test(cleaned)) {
                          cleaned = "V" + cleaned.replace(/[^0-9]/g, "")
                        } else {
                          cleaned = "V" + cleaned.slice(1).replace(/[^0-9]/g, "")
                        }
                      }
                      setEditMachineId(cleaned)
                    }}
                    required
                    className="h-9 text-xs bg-background border-border rounded-lg text-foreground placeholder:text-muted-foreground font-mono font-semibold"
                  />
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Formatted ID: <span className="font-bold text-primary">{editMachineId || "VXX"}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Location</label>
                  <Input
                    placeholder="e.g. Primary Lobby"
                    value={editLocation}
                    onChange={(e) => {
                      const val = e.target.value
                      const words = val.split(" ")
                      const capitalizedWords = words.map(word => {
                        if (word.length === 0) return ""
                        return word.charAt(0).toUpperCase() + word.slice(1)
                      })
                      setEditLocation(capitalizedWords.join(" "))
                    }}
                    className="h-9 text-xs bg-background border-border rounded-lg text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Rows</label>
                    <Input
                      type="number"
                      min="1"
                      required
                      value={editRows}
                      onChange={(e) => setEditRows(e.target.value)}
                      className="h-9 text-xs bg-background border-border rounded-lg text-foreground font-mono font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Columns</label>
                    <Input
                      type="number"
                      min="1"
                      required
                      value={editColumns}
                      onChange={(e) => setEditColumns(e.target.value)}
                      className="h-9 text-xs bg-background border-border rounded-lg text-foreground font-mono font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Max Depth</label>
                    <Input
                      type="number"
                      min="1"
                      required
                      value={editMaxDepth}
                      onChange={(e) => setEditMaxDepth(e.target.value)}
                      className="h-9 text-xs bg-background border-border rounded-lg text-foreground font-mono font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false)
                  setEditingMachine(null)
                }}
                className="h-9 text-xs font-bold rounded-lg border-border hover:bg-muted cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="h-9 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
