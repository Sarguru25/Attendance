import { auth } from '@/auth';
import DashboardClient from './DashboardClient';
import DashboardActions from './DashboardActions';

export default async function AdminDashboard() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-card-foreground">Admin Dashboard</h1>
        <DashboardActions />
      </div>

      <DashboardClient />
    </div>
  );
}
