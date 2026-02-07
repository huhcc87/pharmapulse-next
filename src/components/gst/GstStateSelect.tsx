"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { GST_STATE_CODES } from "@/lib/gstStateCodes";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type Props = {
  value?: string;                  // "27"
  onChange: (code: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function GstStateSelect({
  value,
  onChange,
  disabled,
  placeholder = "Select state code…",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = React.useMemo(
    () => GST_STATE_CODES.find((x) => x.code === value),
    [value]
  );

  const filtered = React.useMemo(() => {
    if (!search) return GST_STATE_CODES;
    const lower = search.toLowerCase();
    return GST_STATE_CODES.filter(
      (s) =>
        s.code.toLowerCase().includes(lower) ||
        s.name.toLowerCase().includes(lower)
    );
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selected ? `${selected.code} — ${selected.name}` : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder="Search by code or state…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <CommandList>
            {filtered.length === 0 ? (
              <CommandEmpty>No state found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((s) => (
                  <CommandItem
                    key={s.code}
                    onSelect={() => {
                      onChange(s.code);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === s.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {s.code} — {s.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
