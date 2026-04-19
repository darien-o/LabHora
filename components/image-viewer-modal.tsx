"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface ImageViewerModalProps {
  images: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  initialIndex?: number
}

export function ImageViewerModal({
  images,
  open,
  onOpenChange,
  initialIndex = 0,
}: ImageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  // Reset index when modal opens or initialIndex changes
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex)
    }
  }, [open, initialIndex])

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }, [images.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }, [images.length])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToPrevious()
      } else if (e.key === "ArrowRight") {
        goToNext()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, goToPrevious, goToNext])

  if (images.length === 0) return null

  const safeIndex = Math.min(currentIndex, images.length - 1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-center">
            {images.length > 1
              ? `Imagen ${safeIndex + 1} de ${images.length}`
              : "Imagen"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Visor de imágenes adjuntas
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex items-center justify-center min-h-[300px]">
          {/* Previous button */}
          {images.length > 1 && (
            <Button
              variant="outline"
              size="icon"
              className="absolute left-1 z-10 h-10 w-10 rounded-full bg-white/80 hover:bg-white shadow-md"
              onClick={goToPrevious}
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}

          {/* Image */}
          <div className="flex items-center justify-center w-full px-12">
            <img
              src={images[safeIndex]}
              alt={`Imagen ${safeIndex + 1} de ${images.length}`}
              className="max-h-[60vh] max-w-full object-contain rounded-lg"
            />
          </div>

          {/* Next button */}
          {images.length > 1 && (
            <Button
              variant="outline"
              size="icon"
              className="absolute right-1 z-10 h-10 w-10 rounded-full bg-white/80 hover:bg-white shadow-md"
              onClick={goToNext}
              aria-label="Imagen siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Dot indicators for multiple images */}
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  idx === safeIndex
                    ? "bg-primary"
                    : "bg-gray-300 hover:bg-gray-400"
                }`}
                aria-label={`Ir a imagen ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
