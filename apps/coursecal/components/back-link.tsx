import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Consistent "back" affordance for detail pages (semester → dashboard,
// course → semester). The browser back button works, but an in-page control
// is clearer UX.
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <ChevronLeftIcon className="size-4" />
      {children}
    </Link>
  );
}
