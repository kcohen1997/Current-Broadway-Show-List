"use client";

import { useState, useEffect, useMemo } from "react";
import ShowControls from "./components/ShowControls";
import ShowCard from "./components/ShowCard";

export default function ShowList({ shows }) {
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("a-z");
  const [showPreviewsOnly, setShowPreviewsOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [theme, setTheme] = useState("light");
  const now = useState(new Date());

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = (e) => setTheme(e.matches ? "dark" : "light");
    setTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", handleThemeChange);
    return () => media.removeEventListener("change", handleThemeChange);
  }, []);

  // ----------------- Date Parsing -----------------

  // Convert into Date object
  const parseDate = (dateStr) => {
    if (!dateStr || dateStr === "N/A" || dateStr === "Open-ended") return null;

    let match = dateStr.match(/\d{4}-\d{2}-\d{2}/);
    if (match) return new Date(match[0]);

    match = dateStr.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/
    );
    if (match) {
      const months = [
        "January","February","March","April","May","June","July","August",
        "September","October","November","December"
      ];
      const monthIndex = months.indexOf(match[1]);
      return new Date(parseInt(match[2]), monthIndex >= 0 ? monthIndex : 0, 1);
    }

    match = dateStr.match(/\d{4}/);
    if (match) return new Date(parseInt(match[0]), 0, 1);

    return null;
  };

  // Format how date will look
  const formatDate = (dateStr) => {
    const d = parseDate(dateStr);
    if (!d) return dateStr || "N/A";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  // Check is Date is In Previews
  const isInPreviews = (dateStr) => {
    const d = parseDate(dateStr);
    return d && d > now;
  };

  //  Filtered and Sorted Shows
  const filteredShows = useMemo(() => {
    return shows
      .filter((show) => {
        const type = (show.type || show.category || "").toLowerCase();
        if (filter !== "All") {
          if (filter === "Musical" && !type.includes("musical")) return false;
          if (filter === "Play" && !type.includes("play")) return false;
          if (filter === "Other" && ["musical","play"].some((t) => type.includes(t))) return false;
        }
        if (showPreviewsOnly && !isInPreviews(show.openingdate)) return false;
        if (searchTerm && !show.title.toLowerCase().replace(/\s+/g," ").includes(searchTerm.toLowerCase().trim())) return false;
        return true;
      })
      .sort((a, b) => {
        const dateA = parseDate(a.openingdate) || 8640000000000000;
        const dateB = parseDate(b.openingdate) || 8640000000000000;
        switch(sort){
          case "a-z": return a.title.localeCompare(b.title);
          case "z-a": return b.title.localeCompare(a.title);
          case "opening-earliest": return dateA - dateB;
          case "opening-latest": return dateB - dateA;
          default: return 0;
        }
      });
  }, [shows, filter, sort, showPreviewsOnly, searchTerm, now]);

  const darkMode = theme === "dark";

  return (
    <div className={`flex flex-col min-h-screen font-sans ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gradient-to-b from-yellow-50 to-yellow-100 text-gray-900"}`}>
      
      {/* Header */}
      <header className="flex flex-col items-center p-4 md:flex-row md:justify-between md:px-12">
        <h1 className="text-2xl md:text-4xl font-bold text-center md:text-left">
          Now Playing on Broadway
        </h1>
        <button
          onClick={() => setTheme(darkMode ? "light" : "dark")}
          aria-label="Toggle dark/light mode"
          className={`mt-4 md:mt-0 px-4 py-2 rounded-lg font-semibold cursor-pointer transition-transform duration-200 ${darkMode ? "bg-yellow-300 text-black hover:scale-105" : "bg-red-600 text-white hover:scale-105"}`}
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </header>

      {/* Controls */}
      <ShowControls
        filter={filter} setFilter={setFilter}
        sort={sort} setSort={setSort}
        showPreviewsOnly={showPreviewsOnly} setShowPreviewsOnly={setShowPreviewsOnly}
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        darkMode={darkMode}
      />

      {/* Show Grid */}
      <ul className="grid gap-4 px-4 md:px-12 mb-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 justify-items-center mt-6">
        {filteredShows.length > 0 ? filteredShows.map((show, idx) => (
          <ShowCard key={idx} show={show} isInPreviews={isInPreviews} formatDate={formatDate} />
        )) : (
          <li className="col-span-full text-center text-lg text-gray-700 dark:text-gray-300">
            No shows found
          </li>
        )}
      </ul>
    </div>
  );
}
