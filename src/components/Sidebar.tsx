'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CalendarClock, 
  CalendarOff, 
  Banknote, 
  FileBarChart, 
  Settings,
  User as UserIcon,
  LogOut,
  Receipt,
  X,
  Network,
  CalendarDays,
  Mail,
  Building2,
  Clock,
  Timer
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import clsx from 'clsx';

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [hasTeam, setHasTeam] = useState(false);

  useEffect(() => {
    const checkTeam = async () => {
      try {
        const res = await fetch('/api/employee/my-team');
        if (res.ok) {
          const data = await res.json();
          if (data?.team?.length > 0) {
            setHasTeam(true);
          }
        }
      } catch (err) {
        console.error('Failed to check team status', err);
      }
    };
    if (session?.user) {
      checkTeam();
    }
  }, [session]);

  const role = session?.user?.role;

  const adminLinks = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Employees', href: '/admin/employees', icon: Users },
    { name: 'Attendance', href: '/admin/attendance', icon: CalendarClock },
    { name: 'Leaves', href: '/admin/leaves', icon: CalendarOff },
    { name: 'Permissions', href: '/admin/permissions', icon: Timer },
    { name: 'Approval Center', href: '/admin/approvals', icon: Network },
    { name: 'Payroll', href: '/admin/payroll', icon: Banknote },
    { name: 'Reports', href: '/admin/reports', icon: FileBarChart },
    { name: 'Organization', href: '/admin/organization', icon: Network },
    { name: 'Companies', href: '/admin/companies', icon: Building2 },
    { name: 'Calendar', href: '/admin/calendar', icon: CalendarDays },
    { name: 'Calendar Settings', href: '/admin/settings', icon: Settings },
    { name: 'Shifts', href: '/admin/shifts', icon: Clock },
    { name: 'Letters', href: '/admin/letters/create', icon: Mail },
  ];

  const employeeLinks = [
    { name: 'Dashboard', href: '/employee/dashboard', icon: LayoutDashboard },
    { name: 'Attendance', href: '/employee/attendance', icon: CalendarClock },
    { name: 'Leaves', href: '/employee/leaves', icon: CalendarOff },
    { name: 'Permissions', href: '/employee/permissions', icon: Timer },
    { name: 'Approval Center', href: '/employee/approvals', icon: Network },
    { name: 'Calendar', href: '/employee/calendar', icon: CalendarDays },
    { name: 'Payslips', href: '/employee/payslips', icon: Receipt },
    { name: 'Profile', href: '/employee/profile', icon: UserIcon },
  ];

  if (hasTeam) {
    employeeLinks.splice(employeeLinks.findIndex(l => l.name === 'Permissions'), 0, { name: 'My Team', href: '/employee/my-team', icon: Users });
  }

  let links = ['admin', 'super_admin'].includes(role as string) ? adminLinks : employeeLinks;

  if (role === 'admin') {
    links = links.filter(link => link.name !== 'Payroll');
  }

  return (
    <div className="flex flex-col w-55 h-[100dvh] bg-card border-r border-border transition-all duration-300">
      <div className="flex items-center justify-between h-16 border-b border-border px-4">
        <span className="text-xl font-bold text-primary flex-1 text-center lg:text-left">
          HRMS Portal
        </span>
        <button 
          onClick={onClose}
          className="lg:hidden p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="px-2 space-y-1">
          {links.map((item) => {
            const Icon = item.icon;
            const isActive = pathname?.startsWith(item.href) ?? false;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors'
                )}
              >
                <Icon
                  className={clsx(
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-accent-foreground',
                    'mr-3 flex-shrink-0 h-5 w-5 transition-colors'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex-shrink-0 flex border-t border-border p-4">
        <button
          onClick={() => signOut()}
          className="flex-shrink-0 w-full group block"
        >
          <div className="flex items-center">
            <div>
              <div className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-muted text-muted-foreground group-hover:text-foreground group-hover:bg-accent transition-colors">
                <LogOut className="h-5 w-5" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
                Logout
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
