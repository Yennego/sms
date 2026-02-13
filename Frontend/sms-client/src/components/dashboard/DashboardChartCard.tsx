import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardChartCardProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function DashboardChartCard({ title, children, action }: DashboardChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{title}</CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}