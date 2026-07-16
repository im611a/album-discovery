"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AlbumGrid } from "@/components/album-grid";
import type { MockAlbum } from "@/data/albums.mock";
import { searchAlbums } from "@/lib/album-search";

type SearchCatalogProps = {
  albums: MockAlbum[];
};

type SearchFormProps = {
  committedQuery: string;
  onNavigate: (query: string) => void;
};

function SearchForm({ committedQuery, onNavigate }: SearchFormProps) {
  const [inputValue, setInputValue] = useState(committedQuery);
  const hasInput = inputValue.trim().length > 0;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onNavigate(inputValue);
  }

  function clearInput() {
    setInputValue("");
    onNavigate("");
  }

  return (
    <form className="search-form" onSubmit={submitSearch} role="search">
      <label htmlFor="album-search-input">搜索专辑或艺术家</label>
      <div className="search-form__controls">
        <input
          autoComplete="off"
          id="album-search-input"
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="输入专辑名称、别名或艺术家名称"
          type="search"
          value={inputValue}
        />
        <button className="search-submit-button" type="submit">
          搜索
        </button>
        {hasInput ? (
          <button
            className="search-clear-button"
            onClick={clearInput}
            type="button"
          >
            清空关键词
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function SearchCatalog({ albums }: SearchCatalogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();
  const results = useMemo(() => searchAlbums(albums, query), [albums, query]);

  function navigate(rawQuery: string) {
    const nextQuery = rawQuery.trim();

    if (!nextQuery) {
      router.push("/search", { scroll: false });
      return;
    }

    const params = new URLSearchParams();
    params.set("q", nextQuery);
    router.push(`/search?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="search-catalog">
      <section aria-label="专辑搜索" className="search-panel">
        <SearchForm
          committedQuery={query}
          key={query}
          onNavigate={navigate}
        />
      </section>

      {!query ? (
        <div className="search-initial-state" role="status">
          <h2>从一个名字开始搜索</h2>
          <p>可以搜索专辑名称、专辑别名或艺术家名称。</p>
        </div>
      ) : results.length > 0 ? (
        <section
          aria-labelledby="search-results-heading"
          className="search-results"
          id="search-results"
        >
          <div className="search-results__heading">
            <h2 id="search-results-heading">“{query}”的搜索结果</h2>
            <p aria-live="polite">
              <strong>{results.length}</strong> 张专辑
            </p>
          </div>
          <AlbumGrid albums={results.map((result) => result.album)} />
        </section>
      ) : (
        <div className="search-empty-state" role="status">
          <h2>没有找到匹配专辑</h2>
          <p>可以尝试缩短关键词，或改用专辑别名和艺术家名称。</p>
          <button className="secondary-button" onClick={() => navigate("")} type="button">
            清空搜索
          </button>
        </div>
      )}
    </div>
  );
}
