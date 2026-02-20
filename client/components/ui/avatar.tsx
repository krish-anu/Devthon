"use client";

import React, { useState } from "react";

export function Avatar({
  src,
  alt,
  className = "h-10 w-10",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (alt ?? "").split(" ").map((s) => s[0]).join("").slice(0, 2);

  // If a src is provided but fails to load, fall back to initials placeholder
  if (src && !failed) {
    return (
      <div
        className={`${className} rounded-full p-1 border border-(--brand) dark:border-(--brand) bg-(--card) overflow-hidden`}
        aria-hidden={false}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className="w-full h-full rounded-full object-cover object-center"
        />
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-full bg-(--brand)/20 flex items-center justify-center text-xl font-semibold text-white border border-(--brand) p-1`}
      aria-hidden
    >
      {initials || "U"}
    </div>
  );
}

export default Avatar;
