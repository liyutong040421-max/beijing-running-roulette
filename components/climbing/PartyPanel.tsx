"use client";

import { useState } from "react";

export type Participant = {
  id: string;
  label: string;
  lng: number;
  lat: number;
  origin?: string;
};

type Props = {
  participants: Participant[];
  poolCount: number;
  totalCount: number;
  onAdd: (p: Participant) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
};

export function PartyPanel({
  participants,
  poolCount,
  totalCount,
  onAdd,
  onRemove,
  onClear,
}: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labelFocus, setLabelFocus] = useState(false);

  const submitAddress = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);

    try {
      // Accept "lng,lat" directly
      const lngLatMatch = value.match(/^(\d{2,3}\.\d+)\s*[,，]\s*(\d{2}\.\d+)$/);
      if (lngLatMatch) {
        const lng = Number(lngLatMatch[1]);
        const lat = Number(lngLatMatch[2]);
        onAdd(makeParticipant({ label: value, lng, lat, origin: "coords" }));
        setText("");
        return;
      }

      // Otherwise geocode
      const res = await fetch(`/api/amap/geocode?address=${encodeURIComponent(value)}`);
      const data = (await res.json()) as
        | { lng: number; lat: number; formatted_address: string }
        | { error: string };
      if ("error" in data) throw new Error(data.error);
      onAdd(
        makeParticipant({
          label: value,
          lng: data.lng,
          lat: data.lat,
          origin: data.formatted_address,
        }),
      );
      setText("");
    } catch (e) {
      setError((e as Error).message || "找不到这个地址");
    } finally {
      setBusy(false);
    }
  };

  const submitGeolocation = () => {
    if (busy) return;
    if (!navigator.geolocation) {
      setError("浏览器不支持定位");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onAdd(
          makeParticipant({
            label: "我",
            lng: pos.coords.longitude,
            lat: pos.coords.latitude,
            origin: "browser-geolocation",
          }),
        );
        setBusy(false);
      },
      (err) => {
        setError(`定位失败: ${err.message}`);
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="border-b border-hairline bg-bg/95 px-5 py-3 lg:px-6">
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          多人模式 · {participants.length}/4
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {participants.length > 0 ? `公平池 ${poolCount}/${totalCount}` : `共 ${totalCount} 馆`}
        </div>
      </div>

      {participants.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {participants.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                title={p.origin ?? `${p.lng.toFixed(4)},${p.lat.toFixed(4)}`}
                className="group inline-flex items-center gap-1.5 border border-hairline bg-bg px-2 py-0.5 text-[11px] text-fg transition-colors hover:border-fg"
              >
                <span className="truncate max-w-[90px]">{p.label}</span>
                <span className="text-muted group-hover:text-accent">×</span>
              </button>
            </li>
          ))}
          {participants.length > 1 ? (
            <li>
              <button
                type="button"
                onClick={onClear}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted underline decoration-hairline decoration-1 underline-offset-4 hover:text-accent hover:decoration-accent"
              >
                清空
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {participants.length < 4 ? (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setLabelFocus(true)}
            onBlur={() => setLabelFocus(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitAddress();
              }
            }}
            placeholder={labelFocus ? "中关村 / 国贸 / 116.45,39.92" : "+ 加位置"}
            disabled={busy}
            className="min-w-0 flex-1 border border-hairline bg-bg px-2 py-1 text-[12px] text-fg placeholder:text-muted/70 focus:border-fg focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submitGeolocation}
            disabled={busy}
            title="使用浏览器定位加我自己"
            className="border border-hairline bg-bg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg transition-colors hover:border-fg disabled:opacity-50"
          >
            我
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-1.5 text-[11px] text-red-700">{error}</div>
      ) : null}
    </div>
  );
}

function makeParticipant({
  label,
  lng,
  lat,
  origin,
}: {
  label: string;
  lng: number;
  lat: number;
  origin?: string;
}): Participant {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    lng,
    lat,
    origin,
  };
}
