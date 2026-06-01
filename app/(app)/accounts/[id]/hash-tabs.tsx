"use client";

import { useEffect, useState } from "react";

import { Tabs } from "@/components/ui/tabs";

// Server-rendered account page can't own tab state, but we want the Alignment
// panel's "N gaps · M opportunities" links to deep-link into the right tab.
// This thin wrapper makes the Radix tabs respond to the URL hash (#gaps,
// #opportunities, …) so a plain <a href="#gaps"> switches tabs, and the active
// tab stays shareable/bookmarkable.
export function HashTabs({
  defaultValue,
  validValues,
  className,
  children,
}: {
  defaultValue: string;
  validValues: readonly string[];
  className?: string;
  children: React.ReactNode;
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash && validValues.includes(hash)) {
        setValue(hash);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [validValues]);

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        setValue(next);
        // Keep the URL in sync without scrolling or pushing history noise.
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `#${next}`);
        }
      }}
      className={className}
    >
      {children}
    </Tabs>
  );
}
