"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import PhoneInput from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { isValidSriLankaPhone, normalizeSriLankaPhone } from "@/lib/phone";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { User } from "@/lib/types";
import { toast } from "@/components/ui/use-toast";

const phoneSchema = z.object({
  phone: z.string().refine((v) => isValidSriLankaPhone(v), { message: "Enter a valid Sri Lanka phone number" }),
});

type PhoneFormValues = z.infer<typeof phoneSchema>;

export function PhoneVerificationModal() {
  const { user, updateUser } = useAuth();
  const [open, setOpen] = useState(false);

  const form = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phone: "",
    },
  });

  useEffect(() => {
    if (user && (user.role === "ADMIN" || user.role === "DRIVER")) {
      // Check if phone is empty
      if (!user.phone || user.phone.trim() === "") {
        setOpen(true);
      } else {
        setOpen(false);
      }
    } else {
      setOpen(false);
    }
  }, [user]);

  const onSubmit = async (values: PhoneFormValues) => {
    try {
      const updatedUser = await apiFetch<User>("/me", {
        method: "PATCH",
        body: JSON.stringify({ phone: normalizeSriLankaPhone(values.phone) ?? values.phone }),
      });
      toast({
        title: "Success",
        description: "Phone number updated successfully.",
        variant: "success",
      });
      updateUser(updatedUser);
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update phone number.",
        variant: "error",
      });
    }
  }; 

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        // Prevent closing if phone is missing and required
        if (
          !val &&
          user &&
          (user.role === "ADMIN" || user.role === "DRIVER") &&
          (!user.phone || user.phone.trim() === "")
        ) {
          return;
        }
        setOpen(val);
      }}
    >
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Complete your profile</DialogTitle>
          <DialogDescription>
            You must provide your phone number to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <div className="flex flex-col space-y-1 mb-4 text-sm">
            <p>
              <span className="font-semibold">Name:</span> {user?.fullName}
            </p>
            <p>
              <span className="font-semibold">Email:</span> {user?.email}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <PhoneInput placeholder="+94 77 123 4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full"
            >
              Save & Continue
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
