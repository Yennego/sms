"use client"

// A signature pad on a <canvas>, written without a library.
//
// - Pointer events, so a finger (phone), a pen or a mouse all draw. `touch-action: none` stops the
//   page from scrolling while a finger signs. Coalesced events are used when the browser offers
//   them, so fast strokes stay smooth.
// - Strokes are kept as points (CSS pixels) and redrawn on resize and undo, so the pad can follow
//   the width of the screen and keeps working after a phone rotates.
// - toBlob() draws the strokes again on a transparent canvas at 2x, cropped to the ink plus a
//   small margin (a trimmed PNG); the server trims and scales it again.
//
//   const pad = React.useRef<SignaturePadHandle>(null)
//   <SignaturePad ref={pad} onChange={(n) => setStrokes(n)} />
//   const blob = await pad.current?.toBlob()

import * as React from "react"

import { cn } from "@/lib/utils"

type Point = { x: number; y: number }
type Stroke = Point[]

export interface SignaturePadHandle {
  clear: () => void
  undo: () => void
  isEmpty: () => boolean
  /** A trimmed PNG of the ink on a transparent background, or null when nothing is drawn. */
  toBlob: () => Promise<Blob | null>
}

export interface SignaturePadProps {
  ref?: React.Ref<SignaturePadHandle>
  /** Called with the number of strokes after every change. */
  onChange?: (strokes: number) => void
  /** Height of the drawing area in CSS pixels. Default 200. */
  height?: number
  /** Accessible name of the drawing area. */
  label?: string
  className?: string
}

const INK = "#111827"
const LINE_WIDTH = 2.5
const EXPORT_SCALE = 2
const EXPORT_MARGIN = 8

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], offset: Point = { x: 0, y: 0 }) {
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineWidth = LINE_WIDTH
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  for (const stroke of strokes) {
    if (stroke.length === 0) continue
    const p = (i: number) => ({ x: stroke[i].x - offset.x, y: stroke[i].y - offset.y })
    if (stroke.length === 1) {
      // A tap leaves a dot (the dot of an "i", a full stop).
      const a = p(0)
      ctx.beginPath()
      ctx.arc(a.x, a.y, LINE_WIDTH / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    // Quadratic curves through the midpoints keep the line smooth without a library.
    ctx.beginPath()
    const start = p(0)
    ctx.moveTo(start.x, start.y)
    for (let i = 1; i < stroke.length - 1; i++) {
      const c = p(i)
      const n = p(i + 1)
      ctx.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2)
    }
    const last = p(stroke.length - 1)
    ctx.lineTo(last.x, last.y)
    ctx.stroke()
  }
}

function SignaturePad({ ref, onChange, height = 200, label = "Signature drawing area", className }: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const strokesRef = React.useRef<Stroke[]>([])
  const activeRef = React.useRef<{ pointerId: number; stroke: Stroke } | null>(null)
  const sizeRef = React.useRef({ width: 0, height })
  const onChangeRef = React.useRef(onChange)

  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height)
    drawStrokes(ctx, strokesRef.current)
  }, [])

  // Match the canvas's pixel size to its CSS size (and the screen's pixel ratio).
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      sizeRef.current = { width: rect.width, height: rect.height }
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      redraw()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [redraw])

  const changed = () => onChangeRef.current?.(strokesRef.current.length)

  const pointOf = (e: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    if (activeRef.current) return // a second finger doesn't start another line
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const stroke: Stroke = [pointOf(e)]
    activeRef.current = { pointerId: e.pointerId, stroke }
    strokesRef.current = [...strokesRef.current, stroke]
    redraw()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current
    if (!active || active.pointerId !== e.pointerId) return
    e.preventDefault()
    const native = e.nativeEvent
    const events = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : []
    for (const ev of events.length > 0 ? events : [native]) active.stroke.push(pointOf(ev))
    redraw()
  }

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current
    if (!active || active.pointerId !== e.pointerId) return
    activeRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    changed()
  }

  React.useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        strokesRef.current = []
        activeRef.current = null
        redraw()
        changed()
      },
      undo: () => {
        strokesRef.current = strokesRef.current.slice(0, -1)
        activeRef.current = null
        redraw()
        changed()
      },
      isEmpty: () => strokesRef.current.length === 0,
      toBlob: () => {
        const strokes = strokesRef.current.filter((s) => s.length > 0)
        if (strokes.length === 0) return Promise.resolve(null)
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const s of strokes) {
          for (const pt of s) {
            minX = Math.min(minX, pt.x)
            minY = Math.min(minY, pt.y)
            maxX = Math.max(maxX, pt.x)
            maxY = Math.max(maxY, pt.y)
          }
        }
        const pad = EXPORT_MARGIN + LINE_WIDTH
        const width = maxX - minX + pad * 2
        const height = maxY - minY + pad * 2
        const out = document.createElement("canvas")
        out.width = Math.ceil(width * EXPORT_SCALE)
        out.height = Math.ceil(height * EXPORT_SCALE)
        const ctx = out.getContext("2d")
        if (!ctx) return Promise.resolve(null)
        ctx.scale(EXPORT_SCALE, EXPORT_SCALE)
        drawStrokes(ctx, strokes, { x: minX - pad, y: minY - pad })
        return new Promise<Blob | null>((resolve) => out.toBlob((blob) => resolve(blob), "image/png"))
      },
    }),
    [redraw]
  )

  return (
    <div className={cn("relative rounded-xl border-2 border-dashed bg-white", className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        style={{ height }}
        className="block w-full cursor-crosshair touch-none select-none rounded-xl"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onLostPointerCapture={endStroke}
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* The line people sign on; not part of the exported image. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 border-b border-neutral-300"
        style={{ top: height * 0.72 }}
      />
    </div>
  )
}

export { SignaturePad }
