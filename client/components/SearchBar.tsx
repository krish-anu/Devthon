"use client";
import { useState, useEffect } from "react";
import { useDebounce } from "../hooks/useDebounce";

export default function SearchBar() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebounce(input, 500);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setError(null);
      if (debouncedQuery.length < 3) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          "http://localhost:4000/api/search/suggestions",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: debouncedQuery }),
          },
        );

        if (!res.ok) {
          const txt = await res.text();
          console.error("Search API error", res.status, txt);
          setError(`Server error: ${res.status}`);
          setSuggestions([]);
          setLoading(false);
          return;
        }

        const data = await res.json();
        console.debug("Search suggestions response", data);
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      } catch (e) {
        console.error("Fetch suggestions failed", e);
        setError("Network error");
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery]);

  return (
    <div className="relative w-full max-w-md mx-auto mt-4">
      <input
        className="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-black"
        placeholder="Search trash items..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      {loading && (
        <div className="absolute right-3 top-3 text-sm text-(--muted)">
          Loading…
        </div>
      )}

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

      {suggestions.length > 0 && (
        <ul className="absolute w-full mt-2 bg-white border rounded-lg shadow-xl z-50">
          {suggestions.map((item, index) => (
            <li
              key={index}
              className="p-3 hover:bg-gray-100 cursor-pointer text-gray-700 border-b last:border-none"
              onClick={() => setInput(item)}
            >
              ✨ {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
