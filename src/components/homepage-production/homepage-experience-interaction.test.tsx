import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { homepageContent } from "./homepage-data-adapter";
import { buildHomepageExperienceData } from "./homepage-experience-data";
import { HomepageAlbumField } from "./homepage-album-field";

describe("homepage experience interaction", () => {
  it("routes chromatic selection through the existing selected-album authority", () => {
    const experience = buildHomepageExperienceData();
    const targetId = experience.chromaticAlbumIds.red.find((id) => id !== homepageContent.gallery[0]?.albumId)!;
    const target = experience.albums[targetId];
    const { container } = render(<HomepageAlbumField
      albums={homepageContent.gallery}
      initialAlbumSlug="madvillainy"
      experience={experience}
    ><div>downstream</div></HomepageAlbumField>);
    fireEvent.click(screen.getByRole("button", { name: "红" }));
    fireEvent.click(screen.getByRole("button", { name: `选择《${target.title}》，${target.artists.join("、")}` }));
    expect(container.querySelector(".ad-experience")).toHaveAttribute("data-selected-album", target.slug);
    expect(container.querySelector("[data-vinyl-label]")).toHaveAttribute("data-vinyl-label", target.slug);
    expect(container.querySelector("[data-continuation-source]")).toHaveAttribute("data-continuation-source", target.slug);
  });

  it("opens the relationship view and replaces its center through canonical relation options", () => {
    const experience = buildHomepageExperienceData();
    const { container } = render(<HomepageAlbumField
      albums={homepageContent.gallery}
      initialAlbumSlug="madvillainy"
      experience={experience}
    ><div>downstream</div></HomepageAlbumField>);
    fireEvent.click(screen.getByRole("button", { name: "关系视图 ↗" }));
    const initial = container.querySelector("[data-relationship-center]")?.getAttribute("data-relationship-center");
    const firstRelatedButton = container.querySelector<HTMLButtonElement>(".ad-relationship li button");
    expect(firstRelatedButton).not.toBeNull();
    fireEvent.click(firstRelatedButton!);
    expect(container.querySelector("[data-relationship-center]")?.getAttribute("data-relationship-center")).not.toBe(initial);
    expect(container.querySelector(".ad-relationship h3")).toHaveFocus();
  });
});
