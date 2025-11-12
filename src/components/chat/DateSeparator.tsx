interface DateSeparatorProps {
  date: string;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div 
      className="flex items-center justify-center my-4" 
      data-date-separator={date}
    >
      <div className="bg-muted/80 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
        <span className="text-xs font-medium text-muted-foreground capitalize">
          {date}
        </span>
      </div>
    </div>
  );
}
