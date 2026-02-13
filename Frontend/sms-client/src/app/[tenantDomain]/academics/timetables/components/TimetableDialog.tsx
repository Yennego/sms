'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useTimetableService, Timetable, TimetableCreate } from '@/services/api/timetable-service';
import { useClassService } from '@/services/api/class-service';
import { useSectionService } from '@/services/api/section-service';
import type { ClassWithDetails, ClassSubject } from '@/types/class';
import { toast } from 'sonner';

type Item = { id: string; name: string };
type AcademicYear = { id: string; name: string; is_current?: boolean };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (saved: Timetable) => void;
  timetableToEdit?: Timetable;
  academicYears: AcademicYear[];
  grades: Item[];
  // Replaced external sections with internal fetching since dialog state is independent
  // But we can keep it as initial/fallback, typically unused if we fetch dynamically
  sections?: Item[];
}

export default function TimetableDialog({
  isOpen,
  onClose,
  onSaved,
  timetableToEdit,
  academicYears,
  grades,
}: Props) {
  const { createTimetable, updateTimetable, loading } = useTimetableService();
  const { getClasses } = useClassService();
  const { getSectionsByGrade } = useSectionService();

  const [tab, setTab] = useState<'general' | 'timeslots'>('general');
  const [sections, setSections] = useState<Item[]>([]);

  const [form, setForm] = useState<TimetableCreate>({
    name: '',
    academic_year_id: '',
    grade_id: '',
    section_id: '',
    is_active: true,
    time_slots: [],
  });

  // Store flattened class subjects with their class info
  const [availableSubjects, setAvailableSubjects] = useState<(ClassSubject & { class_name?: string })[]>([]);
  const [bulkSlot, setBulkSlot] = useState({
    name: '',
    start_time: '',
    end_time: '',
    days: [] as string[],
    class_id: ''
  });

  useEffect(() => {
    if (timetableToEdit) {
      setForm({
        name: timetableToEdit.name,
        academic_year_id: timetableToEdit.academic_year_id || (academicYears.find((y) => y.name === timetableToEdit.academic_year)?.id || ''),
        grade_id: timetableToEdit.grade_id,
        section_id: timetableToEdit.section_id || '',
        is_active: timetableToEdit.is_active,
        time_slots: timetableToEdit.time_slots.map((s) => ({
          name: s.name || '',
          start_time: s.start_time || '',
          end_time: s.end_time || '',
          day_of_week: s.day_of_week || '',
          class_id: s.class_id || '',
        })),
      });
      setTab('general');
    } else {
      const currentYear = academicYears.find((y) => y.is_current)?.id || academicYears[0]?.id || '';
      setForm({
        name: '',
        academic_year_id: currentYear,
        grade_id: '',
        section_id: '',
        is_active: true,
        time_slots: [],
      });
      setTab('general');
    }
  }, [timetableToEdit, academicYears]);

  // Fetch sections when grade changes
  useEffect(() => {
    const fetchSections = async () => {
      if (!form.grade_id) {
        setSections([]);
        return;
      }
      try {
        const data = await getSectionsByGrade(form.grade_id);
        setSections(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to fetch sections in dialog', e);
        setSections([]);
      }
    };
    fetchSections();
  }, [form.grade_id, getSectionsByGrade]);

  // Fetch subjects (classes) when grade/section/year changes
  useEffect(() => {
    const fetchSubjects = async () => {
      // If we don't have enough info, clear list
      if (!form.grade_id || !form.academic_year_id) {
        setAvailableSubjects([]);
        return;
      }

      const yearName = academicYears.find(y => y.id === form.academic_year_id)?.name;

      const apiFilters = {
        grade_id: form.grade_id,
        section_id: form.section_id || undefined,
        academic_year_id: form.academic_year_id,
        is_active: true
      };

      console.log('[TimetableDialog] Fetching classes with filters:', apiFilters);

      try {
        const classes = await getClasses(apiFilters) as unknown as ClassWithDetails[];
        console.log('[TimetableDialog] Received classes:', classes);

        // Flatten subjects from all classes for the dropdown
        const allSubjects: (ClassSubject & { class_name?: string })[] = [];
        for (const cls of classes) {
          if (cls.subjects && Array.isArray(cls.subjects)) {
            for (const subj of cls.subjects) {
              allSubjects.push({
                ...subj,
                class_name: cls.name || `${cls.grade_name} - ${cls.section_name}`
              });
            }
          }
        }
        console.log('[TimetableDialog] Extracted subjects:', allSubjects);
        setAvailableSubjects(allSubjects);
      } catch (err) {
        console.error('Failed to fetch subjects for timetable', err);
        setAvailableSubjects([]);
      }
    };
    fetchSubjects();
  }, [form.grade_id, form.section_id, form.academic_year_id, getClasses, academicYears]);


  const onSubmit = async () => {
    const payload: TimetableCreate = {
      name: form.name.trim(),
      academic_year_id: form.academic_year_id,
      grade_id: form.grade_id,
      section_id: form.section_id || undefined,
      is_active: form.is_active,
      time_slots: form.time_slots.map((t) => ({
        name: t.name.trim(),
        start_time: t.start_time,
        end_time: t.end_time,
        day_of_week: t.day_of_week,
        class_id: t.class_id || undefined,
      })),
    };

    try {
      const saved = timetableToEdit
        ? await updateTimetable(timetableToEdit.id, payload)
        : await createTimetable(payload);

      toast.success(timetableToEdit ? 'Timetable updated successfully' : 'Timetable created successfully');
      onSaved(saved);
      onClose();
    } catch (err: any) {
      const message = err?.message || err?.detail || 'An unexpected error occurred';
      toast.error(message);
      console.error('Timetable save failed:', err);
    }
  };

  const addSlot = () => {
    setForm((prev) => ({
      ...prev,
      time_slots: [...prev.time_slots, { name: '', start_time: '', end_time: '', day_of_week: '', class_id: '' }],
    }));
  };

  const removeSlot = (index: number) => {
    setForm((prev) => ({
      ...prev,
      time_slots: prev.time_slots.filter((_, i) => i !== index),
    }));
  };

  const handleBulkAdd = () => {
    if (!bulkSlot.class_id || bulkSlot.days.length === 0 || !bulkSlot.start_time || !bulkSlot.end_time) return;

    const newSlots = bulkSlot.days.map(day => ({
      name: bulkSlot.name || 'Period',
      start_time: bulkSlot.start_time,
      end_time: bulkSlot.end_time,
      day_of_week: day,
      class_id: bulkSlot.class_id
    }));

    setForm(prev => ({
      ...prev,
      time_slots: [...prev.time_slots, ...newSlots]
    }));

    // Reset some fields but keep subject/time for easy repetitive add
    setBulkSlot(prev => ({ ...prev, days: [] }));
  };

  const changeSlot = (
    index: number,
    field: keyof Omit<TimetableCreate['time_slots'][number], 'id'>,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      time_slots: prev.time_slots.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot)),
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{timetableToEdit ? 'Edit Timetable' : 'Create Timetable'}</DialogTitle>
          <DialogDescription>Configure details and schedule classes.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="timeslots">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Standard Timetable"
              />
            </div>

            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Select
                value={form.academic_year_id}
                onValueChange={(v) => setForm((prev) => ({ ...prev, academic_year_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name} {y.is_current ? '(current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Grade</Label>
                <Select
                  value={form.grade_id}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, grade_id: v, section_id: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={form.section_id}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, section_id: v }))}
                  disabled={!form.grade_id || sections.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={sections.length === 0 ? "No sections available" : "Select section"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Leaving this empty applies to all sections (template).</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_active: Boolean(checked) }))
                }
                id="is_active"
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </TabsContent>

          <TabsContent value="timeslots" className="space-y-6 pt-4">
            {/* Quick Add Section */}
            <div className="p-4 border border-indigo-100 rounded-xl bg-indigo-50/30 space-y-4 shadow-sm transition-all hover:shadow-md">
              <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">1</span>
                Quick Add (Multi-Day Support)
              </h4>
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-xs font-semibold text-indigo-700">Label (Optional)</Label>
                  <Input
                    placeholder="e.g. Period 1"
                    value={bulkSlot.name}
                    onChange={e => setBulkSlot(prev => ({ ...prev, name: e.target.value }))}
                    className="h-9 bg-white"
                  />
                </div>
                <div className="col-span-4 space-y-1.5">
                  <Label className="text-xs font-semibold text-indigo-700">Subject/Teacher</Label>
                  <Select value={bulkSlot.class_id} onValueChange={v => setBulkSlot(prev => ({ ...prev, class_id: v }))}>
                    <SelectTrigger className="h-9 bg-white">
                      <SelectValue placeholder="Choose Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSubjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.subject_name || 'Unknown Subject'} ({s.teacher_name || 'No Teacher'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-indigo-700">Start Time</Label>
                  <Input type="time" value={bulkSlot.start_time} onChange={e => setBulkSlot(prev => ({ ...prev, start_time: e.target.value }))} className="h-9 bg-white" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-indigo-700">End Time</Label>
                  <Input type="time" value={bulkSlot.end_time} onChange={e => setBulkSlot(prev => ({ ...prev, end_time: e.target.value }))} className="h-9 bg-white" />
                </div>
                <div className="col-span-1">
                  <Button onClick={handleBulkAdd} className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 shadow-sm" disabled={!bulkSlot.class_id || bulkSlot.days.length === 0}>
                    Add
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-indigo-700">Select Days</Label>
                <div className="flex flex-wrap gap-2">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                    <div key={day} className="flex items-center space-x-1 bg-white px-2 py-1.5 rounded-md border border-indigo-100 transition-all hover:bg-indigo-50">
                      <Checkbox
                        id={`bulk-${day}`}
                        checked={bulkSlot.days.includes(day)}
                        onCheckedChange={checked => {
                          setBulkSlot(prev => ({
                            ...prev,
                            days: checked ? [...prev.days, day] : prev.days.filter(d => d !== day)
                          }));
                        }}
                        className="data-[state=checked]:bg-indigo-600 border-indigo-200"
                      />
                      <Label htmlFor={`bulk-${day}`} className="text-xs font-medium cursor-pointer capitalize">
                        {day.substring(0, 3)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 px-1">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-600 text-[10px] text-white">2</span>
                Individual Slots List
              </h4>
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-500 px-1">
                <div className="col-span-2">Label</div>
                <div className="col-span-2">Day</div>
                <div className="col-span-2">Time</div>
                <div className="col-span-5">Subject (Class)</div>
                <div className="col-span-1">Action</div>
              </div>

              {form.time_slots.map((slot, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                  {/* Label */}
                  <div className="col-span-2">
                    <Input
                      value={slot.name}
                      onChange={(e) => changeSlot(idx, 'name', e.target.value)}
                      placeholder="e.g. Period 1"
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Day */}
                  <div className="col-span-2">
                    <Select
                      value={slot.day_of_week}
                      onValueChange={(v) => changeSlot(idx, 'day_of_week', v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => (
                          <SelectItem key={d} value={d}>
                            {d.charAt(0).toUpperCase() + d.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Time Range */}
                  <div className="col-span-2 flex flex-col gap-1">
                    <Input
                      type="time"
                      value={slot.start_time}
                      onChange={(e) => changeSlot(idx, 'start_time', e.target.value)}
                      className="h-7 text-xs"
                    />
                    <Input
                      type="time"
                      value={slot.end_time}
                      onChange={(e) => changeSlot(idx, 'end_time', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>

                  {/* Subject Dropdown */}
                  <div className="col-span-5">
                    <Select
                      value={slot.class_id}
                      onValueChange={(v) => changeSlot(idx, 'class_id', v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select Subject..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSubjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.subject_name || 'Unknown Subject'} {s.teacher_name ? `(${s.teacher_name})` : '(No Teacher)'}
                          </SelectItem>
                        ))}
                        {availableSubjects.length === 0 && <SelectItem value="none" disabled>No subjects found for this grade</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Remove */}
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => removeSlot(idx)} className="text-red-500 h-8 w-8 p-0">
                      X
                    </Button>
                  </div>
                </div>
              ))}

              <Button onClick={addSlot} variant="outline" className="w-full mt-2 border-dashed">
                + Add Schedule Slot
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={loading}>Save Timetable</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
