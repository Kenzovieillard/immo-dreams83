"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CommuneCentre } from "@/lib/property-communes";
import styles from "./property-layout.module.css";

export type CommuneMarker = CommuneCentre & { count: number };

function highlight(
  map: LeafletMap | null,
  markers: Map<string, Marker>,
  selectedCode: string | null,
) {
  for (const [code, marker] of markers) {
    const selected = code === selectedCode;
    const icon = marker.getElement();
    icon?.setAttribute("aria-pressed", String(selected));
    icon?.classList.toggle(styles.communeMarkerSelected, selected);
    marker.setZIndexOffset(selected ? 1000 : 0);
    if (selected) {
      map?.panTo(marker.getLatLng());
      marker.openTooltip();
    } else marker.closeTooltip();
  }
}

export function PropertyMap({
  locations,
  selectedCode,
  onSelect,
}: {
  locations: CommuneMarker[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap>(null);
  const markers = useRef(new Map<string, Marker>());
  const selectedRef = useRef<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element || !locations.length) return;
    let cancelled = false;
    const currentMarkers = markers.current;
    void import("leaflet")
      .then((leaflet) => {
        if (cancelled) return;
        const map = leaflet.map(element, {
          scrollWheelZoom: false,
          maxZoom: 18,
          zoomControl: false,
        });
        mapRef.current = map;
        leaflet.control
          .zoom({
            zoomInTitle: "Agrandir la carte",
            zoomOutTitle: "Réduire la carte",
          })
          .addTo(map);
        const tiles = leaflet
          .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          })
          .addTo(map);
        tiles.on("tileerror", () => setError(true));
        tiles.on("load", () => {
          if (element.querySelector(".leaflet-tile-loaded")) setError(false);
        });

        map.fitBounds(
          locations.map(({ latitude, longitude }) => [latitude, longitude]),
          {
            padding: [32, 32],
            maxZoom: 12,
          },
        );
        for (const { code, name, count, latitude, longitude } of locations) {
          const title = `${name} · ${count} ${count === 1 ? "bien" : "biens"}`;
          const label = document.createElement("span");
          label.textContent = title;
          const marker = leaflet
            .marker([latitude, longitude], {
              title,
              icon: leaflet.divIcon({
                className: styles.communeMarker,
                html: String(count),
                iconSize: [38, 38],
                iconAnchor: [19, 19],
              }),
            })
            .addTo(map)
            .bindTooltip(label, { direction: "top", offset: [0, -18] });
          marker.on("click", () => onSelect(code));
          const icon = marker.getElement();
          icon?.setAttribute("aria-label", title);
          icon?.addEventListener("keydown", (event) => {
            if (event.key === " ") {
              event.preventDefault();
              onSelect(code);
            }
          });
          currentMarkers.set(code, marker);
        }
        highlight(map, currentMarkers, selectedRef.current);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      currentMarkers.clear();
    };
  }, [locations, onSelect]);

  useEffect(() => {
    selectedRef.current = selectedCode;
    highlight(mapRef.current, markers.current, selectedCode);
  }, [selectedCode]);

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-[#dfddd4] bg-[#eeeae3]">
      <div
        ref={container}
        aria-label="Carte des biens par commune"
        className="relative z-0"
        style={{ height: "26rem", width: "100%" }}
      />
      {error ? (
        <p role="status" className="p-3 text-sm">
          Le fond de carte est indisponible. La liste des communes reste
          accessible.
        </p>
      ) : null}
    </div>
  );
}
