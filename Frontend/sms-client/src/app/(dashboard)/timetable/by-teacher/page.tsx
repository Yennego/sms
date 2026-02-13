'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TimetableByTeacherPage() {
  const [selectedTeacher, setSelectedTeacher] = useState('');
  
  // Mock data for demonstration
  const teachers = [
    { id: '1', name: 'John Smith' },
    { id: '2', name: 'Jane Doe' },
    { id: '3', name: 'Robert Johnson' },
    { id: '4', name: 'Emily Davis' },
    { id: '5', name: 'Michael Wilson' }
  ];
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Teacher Timetable</h1>
        <Link 
          href="/timetable" 
          className="text-blue-600 hover:text-blue-800"
        >
          Back to Timetable
        </Link>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Teacher</label>
          <select 
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Select a teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
            ))}
          </select>
        </div>
        
        <div className="mt-4">
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
            disabled={!selectedTeacher}
          >
            View Timetable
          </button>
        </div>
      </div>
      
      {selectedTeacher ? (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h2 className="text-xl font-semibold">{teachers.find(t => t.id === selectedTeacher)?.name}&apos;s Timetable</h2>
          </div>
          <div className="p-4">
            <p className="text-gray-500 text-center py-8">Timetable will be displayed here once implemented.</p>
            <p className="text-gray-500 text-center">Connect to your backend API to fetch the actual timetable data.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <p className="text-gray-500">Please select a teacher to view their timetable.</p>
        </div>
      )}
    </div>
  );
}