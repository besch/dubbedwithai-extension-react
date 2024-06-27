"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Movie } from "../types"; // Import the Movie type from your types file

interface SearchMovieProps {
  movies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onSearch: (query: string) => void;
  query: string;
}

export default function SearchMovie({
  movies,
  onSelectMovie,
  onSearch,
  query,
}: SearchMovieProps) {
  const [open, setOpen] = React.useState(false);

  const handleInputChange = (newValue: string) => {
    onSearch(newValue);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {query || "Search for a movie..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput
            placeholder="Search for a movie..."
            value={query}
            onValueChange={handleInputChange}
          />
          <CommandEmpty>No movies found.</CommandEmpty>
          <CommandGroup>
            {movies.map((movie) => (
              <CommandItem
                key={movie.imdbID}
                value={movie.imdbID}
                onSelect={() => {
                  onSelectMovie(movie);
                  onSearch(movie.Title);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    query === movie.Title ? "opacity-100" : "opacity-0"
                  )}
                />
                {movie.Title}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
