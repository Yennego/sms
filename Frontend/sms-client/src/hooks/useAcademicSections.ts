import { useState, useEffect, useCallback } from 'react';
import { useSectionService } from './useSectionService';
import type { Section } from '@/types/section';

export const useAcademicSections = (gradeId?: string) => {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sectionService = useSectionService();

  const fetchSections = useCallback(async (selectedGradeId: string) => {
    if (!selectedGradeId) {
      console.log('🚫 No grade ID provided, skipping section fetch');
      return;
    }
    
    console.log('🚀 Starting to fetch sections for grade:', selectedGradeId);
    setLoading(true);
    setError(null);
    
    try {
      const data = await sectionService.getSectionsByGrade(selectedGradeId);
      console.log('✅ Successfully fetched sections:', data);
      console.log('📊 Number of sections:', data.length);
      setSections(data);
    } catch (err) {
      console.error('❌ Error fetching sections:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sections';
      console.error('❌ Error details:', errorMessage);
      setError(errorMessage);
      setSections([]);
    } finally {
      setLoading(false);
      console.log('🏁 Finished fetching sections');
    }
  }, [sectionService]);

  useEffect(() => {
    console.log('🔄 useEffect triggered with gradeId:', gradeId);
    if (gradeId) {
      fetchSections(gradeId);
    } else {
      console.log('🚫 No gradeId, clearing sections');
      setSections([]);
    }
  }, [gradeId, fetchSections]);

  return {
    sections,
    loading,
    error,
    fetchSections,
    refetch: () => gradeId && fetchSections(gradeId)
  };
};
