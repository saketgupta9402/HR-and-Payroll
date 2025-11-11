import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

const EMPTY_VALUE_PREFIX = "__radix-empty__";

const normalizeIn = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return undefined;
  const str = typeof value === "string" ? value : String(value);
  const trimmed = str.trim();
  return trimmed === "" ? EMPTY_VALUE_PREFIX : trimmed;
};

const normalizeOut = (value: string) =>
  value.startsWith(EMPTY_VALUE_PREFIX) ? "" : value;

const ensureSafeValue = (
  value: unknown,
  getFallback: () => string,
): string => {
  if (value === null || value === undefined) {
    return getFallback();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? getFallback() : trimmed;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return String(value ?? "");
};

const sanitizeSelectChildren = (
  nodes: React.ReactNode,
  getFallback: () => string,
): React.ReactNode => {
  return React.Children.map(nodes, (child) => {
    if (!React.isValidElement(child)) return child;

    let nextProps: Record<string, unknown> | undefined;

    if ("value" in (child.props as { value?: unknown })) {
      const safeValue = ensureSafeValue(
        (child.props as { value?: unknown }).value,
        getFallback,
      );
      if (safeValue !== (child.props as { value?: unknown }).value) {
        console.warn("[Select] Coercing empty select item value", {
          original: (child.props as { value?: unknown }).value,
          safeValue,
        });
        nextProps = { ...(nextProps ?? {}), value: safeValue };
      }
    }

    if (child.props?.children) {
      const sanitizedChildren = sanitizeSelectChildren(
        child.props.children,
        getFallback,
      );
      if (sanitizedChildren !== child.props.children) {
        nextProps = { ...(nextProps ?? {}), children: sanitizedChildren };
      }
    }

    return nextProps ? React.cloneElement(child, nextProps) : child;
  });
};

const Select = ({
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>) => {
  const handleValueChange = React.useCallback(
    (nextValue: string) => {
      onValueChange?.(normalizeOut(nextValue));
    },
    [onValueChange],
  );

  const fallbackCounter = React.useRef(0);
  const getFallbackValue = React.useCallback(
    () => `${EMPTY_VALUE_PREFIX}::${fallbackCounter.current++}`,
    [],
  );

  const sanitizedChildren = React.useMemo(
    () => sanitizeSelectChildren(children, getFallbackValue),
    [children, getFallbackValue],
  );

  return (
    <SelectPrimitive.Root
      value={value !== undefined ? normalizeIn(value as any) : undefined}
      defaultValue={
        defaultValue !== undefined ? normalizeIn(defaultValue as any) : undefined
      }
      onValueChange={handleValueChange}
      {...props}
    >
      {sanitizedChildren}
    </SelectPrimitive.Root>
  );
};

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

let emptyValueCounter = 0;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, value, ...props }, ref) => {
  const fallbackRef = React.useRef<string>();

  if (!fallbackRef.current) {
    fallbackRef.current = `${EMPTY_VALUE_PREFIX}::item-${++emptyValueCounter}`;
  }

  const normalizedValue =
    value === undefined || value === null
      ? fallbackRef.current
      : typeof value === "number"
      ? String(value)
      : typeof value === "string"
      ? value.trim() === ""
        ? fallbackRef.current
        : value
      : String(value);

  if (value === "" || value === " ") {
    console.error("[SelectItem] received explicit empty string value", {
      children,
      props,
    });
  }

  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
        className,
      )}
      {...props}
      value={normalizedValue}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>

      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
