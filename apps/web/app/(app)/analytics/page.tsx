import PayrollAnalytics from '@/components/analytics/PayrollAnalytics';
import { Role } from '@repo/api';
import { RoleRedirectGuard } from '@/components/RoleRedirectGuard';

const Analytics = () => {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Advanced payroll analytics and insights
        </p>
      </div>
      <PayrollAnalytics />
    </div>
  );
};

export default function AnalyticsPageGuarded() {
  return (
    <RoleRedirectGuard allow={[Role.ADMIN, Role.HR]}>
      <Analytics />
    </RoleRedirectGuard>
  );
}
