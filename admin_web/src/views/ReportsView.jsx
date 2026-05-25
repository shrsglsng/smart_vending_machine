import React from "react"
import { AlertTriangle } from "lucide-react"
import { motion } from "framer-motion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"

export function ReportsView() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 15 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Hardware & Maintenance Reports
        </h1>
        <p className="text-muted-foreground">
          Audit customer complaints, technician feedback, and dynamic system error telemetry.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold text-muted-foreground">Report ID</TableHead>
              <TableHead className="font-bold text-muted-foreground">Tenant Context</TableHead>
              <TableHead className="font-bold text-muted-foreground">Machine ID</TableHead>
              <TableHead className="font-bold text-muted-foreground">Category</TableHead>
              <TableHead className="font-bold text-muted-foreground">Severity</TableHead>
              <TableHead className="font-bold text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                <motion.div
                  animate={{ scale: [0.97, 1.03, 0.97] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="flex flex-col items-center justify-center gap-3.5 select-none"
                >
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                    <AlertTriangle className="h-5 w-5 animate-pulse" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-foreground font-mono uppercase tracking-wider">No Incidents Reported</p>
                    <p className="text-xs text-muted-foreground/80 font-medium max-w-[280px]">
                      Hardware nodes operational. Audit complaints, technician logs, and dynamic system error telemetry are clean.
                    </p>
                  </div>
                </motion.div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </motion.div>
  )
}
