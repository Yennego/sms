'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TimetableByClassPage() {
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  
  // Mock data for demonstration
  const grades = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];
  const sections = ['A', 'B', 'C'];
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Class Timetable</h1>
        <Link 
          href="/timetable" 
          className="text-blue-600 hover:text-blue-800"
        >
          Back to Timetable
        </Link>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Grade</label>
            <select 
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select a grade</option>
              {grades.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Section</label>
            <select 
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              disabled={!selectedGrade}
            >
              <option value="">Select a section</option>
              {sections.map((section) => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-4">
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
            disabled={!selectedGrade || !selectedSection}
          >
            View Timetable
          </button>
        </div>
      </div>
      
      {selectedGrade && selectedSection ? (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h2 className="text-xl font-semibold">{selectedGrade} - Section {selectedSection} Timetable</h2>
          </div>
          <div className="p-4">
            <p className="text-gray-500 text-center py-8">Timetable will be displayed here once implemented.</p>
            <p className="text-gray-500 text-center">Connect to your backend API to fetch the actual timetable data.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <p className="text-gray-500">Please select a grade and section to view the timetable.</p>
        </div>
      )}
    </div>
  );
}