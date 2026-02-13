import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface AddressInfoData {
  address?: string;
  city?: string;
  county?: string;
  country?: string;
}
interface AddressErrors {
  address?: string;
  city?: string;
  country?: string;
}
interface AddressInfoSectionProps {
  formData: AddressInfoData;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  errors: AddressErrors;
}

export const AddressInfoSection = ({ formData, handleInputChange, errors }: AddressInfoSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="address">Address *</Label>
        <Textarea
          id="address"
          name="address"
          value={formData.address || ''}
          onChange={handleInputChange}
          className={errors.address ? 'border-red-500' : ''}
          rows={3}
        />
        {errors.address && <p className="text-red-500 text-sm">{errors.address}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="city">City *</Label>
        <Input
          id="city"
          name="city"
          value={formData.city || ''}
          onChange={handleInputChange}
          className={errors.city ? 'border-red-500' : ''}
        />
        {errors.city && <p className="text-red-500 text-sm">{errors.city}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="county">County</Label>
        <Input
          id="county"
          name="county"
          value={formData.county || ''}
          onChange={handleInputChange}
        />
      </div>
      
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="country">Country *</Label>
        <Input
          id="country"
          name="country"
          value={formData.country || ''}
          onChange={handleInputChange}
          className={errors.country ? 'border-red-500' : ''}
        />
        {errors.country && <p className="text-red-500 text-sm">{errors.country}</p>}
      </div>
    </div>
  );
};
