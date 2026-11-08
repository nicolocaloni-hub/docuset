import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toBlob: () => Promise<Blob | null>;
}

/** Area per firmare con dito, penna o mouse. Esporta un PNG con sfondo trasparente. */
const SignaturePad = forwardRef<SignaturePadHandle, { label: string; onChange?: (hasInk: boolean) => void }>(({ label, onChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  // Dimensiona il canvas sui pixel reali dello schermo, così il tratto resta nitido.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#1F2A44';
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) { setHasInk(true); onChange?.(true); }
  };

  const end = () => { drawing.current = false; last.current = null; };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange?.(false);
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => !hasInk,
    toBlob: () => new Promise(resolve => canvasRef.current ? canvasRef.current.toBlob(resolve, 'image/png') : resolve(null)),
  }), [hasInk]);

  return (
    <div>
      <div className="relative rounded-[3px] border border-line bg-card">
        <canvas
          ref={canvasRef}
          aria-label={label}
          role="img"
          className="block h-44 w-full touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-line pb-1 text-center text-xs text-ink-soft">
            Firma qui con il dito
          </span>
        )}
      </div>
      <button type="button" onClick={clear} disabled={!hasInk}
        className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm text-ink-soft hover:text-ink disabled:opacity-40">
        <Eraser className="h-4 w-4" /> Cancella e rifai
      </button>
    </div>
  );
});

SignaturePad.displayName = 'SignaturePad';
export default SignaturePad;
