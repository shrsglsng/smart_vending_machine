import React, { useState, useEffect, useRef } from "react"
import { useSelector } from "react-redux"
import {
  Users,
  UserCheck,
  Plus,
  X,
  Smartphone,
  MapPin,
  Briefcase,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Pencil,
  Trash2,
  ShoppingCart,
  Lock
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import api from "../services/api"
import { config } from "../config"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import {
  Dialog,
  DialogContent,
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

export function OperatorsView() {
  const { role, tenant_id } = useSelector((state) => state.auth)

  const [operators, setOperators] = useState([])
  const [tenants, setTenants] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitLoading, setIsSubmitLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Creation State
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [mobileNumber, setMobileNumber] = useState("")
  const [password, setPassword] = useState("")
  const [address, setAddress] = useState("")
  const [itemCarrying, setItemCarrying] = useState("")
  const [selectedTenantId, setSelectedTenantId] = useState("")
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const fileInputRef = useRef(null)

  const [showPassword, setShowPassword] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingOperatorId, setEditingOperatorId] = useState(null)

  // Detail State (Inline profile view replacing previous popups)
  const [activeProfileOperator, setActiveProfileOperator] = useState(null)
  const [operatorJobs, setOperatorJobs] = useState([])
  const [isJobsLoading, setIsJobsLoading] = useState(false)
  const [showProfilePassword, setShowProfilePassword] = useState(false)

  // Load active operators
  const fetchOperators = async () => {
    setIsLoading(true)
    try {
      const response = await api.get("/admin/operators")
      setOperators(response.data || [])
      return response.data || []
    } catch (err) {
      console.error("Failed to fetch operators:", err)
      setErrorMsg("Failed to load operator records from server.")
      return []
    } finally {
      setIsLoading(false)
    }
  }

  // Load tenants list (Super Admin only for dynamic routing)
  const fetchTenants = async () => {
    if (role !== "SUPER_ADMIN") return
    try {
      const response = await api.get("/admin/tenants")
      // Filter out disabled B2B client profiles
      const activeTenantsList = response.data.filter((t) => t.status === "ACTIVE")

      // Ensure permanent internal operations tenant is added if missing
      const hasAibotInk = activeTenantsList.some(t => t.tenant_id === "Super_admin")
      if (!hasAibotInk) {
        activeTenantsList.unshift({
          tenant_id: "Super_admin",
          business_name: "AibotINK (Platform Root)"
        })
      }
      setTenants(activeTenantsList)
    } catch (err) {
      console.error("Failed to load B2B tenants list:", err)
    }
  }

  const fetchOperatorJobs = async (operatorId) => {
    setIsJobsLoading(true)
    try {
      const response = await api.get(`/admin/operator/jobs/${operatorId}`)
      setOperatorJobs(response.data || [])
    } catch (err) {
      console.error("Failed to fetch operator restock jobs:", err)
    } finally {
      setIsJobsLoading(false)
    }
  }

  const handleViewProfile = (operator) => {
    setActiveProfileOperator(operator)
    setShowProfilePassword(false)
    fetchOperatorJobs(operator.id)
  }

  useEffect(() => {
    fetchOperators()
    fetchTenants()
  }, [role])

  // Image Selection Handler
  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const clearImageSelection = (e) => {
    e.stopPropagation()
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const triggerCreate = () => {
    setIsEditMode(false)
    setEditingOperatorId(null)
    setName("")
    setMobileNumber("")
    const rand = Math.floor(1000 + Math.random() * 9000)
    setPassword(`aibotinkop${rand}`)
    setAddress("")
    setItemCarrying("")
    setSelectedTenantId("")
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    setErrorMsg(null)
    setSuccessMsg(null)
    setIsOpen(true)
  }

  const triggerEdit = (operator) => {
    setIsEditMode(true)
    setEditingOperatorId(operator.id)
    setName(operator.name || "")
    setMobileNumber(operator.mobile_number || "")
    setPassword("")
    setAddress(operator.address || "")
    setItemCarrying(operator.item_carrying || "")
    setSelectedTenantId(operator.tenant_id || "")
    setImageFile(null)
    if (operator.image_path) {
      const base = config.apiBaseUrl.replace(/\/api\/v1\/?$/, "")
      setImagePreview(`${base}${operator.image_path}`)
    } else {
      setImagePreview(null)
    }
    setErrorMsg(null)
    setSuccessMsg(null)
    setIsOpen(true)
  }

  const handleDeleteOperator = async (e, operator) => {
    e.stopPropagation()
    if (window.confirm(`Are you sure you want to permanently delete Operator "${operator.name}"?`)) {
      try {
        await api.post("/admin/operator/delete", { id: operator.id })
        setSuccessMsg(`Operator "${operator.name}" deleted successfully!`)
        await fetchOperators()
        setTimeout(() => setSuccessMsg(null), 1500)
      } catch (err) {
        console.error("Failed to delete operator:", err)
        setErrorMsg(err.response?.data?.message || "Failed to delete operator account.")
        setTimeout(() => setErrorMsg(null), 3000)
      }
    }
  }

  // Submit Operator data (Create / Edit)
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    if (mobileNumber.length !== 10) {
      setErrorMsg("Mobile number must be exactly 10 digits long and start with 6, 7, 8, or 9.")
      setIsSubmitLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append("name", name)
      formData.append("mobile_number", mobileNumber)
      formData.append("address", address)
      formData.append("item_carrying", itemCarrying)

      if (role === "SUPER_ADMIN") {
        formData.append("tenant_id", selectedTenantId || "Super_admin")
      }

      if (imageFile) {
        formData.append("image", imageFile)
      }

      if (isEditMode) {
        formData.append("id", editingOperatorId)
        await api.post("/admin/operator/edit", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        setSuccessMsg("Operator account updated successfully!")
      } else {
        formData.append("password", password)
        await api.post("/admin/operator/create", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        setSuccessMsg("Operator account created successfully!")
      }

      // Reset form variables on success
      setName("")
      setMobileNumber("")
      setPassword("")
      setAddress("")
      setItemCarrying("")
      setSelectedTenantId("")
      setImageFile(null)
      setImagePreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      const freshOperators = await fetchOperators()
      if (isEditMode && activeProfileOperator) {
        const updatedOp = freshOperators.find(op => op.id === editingOperatorId)
        if (updatedOp) {
          setActiveProfileOperator(updatedOp)
        }
      }
      setTimeout(() => {
        setIsOpen(false)
        setSuccessMsg(null)
      }, 1500)
    } catch (err) {
      console.error("Operator save failed:", err)
      setErrorMsg(err.response?.data?.message || "Failed to save Operator. Check inputs or network.")
    } finally {
      setIsSubmitLoading(false)
    }
  }

  const renderProvisionDialog = () => (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[85vh] flex flex-col p-6 overflow-hidden bg-card rounded-2xl border border-border text-card-foreground">
        <DialogHeader className="space-y-1.5 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle className="text-3xl font-extrabold text-foreground flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            {isEditMode ? "Edit Operator Details" : "Register Operator"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 w-full">
          {/* Scrollable Middle Container with custom scrollbar */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1.5 py-2 min-h-0 custom-popup-scroll">
            {errorMsg && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-3.5 text-xs text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-2 duration-200">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Registration Failed:</span> {errorMsg}
                </div>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3.5 text-xs text-emerald-700 dark:text-emerald-400 animate-in fade-in slide-in-from-top-2 duration-200">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Success:</span> {successMsg}
                </div>
              </div>
            )}

            {/* Two-Column Layout forced side-by-side */}
            <div className="flex flex-row gap-5 items-start justify-between w-full">
              {/* Left Column: Input Forms */}
              <div className="flex-1 min-w-0 space-y-4">
                <div className="space-y-1.5">
                  <Input
                    required
                    placeholder="Operator's Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value.replace(/[^A-Za-z\s]/g, ""))}
                    className="h-10 border-border rounded-lg text-foreground bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Input
                    required
                    placeholder="Mobile Number (Username)"
                    value={mobileNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val.length === 0) {
                        setMobileNumber("");
                        return;
                      }
                      const firstDigit = val.charAt(0);
                      if (!["6", "7", "8", "9"].includes(firstDigit)) {
                        return;
                      }
                      setMobileNumber(val.slice(0, 10));
                    }}
                    className="h-10 border-border rounded-lg text-foreground bg-background"
                  />
                </div>

                {!isEditMode && (
                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 font-mono">Auto Generated Password</label>
                    <div className="relative">
                      <Input
                        required={!isEditMode}
                        readOnly
                        type={showPassword ? "text" : "password"}
                        value={password}
                        className="h-10 pr-10 border-border rounded-lg text-foreground bg-background font-mono font-semibold"
                      />
                      <button
                        type="button"
                        onMouseDown={() => setShowPassword(true)}
                        onMouseUp={() => setShowPassword(false)}
                        onMouseLeave={() => setShowPassword(false)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus:outline-none p-0.5"
                      >
                        {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Input
                    placeholder="Address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-10 border-border rounded-lg text-foreground bg-background"
                  />
                </div>

                {/* Tenant Assignment Selector for SUPER_ADMIN */}
                {role === "SUPER_ADMIN" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 font-mono">Tenant Fleet Scope</label>
                    <Select
                      value={selectedTenantId}
                      onValueChange={(val) => setSelectedTenantId(val)}
                    >
                      <SelectTrigger className="w-full h-10 border-border rounded-lg text-foreground bg-background px-3 flex items-center justify-between text-left">
                        <SelectValue placeholder="Assign Tenant Scope (Default: AibotINK)" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border border-border shadow-lg rounded-lg max-h-60 overflow-y-auto text-card-foreground">
                        {tenants.map((t) => (
                          <SelectItem key={t.tenant_id} value={t.tenant_id}>
                            {t.business_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Right Column: Rectangular Image Preview / Upload Area */}
              <div className="flex-shrink-0 flex flex-col items-center justify-start pt-2" style={{ width: "180px" }}>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  className="hidden"
                />

                {imagePreview ? (
                  <div className="relative rounded-xl border border-border shadow-sm flex items-center justify-center bg-muted/20 shrink-0 overflow-hidden" style={{ width: "180px", height: "180px" }}>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-xl"
                    />

                    {/* Floating overlay actions in top-right corner */}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={triggerFileSelect}
                        className="h-7 w-7 rounded-lg bg-slate-900/90 text-white flex items-center justify-center hover:text-primary transition-colors cursor-pointer shadow-md border border-slate-800"
                        title="Change photo / Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={clearImageSelection}
                        className="h-7 w-7 rounded-lg bg-slate-900/90 text-white flex items-center justify-center hover:text-destructive transition-colors cursor-pointer shadow-md border border-slate-800"
                        title="Remove image"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={triggerFileSelect}
                    className="border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/5 transition-all duration-200 cursor-pointer bg-muted/10 shrink-0 p-4 rounded-xl"
                    style={{ width: "180px", height: "180px" }}
                  >
                    <ImageIcon className="h-8 w-8 stroke-[1.5] text-primary" />
                    <span className="text-xs font-extrabold uppercase font-mono tracking-wider mt-2">Select Photo</span>
                  </button>
                )}
                <span className="text-[10px] text-muted-foreground mt-2 font-mono">Profile photo is optional</span>
              </div>
            </div>
          </div>

          {/* Pinned submit button footer */}
          <div className="pt-3 border-t border-border/40 shrink-0 mt-3">
            <Button
              type="submit"
              disabled={isSubmitLoading}
              className="w-full h-10 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 shadow-sm transition-opacity cursor-pointer font-mono uppercase tracking-wider text-xs"
            >
              {isSubmitLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving operator records...
                </>
              ) : (
                isEditMode ? "Save Operator Changes" : "Confirm Registration"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )

  if (activeProfileOperator) {
    const finalProfileUrl = activeProfileOperator.image_path
      ? `${config.apiBaseUrl.replace(/\/api\/v1\/?$/, "")}${activeProfileOperator.image_path}`
      : null

    const activeJobs = operatorJobs.filter(j => j.status === "PENDING" || j.status === "IN_PROGRESS");
    let totalCarryingItems = 0;
    activeJobs.forEach(job => {
      if (job.packing_list) {
        job.packing_list.forEach(p => {
          totalCarryingItems += p.total_quantity_needed || 0;
        });
      }
    });

    const materialCarryingDisplay = totalCarryingItems > 0
      ? `${totalCarryingItems} items carrying`
      : "None";

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Profile Header Row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveProfileOperator(null)
                setShowProfilePassword(false)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer shadow-sm transition-all"
            >
              ← Back to Operators
            </button>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Operator Profile
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => triggerEdit(activeProfileOperator)}
              className="h-9 px-4 rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center gap-1.5 text-xs font-bold font-mono uppercase tracking-wider cursor-pointer shadow-sm"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Profile
            </Button>
            <Button
              onClick={(e) => {
                handleDeleteOperator(e, activeProfileOperator)
                setActiveProfileOperator(null)
              }}
              className="h-9 px-4 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center gap-1.5 text-xs font-bold font-mono uppercase tracking-wider cursor-pointer shadow-sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Operator
            </Button>
          </div>
        </div>

        {/* Top Info Layout Cards matching mockup */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Operator cover/initials box */}
          <div className="lg:col-span-1 bg-card border border-border rounded-2xl shadow-sm min-h-[220px] overflow-hidden flex items-stretch justify-stretch">
            {finalProfileUrl ? (
              <img
                src={finalProfileUrl}
                alt={activeProfileOperator.name}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <div className="w-full h-full min-h-[220px] bg-gradient-to-br from-primary/10 to-primary/5 text-primary flex flex-col items-center justify-center shadow-inner py-6">
                <span className="text-6xl font-black font-mono">
                  {activeProfileOperator.name ? activeProfileOperator.name.charAt(0).toUpperCase() : "?"}
                </span>
                <span className="text-[10px] font-bold text-primary uppercase font-mono tracking-wider mt-3">No Photo Uploaded</span>
              </div>
            )}
          </div>

          {/* Right Column: Operator details like phone number address tenant basic info */}
          <div className="lg:col-span-2 p-6 bg-card border border-border rounded-2xl shadow-sm space-y-4">
            <div>
              <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
                {activeProfileOperator.name}
              </h2>
              <span className="mt-1.5 font-bold font-mono text-[10px] uppercase bg-primary/10 text-primary border border-primary/20 rounded-lg px-2.5 py-0.5 inline-block">
                Assigned to: {activeProfileOperator.creator_tenant_name}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="flex items-start gap-3">
                <Smartphone className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[9px] uppercase font-bold text-muted-foreground font-mono">Mobile Number / Username</h4>
                  <p className="text-sm font-semibold text-foreground">{activeProfileOperator.mobile_number}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[9px] uppercase font-bold text-muted-foreground font-mono">Address</h4>
                  <p className="text-sm font-semibold text-foreground leading-tight">{activeProfileOperator.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-border/40 pt-3 md:border-t-0 md:pt-0">
                <Briefcase className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[9px] uppercase font-bold text-muted-foreground font-mono">Current Materials Carrying</h4>
                  <p className="text-sm font-semibold text-foreground leading-tight">{materialCarryingDisplay}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-border/40 pt-3 md:border-t-0 md:pt-0">
                <Cpu className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[9px] uppercase font-bold text-muted-foreground font-mono">Assigned Vending Machines</h4>
                  <p className="text-xs font-mono font-bold text-muted-foreground leading-snug mt-1 break-all bg-muted border border-border rounded-lg p-2 max-h-16 overflow-y-auto">
                    {activeProfileOperator.managed_machines}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-border/40 pt-3 md:pt-3">
                <Lock className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-[9px] uppercase font-bold text-muted-foreground font-mono">Login Password</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-semibold text-foreground font-mono truncate">
                      {showProfilePassword ? (activeProfileOperator.password_plaintext || "Not Saved (Legacy)") : "••••••••"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowProfilePassword(!showProfilePassword)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted cursor-pointer shrink-0"
                      title={showProfilePassword ? "Hide password" : "Show password"}
                    >
                      {showProfilePassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Order info in table form no more popup */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Order History
            </h3>
          </div>

          {isJobsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <span className="text-xs font-semibold text-muted-foreground font-mono animate-pulse">Syncing shift logs...</span>
            </div>
          ) : operatorJobs.length === 0 ? (
            <div className="text-center py-12 bg-muted/5 border border-dashed border-border rounded-xl">
              <span className="text-xs font-bold text-muted-foreground font-mono uppercase tracking-wider">No Dispatched Shift Activities</span>
              <p className="text-[10px] text-muted-foreground max-w-[280px] mx-auto mt-1 font-medium leading-relaxed">
                This operator account currently has no restock job assignments or historical shift records.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/80 text-[10px] uppercase font-bold text-muted-foreground font-mono select-none">
                    <th className="py-3 px-4">Job ID</th>
                    <th className="py-3 px-4">Machine ID</th>
                    <th className="py-3 px-4">Shift Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Clearout Req.</th>
                    <th className="py-3 px-4 text-right">Dispatched Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs font-semibold">
                  {operatorJobs.map((job) => {
                    const formattedDate = new Date(job.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })

                    const statusColorMap = {
                      PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20",
                      IN_PROGRESS: "bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/20",
                      COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20",
                      CANCELLED: "bg-destructive/10 text-destructive border-destructive/20"
                    }
                    const activeBadgeClass = statusColorMap[job.status] || "bg-muted text-muted-foreground"

                    return (
                      <tr key={job._id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[10px] tracking-tight">{job.job_id}</td>
                        <td className="py-3 px-4 font-bold text-foreground">{job.machine_id}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-[10px] uppercase font-mono bg-muted border border-border/60 rounded px-1.5 py-0.5">
                            {job.shift_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-bold font-mono uppercase border rounded-lg px-2 py-0.5 inline-block ${activeBadgeClass}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-bold font-mono uppercase ${job.clearout_required ? "text-primary bg-primary/10 border border-primary/15" : "text-muted-foreground bg-muted/30 border border-border"} rounded-md px-1.5 py-0.5`}>
                            {job.clearout_required ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-muted-foreground text-[10px]">{formattedDate}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {renderProvisionDialog()}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Viewport Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <UserCheck className="h-8 w-8 text-primary" />
            Operators Management
            {operators.length > 0 && (
              <span className="font-mono text-sm font-extrabold bg-primary/10 text-primary border border-primary/20 rounded-xl px-2.5 py-0.5 ml-2">
                {operators.length} Active
              </span>
            )}
          </h1>
        </div>

        <Button
          onClick={triggerCreate}
          className="font-bold flex items-center gap-2 rounded-xl shadow-sm bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          New Operator
        </Button>

        {/* Provision Dialog modal */}
        {renderProvisionDialog()}
      </div>

      {/* Grid of Operators Card layout */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <span className="text-xs font-semibold text-muted-foreground font-mono animate-pulse">Syncing fleet logs...</span>
        </div>
      ) : operators.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="border border-border/80 bg-card rounded-2xl p-16 text-center space-y-4 shadow-sm"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-bounce">
            <Users className="h-8 w-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">No Registered Operators</h2>
            <p className="text-xs text-muted-foreground font-mono">
              Register restocking staff operators to manage sequential machine restocks and shifts.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          <AnimatePresence mode="popLayout">
            {operators.map((operator, index) => {
              const cleanAvatarInitial = operator.name ? operator.name.charAt(0).toUpperCase() : "?"

              // Backend host resolve for image path
              const finalProfileUrl = operator.image_path
                ? `${config.apiBaseUrl.replace(/\/api\/v1\/?$/, "")}${operator.image_path}`
                : null

              return (
                <motion.div
                  layout
                  key={operator.id}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ y: -6, scale: 1.018, boxShadow: "0 16px 24px rgba(0,0,0,0.08)" }}
                  className="group bg-card text-card-foreground border border-border/60 hover:border-primary/30 rounded-2xl overflow-hidden shadow-sm transition-all duration-300 cursor-pointer flex flex-col justify-between relative"
                  onClick={() => handleViewProfile(operator)}
                >
                  {/* Floating Action Buttons Badge (top-right overlay on card image) */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 scale-90 group-hover:scale-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        triggerEdit(operator)
                      }}
                      className="h-8 w-8 rounded-lg bg-slate-950/85 hover:bg-slate-900 text-white flex items-center justify-center shadow-md hover:text-primary transition-all cursor-pointer focus:outline-none"
                      title="Edit Operator Profile"
                    >
                      <Pencil className="h-3.5 w-3.5 stroke-[2]" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteOperator(e, operator)}
                      className="h-8 w-8 rounded-lg bg-slate-950/85 hover:bg-red-650 hover:bg-red-650 hover:bg-red-600 text-white flex items-center justify-center shadow-md hover:text-red-400 transition-all cursor-pointer focus:outline-none"
                      title="Delete Operator Account"
                    >
                      <Trash2 className="h-3.5 w-3.5 stroke-[2]" />
                    </button>
                  </div>

                  {/* Card Cover Picture */}
                  <div className="relative h-48 w-full overflow-hidden flex items-center justify-center select-none bg-muted/20">
                    {finalProfileUrl ? (
                      <img
                        src={finalProfileUrl}
                        alt={operator.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/20 text-primary flex items-center justify-center text-3xl font-extrabold font-mono shadow-inner">
                          {cleanAvatarInitial}
                        </div>
                      </div>
                    )}

                    {/* Gradient shading overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/15 to-transparent" />

                    {/* Operator Name bottom overlay */}
                    <div className="absolute bottom-3 left-4 right-4">
                      <h3 className="text-sm font-extrabold text-white tracking-wide uppercase font-mono truncate" title={operator.name}>
                        {operator.name}
                      </h3>
                    </div>

                    {/* Operator Phone Number Hover Overlay */}
                    <div className="absolute bottom-3 right-3 font-mono text-[10px] text-white/90 bg-slate-950/80 border border-white/10 rounded-md px-1.5 py-0.5 transition-all duration-300 opacity-0 group-hover:opacity-100 flex items-center gap-1.5">
                      <Smartphone className="h-3 w-3 text-primary shrink-0" />
                      <span>{operator.mobile_number}</span>
                    </div>
                  </div>

                  {/* Card Details Footer */}
                  <div className="p-4 pt-5 bg-card rounded-b-2xl border-t border-border/40 flex-1 flex flex-col justify-between space-y-3.5">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono shrink-0">Assigned to:</span>
                        <span className="font-extrabold bg-primary/10 text-primary dark:bg-primary/25 border border-primary/15 rounded-lg px-2 py-0.5 text-[10px] truncate max-w-[170px] font-mono text-right" title={operator.creator_tenant_name}>
                          {operator.creator_tenant_name}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/45 mt-4 flex items-center justify-end text-xs font-bold text-primary group-hover:translate-x-1.5 transition-transform duration-200">
                      <span>View Profile</span>
                      <ChevronRight className="h-4 w-4 ml-0.5" />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
