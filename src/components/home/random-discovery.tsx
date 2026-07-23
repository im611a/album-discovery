"use client";

import { useState } from "react";
import { AlbumCard } from "@/components/album-card";
import { catalogAlbums } from "@/catalog/published-catalog";

export function RandomDiscovery() {
  const [step, setStep] = useState(0);
  const album = catalogAlbums[(73 + step * 97) % catalogAlbums.length]!;
  return <div className="random-discovery"><AlbumCard album={album} headingLevel={3} /><button className="button button--secondary" type="button" onClick={() => setStep((value) => value + 1)}>换一张</button></div>;
}
