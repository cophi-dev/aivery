import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import TermsAndConditions from './TermsAndConditions';
import PrivacyPolicy from './PrivacyPolicy';
import Impressum from './Impressum';

type LegalDocumentType = 'terms' | 'privacy' | 'impressum';

interface LegalModalProps {
  documentType: LegalDocumentType;
  trigger?: React.ReactNode;
  className?: string;
  buttonVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
}

const documentTitles: Record<LegalDocumentType, string> = {
  terms: 'Terms and Conditions',
  privacy: 'Privacy Policy',
  impressum: 'Impressum',
};

const LegalModal: React.FC<LegalModalProps> = ({
  documentType,
  trigger,
  className,
  buttonVariant = 'link',
  buttonSize = 'sm',
}) => {
  const renderDocument = () => {
    switch (documentType) {
      case 'terms':
        return <TermsAndConditions />;
      case 'privacy':
        return <PrivacyPolicy />;
      case 'impressum':
        return <Impressum />;
      default:
        return <div>Document not found</div>;
    }
  };

  const defaultTrigger = (
    <Button variant={buttonVariant} size={buttonSize} className={className} type="button">
      {documentTitles[documentType]}
    </Button>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto max-w-4xl">
        <DialogHeader>
          <DialogTitle>{documentTitles[documentType]}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {renderDocument()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LegalModal; 