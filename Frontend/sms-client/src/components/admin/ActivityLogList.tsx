'use client';

import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Clock, User, Activity, Smartphone, Globe } from 'lucide-react';
import { useActivityLogs } from '@/hooks/queries/activity-logs';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export function ActivityLogList() {
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [entityFilter, setEntityFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const limit = 20;

    const { data: paginatedData, isLoading, error, isFetching } = useActivityLogs({
        page,
        limit,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        entity_type: entityFilter !== 'all' ? entityFilter : undefined,
    });

    const logs = paginatedData?.items || [];
    const total = paginatedData?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.user?.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.user?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase());

        return matchesSearch;
    });

    const handleActionFilterChange = (value: string) => {
        setActionFilter(value);
        setPage(1);
    };

    const handleEntityFilterChange = (value: string) => {
        setEntityFilter(value);
        setPage(1);
    };

    const getActionBadge = (action: string) => {
        switch (action.toLowerCase()) {
            case 'create':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">CREATE</Badge>;
            case 'update':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">UPDATE</Badge>;
            case 'delete':
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none">DELETE</Badge>;
            default:
                return <Badge variant="outline">{action.toUpperCase()}</Badge>;
        }
    };

    const getEntityLabel = (entity: string) => {
        return entity.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    if (error) {
        return (
            <div className="p-8 text-center text-destructive">
                <p>Error loading activity logs. Please try again later.</p>
            </div>
        );
    }

    return (
        <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Activity className="h-5 w-5 text-blue-600" />
                            Activity Logs
                        </CardTitle>
                        <CardDescription>
                            Monitor all state-changing administrative actions within your school.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search logs..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={actionFilter} onValueChange={handleActionFilterChange}>
                            <SelectTrigger className="w-full md:w-32">
                                <SelectValue placeholder="Action" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Actions</SelectItem>
                                <SelectItem value="create">Create</SelectItem>
                                <SelectItem value="update">Update</SelectItem>
                                <SelectItem value="delete">Delete</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={entityFilter} onValueChange={handleEntityFilterChange}>
                            <SelectTrigger className="w-full md:w-40">
                                <SelectValue placeholder="Entity Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Entities</SelectItem>
                                <SelectItem value="student">Students</SelectItem>
                                <SelectItem value="teacher">Teachers</SelectItem>
                                <SelectItem value="grade">Grades</SelectItem>
                                <SelectItem value="section">Sections</SelectItem>
                                <SelectItem value="subject">Subjects</SelectItem>
                                <SelectItem value="grading_schema">Grading Schemas</SelectItem>
                                <SelectItem value="academic_year">Academic Years</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="relative">
                {/* Loading indicator for pagination */}
                {isFetching && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-b-lg">
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-md border border-gray-100">
                            <Skeleton className="h-4 w-4 rounded-full animate-pulse bg-blue-400" />
                            <span className="text-xs font-medium text-gray-600">Updating logs...</span>
                        </div>
                    </div>
                )}

                <div className={`rounded-md border border-gray-100 overflow-hidden transition-opacity duration-200 ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow>
                                <TableHead className="w-[180px]">Timestamp</TableHead>
                                <TableHead>Admin User</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Entity</TableHead>
                                <TableHead className="max-w-[300px]">Details</TableHead>
                                <TableHead className="text-right">Source</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredLogs?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                        No activity logs found matching your filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLogs?.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                        <TableCell className="text-xs font-medium text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="h-3 w-3" />
                                                {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-7 w-7 rounded-full bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600">
                                                    {log.user ? `${log.user.first_name[0]}${log.user.last_name[0]}` : 'S'}
                                                </div>
                                                <div className="text-sm">
                                                    <p className="font-medium text-gray-900">
                                                        {log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System'}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 truncate max-w-[120px]">
                                                        {log.user?.email || 'automated-task@system'}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {getActionBadge(log.action)}
                                        </TableCell>
                                        <TableCell className="text-sm font-medium">
                                            {getEntityLabel(log.entity_type)}
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-600 max-w-[300px]">
                                            <div className="truncate" title={JSON.stringify(log.new_values)}>
                                                {log.action === 'create' && 'New record created'}
                                                {log.action === 'update' && `Updated ${Object.keys(log.new_values || {}).join(', ')}`}
                                                {log.action === 'delete' && 'Record deleted'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                                    <Globe className="h-2.5 w-2.5" />
                                                    {log.ip_address || '0.0.0.0'}
                                                </div>
                                                <div className="text-[9px] text-gray-300 truncate max-w-[100px]" title={log.user_agent || ''}>
                                                    {log.user_agent?.split(' ')[0] || 'Unidentified'}
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Controls */}
                {!isLoading && totalPages > 1 && (
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                        <div className="text-sm text-gray-500">
                            Showing <span className="font-medium text-gray-900">{Math.min((page - 1) * limit + 1, total)}</span> to <span className="font-medium text-gray-900">{Math.min(page * limit, total)}</span> of <span className="font-medium text-gray-900">{total}</span> logs
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                Previous
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    // Simple pagination logic to show current window
                                    let pageNum = page;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (page <= 3) pageNum = i + 1;
                                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = page - 2 + i;

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setPage(pageNum)}
                                            className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-all ${page === pageNum
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                                                : 'text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
