import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useDispatch } from "react-redux"
import { useNavigate } from "react-router-dom"
import { ShieldCheck, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import api from "../services/api"
import { setCredentials } from "../store/authSlice"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form"

// Define input validation schema
const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, { message: "Email or mobile number is required." })
    .refine(
      (val) => {
        // If it includes '@', it must be a valid email format
        if (val.includes("@")) {
          return z.string().email().safeParse(val).success
        }
        // Otherwise, it must be a numeric mobile number
        return /^[0-9+() -]{7,15}$/.test(val)
      },
      { message: "Please enter a valid email address or mobile number." }
    ),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters." }),
})

export function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  })

  const onSubmit = async (data) => {
    setIsLoading(true)
    setErrorMsg(null)

    try {
      // Connects modularly using the api client (connected to the port configured in .env)
      const response = await api.post("/auth/login", {
        identifier: data.identifier.trim(),
        password: data.password,
      })

      const payload = {
        token: response.data.token,
        role: response.data.user.role,
        tenant_id: response.data.user.tenant_id,
      }

      // Dispatch to Redux store
      dispatch(setCredentials(payload))

      // Navigate to the protected B2B dashboard
      navigate("/dashboard", { replace: true })
    } catch (err) {
      console.error("Authentication failed:", err)
      const message =
        err.response?.data?.message ||
        "Authentication failed. Please verify your credentials and try again."
      setErrorMsg(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <motion.div
        className="w-full max-w-md space-y-6"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 14 }}
      >
        <Card className="border border-border bg-card shadow-xl rounded-2xl">
          <CardHeader className="space-y-1.5 border-b border-border/50 p-6">
            <CardTitle className="text-xl font-bold text-foreground">Sign In</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your administrator email or mobile credentials to gain access
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 pt-5">
            <AnimatePresence mode="wait">
              {errorMsg && (
                <motion.div
                  key="login-error"
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-600 overflow-hidden"
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold">Authentication Failure</span>
                    <span>{errorMsg}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Email or Mobile Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="admin@example.com or 9876543210"
                          className="h-10 border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/50"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-600 font-medium" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="h-10 pr-10 border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/50"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-600 font-medium" />
                    </FormItem>
                  )}
                />

                <motion.div
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                >
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 mt-6 bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-bold shadow-sm cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Authenticating Account...
                      </>
                    ) : (
                      "Access Platform"
                    )}
                  </Button>
                </motion.div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
