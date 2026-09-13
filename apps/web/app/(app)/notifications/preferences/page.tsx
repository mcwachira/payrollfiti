"use client"

import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Bell } from "lucide-react"
import { toast } from "sonner"
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
import { Switch } from "@/components/ui/switch"
import { usePushNotifications } from "@/lib/push/use-push-notifications"
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationChannel,
  type NotificationPreference,
  type NotificationPreferenceInput,
} from "@/lib/notifications-api"

const CATEGORY_META: Record<string, { title: string; description: string }> = {
  billing: {
    title: "Billing & payments",
    description: "Payments, invoices and subscription updates.",
  },
  payroll: {
    title: "Payroll",
    description: "Payroll run completion and payout status.",
  },
  compliance: {
    title: "Compliance",
    description: "When compliance reports are ready to download.",
  },
  hr: {
    title: "People",
    description: "Employee onboarding and people events.",
  },
  auth: {
    title: "Account & security",
    description: "New sign-ins and account security alerts.",
  },
}

const CATEGORY_ORDER = ["auth", "payroll", "billing", "compliance", "hr"]

const CHANNELS: {
  key: NotificationChannel
  label: string
  description: string
}[] = [
  {
    key: "in_app",
    label: "In-app",
    description: "Notification centre and bell",
  },
  { key: "email", label: "Email", description: "Sent to your account email" },
  { key: "sms", label: "SMS", description: "Requires a phone number" },
  {
    key: "push",
    label: "Push",
    description: "Browser push subscription",
  },
]

function humanizeEventType(eventType: string): string {
  const segments = eventType.split(".")
  const name = segments.length > 1 ? segments.slice(1) : segments
  return name
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

function BrowserPushCard() {
  const { support, subscribed, busy, subscribe, unsubscribe } =
    usePushNotifications()

  if (support === "unsupported") return null

  const handleToggle = async (value: boolean) => {
    try {
      if (value) {
        await subscribe()
        toast.success("Push notifications enabled for this browser")
      } else {
        await unsubscribe()
        toast.success("Push notifications disabled for this browser")
      }
    } catch (error) {
      toast.error("Could not update browser notifications", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base font-heading">
          Browser notifications
        </CardTitle>
        <CardDescription>
          The push channel only delivers while this browser is subscribed.
          Permissions can be revoked from your browser&apos;s settings at any
          time.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Enable push in this browser</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {subscribed
              ? "This browser is receiving push notifications."
              : "Subscribe this browser to receive push notifications."}
          </p>
        </div>
        <Switch
          checked={subscribed}
          disabled={busy || support === "checking"}
          onCheckedChange={handleToggle}
          aria-label="Enable push notifications in this browser"
        />
      </CardContent>
    </Card>
  )
}

function PreferenceRow({
  preference,
  busy,
  onToggle,
}: {
  preference: NotificationPreference
  busy: boolean
  onToggle: (channel: NotificationChannel, value: boolean) => void
}) {
  return (
    <div className="border-b last:border-b-0">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">
              {humanizeEventType(preference.event_type)}
            </p>
            <p className="text-muted-foreground mt-0.5 font-mono text-xs">
              {preference.event_type}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {CHANNELS.map((channel) => (
              <div
                key={channel.key}
                className="flex flex-col items-center gap-1"
                title={channel.description}
              >
                <Switch
                  checked={preference.channels[channel.key]}
                  disabled={busy}
                  onCheckedChange={(value) => onToggle(channel.key, value)}
                  aria-label={`${channel.label} notifications for ${preference.event_type}`}
                />
                <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  {channel.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NotificationPreferencesPage() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
  })

  const updateMutation = useMutation<
    NotificationPreference[],
    Error,
    NotificationPreferenceInput,
    { previous?: NotificationPreference[] }
  >({
    mutationFn: (input) => updateNotificationPreferences(input),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["notification-preferences"],
      })
      const previous = queryClient.getQueryData<NotificationPreference[]>([
        "notification-preferences",
      ])
      const changedChannel = Object.keys(variables).find(
        (key) => key !== "event_type"
      ) as NotificationChannel | undefined
      if (changedChannel && variables[changedChannel] !== undefined) {
        queryClient.setQueryData<NotificationPreference[]>(
          ["notification-preferences"],
          (old) =>
            old?.map((item) =>
              item.event_type === variables.event_type
                ? {
                    ...item,
                    channels: {
                      ...item.channels,
                      [changedChannel]: variables[changedChannel],
                    },
                  }
                : item
            )
        )
      }
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notification-preferences"], context.previous)
      }
      toast.error("Could not update notification preference", {
        description: error instanceof Error ? error.message : undefined,
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["notification-preferences"],
      })
    },
  })

  const handleToggle = (
    preference: NotificationPreference,
    channel: NotificationChannel,
    value: boolean
  ) => {
    updateMutation.mutate({
      event_type: preference.event_type,
      [channel]: value,
    })
  }

  const preferences = query.data ?? []
  const busy = updateMutation.isPending

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="neutral" size="sm" className="mb-4">
          <Link href="/notifications">
            <ArrowLeft className="h-4 w-4" />
            Back to notifications
          </Link>
        </Button>
        <h1 className="text-2xl font-bold font-heading">
          Notification preferences
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose how each event reaches you. Changes apply immediately.
        </p>
      </div>

      <BrowserPushCard />

      {query.isPending ? (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <Card key={index}>
              <CardHeader className="border-b">
                <Skeleton className="h-4 w-1/4" />
              </CardHeader>
              <CardContent className="space-y-4 py-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-24" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-5 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent>
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bell className="h-4 w-4" />
                </EmptyMedia>
                <EmptyTitle>Could not load preferences</EmptyTitle>
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
          </CardContent>
        </Card>
      ) : (
        CATEGORY_ORDER.map((category) => {
          const rows = preferences.filter(
            (preference) => preference.category === category
          )
          if (rows.length === 0) return null
          const meta = CATEGORY_META[category]
          return (
            <Card key={category}>
              <CardHeader className="border-b">
                <CardTitle className="text-base font-heading">
                  {meta?.title ?? category}
                </CardTitle>
                <CardDescription>
                  {meta?.description ?? "Notification settings."}
                </CardDescription>
              </CardHeader>
              <div className="divide-y divide-border">
                {rows.map((preference) => (
                  <PreferenceRow
                    key={preference.event_type}
                    preference={preference}
                    busy={busy}
                    onToggle={(channel, value) =>
                      handleToggle(preference, channel, value)
                    }
                  />
                ))}
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
