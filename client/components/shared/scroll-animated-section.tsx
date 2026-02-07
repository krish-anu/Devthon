"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrollAnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function ScrollAnimatedSection({ 
  children, 
  className,
  delay = 0 
}: ScrollAnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 0.1, // Trigger when 10% visible
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-out transform",
        isVisible 
          ? "opacity-100 translate-y-0" 
          : "opacity-0 translate-y-25",
        className
      )}
    >
      {children}
    </div>
  );
}
