import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export function WhatsAppChatSkeleton() {
  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar Skeleton */}
      <Card className="w-96 flex flex-col">
        <CardContent className="p-4 flex flex-col h-full">
          {/* Search Bar Skeleton */}
          <div className="mb-4">
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Filter Tabs Skeleton */}
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
          </div>

          {/* Filters Row Skeleton */}
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-9" />
          </div>

          {/* Conversations List Skeleton */}
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg border"
                >
                  {/* Avatar Skeleton */}
                  <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Name and Time Row */}
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-12" />
                    </div>

                    {/* Message Preview */}
                    <Skeleton className="h-3 w-full" />
                    
                    {/* Tags Row */}
                    <div className="flex gap-1">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main Chat Area Skeleton */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          {/* Chat Header Skeleton */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>

          {/* Messages Area Skeleton */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`flex gap-2 max-w-[70%] ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-64 rounded-lg" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input Area Skeleton */}
          <div className="border-t p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
