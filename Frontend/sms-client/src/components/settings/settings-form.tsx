'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'color';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

type SettingValues = string | number | boolean;

interface SettingsFormProps {
  title: string;
  description?: string;
  fields: FormField[];
  initialValues: Record<string, SettingValues>;
  onSubmit: (values: Record<string, SettingValues>) => void;
  isLoading?: boolean;
}

export default function SettingsForm({
  title,
  description,
  fields,
  initialValues,
  onSubmit,
  isLoading = false,
}: SettingsFormProps) {
  const [values, setValues] = useState<Record<string, SettingValues>>(initialValues);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setValues(prevValues => ({
    ...prevValues,
    [name]: type === 'checkbox' ? Boolean(checked) : value,
  }));
};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fields.map((field) => (
              <div key={field.id} className="space-y-2">
                {field.type === 'checkbox' ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={field.id}
                      name={field.id}
                      checked={Boolean(values[field.id])}
                      onChange={handleChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <Label htmlFor={field.id}>{field.label}</Label>
                  </div>
                ) : (
                  <>
                    <Label htmlFor={field.id}>{field.label}</Label>
                    {field.type === 'select' ? (
                      <select
                        id={field.id}
                        name={field.id}
                        value={String(values[field.id]) || ''}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={field.type}
                        id={field.id}
                        name={field.id}
                        value={String(values[field.id]) || ''}
                        onChange={handleChange}
                        placeholder={field.placeholder}
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}