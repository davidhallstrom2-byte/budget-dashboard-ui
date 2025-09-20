// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\components\receipts\CameraCapture.jsx
import React, { useEffect, useRef, useState } from "react";

export default function CameraCapture({ onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState("environment"); // or "user"
  const [ready, setReady] = useState(false);

  const modal = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    zIndex: 70,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  };
  const panel = {
    width: "min(980px, 96vw)",
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    maxHeight: "92vh",
    overflow: "hidden",
  };
  const hdr = {
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  };
  const content = {
    padding: 12,
    display: "grid",
    gridTemplateColumns: "1fr",
    alignItems: "center",
    justifyItems: "center",
  };
  const btn = {
    fontSize: 13,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
  };

  async function startStream(mode) {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch (e) {
      console.error("Camera error:", e);
      alert("Could not access camera.");
      onClose?.();
    }
  }

  function stopStream() {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setReady(false);
  }

  useEffect(() => {
    startStream(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const handleCapture = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    // Preserve aspect ratio; use actual video size for clarity
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0, w, h);
    if (typeof onCapture === "function") onCapture(canvas);
  };

  return (
    <div style={modal} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={hdr}>
          <div style={{ fontWeight: 700 }}>Camera Capture</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={btn}
              onClick={() => setFacingMode((m) => (m === "environment" ? "user" : "environment"))}
              title="Switch front/back camera"
            >
              Flip Camera
            </button>
            <button style={btn} onClick={onClose}>Close</button>
          </div>
        </div>

        <div style={content}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              maxWidth: 840,
              background: "#000",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
            }}
          />
          {!ready && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
              Initializing camera…
            </div>
          )}
        </div>

        <div
          style={{
            padding: 12,
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <button
            style={{ ...btn, borderColor: "#16a34a", background: "#16a34a", color: "#fff" }}
            onClick={handleCapture}
            disabled={!ready}
            title="Capture a photo and send to OCR"
          >
            Capture
          </button>
        </div>
      </div>
    </div>
  );
}
