"use client"
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Role } from "@/shared-types"
import { PropsWithChildren } from "react"

interface RoleGuardProps {
  allow: Role[];
}

export function RoleGuard({
                            allow,
                            children,
                          }: PropsWithChildren<RoleGuardProps>) {
  const { user } = useAuth();

  if (!user || !allow.includes(user.role)) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            You don&apos;t have permission to view this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

