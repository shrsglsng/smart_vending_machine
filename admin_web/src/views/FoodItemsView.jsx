import React, { useState, useEffect, useRef } from "react"
import { useSelector } from "react-redux"
import { Plus, Utensils, AlertCircle, ShieldCheck, Loader2, Pencil, Trash2 } from "lucide-react"
import { motion } from "framer-motion"

import api from "../services/api"
import { config } from "../config"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog"

const gridContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
}

const cardItemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
}

export function FoodItemsView() {
  const { role } = useSelector((state) => state.auth)

  const [catalogItems, setCatalogItems] = useState([])
  const [isFetchLoading, setIsFetchLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Dialog Control
  const [isOpen, setIsOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState("BREAKFAST")

  // Form Fields
  const [itemName, setItemName] = useState("")
  const [itemPrice, setItemPrice] = useState("")
  const [itemDescription, setItemDescription] = useState("")
  const [imageSource, setImageSource] = useState("UPLOAD") // "UPLOAD" | "URL"
  const [imageFile, setImageFile] = useState(null)
  const [imageUrl, setImageUrl] = useState("")

  // Real-time Preview Url
  const [previewUrl, setPreviewUrl] = useState("")

  // Hidden File input ref to hide the ugly browser selected filename next to the trigger button
  const fileInputRef = useRef(null)

  // Fetch all master catalog food items
  const fetchCatalog = async () => {
    try {
      const response = await api.get("/admin/catalog")
      setCatalogItems(response.data || [])
    } catch (err) {
      console.error("Failed to fetch food items catalog:", err)
    } finally {
      setIsFetchLoading(false)
    }
  }

  useEffect(() => {
    fetchCatalog()
  }, [])

  // Reactive URL object creator for local file selection or direct text URL previewing
  useEffect(() => {
    if (imageSource === "UPLOAD" && imageFile) {
      const objectUrl = URL.createObjectURL(imageFile)
      setPreviewUrl(objectUrl)
      // Cleanup hook logic to release system resources
      return () => URL.revokeObjectURL(objectUrl)
    } else if (imageSource === "URL" && imageUrl) {
      setPreviewUrl(imageUrl)
    } else {
      setPreviewUrl("")
    }
  }, [imageSource, imageFile, imageUrl])

  const handleToggleSource = (source) => {
    setImageSource(source)
    if (source === "UPLOAD") {
      setImageUrl("")
    } else {
      setImageFile(null)
    }
  }

  // Trigger modal launch with dynamic category auto-assignment
  const triggerCreate = (category) => {
    setIsEditMode(false)
    setEditingItemId(null)
    setSelectedCategory(category)
    setItemName("")
    setItemPrice("")
    setItemDescription("")
    setImageSource("UPLOAD")
    setImageFile(null)
    setImageUrl("")
    setPreviewUrl("")
    setErrorMsg(null)
    setSuccessMsg(null)
    setIsOpen(true)
  }

  // Trigger modal in edit mode populated with catalog details
  const triggerEdit = (item) => {
    setIsEditMode(true)
    setEditingItemId(item._id)
    setSelectedCategory(item.category || "BREAKFAST")
    setItemName(item.item_name || "")
    setItemPrice(item.default_price_paise ? (item.default_price_paise / 100).toString() : "")
    setItemDescription(item.item_description || "")
    
    if (item.image_path && (item.image_path.startsWith("http://") || item.image_path.startsWith("https://"))) {
      setImageSource("URL")
      setImageUrl(item.image_path)
      setPreviewUrl(item.image_path)
      setImageFile(null)
    } else {
      setImageSource("UPLOAD")
      setImageFile(null)
      setImageUrl("")
      setPreviewUrl(getImageUrl(item.image_path))
    }

    setErrorMsg(null)
    setSuccessMsg(null)
    setIsOpen(true)
  }

  // Delete item handler
  const handleDeleteItem = async (e, item) => {
    e.stopPropagation()
    if (window.confirm(`Are you sure you want to permanently delete "${item.item_name}" from the global approved catalog?`)) {
      try {
        await api.post("/admin/catalog/delete", { _id: item._id })
        await fetchCatalog()
      } catch (err) {
        console.error("Failed to delete catalog item:", err)
        alert(err.response?.data?.message || "Failed to delete catalog item.")
      }
    }
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()

    // Client-side validations
    if (!itemName || !itemName.trim() || !itemDescription || !itemDescription.trim()) {
      setErrorMsg("Name of item and Description are required to save.")
      return
    }

    const pricePaise = Math.round(parseFloat(itemPrice) * 100)
    if (isNaN(pricePaise) || pricePaise < 0) {
      setErrorMsg("Please enter a valid price.")
      return
    }

    if (!isEditMode && imageSource === "UPLOAD" && !imageFile) {
      setErrorMsg("Please select an image file to upload.")
      return
    }

    if (imageSource === "URL" && (!imageUrl || !imageUrl.trim())) {
      setErrorMsg("Please provide a valid image URL.")
      return
    }

    setIsLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      if (isEditMode) {
        // Edit Branch
        if (imageSource === "UPLOAD") {
          const formData = new FormData()
          formData.append("_id", editingItemId)
          formData.append("item_name", itemName.trim())
          formData.append("item_description", itemDescription.trim())
          formData.append("category", selectedCategory)
          formData.append("default_price_paise", pricePaise)
          if (imageFile) {
            formData.append("image", imageFile)
          }

          await api.post("/admin/catalog/edit", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          })
        } else {
          await api.post("/admin/catalog/edit", {
            _id: editingItemId,
            item_name: itemName.trim(),
            item_description: itemDescription.trim(),
            category: selectedCategory,
            default_price_paise: pricePaise,
            image_url: imageUrl.trim(),
          })
        }
        setSuccessMsg("Catalog item updated successfully!")
      } else {
        // Creation Branch
        if (imageSource === "UPLOAD") {
          const formData = new FormData()
          formData.append("item_name", itemName.trim())
          formData.append("item_description", itemDescription.trim())
          formData.append("category", selectedCategory)
          formData.append("default_price_paise", pricePaise)
          formData.append("image", imageFile)

          await api.post("/admin/catalog/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          })
        } else {
          await api.post("/admin/catalog/upload", {
            item_name: itemName.trim(),
            item_description: itemDescription.trim(),
            category: selectedCategory,
            default_price_paise: pricePaise,
            image_url: imageUrl.trim(),
          })
        }
        setSuccessMsg("Catalog item registered successfully!")
      }
      
      // Re-fetch catalog list for immediate real-time rendering
      await fetchCatalog()

      // Close modal gracefully after success toast displays
      setTimeout(() => {
        setIsOpen(false)
        setSuccessMsg(null)
      }, 950)

    } catch (err) {
      console.error(err)
      setErrorMsg(err.response?.data?.message || "Failed to save catalog food item.")
    } finally {
      setIsLoading(false)
    }
  }

  // Dynamic image resolution helper
  const getImageUrl = (imagePath) => {
    if (!imagePath) return ""
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      return imagePath
    }
    const base = config.apiBaseUrl.replace(/\/api\/v1\/?$/, "")
    return `${base}${imagePath}`
  }

  // Filter items dynamically based on category fields
  const breakfastItems = catalogItems.filter((item) => item.category === "BREAKFAST")
  const lunchItems = catalogItems.filter((item) => item.category === "LUNCH")
  const snackItems = catalogItems.filter((item) => item.category === "SNACK")

  const renderCreateCard = (category) => (
    <motion.div
      variants={cardItemVariants}
      whileHover={{ scale: 1.018 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => triggerCreate(category)}
      className="flex flex-col items-center justify-center min-h-[350px] rounded-2xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 bg-card hover:bg-primary/[0.01] cursor-pointer group p-6 text-center select-none shadow-sm hover:shadow-md"
    >
      <div className="h-12 w-12 rounded-full border border-dashed border-muted-foreground/35 group-hover:border-primary/40 flex items-center justify-center mb-3.5 bg-muted/20 group-hover:bg-primary/5 transition-all">
        <Plus className="h-5 w-5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
      </div>
      <h3 className="text-sm font-extrabold text-foreground/80 group-hover:text-primary transition-colors font-mono uppercase tracking-wider">
        Create New
      </h3>
      <p className="text-[10px] font-medium text-muted-foreground mt-1 text-center max-w-[150px]">
        Add food item to dynamic {category.toLowerCase()} menu
      </p>
    </motion.div>
  )

  const renderItemCard = (item) => (
    <motion.div
      key={item._id}
      variants={cardItemVariants}
      whileHover={{ y: -8, scale: 1.02, boxShadow: "0 16px 24px rgba(0,0,0,0.08)" }}
      whileTap={{ scale: 0.99 }}
      className="flex flex-col min-h-[350px] rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:border-primary/30 transition-colors duration-300 group relative"
    >
      {/* Absolute action overlays in the top right corner - black background & visible on hover */}
      {role === "SUPER_ADMIN" && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 scale-90 group-hover:scale-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              triggerEdit(item)
            }}
            className="h-8 w-8 rounded-lg bg-slate-950/85 hover:bg-slate-900 text-white flex items-center justify-center shadow-md hover:text-primary transition-all cursor-pointer focus:outline-none"
            title="Edit Catalog Item"
          >
            <Pencil className="h-3.5 w-3.5 stroke-[2]" />
          </button>
          <button
            type="button"
            onClick={(e) => handleDeleteItem(e, item)}
            className="h-8 w-8 rounded-lg bg-slate-950/85 hover:bg-red-650 hover:bg-red-600 text-white flex items-center justify-center shadow-md hover:text-red-400 transition-all cursor-pointer focus:outline-none"
            title="Delete Catalog Item"
          >
            <Trash2 className="h-3.5 w-3.5 stroke-[2]" />
          </button>
        </div>
      )}

      {/* Card Cover & Title Overlay - image fills container completely */}
      <div className="relative h-48 w-full overflow-hidden flex items-center justify-center select-none">
        {item.image_path ? (
          <img
            src={getImageUrl(item.image_path)}
            alt={item.item_name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop"
            }}
          />
        ) : (
          <div className="h-full w-full bg-muted/30 flex items-center justify-center">
            <Utensils className="h-10 w-10 text-muted-foreground/30 stroke-[1.5]" />
          </div>
        )}
        
        {/* Title overlay background vail for absolute readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />
        
        <div className="absolute bottom-2 left-0 right-0 px-4 space-y-1">
          <h3 className="text-xs font-extrabold text-white tracking-wide uppercase font-mono truncate" title={item.item_name}>
            {item.item_name}
          </h3>
        </div>
      </div>

      {/* Card Content Footer Section - padded slightly lower for clean spacing */}
      <div className="p-4 pt-5 bg-card rounded-b-2xl border-t border-border/40 flex-1 flex flex-col justify-between space-y-3.5">
        <p className="text-xs text-muted-foreground/90 line-clamp-3 leading-relaxed font-medium">
          {item.item_description || "No description provided for this global catalog item."}
        </p>

        {/* Full-width centered emerald green price banner with white text */}
        <div className="pt-3.5 border-t border-border/45 w-full">
          <motion.div 
            whileHover={{ scale: 1.04 }}
            className="w-full text-center py-2.5 px-4 rounded-xl bg-emerald-600 dark:bg-emerald-600 text-white font-mono font-extrabold text-sm shadow-sm tracking-wide transition-colors hover:bg-emerald-500 duration-200 cursor-pointer"
          >
            ₹{(item.default_price_paise / 100).toFixed(2)}
          </motion.div>
        </div>
      </div>
    </motion.div>
  )

  const renderEmptyState = () => (
    <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-muted/10 rounded-2xl border border-dashed border-border p-8 animate-in fade-in duration-200">
      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
        <Utensils className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <h3 className="text-sm font-bold text-foreground/80 font-mono uppercase tracking-wider">No Catalog Items</h3>
      <p className="text-xs text-muted-foreground max-w-[280px] mt-1 select-none font-medium">
        There are currently no master catalog items assigned to this dynamic category.
      </p>
    </div>
  )

  const renderSectionGrid = (title, items, categoryKey, bulletColorClass) => (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-3 border-b border-border/40 pb-2.5">
        <span className={`h-2.5 w-2.5 rounded-full ${bulletColorClass} animate-pulse`} />
        <h2 className="text-base font-extrabold text-foreground tracking-wider font-mono uppercase">
          {title}
        </h2>
      </div>
      
      {/* Grid Container with Dotted Borders to isolate segments beautifully */}
      <div className="rounded-2xl border-2 border-dotted border-border/80 bg-muted/10 p-5 shadow-sm">
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
          variants={gridContainerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
        >
          {role === "SUPER_ADMIN" && renderCreateCard(categoryKey)}
          {items.map(renderItemCard)}
          {items.length === 0 && role !== "SUPER_ADMIN" && renderEmptyState()}
        </motion.div>
      </div>
    </div>
  )

  if (isFetchLoading) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground font-mono">
          Loading catalog metadata...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-12 pb-16">
      {/* Enriched Custom CSS Scrollbar Injection to match premium aesthetics */}
      <style>{`
        .custom-popup-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-popup-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-popup-scroll::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 9999px;
          transition: background-color 0.2s ease-in-out;
        }
        .custom-popup-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
        }
      `}</style>

      {/* Header Info */}
      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground font-sans">
          Food Items Catalog
        </h1>
      </div>

      {/* Grid Sections */}
      <div className="space-y-16">
        {renderSectionGrid("Breakfast", breakfastItems, "BREAKFAST", "bg-amber-500")}
        {renderSectionGrid("Lunch", lunchItems, "LUNCH", "bg-blue-500")}
        {renderSectionGrid("Evening Snacks", snackItems, "SNACK", "bg-violet-500")}
      </div>

      {/* Create / Edit Dialog Form Popup */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[85vh] flex flex-col p-6 overflow-hidden">
          {/* Pinned Header */}
          <DialogHeader className="shrink-0 mb-4">
            <DialogTitle className="font-mono text-base font-extrabold uppercase tracking-wider">
              {isEditMode ? "Edit Catalog Item" : "Create Food Catalog Item"}
            </DialogTitle>
          </DialogHeader>

          {/* Pinned Inline Banners for Status Logs */}
          <div className="space-y-3.5 my-1 shrink-0">
            {errorMsg && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive animate-in fade-in slide-in-from-top-2 duration-200">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="font-medium">
                  <span className="font-bold">Error:</span> {errorMsg}
                </div>
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-700 animate-in fade-in slide-in-from-top-2 duration-200">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="font-medium">
                  <span className="font-bold">Success:</span> {successMsg}
                </div>
              </div>
            )}
          </div>

          {/* Form container using flex vertical layout with pinned submit buttons */}
          <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col min-h-0 w-full">
            
            {/* Scrollable Middle Container with ultra-sleek, theme-aligned custom scrollbar */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 space-y-5 py-1 max-h-[48vh] min-h-0 custom-popup-scroll">
              
              {/* Live Interactive Preview Box at the top */}
              <div className="relative h-32 w-full rounded-2xl bg-muted/40 border border-border overflow-hidden flex items-center justify-center select-none shadow-inner p-2 shrink-0">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="preview"
                    className="h-full w-full object-contain animate-in fade-in duration-200"
                    onError={() => setPreviewUrl("")}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground/60">
                    <Utensils className="h-8 w-8 stroke-[1.5]" />
                    <span className="text-[9px] font-extrabold uppercase font-mono tracking-wider">Image Preview Box</span>
                  </div>
                )}
              </div>

              {/* Toggle 1: Upload File Field */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    id="checkbox-upload"
                    checked={imageSource === "UPLOAD"}
                    onChange={() => handleToggleSource("UPLOAD")}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                  />
                  <label
                    htmlFor="checkbox-upload"
                    className="text-xs font-extrabold text-foreground cursor-pointer font-mono uppercase tracking-wider"
                  >
                    Upload Local Image File
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    disabled={imageSource !== "UPLOAD"}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setImageFile(e.target.files[0])
                      }
                    }}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    disabled={imageSource !== "UPLOAD"}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-10 text-xs font-mono uppercase tracking-wider rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 cursor-pointer disabled:opacity-50 select-none px-4 w-full"
                  >
                    {isEditMode && !imageFile ? "Keep Existing / Choose New File" : imageFile ? "Image Selected" : "Upload Image"}
                  </Button>
                </div>
              </div>

              {/* Toggle 2: Direct Image URL Field */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    id="checkbox-url"
                    checked={imageSource === "URL"}
                    onChange={() => handleToggleSource("URL")}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                  />
                  <label
                    htmlFor="checkbox-url"
                    className="text-xs font-extrabold text-foreground cursor-pointer font-mono uppercase tracking-wider"
                  >
                    Provide Direct Image URL
                  </label>
                </div>
                <Input
                  type="text"
                  placeholder="https://example.com/optimized_food.jpg"
                  disabled={imageSource !== "URL"}
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="h-10 text-xs bg-background border-border rounded-lg text-foreground placeholder:text-muted-foreground disabled:opacity-50 transition-opacity font-mono"
                />
              </div>

              {/* Side by side: Name and Price Inputs */}
              <div className="grid grid-cols-3 gap-4 pt-1">
                <div className="col-span-2">
                  <Input
                    type="text"
                    required
                    placeholder="Name of item"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="h-10 text-xs bg-background border-border rounded-lg text-foreground placeholder:text-muted-foreground font-semibold"
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Price (₹)"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="h-10 text-xs bg-background border-border rounded-lg text-foreground placeholder:text-muted-foreground font-mono font-semibold"
                  />
                </div>
              </div>

              {/* Description Textarea */}
              <div className="pt-1">
                <textarea
                  required
                  placeholder="Brief description about the dish..."
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full min-h-[96px] p-3 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all leading-relaxed font-medium"
                />
              </div>

            </div>

            {/* Pinned Action buttons (Always visible at the bottom of the DialogContent!) */}
            <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-border/40 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="h-10 text-xs font-mono uppercase tracking-wider rounded-lg border-border hover:bg-muted text-foreground cursor-pointer flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="h-10 text-xs font-mono uppercase tracking-wider rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-none min-w-[120px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Item</span>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
