import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ContactInfoData {
  whatsappNumber?: string;
  emergencyContact?: string;
}
interface ContactInfoErrors {
  emergencyContact?: string;
}
interface ContactInfoSectionProps {
  formData: ContactInfoData;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors: ContactInfoErrors;
}

export const ContactInfoSection = ({ formData, handleInputChange, errors }: ContactInfoSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
        <Input
          id="whatsappNumber"
          name="whatsappNumber"
          value={formData.whatsappNumber || ''}
          onChange={handleInputChange}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="emergencyContact">Emergency Contact *</Label>
        <Input
          id="emergencyContact"
          name="emergencyContact"
          value={formData.emergencyContact || ''}
          onChange={handleInputChange}
          className={errors.emergencyContact ? 'border-red-500' : ''}
        />
        {errors.emergencyContact && <p className="text-red-500 text-sm">{errors.emergencyContact}</p>}
      </div>
    </div>
  );
};
