'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function GradesPage() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  
  // Mock data for demonstration
  const classes = [
    { id: '1', name: 'Grade 1-A' },
    { id: '2', name: 'Grade 1-B' },
    { id: '3', name: 'Grade 2-A' },
    { id: '4', name: 'Grade 2-B' },
    { id: '5', name: 'Grade 3-A' }
  ];
  
  const exams = [
    { id: '1', name: 'First Term Exam' },
    { id: '2', name: 'Mid-Term Assessment' },
    { id: '3', name: 'Final Exam' }
  ];
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Grades Management</h1>
        <Link 
          href="/grades/entry" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Enter Grades
        </Link>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Class</label>
            <select 
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select a class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Exam</label>
            <select 
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select an exam</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>{exam.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-4">
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
            disabled={!selectedClass || !selectedExam}
          >
            View Grades
          </button>
        </div>
      </div>
      
      {selectedClass && selectedExam ? (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h2 className="text-xl font-semibold">
              {classes.find(c => c.id === selectedClass)?.name} - 
              {exams.find(e => e.id === selectedExam)?.name}
            </h2>
          </div>
          <div className="p-4">
            <p className="text-gray-500 text-center py-8">Grade data will be displayed here once implemented.</p>
            <p className="text-gray-500 text-center">Connect to your backend API to fetch the actual grade data.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <p className="text-gray-500">Please select a class and exam to view grades.</p>
        </div>
      )}
      
      <div className="mt-8">
        <Link 
          href="/settings/grades" 
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          <span>Grade Settings</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>
    </div>
  );
}