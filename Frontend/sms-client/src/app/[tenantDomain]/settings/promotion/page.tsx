'use client';

import React, { useEffect, useState } from 'react';
import { useAcademicYearService } from '@/services/api/academic-year-service';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import { usePromotionService, PromotionCriteria } from '@/services/api/promotion-service';
import { AcademicYear } from '@/types/enrollment';
import { AcademicGrade } from '@/types/academic-grade';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function PromotionSettingsPage() {
  const yearService = useAcademicYearService();
  const gradeService = useAcademicGradeService();
  const { getCriteria, setCriteria, setCriteriaBulk } = usePromotionService();

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<AcademicGrade[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>([]);
  const [scope, setScope] = useState<'tenant' | 'grade' | 'multi'>('grade');

  const [criteria, setCriteriaState] = useState<Partial<PromotionCriteria>>({
    passing_mark: 70,
    min_passed_subjects: 0,
    require_core_pass: true,
    core_subject_ids: [],
    aggregate_method: 'average',
    weighting_schema: {
      assignment: 20,
      exam: 60,
      attendance: 10,
      quiz: 5,
      test: 5
    }
  });

  const [gradeCriteria, setGradeCriteria] = useState<Record<string, { passing_mark: number; min_passed_subjects: number; require_core_pass: boolean }>>({});

  const assessmentTypes = ['assignment', 'exam', 'attendance', 'quiz', 'test', 'project', 'other'];

  useEffect(() => {
    (async () => {
      const results = await Promise.allSettled([
        yearService.getAcademicYears(),
        gradeService.getActiveGrades()
      ]);
      const yrs = results[0].status === 'fulfilled' ? results[0].value : [];
      const grs = results[1].status === 'fulfilled' ? results[1].value : [];
      setYears(yrs || []);
      setGrades(grs || []);
    })();
  }, [yearService, gradeService]);

  useEffect(() => {
    (async () => {
      if (!selectedYearId) return;
      const gradeParam = scope === 'grade' ? selectedGradeId : undefined;
      const c = await getCriteria(selectedYearId, gradeParam);
      if (c) {
        setCriteriaState({
          ...c,
          weighting_schema: c.weighting_schema || criteria.weighting_schema
        });
      }
    })();
  }, [selectedYearId, selectedGradeId, scope, getCriteria]);

  const handleWeightChange = (type: string, value: number) => {
    setCriteriaState(prev => ({
      ...prev,
      weighting_schema: {
        ...(prev.weighting_schema || {}),
        [type]: value
      }
    }));
  };

  const totalWeight = Object.values(criteria.weighting_schema || {}).reduce((a, b) => a + Number(b), 0);

  const onSave = async () => {
    if (!selectedYearId) {
      toast.error('Select academic year');
      return;
    }
    if (scope === 'grade' && !selectedGradeId) {
      toast.error('Select grade');
      return;
    }
    if (scope === 'multi' && selectedGradeIds.length === 0) {
      toast.error('Select at least one grade');
      return;
    }

    if (criteria.aggregate_method === 'weighted' && totalWeight !== 100) {
      toast.warning(`Total weight is ${totalWeight}%. It should ideally be 100% for proper percentage calculation.`);
    }

    try {
      if (scope === 'multi') {
        const items: PromotionCriteria[] = selectedGradeIds.map(gid => {
          const row = gradeCriteria[gid] || { passing_mark: criteria.passing_mark ?? 70, min_passed_subjects: criteria.min_passed_subjects ?? 0, require_core_pass: !!criteria.require_core_pass };
          return {
            academic_year_id: selectedYearId,
            grade_id: gid,
            passing_mark: Math.max(0, Math.min(100, row.passing_mark)),
            min_passed_subjects: row.min_passed_subjects,
            require_core_pass: row.require_core_pass,
            core_subject_ids: criteria.core_subject_ids ?? [],
            weighting_schema: criteria.weighting_schema,
            aggregate_method: criteria.aggregate_method as any
          };
        });
        const res = await setCriteriaBulk(items);
        toast.success(`Saved: ${res.created} created, ${res.updated} updated`);
      } else {
        const payload: PromotionCriteria = {
          academic_year_id: selectedYearId,
          grade_id: scope === 'grade' ? selectedGradeId : undefined,
          passing_mark: Math.max(0, Math.min(100, criteria.passing_mark ?? 70)),
          min_passed_subjects: criteria.min_passed_subjects ?? 0,
          require_core_pass: !!criteria.require_core_pass,
          core_subject_ids: criteria.core_subject_ids ?? [],
          weighting_schema: criteria.weighting_schema,
          aggregate_method: criteria.aggregate_method as any
        };
        await setCriteria(payload);
        toast.success('Criteria saved');
      }
    } catch {
      toast.error('Failed to save criteria');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Promotion Criteria</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Academic Year</label>
              <select className="border rounded p-2 w-full text-sm" value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)}>
                <option value="">Select year</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Scope</label>
              <select className="border rounded p-2 w-full text-sm" value={scope} onChange={(e) => setScope(e.target.value as 'tenant' | 'grade' | 'multi')}>
                <option value="tenant">School-wide (Default)</option>
                <option value="grade">Per Grade Level</option>
                <option value="multi">Multi Grade Selection</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Specific Grade</label>
              <select className="border rounded p-2 w-full text-sm" value={selectedGradeId} onChange={(e) => setSelectedGradeId(e.target.value)} disabled={scope !== 'grade'}>
                <option value="">Select grade</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t pt-6 grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Pass Requirements</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium">Passing Mark (%)</label>
                  <input type="number" className="border rounded p-2 w-full text-sm" value={criteria.passing_mark ?? 70} onChange={(e) => setCriteriaState(s => ({ ...s, passing_mark: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium">Min Passed Subjects</label>
                  <input type="number" className="border rounded p-2 w-full text-sm" value={criteria.min_passed_subjects ?? 0} onChange={(e) => setCriteriaState(s => ({ ...s, min_passed_subjects: Number(e.target.value) }))} />
                </div>
                <div className="col-span-2 flex items-center gap-2 mt-2">
                  <input id="require_core" type="checkbox" checked={!!criteria.require_core_pass} onChange={(e) => setCriteriaState(s => ({ ...s, require_core_pass: e.target.checked }))} />
                  <label htmlFor="require_core" className="text-sm font-medium">Require core subject pass for promotion</label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2 flex justify-between items-center">
                Weighting Strategy
                <select
                  className="text-xs border rounded p-1 font-normal"
                  value={criteria.aggregate_method}
                  onChange={(e) => setCriteriaState(s => ({ ...s, aggregate_method: e.target.value as any }))}
                >
                  <option value="average">Simple Average</option>
                  <option value="weighted">Weighted Aggregation</option>
                </select>
              </h3>

              {criteria.aggregate_method === 'weighted' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {assessmentTypes.map(type => (
                      <div key={type} className="flex items-center justify-between gap-2 p-2 border rounded bg-gray-50/50">
                        <span className="text-xs font-bold uppercase text-gray-500">{type}</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            className="w-16 border rounded p-1 text-right text-sm"
                            value={criteria.weighting_schema?.[type] ?? 0}
                            onChange={(e) => handleWeightChange(type, Number(e.target.value))}
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-2 p-2 rounded text-xs font-bold flex justify-between ${totalWeight === 100 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    <span>TOTAL WEIGHT</span>
                    <span>{totalWeight}%</span>
                  </div>
                  <p className="text-[10px] text-gray-500 italic">
                    * Assessments of the same type (e.g., multiple quizzes) are averaged first, then weighted.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-gray-400 italic">
                  All assessment types contribute equally to the subject average.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end border-t pt-6">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700" onClick={onSave}>Save Promotion Criteria</Button>
          </div>
        </CardContent>
      </Card>

      {scope === 'multi' && selectedGradeIds.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Bulk Pass Requirements Override</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grade</TableHead>
                  <TableHead>Passing Mark (%)</TableHead>
                  <TableHead>Min Passed Subjects</TableHead>
                  <TableHead>Require Core</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedGradeIds.map(gid => {
                  const row = gradeCriteria[gid] || { passing_mark: criteria.passing_mark ?? 70, min_passed_subjects: criteria.min_passed_subjects ?? 0, require_core_pass: !!criteria.require_core_pass };
                  return (
                    <TableRow key={gid}>
                      <TableCell className="font-medium">{grades.find(g => g.id === gid)?.name || gid}</TableCell>
                      <TableCell>
                        <input type="number" className="border rounded p-2 w-24 text-sm" value={row.passing_mark} onChange={(e) => {
                          const v = Number(e.target.value);
                          setGradeCriteria(s => ({ ...s, [gid]: { ...row, passing_mark: v } }));
                        }} />
                      </TableCell>
                      <TableCell>
                        <input type="number" className="border rounded p-2 w-24 text-sm" value={row.min_passed_subjects} onChange={(e) => {
                          const v = Number(e.target.value);
                          setGradeCriteria(s => ({ ...s, [gid]: { ...row, min_passed_subjects: v } }));
                        }} />
                      </TableCell>
                      <TableCell>
                        <input type="checkbox" checked={row.require_core_pass} onChange={(e) => {
                          const v = e.target.checked;
                          setGradeCriteria(s => ({ ...s, [gid]: { ...row, require_core_pass: v } }));
                        }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
