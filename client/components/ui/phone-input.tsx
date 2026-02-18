"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { normalizeSriLankaPhone, formatSriLankaPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export type PhoneInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  // when used with react-hook-form register, it will receive onChange and onBlur handlers
};

function formatAsUserTypes(digits: string) {
  // digits: local part only (9 digits) or partial
  // We'll show progressive grouping: +94 <first2> <next3> <rest>
  const cleaned = digits.replace(/\D/g, "");
  if (cleaned.length === 0) return "";
  const a = cleaned.slice(0, 2);
  const b = cleaned.slice(2, 5);
  const c = cleaned.slice(5, 9);

  if (cleaned.length <= 2) return `+94 ${a}`.trim();
  if (cleaned.length <= 5) return `+94 ${a} ${b}`.trim();
  return `+94 ${a} ${b} ${c}`.trim();
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, defaultValue, onChange, onBlur, placeholder, name, id, className, ...rest }, ref) => {
    const internalRef = useRef<HTMLInputElement | null>(null);
    useImperativeHandle(ref, () => internalRef.current as HTMLInputElement);

    // Display value is formatted for the user
    const [display, setDisplay] = useState<string>("");

    useEffect(() => {
      // Initialize display from props value, defaultValue or the input's DOM defaultValue (when registered with react-hook-form)
      const initialProp = (value as string) ?? (defaultValue as string) ?? "";
      let initial = initialProp;
      if (!initial && internalRef.current?.defaultValue) {
        initial = internalRef.current.defaultValue;
      }

      // If initial looks like +94 or starts with digits, format progressively
      if (typeof initial === "string") {
        const cleaned = String(initial).replace(/\D/g, "");
        let local = cleaned;
        if (cleaned.startsWith("94")) local = cleaned.slice(2);
        if (cleaned.startsWith("0")) local = cleaned.replace(/^0+/, "");
        local = local.slice(-9);
        const f = local ? formatAsUserTypes(local) : "";
        setDisplay(f || (formatSriLankaPhone(String(initial)) ?? String(initial ?? "")));
      } else {
        setDisplay("");
      }
    }, []);

    useEffect(() => {
      // keep controlled value in sync
      if (typeof value === "string") {
        // If value is partial normalized like +94xxx or full normalized
        const cleaned = String(value).replace(/\D/g, "");
        let local = cleaned;
        if (cleaned.startsWith("94")) local = cleaned.slice(2);
        if (cleaned.startsWith("0")) local = cleaned.replace(/^0+/, "");
        local = local.slice(-9);
        if (local) {
          setDisplay(formatAsUserTypes(local));
        } else {
          const f = formatSriLankaPhone(value) ?? value;
          setDisplay(f);
        }
      }
    }, [value]);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Remove non-digits
      let d = raw.replace(/\D/g, "");

      // If user pasted full +94XXXXXXXXX or 94XXXXXXXXX, drop leading 94
      if (d.startsWith("94")) {
        d = d.slice(2);
      } else if (d.startsWith("0")) {
        // drop leading 0
        d = d.replace(/^0+/, "");
      }

      // Keep up to first 9 digits (local part) — prevent adding beyond 9
      if (d.length > 9) {
        d = d.slice(0, 9);
      }

      const local = d.slice(0, 9);

      // Update display progressively; if no digits, show empty so placeholder is visible
      const newDisplay = local ? formatAsUserTypes(local) : "";
      setDisplay(newDisplay);

      // Emit partial normalized value (+94 + digits) so form value reflects user typing and backspace works
      const partial = local.length > 0 ? `+94${local}` : "";

      if (onChange) {
        const syntheticEvent = { target: { name, value: partial } } as any;
        onChange(syntheticEvent);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow navigation and control keys
      if (
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "Tab" ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return;
      }

      // Only block when typing digits beyond 9
      if (!/^[0-9]$/.test(e.key)) return;

      const el = internalRef.current;
      if (!el) return;
      const val = el.value || "";
      const digits = val.replace(/\D/g, "");
      let local = digits;
      if (digits.startsWith("94")) local = digits.slice(2);
      if (digits.startsWith("0")) local = local.replace(/^0+/, "");

      const selStart = el.selectionStart ?? 0;
      const selEnd = el.selectionEnd ?? 0;
      const selectionHasDigits = val.slice(selStart, selEnd).replace(/\D/g, "").length > 0;

      // If no selection and already 9 local digits, block further numeric input
      if (!selectionHasDigits && local.length >= 9) {
        e.preventDefault();
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const paste = (e.clipboardData.getData("text") || "").replace(/\D/g, "");
      if (!paste) return;
      const el = internalRef.current;
      if (!el) return;
      const val = el.value || "";
      const selStart = el.selectionStart ?? 0;
      const selEnd = el.selectionEnd ?? 0;

      const before = val.slice(0, selStart).replace(/\D/g, "");
      const after = val.slice(selEnd).replace(/\D/g, "");

      let combined = (before + paste + after).slice(0, 9);

      // Update display and emit partial/full value
      const newDisplay = combined ? formatAsUserTypes(combined) : "";
      setDisplay(newDisplay);
      if (onChange) {
        const syntheticEvent = { target: { name, value: combined ? `+94${combined}` : "" } } as any;
        onChange(syntheticEvent);
      }

      // Place caret at end
      requestAnimationFrame(() => {
        const len = (newDisplay || "").length;
        el.setSelectionRange(len, len);
      });
    };


    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // On blur, try to normalize and set display to formatted normalized or keep as is
      const raw = e.target.value;
      const normalizedFull = normalizeSriLankaPhone(raw);
      if (normalizedFull) {
        const formatted = formatSriLankaPhone(normalizedFull) ?? normalizedFull;
        setDisplay(formatted);
        if (onChange) {
          const syntheticEvent = { target: { name, value: normalizedFull } } as any;
          onChange(syntheticEvent);
        }
      } else {
        // Not a full valid number: keep the partial digits in the underlying value so user input isn't lost
        const cleaned = raw.replace(/\D/g, "");
        let local = cleaned;
        if (cleaned.startsWith("94")) local = cleaned.slice(2);
        if (cleaned.startsWith("0")) local = cleaned.replace(/^0+/, "");
        local = local.slice(-9);
        const partial = local ? `+94${local}` : "";
        setDisplay(local ? formatAsUserTypes(local) : "");
        if (onChange) {
          const syntheticEvent = { target: { name, value: partial } } as any;
          onChange(syntheticEvent);
        }
      }
      if (onBlur) onBlur(e);
    };

    return (
      <input
        {...rest}
        ref={internalRef}
        name={name}
        id={id}
        value={display}
        onChange={handleInput}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder ?? "+94 77 123 4567"}
        inputMode="tel"
        className={cn(
          "flex h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
          className,
        )}
        aria-label={rest["aria-label"] ?? "Phone"}
      />
    );
  },
);

PhoneInput.displayName = "PhoneInput";

export default PhoneInput;
