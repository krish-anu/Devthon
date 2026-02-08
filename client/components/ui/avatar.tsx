"use client";

import React from "react";

export function Avatar({
  src,
  alt,
  className = "h-10 w-10",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const initials = (alt ?? "").split(" ").map((s) => s[0]).join("").slice(0, 2);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={`${className} rounded-full object-cover p-1 border-1 border-[color:var(--brand)] dark:border-[color:var(--brand)]`}
      />
    );
  }

  return (
    <div
      className={`${className} rounded-full bg-(--surface-strong) flex items-center justify-center text-sm font-medium text-(--muted)`}
      aria-hidden
    >
      {initials || "U"}
    </div>
  );
}

export default Avatar;
