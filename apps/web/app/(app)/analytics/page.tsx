import PayrollAnalytics from '@/components/analytics/PayrollAnalytics';

const Analytics = () => {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Advanced payroll analytics and insights
        </p>
      </div>
      <PayrollAnalytics />
    </div>
  );
};

export default Analytics;
