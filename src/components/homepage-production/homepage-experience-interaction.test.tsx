import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { homepageContent } from "./homepage-data-adapter";
import { buildHomepageExperienceData } from "./homepage-experience-data";
import { HomepageAlbumField } from "./homepage-album-field";
import { getHomepageAmbientPaintColor } from "./homepage-atmosphere-color";

describe("homepage experience interaction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps dark canonical accents album-derived while enforcing a painted luminance floor", () => {
    expect(getHomepageAmbientPaintColor("#403b86")).toBe("rgb(110 107 150)");
    expect(getHomepageAmbientPaintColor("#7c4646")).toBe("rgb(138 102 106)");
    expect(getHomepageAmbientPaintColor("#b27676")).toBe("#b27676");
    expect(getHomepageAmbientPaintColor("not-a-color")).toBe("not-a-color");
  });

  it("routes chromatic selection through the existing selected-album authority", () => {
    const experience = buildHomepageExperienceData();
    const targetId = experience.chromaticAlbumIds.red.find((id) => id !== homepageContent.gallery[0]?.albumId)!;
    const target = experience.albums[targetId];
    const { container } = render(<HomepageAlbumField
      albums={homepageContent.gallery}
      initialAlbumSlug="madvillainy"
      experience={experience}
      stage={<section className="ad-stage">stage</section>}
    ><div>downstream</div></HomepageAlbumField>);
    const ambientField = container.querySelector(".ad-ambient-flow");
    const ambientPalette = container.querySelector(".ad-ambient-flow__palette");
    fireEvent.click(screen.getByRole("button", { name: "红" }));
    fireEvent.click(screen.getByRole("button", { name: `选择《${target.title}》，${target.artists.join("、")}` }));
    expect(container.querySelector(".ad-experience")).toHaveAttribute("data-selected-album", target.slug);
    expect(container.querySelector("[data-vinyl-label]")).toHaveAttribute("data-vinyl-label", target.slug);
    expect(container.querySelector("[data-continuation-source]")).toHaveAttribute("data-continuation-source", target.slug);
    expect(container.querySelector(".ad-ambient-flow")).toHaveAttribute("data-flow-accent", target.accentColor);
    expect(container.querySelector(".ad-ambient-flow")).toBe(ambientField);
    expect(container.querySelector(".ad-ambient-flow__palette")).toBe(ambientPalette);
    expect(container.querySelectorAll(".ad-ambient-flow")).toHaveLength(1);
    expect(container.querySelector(".ad-ambient-flow")).toHaveAttribute("aria-hidden", "true");
  });

  it("retargets rapid album selections to the latest canonical palette without adding layers", () => {
    const experience = buildHomepageExperienceData();
    const targets = homepageContent.gallery.slice(1, 5);
    const { container } = render(<HomepageAlbumField
      albums={homepageContent.gallery}
      initialAlbumSlug="madvillainy"
      experience={experience}
      stage={<section className="ad-stage">stage</section>}
    ><div>downstream</div></HomepageAlbumField>);
    const ambientField = container.querySelector(".ad-ambient-flow");
    const ambientPalette = container.querySelector(".ad-ambient-flow__palette");

    targets.forEach((album) => {
      fireEvent.click(screen.getByRole("button", { name: `选择《${album.title}》作为黑胶标签` }));
    });

    const latest = targets.at(-1)!;
    const latestExperience = experience.albums[latest.albumId];
    expect(container.querySelector(".ad-experience")).toHaveAttribute("data-selected-album", latest.slug);
    expect(ambientField).toHaveAttribute("data-flow-album-id", latest.albumId);
    expect(ambientField).toHaveAttribute("data-flow-accent", latestExperience.accentColor);
    expect(container.querySelector(".ad-ambient-flow")).toBe(ambientField);
    expect(container.querySelector(".ad-ambient-flow__palette")).toBe(ambientPalette);
    expect(container.querySelectorAll(".ad-ambient-flow__palette")).toHaveLength(1);
  });

  it("opens the relationship view and replaces its center through canonical relation options", () => {
    const experience = buildHomepageExperienceData();
    const { container } = render(<HomepageAlbumField
      albums={homepageContent.gallery}
      initialAlbumSlug="madvillainy"
      experience={experience}
      stage={<section className="ad-stage">stage</section>}
    ><div>downstream</div></HomepageAlbumField>);
    fireEvent.click(screen.getByRole("button", { name: "关系视图 ↗" }));
    const initial = container.querySelector("[data-relationship-center]")?.getAttribute("data-relationship-center");
    const firstRelatedButton = container.querySelector<HTMLButtonElement>(".ad-relationship li button");
    expect(firstRelatedButton).not.toBeNull();
    fireEvent.click(firstRelatedButton!);
    expect(container.querySelector("[data-relationship-center]")?.getAttribute("data-relationship-center")).not.toBe(initial);
    expect(container.querySelector(".ad-relationship h3")).toHaveFocus();
  });

  it("keeps chromatic selection in place while updating the canonical consumers", () => {
    const experience = buildHomepageExperienceData();
    const targetId = experience.chromaticAlbumIds.red.find((id) => id !== homepageContent.gallery[0]?.albumId)!;
    const target = experience.albums[targetId];
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const { container } = render(<HomepageAlbumField
      albums={homepageContent.gallery}
      initialAlbumSlug="madvillainy"
      experience={experience}
      stage={<section className="ad-stage">stage</section>}
    ><div>downstream</div></HomepageAlbumField>);

    fireEvent.click(screen.getByRole("button", { name: "红" }));
    const targetButton = screen.getByRole("button", { name: `选择《${target.title}》，${target.artists.join("、")}` });
    targetButton.focus();
    expect(targetButton).toHaveFocus();
    fireEvent.click(targetButton);

    expect(targetButton).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector(".ad-experience")).toHaveAttribute("data-selected-album", target.slug);
    expect(container.querySelector("[data-vinyl-label]")).toHaveAttribute("data-vinyl-label", target.slug);
    expect(container.querySelector("[data-continuation-source]")).toHaveAttribute("data-continuation-source", target.slug);
    expect(container.querySelector(".ad-ambient-flow")).toHaveAttribute("data-flow-accent", target.accentColor);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
