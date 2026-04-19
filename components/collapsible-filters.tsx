"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface CollapsibleFiltersProps {
  children: React.ReactNode
  label?: string
}

export function CollapsibleFilters({
  children,
  label = "Filtros",
}: CollapsibleFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="w-full flex items-center justify-between h-12 text-base font-medium"
        >
          <span>{label}</span>
          <ChevronDown
            className={`h-5 w-5 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-up data-[state=open]:slide-down transition-all duration-200">
        <div className="pt-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
