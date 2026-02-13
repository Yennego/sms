'use client';
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import { useSectionService } from '@/services/api/section-service';
import { useTimetableService, Timetable } from '@/services/api/timetable-service';
import type { TimetableFilters as TimetableQueryFilters } from '@/services/api/timetable-service';
import type { AcademicYear, Section } from '@/types/enrollment';
import type { AcademicGrade as Grade } from '@/types/academic-grade';
import TimetableFilters from './components/TimetableFilters';
import TimetableList from './components/TimetableList';
import TimetableDialog from './components/TimetableDialog';
import TimetableScheduleView from './components/TimetableScheduleView';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useAuth } from '@/hooks/use-auth';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { toast } from 'sonner';

export default function TimetablesPage() {
  const academicGradeService = useAcademicGradeService();
  const sectionService = useSectionService();
  const timetableService = useTimetableService();

  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [filters, setFilters] = useState<TimetableQueryFilters>({});
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTimetable, setEditingTimetable] = useState<Timetable | null>(null);
  const [viewingTimetable, setViewingTimetable] = useState<Timetable | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.roles?.some(r => ['admin', 'superadmin', 'super-admin'].includes(r.name));

  // Use Context for Academic Years
  const { academicYears: ayList, selectedAcademicYearId, setSelectedAcademicYearId } = useAcademicYear();

  // Use refs to access services inside effects without adding them to dependencies
  // This breaks the loop if services are unstable (though they should be fixed now)
  const servicesRef = useRef({ academicGradeService, sectionService, timetableService });
  useEffect(() => {
    servicesRef.current = { academicGradeService, sectionService, timetableService };
  }, [academicGradeService, sectionService, timetableService]);

  const lastFetchKeyRef = useRef<string>('');
  const inflightRef = useRef<Promise<Timetable[]> | null>(null);

  // Effect 1: Initial Data Load (Grades/Sections) - One time only on mount
  useEffect(() => {
    let mounted = true;
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const { academicGradeService, sectionService } = servicesRef.current;

        const gradesRes = await academicGradeService.getAllGrades();
        if (mounted) setGrades(Array.isArray(gradesRes) ? gradesRes : []);

        const sectionsData = await sectionService.getSections();
        if (mounted) setSections(Array.isArray(sectionsData) ? sectionsData : []);
      } catch (e) {
        console.warn('[TimetablesPage] Failed to load initial data:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadInitialData();
    return () => { mounted = false; };
  }, []); // Strictly empty dependency array to prevent loops

  // Effect 2: Load Timetables when Filters change
  useEffect(() => {
    if (!filters.academic_year_id) return;

    const key = JSON.stringify({
      ay: filters.academic_year_id || '',
      g: filters.grade_id || '',
      s: filters.section_id || '',
      q: search || ''
    });
    if (lastFetchKeyRef.current === key) return;
    lastFetchKeyRef.current = key;

    let mounted = true;
    const loadTimetables = async () => {
      setLoading(true);
      try {
        const { timetableService } = servicesRef.current;
        const p = timetableService.getTimetables({
          academic_year_id: filters.academic_year_id,
          grade_id: filters.grade_id,
          section_id: filters.section_id,
          search
        });
        inflightRef.current = p;
        const data = await p;
        if (inflightRef.current !== p) return;
        if (mounted) setTimetables(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load timetables", e);
      } finally {
        inflightRef.current = null;
        if (mounted) setLoading(false);
      }
    };

    loadTimetables();
    return () => { mounted = false; };
  }, [filters.academic_year_id, filters.grade_id, filters.section_id, search]);

  // Effect 3: Fetch Sections when Grade Filter changes
  useEffect(() => {
    if (!filters.grade_id) {
      // Optional: reset sections or fetch all.
      // For stability, let's just ignore or fetch all if needed.
      return;
    }
    let mounted = true;
    const fetchSections = async () => {
      try {
        const { sectionService } = servicesRef.current;
        const arr = await sectionService.getSectionsByGrade(filters.grade_id!);
        if (mounted) setSections(Array.isArray(arr) ? arr : []);
      } catch (e) {
        console.warn('[TimetablesPage] Failed to fetch sections by grade:', e);
      }
    };
    fetchSections();
    return () => { mounted = false; };
  }, [filters.grade_id]);

  // Effect 4: Sync Filters with Global Context (One Way: Context -> Filter)
  useEffect(() => {
    if (selectedAcademicYearId && filters.academic_year_id !== selectedAcademicYearId) {
      setFilters(prev => ({ ...prev, academic_year_id: selectedAcademicYearId }));
    }
  }, [selectedAcademicYearId, filters.academic_year_id]);


  const handleDelete = async (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;

    setIsDeleting(true);
    try {
      await servicesRef.current.timetableService.deleteTimetable(deletingId);
      toast.success('Timetable deleted successfully');

      // Trigger reload
      lastFetchKeyRef.current = '';
      const { timetableService } = servicesRef.current;
      const data = await timetableService.getTimetables(filters);
      setTimetables(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to delete timetable:', err);
      toast.error('Failed to delete timetable');
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const handleFiltersChange = (updated: TimetableQueryFilters) => {
    if (updated.academic_year_id !== filters.academic_year_id) {
      setSelectedAcademicYearId(updated.academic_year_id || '');
    }
    setFilters(updated);
  };

  return (
    <>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Timetables</h1>
          <p className="text-gray-600 mt-2">Manage class schedules and time slots</p>
        </div>

        <TimetableFilters
          academicYears={ayList}
          grades={grades}
          sections={sections}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          search={search}
          onSearchChange={setSearch}
          onReset={() => {
            setFilters({ academic_year_id: selectedAcademicYearId });
            setSearch('');
          }}
          onCreate={() => {
            setEditingTimetable(null);
            setIsDialogOpen(true);
          }}
          isAdmin={isAdmin}
        />

        <TimetableList
          loading={loading}
          timetables={timetables}
          grades={grades}
          sections={sections}
          onDelete={handleDelete}
          onEdit={(t) => {
            setEditingTimetable(t);
            setIsDialogOpen(true);
          }}
          onViewSchedule={(t) => setViewingTimetable(t)}
          isAdmin={isAdmin}
        />
      </div>
      <TimetableDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingTimetable(null);
        }}
        timetableToEdit={editingTimetable || undefined}
        academicYears={ayList}
        grades={grades}
        sections={sections}
        onSaved={() => {
          // Manual reload
          lastFetchKeyRef.current = '';
          const { timetableService } = servicesRef.current;
          setLoading(true);
          timetableService.getTimetables(filters).then(data => {
            setTimetables(Array.isArray(data) ? data : []);
            setLoading(false);
          });
        }}
      />
      <TimetableScheduleView
        timetable={viewingTimetable!}
        isOpen={!!viewingTimetable}
        onClose={() => setViewingTimetable(null)}
      />
      <ConfirmationModal
        isOpen={!!deletingId}
        title="Delete Timetable"
        message="Are you sure you want to delete this timetable? This action cannot be undone and will remove all associated schedules."
        confirmButtonText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
        isLoading={isDeleting}
      />
    </>
  );
}
