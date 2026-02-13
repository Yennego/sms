'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSuperAdminService, AuditLog, SystemAlert } from '@/services/api/super-admin-service';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Add proper error response interface
interface ApiErrorResponse {
  detail: string;
  status?: number;
}

// Add proper error response interface for axios errors
interface AxiosErrorResponse {
  response?: {
    data?: {
      detail?: string;
    };
  };
  detail?: string;
  message?: string;
}

export default function SecurityPage() {
  const superAdminService = useSuperAdminService();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SystemAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [hasMoreData, setHasMoreData] = useState<boolean>(true);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState<boolean>(false);
  
  // Log type filter state - moved to component level
  const [logType, setLogType] = useState<'all' | 'super_admin' | 'tenant'>('all');
  
  // Calculate pagination values
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const skip = (currentPage - 1) * itemsPerPage;
  
  // Fetch security alerts from the API
  const fetchSecurityAlerts = useCallback(async () => {
    try {
      setIsLoadingAlerts(true);
      setAlertsError(null);
      
      const alerts = await superAdminService.getSecurityAlerts();
      setSecurityAlerts(alerts);
    } catch (error: unknown) {
      console.error('Error fetching security alerts:', error);
      
      let errorMessage = 'Failed to load security alerts';
      
      if (error && typeof error === 'object') {
        const axiosError = error as AxiosErrorResponse;
        if (axiosError.response?.data?.detail) {
          errorMessage = `Permission denied: ${axiosError.response.data.detail}`;
        } else if (axiosError.detail) {
          errorMessage = `Permission denied: ${axiosError.detail}`;
        } else if (axiosError.message) {
          errorMessage = axiosError.message;
        }
      }
      
      setAlertsError(errorMessage);
      setSecurityAlerts([]);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, [superAdminService]);
  
  // Memoize the fetch function to prevent infinite re-renders
  const fetchAuditLogs = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const skipValue = (page - 1) * itemsPerPage;
      // Use the new combined endpoint to show both super-admin and tenant logs
      const logs = await superAdminService.getCombinedAuditLogs({
        skip: skipValue,
        limit: itemsPerPage,
        log_type: logType
      });
      
      if (Array.isArray(logs)) {
        setAuditLogs(logs);
        setHasAttemptedLoad(true);
        
        // Determine if there's more data
        const hasMore = logs.length === itemsPerPage;
        setHasMoreData(hasMore);
        
        // Calculate total items more accurately
        if (logs.length < itemsPerPage) {
          // We've reached the end, set exact total
          setTotalItems(skipValue + logs.length);
        } else if (skipValue === 0) {
          // First page with full results, estimate conservatively
          setTotalItems(skipValue + logs.length + itemsPerPage);
        } else {
          // Middle pages, maintain current total or increase if needed
          const minTotal = skipValue + logs.length;
          setTotalItems(prev => Math.max(prev, minTotal + (hasMore ? itemsPerPage : 0)));
        }
      } else {
        console.error('API returned non-array data for audit logs:', logs);
        if (logs && typeof logs === 'object' && 'detail' in logs) {
          const errorResponse = logs as ApiErrorResponse;
          setError(`Permission denied: ${errorResponse.detail}`);
        } else {
          setError('Invalid response format from server');
        }
        setAuditLogs([]);
        setHasAttemptedLoad(true);
      }
    } catch (error: unknown) {
      console.error('Error fetching audit logs:', error);
      
      let errorMessage = 'Failed to load audit logs';
      
      if (error && typeof error === 'object') {
        const axiosError = error as AxiosErrorResponse;
        if (axiosError.response?.data?.detail) {
          errorMessage = `Permission denied: ${axiosError.response.data.detail}`;
        } else if (axiosError.detail) {
          errorMessage = `Permission denied: ${axiosError.detail}`;
        } else if (axiosError.message) {
          errorMessage = axiosError.message;
        }
      }
      
      setError(errorMessage);
      setAuditLogs([]);
      setHasAttemptedLoad(true);
    } finally {
      setIsLoading(false);
    }
  }, [superAdminService, itemsPerPage, logType]); // Add logType to dependencies
  
  // Fetch audit logs and security alerts from the API
  useEffect(() => {
    fetchAuditLogs(currentPage);
    fetchSecurityAlerts();
  }, [fetchAuditLogs, fetchSecurityAlerts, currentPage]);
  
  // Pagination handlers
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const handleNextPage = () => {
    if (hasMoreData && currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };
  
  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    const adjustedStartPage = endPage - startPage + 1 < maxVisiblePages 
      ? Math.max(1, endPage - maxVisiblePages + 1) 
      : startPage;
    
    for (let i = adjustedStartPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Security</h1>
      
      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <div className="flex justify-between items-center">
            <span>{error}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchAuditLogs(currentPage)}
              disabled={isLoading}
            >
              Retry
            </Button>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-6">
        {/* Security Alerts */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Security Alerts</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchSecurityAlerts}
                disabled={isLoadingAlerts}
              >
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {alertsError && (
              <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <div className="flex justify-between items-center">
                  <span>{alertsError}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchSecurityAlerts}
                    disabled={isLoadingAlerts}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead>Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingAlerts ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-4">
                      Loading security alerts...
                    </TableCell>
                  </TableRow>
                ) : securityAlerts.length > 0 ? (
                  securityAlerts.map((alert, index) => (
                    <TableRow key={index}>
                      <TableCell>{alert.message}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          alert.level === 'info' ? 'bg-blue-100 text-blue-800' :
                          alert.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {alert.level.charAt(0).toUpperCase() + alert.level.slice(1)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-4">
                      {alertsError ? 'Failed to load security alerts' : 'No security alerts available'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Audit Logs with Pagination */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Audit Logs</CardTitle>
              <div className="flex items-center gap-4">
                {/* Log Type Filter */}
                <select 
                  value={logType} 
                  onChange={(e) => {
                    setLogType(e.target.value as 'all' | 'super_admin' | 'tenant');
                    setCurrentPage(1); // Reset to first page when filter changes
                  }}
                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="all">All Logs</option>
                  <option value="super_admin">Super Admin Only</option>
                  <option value="tenant">Tenant Only</option>
                </select>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {totalItems > 0 ? (
                      `Showing ${Math.min(skip + 1, totalItems)}-${Math.min(skip + auditLogs.length, totalItems)} of ${totalItems}`
                    ) : (
                      'No audit logs available'
                    )}
                  </span>
                  <Button variant="outline" size="sm">Export Logs</Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(auditLogs) && auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                      <TableCell>{log.user}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>{log.details}</TableCell>
                      <TableCell>{log.ipAddress}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      {isLoading ? 'Loading audit logs...' : error ? 'Failed to load audit logs' : 'No audit logs available'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            {hasAttemptedLoad && totalItems > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageClick(page)}
                        disabled={isLoading}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!hasMoreData || currentPage >= totalPages || isLoading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                  {auditLogs.length === 0 && currentPage > 1 && " (No data on this page)"}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}