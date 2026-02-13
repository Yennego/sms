'use client';

import Link from 'next/link';

export default function TimetablePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Timetable Management</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/timetable/by-class">
          <div className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <h2 className="text-xl font-semibold mb-2">View by Class</h2>
            <p className="text-gray-600">View and manage timetables organized by class and section</p>
          </div>
        </Link>
        
        <Link href="/timetable/by-teacher">
          <div className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <h2 className="text-xl font-semibold mb-2">View by Teacher</h2>
            <p className="text-gray-600">View and manage timetables organized by teacher</p>
          </div>
        </Link>
      </div>
      
      <div className="mt-8">
        <Link 
          href="/settings/timetable" 
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          <span>Timetable Settings</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>
    </div>
  );
}