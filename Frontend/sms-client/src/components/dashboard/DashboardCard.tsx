import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: ReactNode;
  description?: string;
}

export function DashboardCard({ title, value, change, icon, description }: DashboardCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className="mt-4 text-xs text-muted-foreground flex items-center">
            <span className={change >= 0 ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
              {change >= 0 ? '+' : ''}{change}%
            </span>
            {description && <span className="ml-1">{description}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}