'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ExamsPage() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Simulate API call to fetch exams
    setTimeout(() => {
      setExams([]);
      setLoading(false);
    }, 1000);
  }, []);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Exams Management</h1>
        <Link 
          href="/exams/new" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Create New Exam
        </Link>
      </div>
      
      {loading ? (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-2 text-gray-500">Loading exams...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <p className="text-gray-500 mb-4">No exams found.</p>
          <Link 
            href="/exams/new" 
            className="text-blue-600 hover:text-blue-800"
          >
            Create your first exam
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {/* Exam list would go here */}
        </div>
      )}
      
      <div className="mt-8">
        <Link 
          href="/settings/exams" 
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          <span>Exam Settings</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>
    </div>
  );
}