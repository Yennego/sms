'use client';

import Link from 'next/link';

export default function CommunicationPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Communication</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/communication/announcements">
          <div className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <h2 className="text-xl font-semibold mb-2">Announcements</h2>
            <p className="text-gray-600">Create and manage school-wide announcements</p>
          </div>
        </Link>
        
        <Link href="/communication/messages">
          <div className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <h2 className="text-xl font-semibold mb-2">Messages</h2>
            <p className="text-gray-600">Send and receive messages to/from teachers, students, and parents</p>
          </div>
        </Link>
        
        <Link href="/communication/events">
          <div className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <h2 className="text-xl font-semibold mb-2">Events</h2>
            <p className="text-gray-600">Create and manage school events and calendar</p>
          </div>
        </Link>
      </div>
      
      <div className="mt-8">
        <Link 
          href="/settings/communication" 
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          <span>Communication Settings</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>
    </div>
  );
}