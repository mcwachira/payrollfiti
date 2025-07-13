import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calculator, FileCheck, DollarSign } from 'lucide-react';
const ComplianceSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Kenya Statutory Compliance Made Simple
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stay compliant with all Kenyan tax and statutory requirements
            automatically
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* PAYE */}
          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="bg-blue-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <DollarSign className="h-6 w-6 text-white" />
            </div>

            <h3 className="text-xl font-semibold text-foreground mb-3">
              PAYE Tax
            </h3>
            <p className="text-muted-foreground mb-4">
              Automatic calculation of Pay As You Earn tax with current KRA
              brackets
            </p>

            <div className="space-y-2">
              <Badge variant="secondary">0-24,000: 10%</Badge>
              <Badge variant="secondary">24,001-32,333: 25%</Badge>
              <Badge variant="secondary">32,334+: 30%</Badge>
            </div>
          </Card>

          {/* NSSF */}
          <Card className="p-6 bg-green-50 border-green-200">
            <div className="bg-green-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <FileCheck className="h-6 w-6 text-white" />
            </div>

            <h3 className="text-xl font-semibold text-foreground mb-3">NSSF</h3>
            <p className="text-muted-foreground mb-4">
              Tier I & II contributions calculated automatically
            </p>

            <div className="space-y-2">
              <Badge variant="secondary">Tier I: KES 360</Badge>
              <Badge variant="secondary">Tier II: 12% of pensionable pay</Badge>
            </div>
          </Card>

          {/* NHIF */}
          <Card className="p-6 bg-orange-50 border-orange-200">
            <div className="bg-orange-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Calculator className="h-6 w-6 text-white" />
            </div>

            <h3 className="text-xl font-semibold text-foreground mb-3">NHIF</h3>
            <p className="text-muted-foreground mb-4">
              Health insurance contributions based on salary bands
            </p>

            <div className="space-y-2">
              <Badge variant="secondary">Salary-based rates</Badge>
              <Badge variant="secondary">Auto-updated annually</Badge>
            </div>
          </Card>
        </div>

        <div className="text-center">
          <Button size="lg" className="bg-primary hover:bg-primary/90">
            Try Our Compliance Calculator
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ComplianceSection;
