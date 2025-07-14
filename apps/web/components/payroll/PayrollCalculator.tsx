
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calculator, Save, Eye, FileText } from 'lucide-react';
import { calculatePayroll, formatCurrency, PayrollInputs, PayrollResult } from '@/utils/payrollCalculations';

interface PayrollCalculatorProps {
  employeeId?: string;
  employeeName?: string;
  defaultSalary?: number;
  onSave?: (calculation: PayrollResult) => void;
}


const PayrollCalculator = ({employeeId, employeeName,defaultSalary=0, onSave}:PayrollCalculatorProps) {

    const [inputs, setInputs] = useState<PayrollInputs>({
    basicSalary: defaultSalary,
    transportAllowance: 0,
    housingAllowance: 0,
    medicalAllowance: 0,
    overtimeAmount: 0,
    commissionAmount: 0,
    bonusAmount: 0,
    otherAllowances: 0,
    saccoDeduction: 0,
    helbDeduction: 0,
    pensionDeduction: 0,
    loanDeductions: 0,
    otherDeductions: 0
  });

  const [calculation, setCalculation] = useState<PayrollResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);


  const handleInputChange = (field: keyof PayrollInputs, value: string) => {
    const numValue = parseFloat(value) || 0;
    setInputs(prev => ({ ...prev, [field]: numValue }));
  };

  const handleCalculate = () => {
    setIsCalculating(true);
    setTimeout(() => {
      const result = calculatePayroll(inputs);
      setCalculation(result);
      setIsCalculating(false);
    }, 500);
  };

const handleSave = () => {
    if (calculation && onSave) {
      onSave(calculation);
    }
  };

  // Auto-calculate when inputs change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputs.basicSalary > 0) {
        const result = calculatePayroll(inputs);
        setCalculation(result);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputs]);

   return (
    <div className="space-y-6">
      {employeeName && (
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Payroll Calculation</h2>
          <Badge variant="outline">{employeeName}</Badge>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Salary Components
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Salary */}
            <div className="space-y-2">
              <Label htmlFor="basicSalary">Basic Salary *</Label>
              <Input
                id="basicSalary"
                type="number"
                value={inputs.basicSalary}
                onChange={(e) => handleInputChange('basicSalary', e.target.value)}
                placeholder="Enter basic salary"
              />
            </div>

            <Separator />

            {/* Allowances */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">ALLOWANCES</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transportAllowance">Transport</Label>
                  <Input
                    id="transportAllowance"
                    type="number"
                    value={inputs.transportAllowance}
                    onChange={(e) => handleInputChange('transportAllowance', e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="housingAllowance">Housing</Label>
                  <Input
                    id="housingAllowance"
                    type="number"
                    value={inputs.housingAllowance}
                    onChange={(e) => handleInputChange('housingAllowance', e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medicalAllowance">Medical</Label>
                  <Input
                    id="medicalAllowance"
                    type="number"
                    value={inputs.medicalAllowance}
                    onChange={(e) => handleInputChange('medicalAllowance', e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overtimeAmount">Overtime</Label>
                  <Input
                    id="overtimeAmount"
                    type="number"
                    value={inputs.overtimeAmount}
                    onChange={(e) => handleInputChange('overtimeAmount', e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commissionAmount">Commission</Label>
                  <Input
                    id="commissionAmount"
                    type="number"
                    value={inputs.commissionAmount}
                    onChange={(e) => handleInputChange('commissionAmount', e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bonusAmount">Bonus</Label>
                  <Input
                    id="bonusAmount"
                    type="number"
                    value={inputs.bonusAmount}
                    onChange={(e) => handleInputChange('bonusAmount', e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otherAllowances">Other Allowances</Label>
                <Input
                  id="otherAllowances"
                  type="number"
                  value={inputs.otherAllowances}
                  onChange={(e) => handleInputChange('otherAllowances', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <Separator />

            {/* Voluntary Deductions */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">VOLUNTARY DEDUCTIONS</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="saccoDeduction">SACCO</Label>
                  <Input
                    id="saccoDeduction"
                    type="number"
                    value={inputs.saccoDeduction}
                    onChange={(e) => handleInputChange('saccoDeduction', e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="helbDeduction">HELB</Label>
                  <Input
                    id="helbDeduction"
                    type="number"
                    value={inputs.helbDeduction}
                    onChange={(e) => handleInputChange('helbDeduction', e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pensionDeduction">Pension</Label>
                  <Input
                    id="pensionDeduction"
                    type="number"
                    value={inputs.pensionDeduction}
                    onChange={(e) => handleInputChange('pensionDeduction', e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loanDeductions">Loans</Label>
                  <Input
                    id="loanDeductions"
                    type="number"
                    value={inputs.loanDeductions}
                    onChange={(e) => handleInputChange('loanDeductions', e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otherDeductions">Other Deductions</Label>
                <Input
                  id="otherDeductions"
                  type="number"
                  value={inputs.otherDeductions}
                  onChange={(e) => handleInputChange('otherDeductions', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleCalculate} disabled={isCalculating} className="flex-1">
                <Calculator className="mr-2 h-4 w-4" />
                {isCalculating ? 'Calculating...' : 'Calculate'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {calculation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Payroll Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Gross Pay */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Basic Salary</span>
                  <span className="font-medium">{formatCurrency(calculation.basicSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Allowances</span>
                  <span className="font-medium">{formatCurrency(calculation.totalAllowances)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Gross Pay</span>
                  <span>{formatCurrency(calculation.totalGross)}</span>
                </div>
              </div>

              <Separator />

              {/* Statutory Deductions */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">STATUTORY DEDUCTIONS</h4>
                <div className="flex justify-between text-sm">
                  <span>PAYE Tax</span>
                  <span className="text-red-600">-{formatCurrency(calculation.payeTax)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>NSSF (Employee)</span>
                  <span className="text-red-600">-{formatCurrency(calculation.nssfEmployee)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>NHIF</span>
                  <span className="text-red-600">-{formatCurrency(calculation.nhifDeduction)}</span>
                </div>
              </div>

              {/* Voluntary Deductions */}
              {calculation.totalVoluntaryDeductions > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground">VOLUNTARY DEDUCTIONS</h4>
                    {calculation.breakdown.saccoDeduction > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>SACCO</span>
                        <span className="text-red-600">-{formatCurrency(calculation.breakdown.saccoDeduction)}</span>
                      </div>
                    )}
                    {calculation.breakdown.helbDeduction > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>HELB</span>
                        <span className="text-red-600">-{formatCurrency(calculation.breakdown.helbDeduction)}</span>
                      </div>
                    )}
                    {calculation.breakdown.pensionDeduction > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Pension</span>
                        <span className="text-red-600">-{formatCurrency(calculation.breakdown.pensionDeduction)}</span>
                      </div>
                    )}
                    {calculation.breakdown.loanDeductions > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Loans</span>
                        <span className="text-red-600">-{formatCurrency(calculation.breakdown.loanDeductions)}</span>
                      </div>
                    )}
                    {calculation.breakdown.otherDeductions > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Other</span>
                        <span className="text-red-600">-{formatCurrency(calculation.breakdown.otherDeductions)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              {/* Total Deductions & Net Pay */}
              <div className="space-y-2">
                <div className="flex justify-between font-medium">
                  <span>Total Deductions</span>
                  <span className="text-red-600">-{formatCurrency(calculation.totalDeductions)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold bg-green-50 p-3 rounded-lg">
                  <span>Net Pay</span>
                  <span className="text-green-700">{formatCurrency(calculation.netPay)}</span>
                </div>
              </div>

              <Separator />

              {/* Employer Contributions */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">EMPLOYER CONTRIBUTIONS</h4>
                <div className="flex justify-between text-sm">
                  <span>NSSF (Employer)</span>
                  <span className="text-blue-600">{formatCurrency(calculation.nssfEmployer)}</span>
                </div>
              </div>

              {onSave && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSave} className="flex-1">
                    <Save className="mr-2 h-4 w-4" />
                    Save Calculation
                  </Button>
                  <Button variant="outline">
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Payslip
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}


export default PayrollCalculator