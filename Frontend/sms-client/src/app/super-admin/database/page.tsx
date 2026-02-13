'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface BackupRecord {
  id: string;
  timestamp: string;
  size: string;
  status: 'completed' | 'failed' | 'in-progress';
  type: 'automatic' | 'manual';
}

export default function DatabasePage() {
  // Mock data for database stats
  const [databaseStats, setDatabaseStats] = useState({
    size: '1.2 GB',
    tables: 42,
    lastBackup: '2023-05-15T23:00:00Z',
    connections: 8,
    uptime: '14 days, 6 hours',
  });
  
  // Mock data for backup history
  const [backupHistory, setBackupHistory] = useState<BackupRecord[]>([
    { id: '1', timestamp: '2023-05-15T23:00:00Z', size: '1.2 GB', status: 'completed', type: 'automatic' },
    { id: '2', timestamp: '2023-05-14T23:00:00Z', size: '1.18 GB', status: 'completed', type: 'automatic' },
    { id: '3', timestamp: '2023-05-13T23:00:00Z', size: '1.15 GB', status: 'completed', type: 'automatic' },
    { id: '4', timestamp: '2023-05-12T15:30:00Z', size: '1.14 GB', status: 'completed', type: 'manual' },
    { id: '5', timestamp: '2023-05-11T23:00:00Z', size: '1.12 GB', status: 'failed', type: 'automatic' },
  ]);
  
  const [isBackupInProgress, setIsBackupInProgress] = useState(false);
  
  const startBackup = () => {
    setIsBackupInProgress(true);
    
    // Simulate backup process
    setTimeout(() => {
      const newBackup: BackupRecord = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        size: databaseStats.size,
        status: 'completed',
        type: 'manual',
      };
      
      setBackupHistory([newBackup, ...backupHistory]);
      setIsBackupInProgress(false);
    }, 3000);
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Database Management</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Database Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Database Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Database Size:</span>
                <span className="font-medium">{databaseStats.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Number of Tables:</span>
                <span className="font-medium">{databaseStats.tables}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Connections:</span>
                <span className="font-medium">{databaseStats.connections}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Database Uptime:</span>
                <span className="font-medium">{databaseStats.uptime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Backup:</span>
                <span className="font-medium">{new Date(databaseStats.lastBackup).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Backup Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Backup Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Create a manual backup of the database or restore from a previous backup.
              </p>
              <div className="flex gap-4">
                <Button 
                  onClick={startBackup} 
                  disabled={isBackupInProgress}
                >
                  {isBackupInProgress ? 'Backup in Progress...' : 'Create Backup'}
                </Button>
                <Button variant="outline">Restore Backup</Button>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Automatic backups are scheduled daily at 11:00 PM.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backupHistory.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell>{new Date(backup.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{backup.size}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      backup.type === 'automatic' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {backup.type.charAt(0).toUpperCase() + backup.type.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      backup.status === 'completed' ? 'bg-green-100 text-green-800' :
                      backup.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {backup.status.charAt(0).toUpperCase() + backup.status.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="mr-2">Download</Button>
                    <Button variant="outline" size="sm">Restore</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}