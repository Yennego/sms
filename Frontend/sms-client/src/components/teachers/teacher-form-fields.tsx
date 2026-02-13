'use client';

import { TeacherCreate, TeacherUpdate } from '@/types/teacher';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

interface TeacherFormFieldsProps {
  formData: TeacherCreate | TeacherUpdate;
  onInputChange: (field: string, value: string | boolean | number) => void;
//   mode?: 'create' | 'edit';
}

export function TeacherFormFields({ formData, onInputChange }: TeacherFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Personal Information</h3>
        
        <div>
          <Label htmlFor="first_name">First Name *</Label>
          <Input
            id="first_name"
            value={formData.first_name || ''}
            onChange={(e) => onInputChange('first_name', e.target.value)}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="last_name">Last Name *</Label>
          <Input
            id="last_name"
            value={formData.last_name || ''}
            onChange={(e) => onInputChange('last_name', e.target.value)}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email || ''}
            onChange={(e) => onInputChange('email', e.target.value)}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="phone_number">Phone Number</Label>
          <Input
            id="phone_number"
            value={formData.phone_number || ''}
            onChange={(e) => onInputChange('phone_number', e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
          <Input
            id="whatsapp_number"
            value={formData.whatsapp_number || ''}
            onChange={(e) => onInputChange('whatsapp_number', e.target.value)}
            placeholder="For receiving login credentials"
          />
        </div>
        
        <div>
          <Label htmlFor="gender">Gender</Label>
          <Select value={formData.gender || ''} onValueChange={(value) => onInputChange('gender', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Professional Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Professional Information</h3>
        
        <div>
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            value={formData.department || ''}
            onChange={(e) => onInputChange('department', e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="qualification">Qualification</Label>
          <Input
            id="qualification"
            value={formData.qualification || ''}
            onChange={(e) => onInputChange('qualification', e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="joining_date">Joining Date</Label>
          <Input
            id="joining_date"
            type="date"
            value={formData.joining_date || ''}
            onChange={(e) => onInputChange('joining_date', e.target.value)}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_class_teacher"
            checked={formData.is_class_teacher || false}
            onCheckedChange={(checked) => onInputChange('is_class_teacher', checked as boolean)}
          />
          <Label htmlFor="is_class_teacher">Is Class Teacher</Label>
        </div>
      </div>
      
      {/* Address Information */}
      <div className="md:col-span-2 space-y-4">
        <h3 className="text-lg font-semibold">Address Information</h3>
        
        <div>
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            value={formData.address || ''}
            onChange={(e) => onInputChange('address', e.target.value)}
            rows={3}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city || ''}
              onChange={(e) => onInputChange('city', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="county">County</Label>
            <Input
              id="county"
              value={formData.county || ''}
              onChange={(e) => onInputChange('county', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={formData.country || ''}
              onChange={(e) => onInputChange('country', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}