import React from 'react';
import { Button } from '@/components/ui/button';
import { Timetable } from '@/services/api/timetable-service';
import type { Section } from '@/types/enrollment';
import type { AcademicGrade as Grade } from '@/types/academic-grade';

export default function TimetableList({ loading, timetables, grades, sections, onDelete, onEdit, onViewSchedule, isAdmin }: {
  loading: boolean;
  timetables: Timetable[];
  grades: Grade[];
  sections: Section[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (t: Timetable) => void;
  onViewSchedule: (t: Timetable) => void;
  isAdmin?: boolean;
}) {
  if (loading && timetables.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading timetables...</span>
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Academic Year</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade & Section</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Slots</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {timetables.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                No timetables found.
              </td>
            </tr>
          ) : (
            timetables.map((timetable) => {
              const grade = grades.find((g) => g.id === timetable.grade_id);
              const section = sections.find((s) => s.id === timetable.section_id);
              const days = [...new Set(timetable.time_slots.map((slot) => slot.day_of_week))];

              return (
                <tr key={timetable.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{timetable.name}</div>
                    <div className="text-xs text-gray-500">{timetable.is_active ? 'Active' : 'Inactive'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{timetable.academic_year}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {timetable.grade_name || grade?.name || 'Unknown Grade'}
                    {timetable.section_name ? ` - ${timetable.section_name}` : (section ? ` - ${section.name}` : '')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{days.join(', ')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {timetable.time_slots.length} periods
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Button variant="ghost" size="sm" onClick={() => onViewSchedule(timetable)}>
                      View Schedule
                    </Button>
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(timetable)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(timetable.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
