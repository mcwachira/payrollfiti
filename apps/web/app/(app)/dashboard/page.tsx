import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Users, DollarSign, Calendar, TrendingUp } from 'lucide-react';

const stats = [
  {
    name: 'Total Employees',
    value: '156',
    change: '+12%',
    changeType: 'positive',
    icon: Users,
  },
  {
    name: 'Monthly Payroll',
    value: 'KES 2.4M',
    change: '+8%',
    changeType: 'positive',
    icon: DollarSign,
  },
  {
    name: 'Pending Leave Requests',
    value: '8',
    change: '-2',
    changeType: 'neutral',
    icon: Calendar,
  },
  {
    name: 'YTD Tax Savings',
    value: 'KES 450K',
    change: '+15%',
    changeType: 'positive',
    icon: TrendingUp,
  },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Welcome to your payroll management system
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-gray-600">
                <span
                  className={`${
                    stat.changeType === 'positive'
                      ? 'text-green-600'
                      : stat.changeType === 'negative'
                        ? 'text-red-600'
                        : 'text-gray-600'
                  }`}
                >
                  {stat.change}
                </span>{' '}
                from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Payroll Activities</CardTitle>
            <CardDescription>
              Latest payroll processing activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">December 2024 Payroll</p>
                  <p className="text-sm text-gray-600">
                    Processed for 156 employees
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  Completed
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">PAYE Returns - November</p>
                  <p className="text-sm text-gray-600">KRA submission due</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                  Pending
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">NSSF Contributions</p>
                  <p className="text-sm text-gray-600">Monthly remittance</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  In Progress
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
            <CardDescription>
              Important compliance and payroll dates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">PAYE Returns Due</p>
                  <p className="text-sm text-gray-600">9th January 2025</p>
                </div>
                <span className="text-sm text-red-600 font-medium">3 days</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">January Payroll</p>
                  <p className="text-sm text-gray-600">Processing starts</p>
                </div>
                <span className="text-sm text-orange-600 font-medium">
                  5 days
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">NHIF Remittance</p>
                  <p className="text-sm text-gray-600">Monthly contribution</p>
                </div>
                <span className="text-sm text-green-600 font-medium">
                  12 days
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
