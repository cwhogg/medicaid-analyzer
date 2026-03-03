import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className, hover = false }: GlassCardProps) {
  return (
    <div className={cn(hover ? "card-hover" : "card", className)}>
      {children}
    </div>
  );
}
