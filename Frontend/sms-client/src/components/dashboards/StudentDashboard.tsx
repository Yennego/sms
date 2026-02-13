'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Calendar, Clock, Award } from 'lucide-react';

export default function StudentDashboard() {
  const [courses] = useState([
    { id: '1', name: 'Mathematics', teacher: 'Mr. Johnson', grade: 'A-' },
    { id: '2', name: 'Physics', teacher: 'Ms. Smith', grade: 'B+' },
    { id: '3', name: 'English Literature', teacher: 'Mrs. Davis', grade: 'A' },
    { id: '4', name: 'History', teacher: 'Mr. Wilson', grade: 'B' },
  ]);
  
  const [assignments] = useState([
    { id: '1', title: 'Algebra Quiz', course: 'Mathematics', dueDate: '2023-10-15', status: 'Pending' },
    { id: '2', title: 'Physics Lab Report', course: 'Physics', dueDate: '2023-10-20', status: 'Submitted' },
    { id: '3', title: 'Essay on Shakespeare', course: 'English Literature', dueDate: '2023-10-12', status: 'Graded', grade: 'A-' },
  ]);

  const [schedule] = useState([
    { id: '1', subject: 'Mathematics', time: '9:00 AM - 10:30 AM', room: 'Room 101' },
    { id: '2', subject: 'Physics', time: '11:00 AM - 12:30 PM', room: 'Lab 3' },
    { id: '3', subject: 'Lunch Break', time: '12:30 PM - 1:30 PM', room: 'Cafeteria' },
    { id: '4', subject: 'English Literature', time: '1:30 PM - 3:00 PM', room: 'Room 205' },
  ]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Student Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">My Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courses.length}</div>
            <p className="text-xs text-muted-foreground">Enrolled courses</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assignments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.filter(a => a.status === 'Pending').length}</div>
            <p className="text-xs text-muted-foreground">Pending assignments</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Grade</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">A-</div>
            <p className="text-xs text-muted-foreground">Current semester</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Student-specific content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {schedule.map(item => (
                <li key={item.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{item.subject}</p>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <Clock className="h-3 w-3 mr-1" /> {item.time}
                    </p>
                  </div>
                  <span className="text-sm">{item.room}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {assignments.filter(a => a.status === 'Pending').map(assignment => (
                <li key={assignment.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{assignment.title}</p>
                    <p className="text-sm text-muted-foreground">{assignment.course} • Due: {assignment.dueDate}</p>
                  </div>
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                    {assignment.status}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
