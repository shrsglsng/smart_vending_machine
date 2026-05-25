import React, { useState, useEffect } from "react"
import { ShieldCheck, Eye, EyeOff, Loader2, AlertCircle, Plus, X } from "lucide-react"
import { motion } from "framer-motion"

import api from "../services/api"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"

const MotionTableBody = motion(TableBody)
const MotionTableRow = motion(TableRow)

const tableContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04
    }
  }
}

const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 15
    }
  }
}
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

function PasswordCell({ password }) {
  const [show, setShow] = useState(false)

  return (
    <div className="flex items-center gap-1.5 min-w-[90px]">
      <span className="font-mono text-xs text-muted-foreground select-all truncate max-w-[80px]">
        {show ? password : "••••••••"}
      </span>
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus:outline-none p-0.5"
        title={show ? "Hide Password" : "Show Password"}
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

export function TenantsView() {
  const [tenants, setTenants] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Form Fields
  const [businessName, setBusinessName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [mobileNumber, setMobileNumber] = useState("")
  const [assignedMachineId, setAssignedMachineId] = useState("")
  const [password, setPassword] = useState("")
  const [isInternal, setIsInternal] = useState(false)

  const [availableMachines, setAvailableMachines] = useState([])

  // Security password mask control
  const [showPassword, setShowPassword] = useState(false)

  // Edit Mode state
  const [editMode, setEditMode] = useState(false)
  const [editingTenantId, setEditingTenantId] = useState(null)
  const [assignedMachines, setAssignedMachines] = useState([])
  const [originalAssignedMachines, setOriginalAssignedMachines] = useState([])

  // Fetch tenants on mount
  const fetchTenants = async () => {
    try {
      const response = await api.get("/admin/tenants")
      setTenants(response.data)
    } catch (err) {
      console.error("Failed to fetch tenants:", err)
    }
  }

  // Fetch available machines
  const fetchAvailableMachines = async () => {
    try {
      const response = await api.get("/admin/machines/available")
      setAvailableMachines(response.data || [])
    } catch (err) {
      console.error("Failed to fetch available machines:", err)
    }
  }

  // Disable tenant handler
  const handleDisableTenant = async (tenantId) => {
    if (window.confirm("Are you sure you want to disable this tenant? All their assigned machines will be cascadingly unassigned.")) {
      setIsActionLoading(true)
      try {
        await api.post("/admin/tenant/disable", { tenant_id: tenantId })
        await fetchTenants()
        await fetchAvailableMachines()
      } catch (err) {
        console.error("Failed to disable tenant:", err)
      } finally {
        setIsActionLoading(false)
      }
    }
  }

  // Enable tenant handler
  const handleEnableTenant = async (tenantId) => {
    if (window.confirm("Are you sure you want to enable this tenant?")) {
      setIsActionLoading(true)
      try {
        await api.post("/admin/tenant/enable", { tenant_id: tenantId })
        await fetchTenants()
        await fetchAvailableMachines()
      } catch (err) {
        console.error("Failed to enable tenant:", err)
      } finally {
        setIsActionLoading(false)
      }
    }
  }

  // Local Machine Assignment Handlers
  const handleRemoveMachineLocal = (mId) => {
    setAssignedMachines((prev) => prev.filter((id) => id !== mId))
  }

  const handleAddMachineLocal = (mId) => {
    if (mId && !assignedMachines.includes(mId)) {
      setAssignedMachines((prev) => [...prev, mId])
    }
  }

  const handleMachineSelect = (value) => {
    if (editMode) {
      handleAddMachineLocal(value)
      setAssignedMachineId("")
    } else {
      setAssignedMachineId(value)
    }
  }

  const selectableMachines = editMode
    ? [...availableMachines, ...originalAssignedMachines].filter((mId) => !assignedMachines.includes(mId))
    : availableMachines

  // Edit Click Handler
  const handleEditClick = (tenant) => {
    setEditMode(true)
    setEditingTenantId(tenant.tenant_id)
    setBusinessName(tenant.business_name)
    setContactEmail(tenant.contact_email)
    setMobileNumber(tenant.mobile_number)
    setPassword(tenant.password || "")
    setAssignedMachineId("")

    // Parse currently assigned machines list
    let currentAssigned = []
    if (tenant.assigned_machine && tenant.assigned_machine !== "N/A" && tenant.assigned_machine.trim() !== "") {
      currentAssigned = tenant.assigned_machine.split(",").map((id) => id.trim()).filter(Boolean)
    }
    setAssignedMachines(currentAssigned)
    setOriginalAssignedMachines(currentAssigned)
    setIsOpen(true)
  }

  useEffect(() => {
    fetchTenants()
    fetchAvailableMachines()
  }, [])

  // Machine ID validation handler
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
    setAssignedMachineId(cleaned)
  }

  const handleRevealPassword = () => {
    setShowPassword(true)
  }

  const handleMaskPassword = () => {
    setShowPassword(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      if (editMode) {
        // Calls POST /api/v1/admin/tenant/edit
        await api.post("/admin/tenant/edit", {
          tenant_id: editingTenantId,
          business_name: businessName,
          contact_email: contactEmail,
          mobile_number: mobileNumber,
          password: password,
          assigned_machines: assignedMachines,
        })
        setSuccessMsg("Tenant successfully updated!")
      } else {
        // Calls POST /api/v1/admin/tenant/create
        await api.post("/admin/tenant/create", {
          business_name: businessName,
          contact_email: contactEmail,
          mobile_number: isInternal ? undefined : mobileNumber,
          password: isInternal ? undefined : password,
          assigned_machine_id: assignedMachineId,
          is_internal: isInternal
        })
        setSuccessMsg("Tenant and Admin user successfully created!")
      }

      // Reset fields
      setBusinessName("")
      setContactEmail("")
      setMobileNumber("")
      setAssignedMachineId("")
      setPassword("")
      setAssignedMachines([])
      setOriginalAssignedMachines([])
      setIsInternal(false)
      setEditMode(false)
      setEditingTenantId(null)

      // Re-fetch tenants list and close modal
      await fetchTenants()
      setIsOpen(false)
      setSuccessMsg(null)
    } catch (err) {
      console.error(editMode ? "Tenant update failed:" : "Tenant creation failed:", err)
      setErrorMsg(
        err.response?.data?.message || `Failed to ${editMode ? "update" : "create"} Tenant. Ensure the backend is active.`
      )
    } finally {
      setIsLoading(false)
    }
  }

  const activeTenants = tenants.filter((t) => t.status !== "DISABLED" && t.tenant_id !== "Super_admin")
  const disabledTenants = tenants.filter((t) => t.status === "DISABLED" && t.tenant_id !== "Super_admin")
  const hasInternalTenant = tenants.some((t) => t.tenant_id === "Super_admin")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Tenant Administrations
          </h1>
        </div>

        {/* Create Tenant Modal Trigger */}
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open)
          if (open) {
            if (!editMode) {
              const rand = Math.floor(1000 + Math.random() * 9000)
              setPassword(`aibotink${rand}`)
              setBusinessName("")
              setContactEmail("")
              setMobileNumber("")
              setAssignedMachineId("")
              setAssignedMachines([])
              setOriginalAssignedMachines([])
              setIsInternal(false)
            }
            fetchAvailableMachines()
          } else {
            setEditMode(false)
            setEditingTenantId(null)
            setOriginalAssignedMachines([])
            setAssignedMachines([])
            setIsInternal(false)
          }
        }}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditMode(false)
                setEditingTenantId(null)
                setBusinessName("")
                setContactEmail("")
                setMobileNumber("")
                setAssignedMachineId("")
                setAssignedMachines([])
                setOriginalAssignedMachines([])
                setIsInternal(false)
              }}
              className="font-bold flex items-center gap-2 rounded-xl shadow-sm bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Create Tenant
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[400px] bg-card rounded-2xl p-6 border border-border text-card-foreground">
            <DialogHeader className="space-y-1.5 pb-4 border-b border-border/50">
              <DialogTitle className="text-4xl font-extrabold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-8 w-8 text-primary" />
                {editMode ? "Edit Tenant" : "New tenant"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-600 animate-in fade-in slide-in-from-top-2 duration-200">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Provisioning Failed:</span> {errorMsg}
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-700 animate-in fade-in slide-in-from-top-2 duration-200">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Success:</span> {successMsg}
                  </div>
                </div>
              )}

              {!editMode && !hasInternalTenant && (
                <div className="flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-xl p-3.5 select-none animate-in fade-in slide-in-from-top-1 duration-150">
                  <input
                    id="is-internal-tenant"
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setIsInternal(checked)
                      if (checked) {
                        setBusinessName("AibotINK")
                        setContactEmail("aibotink.web@gmail.com")
                        setMobileNumber("")
                        setPassword("AUTO_GENERATED")
                      } else {
                        setBusinessName("")
                        setContactEmail("")
                        setMobileNumber("")
                        const rand = Math.floor(1000 + Math.random() * 9000)
                        setPassword(`aibotink${rand}`)
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="is-internal-tenant" className="text-xs font-bold text-primary cursor-pointer select-none">
                    Register as Internal Operations (Super Admin)
                  </label>
                </div>
              )}

              <div className="space-y-1.5">
                <Input
                  required
                  readOnly={isInternal}
                  placeholder="Enter Tenant Name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className={`h-10 border-border rounded-lg text-foreground bg-background ${isInternal ? "opacity-75 font-semibold" : ""}`}
                />
              </div>

              <div className="space-y-1.5">
                <Input
                  required
                  readOnly={isInternal}
                  type="email"
                  placeholder="Tenant Email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={`h-10 border-border rounded-lg text-foreground bg-background ${isInternal ? "opacity-75 font-semibold" : ""}`}
                />
              </div>

              {!isInternal && (
                <div className="space-y-1.5">
                  <Input
                    required
                    placeholder="Mobile Number"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="h-10 border-border rounded-lg text-foreground bg-background"
                  />
                </div>
              )}

              {editMode && (
                <div className="space-y-1.5 pb-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Assigned Machines ({assignedMachines.length})
                  </label>
                  {assignedMachines.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic bg-muted/30 border border-dashed border-border rounded-lg p-3 text-center">
                      No machines currently assigned.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-muted/20 border border-border rounded-lg">
                      {assignedMachines.map((mId) => (
                        <span
                          key={mId}
                          className="inline-flex items-center gap-1 bg-muted border border-border text-foreground rounded-md px-2 py-0.5 text-xs font-mono select-none animate-in scale-in-95 duration-100"
                        >
                          {mId}
                          <button
                            type="button"
                            onClick={() => handleRemoveMachineLocal(mId)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded p-0.5 transition-colors cursor-pointer focus:outline-none"
                            title={`Remove ${mId}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Select
                  disabled={editMode ? selectableMachines.length === 0 : availableMachines.length === 0}
                  value={assignedMachineId}
                  onValueChange={handleMachineSelect}
                >
                  <SelectTrigger className="w-full h-10 border-border rounded-lg text-foreground bg-background px-3 flex items-center justify-between text-left">
                    <SelectValue placeholder={
                      editMode
                        ? (selectableMachines.length === 0 ? "No more machines available" : "Add machine...")
                        : (availableMachines.length === 0 ? "No machines available" : "Assign Machine_ID")
                    } />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-border shadow-lg rounded-lg max-h-60 overflow-y-auto text-card-foreground">
                    {selectableMachines.map((mId) => (
                      <SelectItem key={mId} value={mId}>
                        {mId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isInternal && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Auto Generated Password</label>
                  <div className="relative">
                    <Input
                      required
                      readOnly
                      type={showPassword ? "text" : "password"}
                      value={password}
                      className="h-10 pr-10 border-border rounded-lg text-foreground bg-background font-mono font-semibold"
                    />
                    <button
                      type="button"
                      onMouseDown={handleRevealPassword}
                      onMouseUp={handleMaskPassword}
                      onMouseLeave={handleMaskPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus:outline-none p-0.5"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4.5 w-4.5" />
                      ) : (
                        <Eye className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </div>
                  <div className="text-[9px] text-muted-foreground px-1">
                    Hold eye icon to securely display auto-generated password credentials.
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 mt-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 shadow-sm transition-opacity cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editMode ? "Updating Tenant..." : "Creating Tenant..."}
                  </>
                ) : (
                  editMode ? "Update" : "Confirm"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Tenants Table Grid */}
      <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
        Active Tenants
      </h2>
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold text-muted-foreground">Tenant Name</TableHead>
              <TableHead className="font-bold text-muted-foreground">Tenant ID</TableHead>
              <TableHead className="font-bold text-muted-foreground">Contact Email</TableHead>
              <TableHead className="font-bold text-muted-foreground">Mobile Number</TableHead>
              <TableHead className="font-bold text-muted-foreground">Assigned Machine</TableHead>
              <TableHead className="font-bold text-muted-foreground">Password</TableHead>
              <TableHead className="font-bold text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <MotionTableBody variants={tableContainerVariants} initial="hidden" animate="show">
            {activeTenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-medium">
                  No custom active tenants registered yet. Click "Create Tenant" above to provision.
                </TableCell>
              </TableRow>
            ) : (
              activeTenants.map((tenant) => (
                <MotionTableRow key={tenant.id} variants={rowVariants} className="hover:bg-muted/30">
                  <TableCell className="font-bold text-foreground truncate max-w-[150px]" title={tenant.business_name}>{tenant.business_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground font-semibold truncate max-w-[100px]" title={tenant.tenant_id}>{tenant.tenant_id}</TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[150px]" title={tenant.contact_email}>{tenant.contact_email}</TableCell>
                  <TableCell className="text-muted-foreground font-medium truncate max-w-[120px]" title={tenant.mobile_number}>{tenant.mobile_number}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[100px]" title={tenant.assigned_machine}>{tenant.assigned_machine}</TableCell>
                  <TableCell className="py-2">
                    <PasswordCell password={tenant.password} />
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={isActionLoading}
                        onClick={() => handleEditClick(tenant)}
                        className="rounded-lg text-xs font-bold bg-muted hover:bg-muted/80 text-foreground cursor-pointer px-3 py-1.5 shadow-sm transition-colors border border-border"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        disabled={isActionLoading}
                        onClick={() => handleDisableTenant(tenant.tenant_id)}
                        className="rounded-lg text-xs font-bold bg-red-500 hover:bg-red-600 text-white cursor-pointer px-3 py-1.5 shadow-sm transition-colors"
                      >
                        Disable
                      </Button>
                    </div>
                  </TableCell>
                </MotionTableRow>
              ))
            )}
          </MotionTableBody>
        </Table>
      </div>

      {/* Disabled Tenants Section */}
      <div className="mt-10">
        <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
          Disabled Tenants
        </h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold text-muted-foreground">Tenant Name</TableHead>
                <TableHead className="font-bold text-muted-foreground">Tenant ID</TableHead>
                <TableHead className="font-bold text-muted-foreground">Contact Email</TableHead>
                <TableHead className="font-bold text-muted-foreground">Mobile Number</TableHead>
                <TableHead className="font-bold text-muted-foreground">Assigned Machine</TableHead>
                <TableHead className="font-bold text-muted-foreground">Password</TableHead>
                <TableHead className="font-bold text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <MotionTableBody variants={tableContainerVariants} initial="hidden" animate="show">
              {disabledTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-medium">
                    No disabled tenants.
                  </TableCell>
                </TableRow>
              ) : (
                disabledTenants.map((tenant) => (
                  <MotionTableRow key={tenant.id} variants={rowVariants} className="hover:bg-muted/30 opacity-75">
                    <TableCell className="font-bold text-foreground truncate max-w-[150px]" title={tenant.business_name}>{tenant.business_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground font-semibold truncate max-w-[100px]" title={tenant.tenant_id}>{tenant.tenant_id}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[150px]" title={tenant.contact_email}>{tenant.contact_email}</TableCell>
                    <TableCell className="text-muted-foreground font-medium truncate max-w-[120px]" title={tenant.mobile_number}>{tenant.mobile_number}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[100px]" title={tenant.assigned_machine}>{tenant.assigned_machine}</TableCell>
                    <TableCell className="py-2">
                      <PasswordCell password={tenant.password} />
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={isActionLoading}
                          onClick={() => handleEditClick(tenant)}
                          className="rounded-lg text-xs font-bold bg-muted hover:bg-muted/80 text-foreground cursor-pointer px-3 py-1.5 shadow-sm transition-colors border border-border"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          disabled={isActionLoading}
                          onClick={() => handleEnableTenant(tenant.tenant_id)}
                          className="rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 cursor-pointer px-3 py-1.5 shadow-sm transition-opacity"
                        >
                          Enable
                        </Button>
                      </div>
                    </TableCell>
                  </MotionTableRow>
                ))
              )}
            </MotionTableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
