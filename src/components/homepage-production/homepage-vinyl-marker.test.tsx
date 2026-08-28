import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { homepageContent } from "./homepage-data-adapter";
import { HomepageVinylMarker } from "./homepage-vinyl-marker";

describe("HomepageVinylMarker", () => {
  it("uses Madvillainy's canonical local cover as a visual label without playback semantics", () => {
    const label = homepageContent.gallery.find((album) => album.slug === "madvillainy")!;
    const { container } = render(<HomepageVinylMarker labelAlbum={label} />);
    expect(container.querySelector(".ad-marker")).toHaveAttribute("data-vinyl-label", "madvillainy");
    expect(container.querySelector(".ad-marker")).toHaveAttribute("data-audio-source", "required");
    expect(container.querySelector(".ad-marker__label img")).toHaveAttribute("src", expect.stringContaining("/catalog/covers/detail/316551.webp"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector("audio")).not.toBeInTheDocument();
  });
});
