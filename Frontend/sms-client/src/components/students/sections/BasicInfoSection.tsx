import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BasicInfoData {
  firstName?: string;
  lastName?: string;
  email?: string;
}
interface BasicInfoErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
}
interface BasicInfoSectionProps {
  formData: BasicInfoData;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors: BasicInfoErrors;
}

export const BasicInfoSection = ({ formData, handleInputChange, errors }: BasicInfoSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="firstName">First Name *</Label>
        <Input
          id="firstName"
          name="firstName"
          value={formData.firstName || ''}
          onChange={handleInputChange}
          className={errors.firstName ? 'border-red-500' : ''}
        />
        {errors.firstName && <p className="text-red-500 text-sm">{errors.firstName}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="lastName">Last Name *</Label>
        <Input
          id="lastName"
          name="lastName"
          value={formData.lastName || ''}
          onChange={handleInputChange}
          className={errors.lastName ? 'border-red-500' : ''}
        />
        {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName}</p>}
      </div>
      
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email || ''}
          onChange={handleInputChange}
          className={errors.email ? 'border-red-500' : ''}
        />
        {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
      </div>
    </div>
  );
};
