"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TableSelectionContextValue = {
  selectedRowId: string | null;
  setSelectedRowId: React.Dispatch<React.SetStateAction<string | null>>;
};

const TableSelectionContext =
  React.createContext<TableSelectionContextValue | null>(null);

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => {
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (wrapper.scrollWidth <= wrapper.clientWidth) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    wrapper.scrollLeft += event.deltaY;
    event.preventDefault();
  };

  return (
    <TableSelectionContext.Provider value={{ selectedRowId, setSelectedRowId }}>
      <div
        ref={wrapperRef}
        className="table-scrollbar w-full max-w-full overflow-x-auto overflow-y-visible rounded-2xl border border-[color:var(--border)]"
        onWheel={handleWheel}
      >
        <table
          ref={ref}
          className={cn("w-full min-w-full table-auto caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    </TableSelectionContext.Provider>
  );
});
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-[color:var(--surface)] text-[color:var(--muted)]",
      className,
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("divide-y divide-[color:var(--border)]", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, children, onClick, ...props }, ref) => {
  const selectionContext = React.useContext(TableSelectionContext);
  const rowId = React.useId();
  const filteredChildren = React.Children.toArray(children).filter(
    (child) => !(typeof child === "string" && /^\s*$/.test(child as string)),
  );
  const isSelected = selectionContext?.selectedRowId === rowId;

  const handleClick: React.MouseEventHandler<HTMLTableRowElement> = (event) => {
    onClick?.(event);

    if (event.defaultPrevented || !selectionContext) return;
    if (!event.currentTarget.querySelector("td")) return;

    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        "a,button,input,select,textarea,label,[role='button'],[data-row-ignore-select='true']",
      )
    ) {
      return;
    }

    selectionContext.setSelectedRowId(rowId);
  };

  return (
    <tr
      ref={ref}
      className={cn(
        "transition-colors hover:bg-[color:var(--surface)]",
        className,
        isSelected && "!bg-[color:var(--surface-strong)]",
      )}
      onClick={handleClick}
      {...props}
    >
      {filteredChildren}
    </tr>
  );
});
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "whitespace-normal break-words px-2 py-2 text-center text-[0.65rem] font-semibold uppercase tracking-wide sm:whitespace-nowrap sm:px-4 sm:py-3 sm:text-xs",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "whitespace-normal break-words px-2 py-2 text-xs text-foreground align-top sm:whitespace-nowrap sm:px-4 sm:py-3 sm:text-sm",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
