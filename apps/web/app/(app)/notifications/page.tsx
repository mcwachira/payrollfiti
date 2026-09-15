"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, CheckCheck, Settings2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/lib/notifications-api"
import { cn } from "@/lib/utils"

const CATEGORY_LABELS: Record<string, string> = {
  auth: "Account",
  payroll: "Payroll",
  billing: "Billing",
  compliance: "Compliance",
  hr: "People",
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function NotificationRow({
  notification,
  disabled,
  onMarkRead,
}: {
  notification: Notification
  disabled: boolean
  onMarkRead: (id: string) => void
}) {
  const read = notification.read
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-2 h-2 w-2 shrink-0 rounded-full",
          read ? "bg-transparent" : "bg-primary"
        )}
        aria-hidden
      />
      <button
        type="button"
        disabled={read || disabled}
        onClick={() => onMarkRead(notification.id)}
        aria-label={
          read
            ? `${notification.title} (read)`
            : `${notification.title} (unread — click to mark read)`
        }
        className={cn("min-w-0 flex-1 text-left", !read && "cursor-pointer")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn("text-sm", !read && "font-semibold text-foreground")}
          >
            {notification.title}
          </span>
          {notification.category && (
            <Badge variant="neutral">
              {CATEGORY_LABELS[notification.category] ?? notification.category}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {notification.message}
        </p>
        <p className="text-muted-foreground/70 mt-1 text-xs">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </button>
    </div>
  )
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => listNotifications(false),
  })

  const unreadCount =
    query.data?.filter((notification) => !notification.read).length ?? 0

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onError: (error) => {
      console.error("Failed to mark notification as read", error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onError: (error) => {
      console.error("Failed to mark all notifications as read", error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
  })

  const notifications =
    filter === "unread"
      ? (query.data ?? []).filter((notification) => !notification.read)
      : (query.data ?? [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Notifications</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Payment, payroll and account updates for{" "}
            {filter === "unread" ? "you" : "your workspace"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="neutral" size="sm">
            <Link href="/notifications/preferences">
              <Settings2 className="h-4 w-4" />
              Preferences
            </Link>
          </Button>
          <Button
            size="sm"
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </div>

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as "all" | "unread")}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={filter}>
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-heading">
                {filter === "unread"
                  ? "Unread notifications"
                  : "All notifications"}
              </CardTitle>
              <CardDescription>
                Newer notifications appear first.
              </CardDescription>
            </CardHeader>
            <CardContent className="py-2">
              {query.isPending ? (
                <div className="space-y-3 py-4">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Skeleton className="mt-2 h-2 w-2 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : query.isError ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Bell className="h-4 w-4" />
                    </EmptyMedia>
                    <EmptyTitle>Could not load notifications</EmptyTitle>
                    <EmptyDescription>
                      {query.error instanceof Error
                        ? query.error.message
                        : "Something went wrong. Please try again."}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      size="sm"
                      variant="neutral"
                      onClick={() => query.refetch()}
                    >
                      Try again
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : notifications.length === 0 ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Bell className="h-4 w-4" />
                    </EmptyMedia>
                    <EmptyTitle>
                      {filter === "unread"
                        ? "You're all caught up"
                        : "No notifications yet"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {filter === "unread"
                        ? "There are no unread notifications right now."
                        : "You'll see payment, payroll and account updates here when they arrive."}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="divide-y last:divide-y-0">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "py-3",
                        !notification.read && "bg-muted/40"
                      )}
                    >
                      <NotificationRow
                        notification={notification}
                        disabled={markReadMutation.isPending}
                        onMarkRead={(id) => markReadMutation.mutate(id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
