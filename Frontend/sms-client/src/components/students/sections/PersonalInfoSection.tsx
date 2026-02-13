import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PersonalInfoData {
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
}
interface PersonalInfoErrors {
  dateOfBirth?: string;
  gender?: string;
}
interface PersonalInfoSectionProps {
  formData: PersonalInfoData;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  errors: PersonalInfoErrors;
}

export const PersonalInfoSection = ({ formData, handleInputChange, handleSelectChange, errors }: PersonalInfoSectionProps) => {
  console.log('PersonalInfoSection - formData.gender:', formData.gender);
  console.log('PersonalInfoSection - formData.bloodGroup:', formData.bloodGroup);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">Date of Birth *</Label>
        <Input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          value={formData.dateOfBirth || ''}
          onChange={handleInputChange}
          className={errors.dateOfBirth ? 'border-red-500' : ''}
        />
        {errors.dateOfBirth && <p className="text-red-500 text-sm">{errors.dateOfBirth}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="gender">Gender *</Label>
        <Select key={`gender-${formData.gender}`} value={formData.gender || ''} onValueChange={(value) => handleSelectChange('gender', value)}>
          <SelectTrigger className={errors.gender ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
          </SelectContent>
        </Select>
        {errors.gender && <p className="text-red-500 text-sm">{errors.gender}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="bloodGroup">Blood Group</Label>
        <Select key={`bloodGroup-${formData.bloodGroup}`} value={formData.bloodGroup || ''} onValueChange={(value) => handleSelectChange('bloodGroup', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select blood group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A+">A+</SelectItem>
            <SelectItem value="A-">A-</SelectItem>
            <SelectItem value="B+">B+</SelectItem>
            <SelectItem value="B-">B-</SelectItem>
            <SelectItem value="AB+">AB+</SelectItem>
            <SelectItem value="AB-">AB-</SelectItem>
            <SelectItem value="O+">O+</SelectItem>
            <SelectItem value="O-">O-</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="nationality">Nationality</Label>
        <Input
          id="nationality"
          name="nationality"
          value={formData.nationality || ''}
          onChange={handleInputChange}
        />
      </div>
      
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="religion">Religion</Label>
        <Input
          id="religion"
          name="religion"
          value={formData.religion || ''}
          onChange={handleInputChange}
        />
      </div>
    </div>
  );
};
