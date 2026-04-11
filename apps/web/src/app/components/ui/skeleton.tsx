import { cn } from '../../../lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03] bg-[length:200%_100%]',
        className,
      )}
      style={{ animation: 'shimmer 1.8s ease-in-out infinite' }}
      {...props}
    />
  );
}
